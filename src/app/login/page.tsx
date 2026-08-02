import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { getDashboardData } from "@/lib/data";
import { formatCreditBasisPoints, formatMoney, monthLabel } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const [currentUser, dashboard] = await Promise.all([getCurrentUser(), getDashboardData()]);
  if (currentUser) {
    redirect("/");
  }

  const params = await searchParams;
  const error = scalar(params.error);
  const message = scalar(params.message);
  const showForgot = scalar(params.showForgot) === "1";
  const userName = scalar(params.userName) ?? "";
  const leaderboardMonthLabel = monthLabel();
  const topSales = [...dashboard.commissionSummary]
    .sort((a, b) => {
      const salesDiff = b.result.totalCreditBasisPoints - a.result.totalCreditBasisPoints;
      if (salesDiff !== 0) {
        return salesDiff;
      }
      const commissionDiff = b.result.finalCommissionCents - a.result.finalCommissionCents;
      return commissionDiff !== 0 ? commissionDiff : a.staff.displayName.localeCompare(b.staff.displayName);
    })
    .slice(0, 5);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center py-6">
      <div className="login-grid">
        <section className="card w-full p-6">
          <div className="mb-5">
            <h1 className="page-title">Thai Sport Commissions</h1>
            <p className="text-[var(--text-muted)]">Sign in to add first-time clients and work today’s follow-up.</p>
          </div>
          {message ? <p className="message mb-4 border-[var(--teal)]">{message}</p> : null}
          {error ? <p className="message mb-4 border-[var(--orange)]">{error}</p> : null}
          <form action={loginAction} className="grid gap-4">
            <label className="grid gap-1">
              <span className="text-sm font-semibold">User Name</span>
              <input className="field" name="userName" defaultValue={userName} autoComplete="username" required />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-semibold">Password</span>
              <input className="field" name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="button-primary" type="submit">Sign in</button>
          </form>
          {showForgot ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-[var(--teal)]" href={`/forgot-password?userName=${encodeURIComponent(userName)}`}>
              Reset password
            </Link>
          ) : null}
        </section>

        <section className="card card-soft p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="section-title">Top 5 Leaderboard for {leaderboardMonthLabel}</h2>
              <p className="text-sm text-[var(--text-muted)]">Estimated from pending and approved sales this month.</p>
            </div>
            <span className="badge badge-teal">{dashboard.salesThisMonth.length} total sales</span>
          </div>
          <div className="grid gap-3">
            {topSales.map(({ staff, result }, index) => (
              <div key={staff.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-surface)] p-3">
                <span className="leaderboard-rank">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-[var(--color-ink)]">{staff.displayName}</p>
                  <p className="text-sm text-[var(--text-muted)]">{formatCreditBasisPoints(result.totalCreditBasisPoints)} sales · {result.currentTier}</p>
                </div>
                <p className="mono-num font-bold text-[var(--color-ink)]">{formatMoney(result.finalCommissionCents)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
