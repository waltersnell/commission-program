import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "./db";
import { roles, type Role } from "./roles";

const roleCookieName = "thai-sport-role";
const userCookieName = "thai-sport-user-id";

export async function getCurrentRole(): Promise<Role> {
  const user = await getCurrentUser();
  if (user && roles.includes(user.role as Role)) {
    return user.role as Role;
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(roleCookieName)?.value;
  return roles.includes(value as Role) ? (value as Role) : "FRONT_DESK";
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(userCookieName)?.value;
  if (!userId) {
    return null;
  }

  return getPrisma().user.findFirst({
    where: {
      id: userId,
      active: true,
    },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function setCurrentUserSession(user: { id: string; role: string }) {
  const cookieStore = await cookies();
  cookieStore.set(userCookieName, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  cookieStore.set(roleCookieName, user.role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearCurrentUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(userCookieName);
  cookieStore.delete(roleCookieName);
}

export async function setCurrentRole(role: Role) {
  const cookieStore = await cookies();
  cookieStore.set(roleCookieName, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
