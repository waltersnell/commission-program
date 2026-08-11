export type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Add Client", href: "/clients/new" },
  { label: "Opportunities", href: "/opportunities" },
  { label: "Sales", href: "/sales" },
  { label: "Commissions", href: "/commissions" },
];

const monthEndItem: NavItem = { label: "Month-End", href: "/month-end" };
const adminItem: NavItem = { label: "Admin", href: "/admin" };

export function getNavItems(role?: string | null): NavItem[] {
  return [
    ...navItems,
    ...(role === "MANAGER" || role === "ADMINISTRATOR" ? [monthEndItem] : []),
    ...(role === "ADMINISTRATOR" ? [adminItem] : []),
  ];
}

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
