import { Prisma, type Role } from "@prisma/client";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

export const RegisterSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "El. paštas per ilgas.")
    .pipe(z.email("Įveskite galiojantį el. pašto adresą.")),
  password: z
    .string()
    .min(8, "Slaptažodis turi būti bent 8 simbolių.")
    .max(200, "Slaptažodis per ilgas."),
  displayName: z
    .string()
    .trim()
    .min(2, "Įveskite vardą arba slapyvardį.")
    .max(40, "Vardas per ilgas (iki 40 simbolių)."),
  role: z.enum(["STUDENT", "ADULT", "TEACHER"], { error: "Pasirinkite, kas esate." }),
});

export type RegisterInput = z.input<typeof RegisterSchema>;
export type RegisterResult = { ok: true; userId: string } | { ok: false; errors: Record<string, string> };

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }
  const { email, password, displayName, role } = parsed.data;
  const passwordHash = await hashPassword(password);
  try {
    const user = await db.user.create({
      data: { email, passwordHash, displayName, role: role as Role },
      select: { id: true },
    });
    return { ok: true, userId: user.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, errors: { email: "Su šiuo el. paštu paskyra jau yra. Bandykite prisijungti." } };
    }
    throw e;
  }
}

// Verified against when the email is unknown, so response time does not reveal which emails exist.
let dummyHash: Promise<string> | undefined;

/** Returns the user id, or null. The same null for an unknown email and a wrong password. */
export async function authenticate(email: string, password: string): Promise<{ id: string } | null> {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    dummyHash ??= hashPassword("niekada-nenaudojamas-slaptazodis");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? { id: user.id } : null;
}
