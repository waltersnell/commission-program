export const roles = ["FRONT_DESK", "MANAGER", "ADMINISTRATOR"] as const;

export type Role = (typeof roles)[number];

export const staffJobs = ["FRONT_DESK", "MANAGER", "ADMINISTRATOR", "THERAPIST", "OPERATIONS", "SALES"] as const;

export type StaffJob = (typeof staffJobs)[number];

export function roleLabel(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function canManage(role: string) {
  return role === "MANAGER" || role === "ADMINISTRATOR";
}

export function canAdmin(role: string) {
  return role === "ADMINISTRATOR";
}

export function isCloserRole(role: string) {
  return role === "FRONT_DESK" || role === "MANAGER" || role === "ADMINISTRATOR";
}

export function assertCanEditFinalized(role: string) {
  return canAdmin(role);
}
