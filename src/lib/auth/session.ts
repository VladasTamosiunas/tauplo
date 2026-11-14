import type { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  SESSION_DAYS,
  createSessionRecord,
  deleteSessionRecord,
  findUserBySessionToken,
  type SessionUser,
} from "@/server/sessions";

export type { SessionUser };

const COOKIE = "tauplo_session";

/** Signs the person in by creating a session and setting the httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = await createSessionRecord(userId);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

/** The signed-in user for this request, or null. Looked up once per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  return token ? findUserBySessionToken(token) : null;
});

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await deleteSessionRecord(token);
  jar.delete(COOKIE);
}

/** Pages that need an account. Sends guests to the sign-in page, and the wrong role home. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/prisijungti");
  if (roles && !roles.includes(user.role)) redirect("/profilis");
  return user;
}
