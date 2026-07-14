import Link from "next/link";
import { getFormOptions, getOpportunities } from "@/lib/data";
import { dateInputValue, displayStatus } from "@/lib/format";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [{ rows, total, page, pageCount }, { locations, staff }] = await Promise.all([
    getOpportunities(params),
    getFormOptions(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="page-title">Open Opportunities</h1>
          <p className="text-[var(--text-muted)]">{total} matching client opportunities. Default page size is 25.</p>
        </div>
        <Link href="/clients/new" className="button-accent">
          Add client
        </Link>
      </div>

      <form className="card grid gap-3 p-4 md:grid-cols-5">
        <input className="field" name="search" placeholder="Search name or phone" defaultValue={scalar(params.search) ?? ""} />
        <select className="field" name="status" defaultValue={scalar(params.status) ?? ""}>
          <option value="">All statuses</option>
          {["OPEN", "MEMBERSHIP_SOLD", "CLOSED_NO_SALE", "INVALID", "DISPUTED"].map((status) => (
            <option key={status} value={status}>{displayStatus(status)}</option>
          ))}
        </select>
        <select className="field" name="locationId" defaultValue={scalar(params.locationId) ?? ""}>
          <option value="">All locations</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
        </select>
        <select className="field" name="closerId" defaultValue={scalar(params.closerId) ?? ""}>
          <option value="">All closers</option>
          {staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
        </select>
        <button className="button-primary" type="submit">Filter</button>
      </form>

      <section className="card p-4">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>First Visit</th>
                <th>Location</th>
                <th>Primary</th>
                <th>Days Open</th>
                <th>Interest Level</th>
                <th>Next Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((opportunity) => {
                return (
                  <tr key={opportunity.id} className={opportunity.daysOpen >= 14 ? "bg-[#fff8f3]" : opportunity.daysOpen >= 7 ? "bg-[#fffaf6]" : ""}>
                    <td>
                      <Link href={`/opportunities/${opportunity.id}`} className="font-semibold text-[var(--teal)]">
                        {opportunity.client.firstName} {opportunity.client.lastName}
                      </Link>
                    </td>
                    <td>{dateInputValue(opportunity.client.firstVisitDate)}</td>
                    <td>{opportunity.location.code}</td>
                    <td>{opportunity.proposedPrimaryCloser.displayName}</td>
                    <td>{opportunity.daysOpen}</td>
                    <td><InterestBadge level={opportunity.interestLevel} /></td>
                    <td>{displayStatus(opportunity.followUpStatus)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="py-8 text-center text-[var(--text-muted)]">No opportunities match these filters.</p> : null}
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
          <span>Page {page} of {pageCount}</span>
          <div className="flex gap-2">
            <Link className="button-secondary" href={`/opportunities?page=${Math.max(1, page - 1)}`}>Previous</Link>
            <Link className="button-secondary" href={`/opportunities?page=${Math.min(pageCount, page + 1)}`}>Next</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function InterestBadge({ level }: { level: string }) {
  const className = level === "Hot" ? "badge-orange" : level === "Warm" ? "badge-teal" : "badge-gray";
  return <span className={`badge ${className}`}>{level}</span>;
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
