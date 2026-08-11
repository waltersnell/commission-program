import Link from "next/link";
import { getFormOptions, getMembershipSales } from "@/lib/data";
import { dateInputValue, displayStatus, formatBasisPointsPercent, formatCreditBasisPoints, monthKey } from "@/lib/format";
import { sumCreditBasisPoints } from "@/lib/commission";
import { findStaffForUser } from "@/lib/current-staff";
import { canManage } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const canSeeAll = canManage(user?.role ?? "");
  const visibleStaff = canSeeAll ? null : await findStaffForUser(user);
  const [sales, { locations, staff }] = await Promise.all([
    getMembershipSales(params, user, canSeeAll ? null : visibleStaff?.id ?? "__no_matching_staff__"),
    getFormOptions(),
  ]);

  return (
    <div className="page-shell">
      <div>
        <h1 className="page-title">Membership Sales</h1>
        <p className="text-[var(--text-muted)]">Pending sales wait for administrator approval before they count toward final commission.</p>
      </div>
      {canSeeAll ? (
        <form className="card card-soft grid gap-3 p-4 md:grid-cols-6">
          <input className="field" type="month" name="month" defaultValue={scalar(params.month) ?? monthKey()} />
          <select className="field" name="locationId" defaultValue={scalar(params.locationId) ?? ""}>
            <option value="">All locations</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
          </select>
          <select className="field" name="primaryId" defaultValue={scalar(params.primaryId) ?? ""}>
            <option value="">Primary closer</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
          </select>
          <select className="field" name="supportId" defaultValue={scalar(params.supportId) ?? ""}>
            <option value="">Support closer</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
          </select>
          <select className="field" name="approvalStatus" defaultValue={scalar(params.approvalStatus) ?? ""}>
            <option value="">All approvals</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button className="button-primary" type="submit">Filter</button>
        </form>
      ) : (
        <form className="card card-soft flex flex-wrap items-end gap-3 p-4">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Month</span>
            <input className="field" type="month" name="month" defaultValue={scalar(params.month) ?? monthKey()} />
          </label>
          <button className="button-primary" type="submit">View month</button>
        </form>
      )}

      <section className="card p-4">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Date</th>
                <th>Location</th>
                <th>Membership</th>
                <th>Primary</th>
                <th>Support</th>
                <th>Credits</th>
                <th>Total Credit</th>
                <th>First Visit</th>
                <th>Approval</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <Link href={`/opportunities/${sale.opportunityId}`} className="font-semibold text-[var(--teal)]">
                      {sale.opportunity.client.firstName} {sale.opportunity.client.lastName}
                    </Link>
                  </td>
                  <td>{dateInputValue(sale.membershipSaleDate)}</td>
                  <td>{sale.location.code}</td>
                  <td>{sale.membershipType.name}</td>
                  <td>{sale.finalPrimaryCloser.displayName}</td>
                  <td>{sale.finalSupportCloser?.displayName ?? "-"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {sale.credits.map((credit) => (
                        <span key={credit.id} className="badge badge-gray">{credit.staff.displayName} {formatBasisPointsPercent(credit.creditBasisPoints)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="font-semibold">{formatCreditBasisPoints(sumCreditBasisPoints(sale.credits))}</td>
                  <td>{sale.isFirstVisitSale ? <span className="badge badge-orange">Yes</span> : "No"}</td>
                  <td><ApprovalBadge status={sale.approvalStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sales.length === 0 ? <p className="empty-state mt-4">No membership sales match these filters.</p> : null}
      </section>
    </div>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const isApproved = status === "APPROVED";
  const isRejected = status === "REJECTED";
  const label = status === "PENDING" ? "Pending" : displayStatus(status);
  return <span className={`badge ${isApproved ? "badge-teal" : isRejected ? "badge-gray" : "badge-orange"}`}>{label}</span>;
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
