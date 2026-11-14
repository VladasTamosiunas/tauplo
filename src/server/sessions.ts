import { Prisma } from "@prisma/client";
import { hashToken, newToken } from "@/lib/auth/token";
import { db } from "@/lib/db";

export const SESSION_DAYS = 30;

/** What the app needs to know about the signed-in person. Never includes the password hash. */
export const sessionUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  xp: true,
  financialIq: true,
  streakCount: true,
  longestStreak: true,
  lastActiveKey: true,
} satisfies Prisma.UserSelect;

export type SessionUser = Prisma.UserGetPayload<{ select: typeof sessionUserSelect }>;

/** Creates a session row and returns the raw token to put in the cookie. */
export async function createSessionRecord(userId: string): Promise<string> {
  const token = newToken();
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
    },
  });
  return token;
}

export async function findUserBySessionToken(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, user: { select: sessionUserSelect } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return session.user;
}

export async function deleteSessionRecord(token: string): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
