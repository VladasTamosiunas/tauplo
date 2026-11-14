import type { ComponentProps } from "react";

/** Label above the input, helper text optional, error text below. Never placeholder-as-label. */
export function Field({
  id,
  label,
  error,
  hint,
  ...input
}: { id: string; label: string; error?: string; hint?: string } & Omit<ComponentProps<"input">, "id">) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
        className={`w-full rounded-lg border bg-surface px-3 py-[11px] text-[15px] text-ink placeholder:text-ink-2 ${
          error ? "border-bad" : "border-line-2"
        }`}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[13px] font-medium text-bad-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
