import Link from "next/link";
import { getFormOptions, getOpportunities } from "@/lib/data";
import { dateInputValue } from "@/lib/format";
import { canAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { findStaffForUser } from "@/lib/current-staff";
import { getOpportunityNextAction } from "@/lib/opportunity-next-action";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type OpportunityData = Awaited<ReturnType<typeof getOpportunities>>;
type OpportunityRow = OpportunityData["rows"][number];

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const isAdmin = canAdmin(user?.role ?? "");
  const visibleStaff = isAdmin ? null : await findStaffForUser(user);
  const visibleStaffId = visibleStaff?.id ?? "__no_matching_staff__";
  const [formOptions, opportunityData] = await Promise.all([
    getFormOptions(),
    isAdmin
      ? getOpportunities(params)
      : Promise.all([
          getOpportunities(params, visibleStaffId, "assigned"),
          getOpportunities(params, visibleStaffId, "other"),
        ]),
  ]);
  const adminData = isAdmin ? opportunityData as OpportunityData : null;
  const nonAdminData = isAdmin ? null : opportunityData as [OpportunityData, OpportunityData];

  const title = isAdmin ? "Open Opportunities" : "My Opportunities";

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="text-[var(--text-muted)]">
            {isAdmin
              ? `${adminData?.total ?? 0} matching client opportunities. Default page size is 25.`
              : "Open opportunities assigned to you. Select any row below to review or edit it."}
          </p>
        </div>
        <Link href="/clients/new" className="button-accent">
          Add client
        </Link>
      </div>

      {isAdmin ? (
        <form className="card card-soft grid gap-3 p-4 md:grid-cols-4">
          <input className="field" name="search" placeholder="Search name or phone" defaultValue={scalar(params.search) ?? ""} />
          <select className="field" name="locationId" defaultValue={scalar(params.locationId) ?? ""}>
            <option value="">All locations</option>
            {formOptions.locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
          </select>
          <select className="field" name="closerId" defaultValue={scalar(params.closerId) ?? ""}>
            <option value="">All closers</option>
            {formOptions.staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
          </select>
          <button className="button-primary" type="submit">Filter</button>
        </form>
      ) : null}

      {isAdmin ? (
        <OpportunitySection title="Open Opportunities" rows={adminData?.rows ?? []} emptyMessage="No opportunities match these filters." />
      ) : (
        <>
          <OpportunitySection title="My Opportunities" rows={nonAdminData?.[0]?.rows ?? []} emptyMessage="No open opportunities are assigned to you." />
          <OpportunitySection title="All Other Opportunities" rows={nonAdminData?.[1]?.rows ?? []} emptyMessage="No other open opportunities are available." />
        </>
      )}

      <Pagination
        page={adminData?.page ?? nonAdminData?.[0]?.page ?? 1}
        pageCount={adminData?.pageCount ?? Math.max(nonAdminData?.[0]?.pageCount ?? 1, nonAdminData?.[1]?.pageCount ?? 1)}
      />
    </div>
  );
}

function OpportunitySection({ title, rows, emptyMessage }: { title: string; rows: OpportunityRow[]; emptyMessage: string }) {
  return (
    <section className="card p-4">
      <h2 className="section-title mb-3">{title}</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>First Visit</th>
              <th>Location</th>
              <th>Primary</th>
              <th>Support</th>
              <th>Days Open</th>
              <th>Interest Level</th>
              <th>Next Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((opportunity) => (
              <tr key={opportunity.id} className={opportunity.daysOpen >= 14 ? "row-highlight-warn" : opportunity.daysOpen >= 7 ? "row-highlight-soft" : ""}>
                <td>
                  <Link href={`/opportunities/${opportunity.id}`} className="font-semibold text-[var(--teal)]">
                    {opportunity.client.firstName} {opportunity.client.lastName}
                  </Link>
                </td>
                <td>{dateInputValue(opportunity.client.firstVisitDate)}</td>
                <td>{opportunity.location.code}</td>
                <td>{opportunity.proposedPrimaryCloser.displayName}</td>
                <td>{opportunity.proposedSupportCloser?.displayName ?? "-"}</td>
                <td>{opportunity.daysOpen}</td>
                <td><InterestBadge level={opportunity.interestLevel} /></td>
                <td>
                  <NextAction
                    level={opportunity.interestLevel}
                    firstVisitDate={opportunity.client.firstVisitDate}
                    followUpStatus={opportunity.followUpStatus}
                    nextFollowUpDate={opportunity.nextFollowUpDate}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="empty-state mt-4">{emptyMessage}</p> : null}
    </section>
  );
}

function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  return (
    <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
      <span>Page {page} of {pageCount}</span>
      <div className="flex gap-2">
        <Link className="button-secondary" href={`/opportunities?page=${Math.max(1, page - 1)}`}>Previous</Link>
        <Link className="button-secondary" href={`/opportunities?page=${Math.min(pageCount, page + 1)}`}>Next</Link>
      </div>
    </div>
  );
}


function InterestBadge({ level }: { level: string }) {
  const className = level === "Hot" ? "badge-orange" : level === "Warm" ? "badge-teal" : "badge-gray";
  return <span className={`badge ${className}`}>{level}</span>;
}

function NextAction({
  level,
  firstVisitDate,
  followUpStatus,
  nextFollowUpDate,
}: {
  level: string;
  firstVisitDate: Date;
  followUpStatus?: string | null;
  nextFollowUpDate?: Date | null;
}) {
  const action = getOpportunityNextAction({ interestLevel: level, firstVisitDate, followUpStatus, nextFollowUpDate });
  if (!action) {
    return "-";
  }

  return (
    <div className="grid gap-1">
      <span className="font-semibold">{action.label}</span>
      {action.dueDate ? (
        <span className={action.isLate ? "font-semibold text-[var(--orange)]" : "text-[var(--text-muted)]"}>
          Due {dateInputValue(action.dueDate)}
        </span>
      ) : null}
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
