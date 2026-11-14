"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth/session";
import { authenticate, registerUser } from "@/server/users";

export type AuthFormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

export async function registerAction(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const input = {
    email: text(fd, "email"),
    password: text(fd, "password"),
    displayName: text(fd, "displayName"),
    role: text(fd, "role") as "STUDENT" | "ADULT" | "TEACHER",
  };
  // Never echo the password back into the page.
  const values = { email: input.email, displayName: input.displayName, role: input.role };
  const result = await registerUser(input);
  if (!result.ok) return { errors: result.errors, values };
  await createSession(result.userId);
  redirect(input.role === "TEACHER" ? "/mokytojas" : "/profilis");
}

export async function loginAction(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const email = text(fd, "email");
  const user = await authenticate(email, text(fd, "password"));
  // One message for unknown email and wrong password, so accounts cannot be probed.
  if (!user) return { errors: { form: "Neteisingas el. paštas arba slaptažodis." }, values: { email } };
  await createSession(user.id);
  redirect("/profilis");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
