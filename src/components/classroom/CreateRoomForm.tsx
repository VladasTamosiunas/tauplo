"use client";

import { useActionState } from "react";
import { createClassroomAction, type CreateRoomState } from "@/app/mokytojas/actions";
import { Button } from "@/components/ui/Button";

const initial: CreateRoomState = {};

export function CreateRoomForm() {
  const [state, action, pending] = useActionState(createClassroomAction, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <label htmlFor="name" className="text-sm font-semibold">
          Pavadinimas
        </label>
        <input
          id="name"
          name="name"
          defaultValue={state.name}
          maxLength={80}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "name-err" : "name-hint"}
          className={`rounded-lg border bg-surface px-3 py-[11px] text-[15px] ${state.error ? "border-bad" : "border-line-2"}`}
        />
        {state.error ? (
          <p id="name-err" role="alert" className="text-[13px] font-medium text-bad-ink">
            {state.error}
          </p>
        ) : (
          <p id="name-hint" className="text-[13px] text-ink-2">
            Pavyzdžiui, „10B klasė“ arba „Vilniaus finansų olimpiada“. Nerašykite mokinių vardų.
          </p>
        )}
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Tipas</legend>
        {[
          { v: "CLASS", t: "Klasė", d: "Nuolatinė mokinių grupė." },
          { v: "CAMPAIGN", t: "Kampanija", d: "Trumpesnė veikla, pavyzdžiui, olimpiada ar akcija." },
        ].map((o, i) => (
          <label
            key={o.v}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line-2 px-3.5 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
          >
            <input type="radio" name="kind" value={o.v} defaultChecked={i === 0} className="mt-1 accent-[var(--brand)]" />
            <span>
              <b className="font-semibold">{o.t}</b>
              <span className="block text-[13.5px] text-ink-2">{o.d}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Kuriama..." : "Sukurti ir gauti kodą"}
        </Button>
      </div>
    </form>
  );
}
