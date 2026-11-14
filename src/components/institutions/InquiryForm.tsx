"use client";

import { useActionState } from "react";
import { submitInquiryAction, type InquiryFormState } from "@/app/institucijoms/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const initial: InquiryFormState = { status: "idle" };

const TYPES = [
  { value: "SCHOOL_MUNICIPALITY", label: "Mokyklų ar savivaldybės programa" },
  { value: "COBRANDED_MODULE", label: "Bendro prekės ženklo edukacinis modulis" },
  { value: "EU_STATE_PROGRAM", label: "ES ar valstybės finansuojamas projektas" },
  { value: "OTHER", label: "Kita" },
];

/** Partnership inquiry. Separate from learner sign-up on purpose. */
export function InquiryForm() {
  const [state, action, pending] = useActionState(submitInquiryAction, initial);
  const e = state.errors ?? {};
  const v = state.values ?? {};

  if (state.status === "sent") {
    return (
      <div role="status" className="grid gap-2 rounded-lg border border-good bg-good-soft p-5">
        <strong className="font-display text-lg text-good-ink">Paraiška gauta</strong>
        <p>Ačiū. Su jumis susisieksime nurodytu el. paštu ir aptarsime tolesnius žingsnius.</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      {e.form ? (
        <p role="alert" className="rounded-lg border border-bad bg-bad-soft px-4 py-3 text-sm font-medium text-bad-ink">
          {e.form}
        </p>
      ) : null}
      <Field id="orgName" label="Organizacijos pavadinimas" autoComplete="organization" defaultValue={v.orgName} error={e.orgName} />

      <div className="grid gap-1.5">
        <label htmlFor="projectType" className="text-sm font-semibold">
          Projekto tipas
        </label>
        <select
          id="projectType"
          name="projectType"
          defaultValue={v.projectType ?? ""}
          aria-invalid={e.projectType ? true : undefined}
          aria-describedby={e.projectType ? "projectType-err" : undefined}
          className={`w-full rounded-lg border bg-surface px-3 py-[11px] text-[15px] text-ink ${e.projectType ? "border-bad" : "border-line-2"}`}
        >
          <option value="">Pasirinkite</option>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {e.projectType ? (
          <p id="projectType-err" role="alert" className="text-[13px] font-medium text-bad-ink">
            {e.projectType}
          </p>
        ) : null}
      </div>

      <Field id="contactName" label="Kontaktinis asmuo" autoComplete="name" defaultValue={v.contactName} error={e.contactName} />
      <Field id="email" label="El. paštas" type="email" autoComplete="email" defaultValue={v.email} error={e.email} />

      <div className="grid gap-1.5">
        <label htmlFor="message" className="text-sm font-semibold">
          Trumpai apie projektą (nebūtina)
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          defaultValue={v.message}
          aria-invalid={e.message ? true : undefined}
          aria-describedby={e.message ? "message-err" : undefined}
          className={`w-full resize-y rounded-lg border bg-surface px-3 py-[11px] text-[15px] text-ink ${e.message ? "border-bad" : "border-line-2"}`}
        />
        {e.message ? (
          <p id="message-err" role="alert" className="text-[13px] font-medium text-bad-ink">
            {e.message}
          </p>
        ) : null}
      </div>

      {/* Honeypot: hidden from people and from assistive tech, tempting to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Svetainė</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-1.5">
        <label className="flex items-start gap-2.5 text-sm" htmlFor="consent">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            aria-invalid={e.consent ? true : undefined}
            aria-describedby={e.consent ? "consent-err" : undefined}
            className="mt-1 accent-[var(--brand)]"
          />
          <span>
            Sutinku, kad Tauplo komanda susisiektų dėl šios paraiškos. Duomenis tvarkome pagal{" "}
            <a href="/privatumas" className="underline">
              privatumo politiką
            </a>
            .
          </span>
        </label>
        {e.consent ? (
          <p id="consent-err" role="alert" className="text-[13px] font-medium text-bad-ink">
            {e.consent}
          </p>
        ) : null}
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Siunčiama..." : "Siųsti paraišką"}
        </Button>
      </div>
    </form>
  );
}
