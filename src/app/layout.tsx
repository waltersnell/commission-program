import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "./actions";
import { getCurrentUser } from "@/lib/session";
import { roleLabel } from "@/lib/roles";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thai Sport Commission Tracker",
  description: "Local membership commission tracking for Thai Sport Bodyworks.",
};

const navItems = [
  ["Dashboard", "/"],
  ["Add Client", "/clients/new"],
  ["Opportunities", "/opportunities"],
  ["Sales", "/sales"],
  ["Commissions", "/commissions"],
  ["Month-End", "/month-end"],
  ["Admin", "/admin"],
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/forgot-password");
  const user = isAuthPage ? null : await getCurrentUser();
  if (pathname && !isAuthPage && !user) {
    redirect("/login");
  }

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {!isAuthPage ? (
          <header className="border-b border-[var(--border)] bg-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Link href="/" className="text-xl font-semibold text-[var(--charcoal)]">
                  Thai Sport Commissions
                </Link>
                <p className="text-sm text-[var(--text-muted)]">Estimated - Finalized at Month-End</p>
              </div>
              <form action={logoutAction} className="flex items-center gap-3">
                {user ? (
                  <div className="text-right text-sm">
                    <p className="font-semibold text-[var(--charcoal)]">{user.displayName}</p>
                    <p className="text-[var(--text-muted)]">{roleLabel(user.role)}</p>
                  </div>
                ) : null}
                <button className="button-secondary" type="submit">
                  Logout
                </button>
              </form>
            </div>
            <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
              {navItems.map(([label, href]) => (
                <Link key={href} href={href} className="nav-link">
                  {label}
                </Link>
              ))}
            </nav>
          </header>
        ) : null}
        <main className={isAuthPage ? "min-h-screen px-4 py-8" : "mx-auto w-full max-w-7xl px-4 py-6"}>{children}</main>
      </body>
    </html>
  );
}
