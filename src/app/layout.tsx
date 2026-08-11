import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import localFont from "next/font/local";
import { logoutAction } from "./actions";
import { getCurrentUser } from "@/lib/session";
import { roleLabel } from "@/lib/roles";
import { getNavItems } from "@/lib/navigation";
import { DesktopNav } from "./desktop-nav";
import { MobileNav } from "./mobile-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thai Sport Commission Tracker",
  description: "Local membership commission tracking for Thai Sport Bodyworks.",
};

const geist = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  variable: "--font-geist",
});

const geistMono = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
});

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
  const visibleNavItems = getNavItems(user?.role);

  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full" suppressHydrationWarning>
        {!isAuthPage ? (
          <header className="app-header">
            <div className="app-header-inner mx-auto max-w-7xl px-4 py-4">
              <div className="app-title-row">
                <div className="app-brand">
                  <div className="min-w-0">
                    <Link href="/" className="block truncate text-xl font-bold text-[var(--charcoal)]">
                      Thai Sport Commissions
                    </Link>
                    <p className="text-sm text-[var(--text-muted)]">Estimated - Finalized at Month-End</p>
                  </div>
                </div>
                <MobileNav items={visibleNavItems} />
              </div>
              <form action={logoutAction} className="app-session-row">
                {user ? (
                  <div className="user-chip text-right text-sm">
                    <p className="font-semibold text-[var(--charcoal)]">{user.displayName}</p>
                    <p className="text-[var(--text-muted)]">{roleLabel(user.role)}</p>
                  </div>
                ) : null}
                <button className="button-secondary" type="submit">
                  Logout
                </button>
              </form>
            </div>
            <DesktopNav items={visibleNavItems} />
          </header>
        ) : null}
        <main className={isAuthPage ? "min-h-screen px-4 py-8" : "mx-auto w-full max-w-7xl px-4 py-6"}>{children}</main>
      </body>
    </html>
  );
}
