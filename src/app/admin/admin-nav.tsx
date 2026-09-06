import Link from "next/link";

export type AdminSectionKey = "users" | "commission" | "other" | "clients" | "payroll";

export function AdminNav({ active }: { active: AdminSectionKey }) {
  const items = [
    { key: "users", label: "Users", description: "Login access and user accounts", href: "/admin?section=users" },
    { key: "commission", label: "Commission Settings", description: "Staff and commission rules", href: "/admin?section=commission" },
    { key: "other", label: "Other Settings", description: "CRM, locations, and memberships", href: "/admin?section=other" },
    { key: "clients", label: "Client Search", description: "Client records and audit history", href: "/admin?section=clients" },
    { key: "payroll", label: "Run Payroll", description: "Review commission payroll", href: "/admin/payroll" },
  ] as const;

  return (
    <nav className="admin-subnav no-print" aria-label="Administration sections">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`admin-subnav-link${active === item.key ? " admin-subnav-link-active" : ""}`}
          aria-current={active === item.key ? "page" : undefined}
        >
          <span>{item.label}</span>
          <small>{item.description}</small>
        </Link>
      ))}
    </nav>
  );
}
