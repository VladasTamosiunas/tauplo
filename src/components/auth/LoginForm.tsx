"use client";

import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const initial: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.errors?.form ? (
        <p role="alert" className="rounded-lg border border-bad bg-bad-soft px-4 py-3 text-sm font-medium text-bad-ink">
          {state.errors.form}
        </p>
      ) : null}
      <Field id="email" label="El. paštas" type="email" autoComplete="email" required defaultValue={state.values?.email} />
      <Field id="password" label="Slaptažodis" type="password" autoComplete="current-password" required />
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Jungiama..." : "Prisijungti"}
      </Button>
    </form>
  );
}
