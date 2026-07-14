import Link from "next/link";
import { getFormOptions, getMembershipSales } from "@/lib/data";
import { dateInputValue, displayStatus, formatCreditBasisPoints } from "@/lib/format";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [sales, { locations, staff }] = await Promise.all([getMembershipSales(params), getFormOptions()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Membership Sales</h1>
        <p className="text-[var(--text-muted)]">Approved sales count toward final commission; pending split approvals stay out of final results.</p>
      </div>
      <form className="card grid gap-3 p-4 md:grid-cols-6">
        <input className="field" type="month" name="month" defaultValue={scalar(params.month) ?? new Date().toISOString().slice(0, 7)} />
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
          <option value="PENDING_SPLIT_APPROVAL">Pending split</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button className="button-primary" type="submit">Filter</button>
      </form>

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
                        <span key={credit.id} className="badge badge-gray">{credit.staff.displayName} {formatCreditBasisPoints(credit.creditBasisPoints)}</span>
                      ))}
                    </div>
                  </td>
                  <td>{sale.isFirstVisitSale ? <span className="badge badge-orange">Yes</span> : "No"}</td>
                  <td><span className="badge badge-teal">{displayStatus(sale.approvalStatus)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sales.length === 0 ? <p className="py-8 text-center text-[var(--text-muted)]">No membership sales match these filters.</p> : null}
      </section>
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
