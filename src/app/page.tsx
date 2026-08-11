import Link from "next/link";
import { getDashboardData } from "@/lib/data";
import { displayStatus, formatCreditBasisPoints, formatMoney, longDateLabel } from "@/lib/format";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const data = await getDashboardData();
  const params = searchParams ? await searchParams : ({} as Record<string, string | string[] | undefined>);
  const message = scalar(params.message);
  const todayLabel = longDateLabel();
  const sortedCommissionSummary = [...data.commissionSummary].sort(sortDashboardCommissions);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-[var(--text-muted)]">Active-month snapshot for first-time client follow-up and commissions. Updated {todayLabel}.</p>
        </div>
        <Link href="/clients/new" className="button-accent">
          Record first-time client
        </Link>
      </div>
      {message ? <p className="message border-[var(--teal)]">{message}</p> : null}

      <section className="grid gap-6 md:grid-cols-4">
        <Metric label="Open opportunities" value={data.openCount.toString()} tone="sage" />
        <Metric label="Memberships sold this month" value={data.salesThisMonth.length.toString()} />
        <Metric label="First-visit close rate" value={`${data.firstVisitCloseRate}%`} />
        <Metric label="Pending approvals this month" value={data.pendingApprovals.toString()} tone="orange" />
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="section-title">Recent Activity</h2>
          <Link href="/opportunities" className="button-secondary">
            Open opportunities
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Location</th>
                <th>Proposed Primary</th>
                <th>Support</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOpportunities.map((opportunity) => (
                <tr key={opportunity.id}>
                  <td>
                    <Link className="font-semibold text-[var(--teal)]" href={`/opportunities/${opportunity.id}`}>
                      {opportunity.client.firstName} {opportunity.client.lastName}
                    </Link>
                  </td>
                  <td>{opportunity.location.code}</td>
                  <td>{opportunity.proposedPrimaryCloser.displayName}</td>
                  <td>{opportunity.proposedSupportCloser?.displayName ?? "-"}</td>
                  <td><StatusBadge status={opportunity.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workbench-grid">
        <div className="card dashboard-commission-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Estimated Commissions</h2>
              <p className="text-sm text-[var(--text-muted)]">Includes approved and pending memberships.</p>
            </div>
            <Link href="/commissions" className="button-secondary">
              View progress
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data-table commission-summary-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Credits</th>
                  <th>Tier</th>
                  <th>Base</th>
                  <th>First Visit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedCommissionSummary.map(({ staff, result }) => (
                  <tr key={staff.id}>
                    <td className="font-semibold">{staff.displayName}</td>
                    <td>{formatCreditBasisPoints(result.totalCreditBasisPoints)}</td>
                    <td>{result.currentTier}</td>
                    <td>{formatMoney(result.baseCommissionCents)}</td>
                    <td>{formatMoney(result.firstVisitBonusCents)}</td>
                    <td className="font-semibold">{formatMoney(result.finalCommissionCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card dashboard-location-card p-4">
          <h2 className="section-title mb-3">Sales by Location</h2>
          <div className="location-progress-list">
            {data.soldByLocation.map((item) => (
              <div key={item.code} className="location-progress-row">
                <span className="font-semibold">{item.code}</span>
                <span className="mono-num font-semibold">{item.totalCount}</span>
                <span className="badge badge-teal">{item.approvedCount} approved</span>
              </div>
            ))}
            {data.soldByLocation.length === 0 ? <p className="empty-state">No active locations are available.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "orange" | "sage" }) {
  return (
    <div className="card metric-card p-4">
      <p className="text-sm font-semibold text-[var(--text-muted)]">{label}</p>
      <p className={tone === "orange" ? "metric-value metric-value-warn" : "metric-value"}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "OPEN" ? "badge-orange" : status === "MEMBERSHIP_SOLD" ? "badge-teal" : "badge-gray";
  return <span className={`badge ${cls}`}>{displayStatus(status)}</span>;
}

type DashboardCommissionRow = Awaited<ReturnType<typeof getDashboardData>>["commissionSummary"][number];

function sortDashboardCommissions(a: DashboardCommissionRow, b: DashboardCommissionRow) {
  const groupDiff = staffSortGroup(a.staff.role) - staffSortGroup(b.staff.role);
  if (groupDiff !== 0) {
    return groupDiff;
  }
  const commissionDiff = b.result.finalCommissionCents - a.result.finalCommissionCents;
  return commissionDiff !== 0 ? commissionDiff : a.staff.displayName.localeCompare(b.staff.displayName);
}

function staffSortGroup(role: string) {
  if (role === "FRONT_DESK" || role === "SALES") {
    return 0;
  }
  if (role === "THERAPIST") {
    return 1;
  }
  return 2;
}
