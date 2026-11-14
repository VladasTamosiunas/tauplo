"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Join code with a copy button. Falls back to selecting the text if the clipboard is blocked. */
export function CopyCode({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="select-all rounded-lg border border-line bg-surface-2 px-3.5 py-2 font-mono text-2xl font-bold tracking-wider">{code}</code>
      <Button variant="ghost" size="sm" onClick={copy}>
        Kopijuoti kodą
      </Button>
      <span role="status" className="text-sm text-ink-2">
        {state === "copied" ? "Nukopijuota" : state === "failed" ? "Pažymėk kodą ir nukopijuok rankiniu būdu" : ""}
      </span>
    </div>
  );
}
