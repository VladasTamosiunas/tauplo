import { db } from "@/lib/db";

/** Safety net: integration tests must never run against the development database. */
export function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("tauplo_test")) {
    throw new Error(`Refusing to run database tests against ${url || "an unset DATABASE_URL"}`);
  }
}

/** Empties every table. Order does not matter because of cascading deletes. */
export async function resetDb() {
  assertTestDatabase();
  await db.$transaction([
    db.inquiry.deleteMany(),
    db.user.deleteMany(), // cascades to sessions, progress, memberships, certificates, plans
    db.classroom.deleteMany(),
  ]);
}
