import Link from "next/link";
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
  const summary = await getCommissionSummary(month, canSeeAll ? null : visibleStaff?.id ?? "__no_matching_staff__");
  const systemUsers = summary.filter((row) => row.hasUserAccess);
  const otherStaff = summary.filter((row) => !row.hasUserAccess);

  return (
    <div className="page-shell">
      <div>
        <h1 className="page-title">Commission Progress</h1>
        <p className="text-[var(--text-muted)]">Approved commission progress. Pending sales wait for administrator approval before they count.</p>
      </div>
      <form className="card card-soft flex flex-wrap items-end gap-3 p-4">
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Month</span>
          <input className="field" type="month" name="month" defaultValue={month} />
        </label>
        <button className="button-primary" type="submit">View month</button>
      </form>

      {systemUsers.length > 0 ? <CommissionGroup title="System Users" rows={systemUsers} month={month} /> : null}
      {otherStaff.length > 0 ? (
        <div className={systemUsers.length > 0 ? "border-t-2 border-[var(--border)] pt-6" : ""}>
          <CommissionGroup title="Other Commissionable Staff" rows={otherStaff} month={month} />
        </div>
      ) : null}
      {summary.length === 0 ? <p className="empty-state">No commission records match this month.</p> : null}
    </div>
  );
}

type CommissionRow = Awaited<ReturnType<typeof getCommissionSummary>>[number];

function CommissionGroup({ title, rows, month }: { title: string; rows: CommissionRow[]; month: string }) {
  return (
    <section>
      <h2 className="section-title mb-3">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ staff, result, pendingSplitCount, pendingSpecialSpiffCount, openOpportunityCount }) => (
          <article key={staff.id} className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="section-title">
                <Link className="text-[var(--teal)] underline-offset-4 hover:underline" href={`/commissions/${staff.id}?month=${month}`}>
                  {staff.displayName}
                </Link>
              </h3>
              <span className="badge badge-teal">{result.currentTier}</span>
            </div>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <Metric label="Full memberships sold" value={String(result.fullSaleCount)} />
              <Metric label="Split membership credits" value={formatCreditBasisPoints(result.splitCreditBasisPoints)} />
              <Metric label="Total credited memberships" value={formatCreditBasisPoints(result.totalCreditBasisPoints)} />
              <Metric label="First-visit credits" value={formatCreditBasisPoints(result.firstVisitCreditBasisPoints)} />
              <Metric label="Credits to next tier" value={formatCreditBasisPoints(result.creditsToNextTierBasisPoints)} />
              <Metric label="Pending membership approvals" value={String(pendingSplitCount)} />
              <Metric label="Pending Special Spiffs" value={String(pendingSpecialSpiffCount)} />
              <Metric label="Open connected opportunities" value={String(openOpportunityCount)} />
              <Metric label="Estimated base commission" value={formatMoney(result.baseCommissionCents)} />
              <Metric label="Estimated first-visit bonus" value={formatMoney(result.firstVisitBonusCents)} />
              <Metric label="Estimated Family Upgrade Spiffs" value={formatMoney(result.membershipSpiffCents)} />
              <Metric label="Estimated Special Spiffs" value={formatMoney(result.specialSpiffCents)} />
              <Metric label="Estimated total commission" value={formatMoney(result.finalCommissionCents)} strong />
            </dl>
          </article>
        ))}
      </div>
    </section>
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
