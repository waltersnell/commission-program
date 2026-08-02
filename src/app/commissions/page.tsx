import { getCommissionSummary } from "@/lib/data";
import { findStaffForUser } from "@/lib/current-staff";
import { formatCreditBasisPoints, formatMoney, monthKey } from "@/lib/format";
import { canManage } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommissionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const month = scalar(params.month) ?? monthKey();
  const user = await getCurrentUser();
  const canSeeAll = canManage(user?.role ?? "");
  const visibleStaff = canSeeAll ? null : await findStaffForUser(user);
  const summary = await getCommissionSummary(month, canSeeAll ? null : visibleStaff?.id ?? "__no_matching_staff__", { includePendingAsEstimated: true });

  return (
    <div className="page-shell">
      <div>
        <h1 className="page-title">Commission Progress</h1>
        <p className="text-[var(--text-muted)]">Estimated progress includes pending and approved sales. Final approved totals are locked at Month-End.</p>
      </div>
      <form className="card card-soft flex flex-wrap items-end gap-3 p-4">
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Month</span>
          <input className="field" type="month" name="month" defaultValue={month} />
        </label>
        <button className="button-primary" type="submit">View month</button>
      </form>

      <section className="grid gap-4 md:grid-cols-2">
        {summary.map(({ staff, result, pendingSplitCount, openOpportunityCount }) => (
          <article key={staff.id} className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="section-title">{staff.displayName}</h2>
              <span className="badge badge-teal">{result.currentTier}</span>
            </div>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <Metric label="Full memberships sold" value={String(result.fullSaleCount)} />
              <Metric label="Split membership credits" value={formatCreditBasisPoints(result.splitCreditBasisPoints)} />
              <Metric label="Total credited memberships" value={formatCreditBasisPoints(result.totalCreditBasisPoints)} />
              <Metric label="First-visit credits" value={formatCreditBasisPoints(result.firstVisitCreditBasisPoints)} />
              <Metric label="Credits to next tier" value={formatCreditBasisPoints(result.creditsToNextTierBasisPoints)} />
              <Metric label="Pending approvals" value={String(pendingSplitCount)} />
              <Metric label="Open connected opportunities" value={String(openOpportunityCount)} />
              <Metric label="Estimated base commission" value={formatMoney(result.baseCommissionCents)} />
              <Metric label="Estimated first-visit bonus" value={formatMoney(result.firstVisitBonusCents)} />
              <Metric label="Estimated total commission" value={formatMoney(result.finalCommissionCents)} strong />
            </dl>
          </article>
        ))}
      </section>
      {summary.length === 0 ? <p className="empty-state">No commission records match this month.</p> : null}
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="font-semibold text-[var(--text-muted)]">{label}</dt>
      <dd className={strong ? "text-xl font-bold text-[var(--charcoal)]" : "font-semibold"}>{value}</dd>
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
