"use client";

import { useActionState } from "react";
import { registerAction, type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const initial: AuthFormState = {};

const ROLES = [
  {
    value: "STUDENT",
    title: "Moksleivis / Studentas",
    text: "Asmeninė pažanga, XP lentelė ir klasės prisijungimo kodai.",
  },
  {
    value: "ADULT",
    title: "Suaugęs besimokantysis",
    text: "Asmeninių finansų kursai, skaičiuoklės ir žaidimai.",
  },
  {
    value: "TEACHER",
    title: "Mokytojas / Institucijos atstovas",
    text: "Grupių valdymas, kvietimo kodai ir anoniminė analitika.",
  },
] as const;

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="grid gap-5" noValidate>
      <fieldset className="grid gap-2" aria-describedby={e.role ? "role-err" : undefined}>
        <legend className="mb-1 text-sm font-semibold">Kas esate?</legend>
        {ROLES.map((r) => (
          <label
            key={r.value}
            className="relative grid cursor-pointer gap-0.5 rounded-lg border border-line-2 bg-surface px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:shadow-[inset_0_0_0_1px_var(--brand)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
          >
            <input
              type="radio"
              name="role"
              value={r.value}
              defaultChecked={v.role === r.value}
              required
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <span className="font-semibold">{r.title}</span>
            <span className="text-[13.5px] text-ink-2">{r.text}</span>
          </label>
        ))}
        {e.role ? (
          <p id="role-err" role="alert" className="text-[13px] font-medium text-bad-ink">
            {e.role}
          </p>
        ) : null}
      </fieldset>

      <Field id="displayName" label="Vardas arba slapyvardis" autoComplete="nickname" defaultValue={v.displayName} error={e.displayName} hint="Šis vardas matomas rezultatų lentelėje. Nenaudokite pavardės." />
      <Field id="email" label="El. paštas" type="email" autoComplete="email" defaultValue={v.email} error={e.email} />
      <Field id="password" label="Slaptažodis" type="password" autoComplete="new-password" error={e.password} hint="Bent 8 simboliai." />

      <Button type="submit" disabled={pending}>
        {pending ? "Kuriama..." : "Sukurti paskyrą"}
      </Button>
      <p className="text-[13px] text-ink-2">
        Registruodamiesi sutinkate su duomenų tvarkymu pagal{" "}
        <a href="/privatumas" className="underline">
          privatumo politiką
        </a>
        .
      </p>
    </form>
  );
}
