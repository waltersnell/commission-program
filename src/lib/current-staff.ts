import type { Staff, User } from "@prisma/client";
import { getPrisma } from "./db";

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

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}
