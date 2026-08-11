import type { Staff, User } from "@prisma/client";
import { getPrisma } from "./db";
import { isCloserRole } from "./roles";

export async function findStaffForUser(user: Pick<User, "displayName" | "username" | "email"> | null) {
  if (!user) {
    return null;
  }

  const staff = await getPrisma().staff.findMany({ where: { active: true } });
  return matchStaffForUser(user, staff);
}

export function matchStaffForUser(user: Pick<User, "displayName" | "username" | "email">, staff: Pick<Staff, "id" | "displayName" | "firstName">[]) {
  const candidates = [
    user.displayName,
    user.username,
    user.email?.split("@")[0],
  ]
    .filter(Boolean)
    .map((value) => normalizeName(value ?? ""));

  return staff.find((person) => {
    const staffNames = [person.displayName, person.firstName].map(normalizeName);
    return candidates.some((candidate) => staffNames.includes(candidate));
  }) ?? null;
}

export function staffMatchesUser(staff: Pick<Staff, "displayName" | "firstName">, user: Pick<User, "displayName" | "username" | "email" | "role">) {
  if (!isCloserRole(user.role)) {
    return false;
  }
  const candidates = [user.displayName, user.username, user.email?.split("@")[0]]
    .filter(Boolean)
    .map((value) => normalizeName(value ?? ""));
  const staffNames = [staff.displayName, staff.firstName].map(normalizeName);

  return candidates.some((candidate) =>
    staffNames.includes(candidate) || candidate.split(/\s+/)[0] === normalizeName(staff.firstName),
  );
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}
