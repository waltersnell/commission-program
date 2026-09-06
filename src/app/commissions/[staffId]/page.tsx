import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findStaffForUser } from "@/lib/current-staff";
import { getCommissionDetail } from "@/lib/data";
import {
  displayStatus,
  formatBasisPointsPercent,
  formatCreditBasisPoints,
  formatDisplayDate,
  formatMoney,
  formatMonthKey,
  monthKey,
} from "@/lib/format";
import { canManage } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

type PageProps = {
  params: Promise<{ staffId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommissionDetailPage({ params, searchParams }: PageProps) {
  const [{ staffId }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const month = scalar(query.month) ?? monthKey();
  if (!user) {
    redirect("/login");
  }
  if (!canManage(user.role)) {
    const visibleStaff = await findStaffForUser(user);
    if (!visibleStaff || visibleStaff.id !== staffId) {
      redirect("/commissions");
    }
  }
  const detail = await getCommissionDetail(staffId, month, true);
  if (!detail || !detail.summary) {
    notFound();
  }
  const { summary } = detail;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <Link className="mb-2 inline-flex text-sm font-semibold text-[var(--teal)]" href={`/commissions?month=${month}`}>← Commission Progress</Link>
          <h1 className="page-title">{detail.staff.displayName}</h1>
          <p className="text-[var(--text-muted)]">Complete commission activity for {formatMonthKey(month)}. Pending items are included in estimated totals.</p>
        </div>
        <span className="badge badge-teal">{summary.currentTier}</span>
      </div>

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Summary label="Membership credits" value={formatCreditBasisPoints(summary.totalCreditBasisPoints)} />
        <Summary label="Base commission" value={formatMoney(summary.baseCommissionCents)} />
        <Summary label="First-visit bonus" value={formatMoney(summary.firstVisitBonusCents)} />
        <Summary label="Family Upgrade" value={formatMoney(summary.membershipSpiffCents)} />
        <Summary label="Special Spiffs" value={formatMoney(summary.specialSpiffCents)} />
        <Summary label="Estimated total" value={formatMoney(summary.finalCommissionCents)} strong />
      </section>

      <section className="card p-4">
        <div className="mb-3">
          <h2 className="section-title">Membership Commission Activity</h2>
          <p className="text-sm text-[var(--text-muted)]">Each row shows this person’s exact share and earnings from a membership sale.</p>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Date</th>
                <th>Location</th>
                <th>Membership</th>
                <th>Approval</th>
                <th>Primary</th>
                <th>Support</th>
                <th>Share</th>
                <th>Tier applied</th>
                <th>Tier credits</th>
                <th>Base</th>
                <th>First Visit</th>
                <th>Family Upgrade</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {detail.membershipItems.map(({ credit, calculation }) => (
                <tr key={credit.id}>
                  <td>
                    <Link className="font-semibold text-[var(--teal)]" href={`/opportunities/${credit.sale.opportunityId}`}>
                      {credit.sale.opportunity.client.firstName} {credit.sale.opportunity.client.lastName}
                    </Link>
                  </td>
                  <td>{formatDisplayDate(credit.sale.membershipSaleDate)}</td>
                  <td>{credit.sale.location.code}</td>
                  <td>{credit.sale.membershipType.name}</td>
                  <td>{displayStatus(credit.sale.approvalStatus)}</td>
                  <td>{credit.sale.finalPrimaryCloser.displayName}</td>
                  <td>{credit.sale.finalSupportCloser?.displayName ?? "-"}</td>
                  <td>{formatBasisPointsPercent(credit.payoutBasisPoints)}</td>
                  <td>{calculation?.tierLabel ?? "Not eligible"}</td>
                  <td>{formatCreditBasisPoints(credit.creditBasisPoints)}</td>
                  <td>{formatMoney(calculation?.baseCommissionCents ?? 0)}</td>
                  <td>{formatMoney(calculation?.firstVisitBonusCents ?? 0)}</td>
                  <td>{formatMoney(calculation?.membershipSpiffCents ?? 0)}</td>
                  <td className="font-semibold">{formatMoney(calculation?.totalCommissionCents ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {detail.membershipItems.length === 0 ? <p className="empty-state mt-4">No membership commission activity for this month.</p> : null}
      </section>

      <section className="card p-4">
        <div className="mb-3">
          <h2 className="section-title">Special Spiff Activity</h2>
          <p className="text-sm text-[var(--text-muted)]">Special Spiffs pay their saved flat amount and do not change membership tiers.</p>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Date</th>
                <th>Location</th>
                <th>Spiff</th>
                <th>Function</th>
                <th>Notes</th>
                <th>Approval</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {detail.specialSpiffItems.map((award) => (
                <tr key={award.id}>
                  <td>{award.client.firstName} {award.client.lastName}</td>
                  <td>{formatDisplayDate(award.activityDate)}</td>
                  <td>{award.location.code}</td>
                  <td className="font-semibold">{award.spiffNameSnapshot}</td>
                  <td>{award.functionDescriptionSnapshot}</td>
                  <td>{award.notes ?? "-"}</td>
                  <td>{displayStatus(award.approvalStatus)}</td>
                  <td className="font-semibold">{formatMoney(award.amountCentsSnapshot)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {detail.specialSpiffItems.length === 0 ? <p className="empty-state mt-4">No Special Spiff activity for this month.</p> : null}
      </section>
    </div>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-[var(--text-muted)]">{label}</p>
      <p className={strong ? "mt-2 text-2xl font-bold" : "mt-2 text-xl font-semibold"}>{value}</p>
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
