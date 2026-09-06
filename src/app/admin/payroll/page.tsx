import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "../admin-nav";
import { PrintButton } from "./print-button";
import { getPayrollReport } from "@/lib/data";
import {
  displayStatus,
  formatBasisPointsPercent,
  formatCreditBasisPoints,
  formatDisplayDate,
  formatMoney,
} from "@/lib/format";
import { parsePayrollRange, type PayrollStaffReport } from "@/lib/payroll";
import { canAdmin } from "@/lib/roles";
import { getCurrentRole } from "@/lib/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RunPayrollPage({ searchParams }: PageProps) {
  const [role, params] = await Promise.all([getCurrentRole(), searchParams]);
  if (!canAdmin(role)) {
    redirect("/");
  }
  const from = scalar(params.from);
  const until = scalar(params.until);
  const parsed = parsePayrollRange(from, until);
  const report = parsed.range ? await getPayrollReport(parsed.range) : null;

  return (
    <div className="page-shell payroll-report">
      <div className="no-print">
        <h1 className="page-title">Run Payroll</h1>
        <p className="text-[var(--text-muted)]">Review commission earnings for an inclusive payroll date range. This report does not approve, finalize, or pay transactions.</p>
      </div>
      <AdminNav active="payroll" />

      <form className="card card-soft grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end no-print">
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Payroll period from</span>
          <input className="field" type="date" name="from" defaultValue={from ?? ""} required />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Payroll period until</span>
          <input className="field" type="date" name="until" defaultValue={until ?? ""} required />
        </label>
        <button className="button-primary" type="submit">Run Payroll Report</button>
      </form>

      {parsed.error ? <p className="message border-[var(--orange)] no-print">{parsed.error}</p> : null}
      {!from && !until ? <p className="empty-state no-print">Select the beginning and ending dates to review payroll.</p> : null}

      {report ? (
        <>
          <div className="page-header payroll-print-heading">
            <div>
              <h2 className="section-title">Payroll Review</h2>
              <p className="text-sm text-[var(--text-muted)]">{formatDisplayDate(report.range.start)} through {formatDisplayDate(new Date(report.range.endExclusive.getTime() - 86_400_000))}</p>
            </div>
            <div className="flex flex-wrap gap-2 no-print">
              <PrintButton />
              <Link className="button-secondary" href={`/admin/payroll/export?from=${report.range.from}&until=${report.range.until}`}>Export CSV</Link>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Summary label="Approved payroll" value={formatMoney(report.approvedCents)} />
            <Summary label="Pending approval" value={formatMoney(report.pendingCents)} warn={report.pendingCents > 0} />
            <Summary label="Rejected / excluded" value={formatMoney(report.rejectedCents)} />
            <Summary label="Total reviewed" value={formatMoney(report.reviewedCents)} />
            <Summary label="Commissioned staff" value={String(report.commissionedStaffCount)} />
            <Summary label="Commission entries" value={String(report.transactionCount)} />
          </section>

          <section className="card p-4">
            <div className="mb-3">
              <h2 className="section-title">Payroll Summary by Person</h2>
              <p className="text-sm text-[var(--text-muted)]">Approved is payable. Pending is estimated for review. Rejected is excluded.</p>
            </div>
            {report.staff.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Commissioned member</th><th>Role</th><th>Approved</th><th>Pending</th><th>Rejected</th><th>Total reviewed</th><th>Status</th></tr></thead>
                  <tbody>
                    {report.staff.map((person) => (
                      <tr key={person.staffId}>
                        <td className="font-semibold"><a href={`#staff-${person.staffId}`}>{person.staffName}</a>{!person.active ? <span className="ml-2 badge badge-gray">Inactive</span> : null}</td>
                        <td>{displayStatus(person.staffRole)}</td>
                        <td className="mono-num">{formatMoney(person.approvedCents)}</td>
                        <td className="mono-num">{formatMoney(person.pendingCents)}</td>
                        <td className="mono-num">{formatMoney(person.rejectedCents)}</td>
                        <td className="mono-num font-semibold">{formatMoney(person.reviewedCents)}</td>
                        <td><PayrollStatus status={person.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="empty-state">No commission earnings were found for this payroll period.</p>}
          </section>

          {report.staff.map((person) => <PersonDetail key={person.staffId} person={person} />)}
        </>
      ) : null}
    </div>
  );
}

function PersonDetail({ person }: { person: PayrollStaffReport }) {
  return (
    <details id={`staff-${person.staffId}`} className="card payroll-person p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div><h2 className="section-title">{person.staffName}</h2><p className="text-sm text-[var(--text-muted)]">{displayStatus(person.staffRole)} commission detail</p></div>
          <div className="flex flex-wrap items-center gap-2"><PayrollStatus status={person.status} /><span className="font-bold mono-num">Approved {formatMoney(person.approvedCents)}</span></div>
        </div>
      </summary>

      {person.membershipItems.length > 0 ? (
        <div className="mt-5">
          <h3 className="mb-2 font-bold">Membership Commissions</h3>
          <div className="table-wrap"><table className="data-table payroll-detail-table">
            <thead><tr><th>Client</th><th>Date</th><th>Location</th><th>Membership</th><th>Approval</th><th>Primary</th><th>Support</th><th>Share</th><th>Tier</th><th>Credits</th><th>Base</th><th>First Visit</th><th>Family Upgrade</th><th>Total</th></tr></thead>
            <tbody>{person.membershipItems.map((item) => (
              <tr key={item.id}>
                <td><Link className="font-semibold text-[var(--teal)]" href={`/opportunities/${item.opportunityId}`}>{item.clientName}</Link></td>
                <td>{formatDisplayDate(item.date)}</td><td>{item.locationCode}</td><td>{item.membershipType}</td>
                <td><ApprovalStatus status={item.approvalStatus} month={item.month} /></td>
                <td>{item.primaryCloser}</td><td>{item.supportCloser ?? "-"}</td><td>{formatBasisPointsPercent(item.payoutBasisPoints)}</td>
                <td>{item.tierLabel}</td><td>{formatCreditBasisPoints(item.creditBasisPoints)}</td>
                <td>{formatMoney(item.baseCommissionCents)}</td><td>{formatMoney(item.firstVisitBonusCents)}</td><td>{formatMoney(item.membershipSpiffCents)}</td>
                <td className="font-semibold mono-num">{formatMoney(item.amountCents)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : null}

      {person.specialSpiffItems.length > 0 ? (
        <div className="mt-5">
          <h3 className="mb-2 font-bold">Special Spiffs</h3>
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Client</th><th>Date</th><th>Location</th><th>Spiff</th><th>Function</th><th>Approval</th><th>Amount</th></tr></thead>
            <tbody>{person.specialSpiffItems.map((item) => (
              <tr key={item.id}><td>{item.clientName}</td><td>{formatDisplayDate(item.date)}</td><td>{item.locationCode}</td><td>{item.spiffName}</td><td>{item.functionDescription}</td><td><ApprovalStatus status={item.approvalStatus} month={item.month} /></td><td className="font-semibold mono-num">{formatMoney(item.amountCents)}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Approved payable" value={formatMoney(person.approvedCents)} />
        <Summary label="Pending estimate" value={formatMoney(person.pendingCents)} warn={person.pendingCents > 0} />
        <Summary label="Rejected / excluded" value={formatMoney(person.rejectedCents)} />
        <Summary label="Reviewed total" value={formatMoney(person.reviewedCents)} />
      </div>
    </details>
  );
}

function ApprovalStatus({ status, month }: { status: string; month: string }) {
  const badge = status === "APPROVED" ? "badge-teal" : status === "PENDING" ? "badge-orange" : "badge-red";
  return status === "PENDING"
    ? <Link className={`badge ${badge}`} href={`/month-end?month=${month}`}>Pending · Review</Link>
    : <span className={`badge ${badge}`}>{displayStatus(status)}</span>;
}

function PayrollStatus({ status }: { status: PayrollStaffReport["status"] }) {
  const badge = status === "READY" ? "badge-teal" : status === "NEEDS_APPROVAL" ? "badge-orange" : "badge-gray";
  return <span className={`badge ${badge}`}>{displayStatus(status)}</span>;
}

function Summary({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <div className="card p-4"><p className="text-sm font-semibold text-[var(--text-muted)]">{label}</p><p className={`mt-2 text-xl font-bold mono-num ${warn ? "text-[var(--orange)]" : ""}`}>{value}</p></div>;
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
