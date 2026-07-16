import Link from "next/link";
import { redirect } from "next/navigation";
import { approveSplitAction, finalizeMonthAction, reopenMonthAction } from "@/app/actions";
import { getMonthEndData } from "@/lib/data";
import { formatCreditBasisPoints, formatMoney, monthKey } from "@/lib/format";
import { canAdmin } from "@/lib/roles";
import { getCurrentRole } from "@/lib/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MonthEndPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const month = scalar(params.month) ?? monthKey();
  const role = await getCurrentRole();
  if (!canAdmin(role)) {
    redirect("/");
  }
  const data = await getMonthEndData(month);
  const error = scalar(params.error);
  const isFinalized = data.period?.status === "FINALIZED";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="page-title">Month-End Review</h1>
          <p className="text-[var(--text-muted)]">Resolve exceptions, approve pending sales, finalize, and export commission results.</p>
        </div>
        {isFinalized ? <Link className="button-secondary" href={`/month-end/export/${month}`}>Export CSV</Link> : null}
      </div>
      {error ? <p className="message border-[var(--orange)]">{error}</p> : null}

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Commission month</span>
          <input className="field" type="month" name="month" defaultValue={month} />
        </label>
        <button className="button-primary" type="submit">Review</button>
        <span className={isFinalized ? "badge badge-teal" : "badge badge-orange"}>{isFinalized ? "Finalized" : "Open"}</span>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        <ExceptionCard label="Pending approvals" value={data.pendingSplits.length} />
        <ExceptionCard label="Disputed records" value={data.disputes.length} />
        <ExceptionCard label="Invalid records" value={data.invalids.length} />
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Pending Sales</h2>
        <div className="space-y-3">
          {data.pendingSplits.map((sale) => (
            <form key={sale.id} action={approveSplitAction} className="flex flex-col gap-2 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
              <input type="hidden" name="saleId" value={sale.id} />
              <div>
                <p className="font-semibold">{sale.opportunity.client.firstName} {sale.opportunity.client.lastName}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  {sale.finalSupportCloser ? `${sale.finalPrimaryCloser.displayName} 70% / ${sale.finalSupportCloser.displayName} 30%` : `${sale.finalPrimaryCloser.displayName} 100%`}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="button-primary" name="approval" value="APPROVED">Approve</button>
                <button className="button-danger" name="approval" value="REJECTED">Reject</button>
              </div>
            </form>
          ))}
          {data.pendingSplits.length === 0 ? <p className="text-[var(--text-muted)]">No pending sales.</p> : null}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Final Totals</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Credits</th>
                <th>First Visit</th>
                <th>Base</th>
                <th>Bonus</th>
                <th>Final</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.map(({ staff, result }) => (
                <tr key={staff.id}>
                  <td className="font-semibold">{staff.displayName}</td>
                  <td>{formatCreditBasisPoints(result.totalCreditBasisPoints)}</td>
                  <td>{formatCreditBasisPoints(result.firstVisitCreditBasisPoints)}</td>
                  <td>{formatMoney(result.baseCommissionCents)}</td>
                  <td>{formatMoney(result.firstVisitBonusCents)}</td>
                  <td className="font-semibold">{formatMoney(result.finalCommissionCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!isFinalized ? (
            <form action={finalizeMonthAction}>
              <input type="hidden" name="month" value={month} />
              <button className="button-accent">Finalize month</button>
            </form>
          ) : (
            <form action={reopenMonthAction}>
              <input type="hidden" name="month" value={month} />
              <button className="button-secondary" disabled={!canAdmin(role)}>Reopen month</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function ExceptionCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--charcoal)]">{value}</p>
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
