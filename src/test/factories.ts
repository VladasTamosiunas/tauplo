import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

let counter = 0;

/** Inserts a user directly (no password hashing, so tests stay fast). */
export async function makeUser(role: Role = "STUDENT", overrides: { displayName?: string } = {}) {
  counter++;
  return db.user.create({
    data: {
      email: `tester${counter}-${Date.now()}@example.lt`,
      passwordHash: "scrypt$16384$x$x",
      displayName: overrides.displayName ?? `Mokinys ${counter}`,
      role,
    },
  });
}
