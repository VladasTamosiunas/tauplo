"use client";

import { useActionState } from "react";
import { joinClassAction, type JoinState } from "@/app/klase/actions";
import { Button } from "@/components/ui/Button";

const initial: JoinState = { status: "idle" };

export function JoinForm() {
  const [state, action, pending] = useActionState(joinClassAction, initial);
  return (
    <form action={action} className="grid gap-3" noValidate>
      <div className="grid gap-1.5">
        <label htmlFor="code" className="text-sm font-semibold">
          Klasės arba kampanijos kodas
        </label>
        <input
          id="code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="TK-7Q42"
          aria-invalid={state.status === "error" ? true : undefined}
          aria-describedby="code-msg"
          className={`max-w-[260px] rounded-lg border bg-surface px-3 py-[11px] font-mono text-lg uppercase placeholder:text-ink-2 ${
            state.status === "error" ? "border-bad" : "border-line-2"
          }`}
        />
        <p id="code-msg" role={state.status === "error" ? "alert" : "status"} className={`text-[13px] ${state.status === "error" ? "font-medium text-bad-ink" : state.status === "joined" ? "font-medium text-good-ink" : "text-ink-2"}`}>
          {state.message ?? "Kodą duoda mokytojas arba organizatorius."}
        </p>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Jungiamasi..." : "Prisijungti"}
        </Button>
      </div>
    </form>
  );
}
