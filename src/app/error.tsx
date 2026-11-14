"use client";

import { Button } from "@/components/ui/Button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto grid max-w-[560px] justify-items-start gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-4xl font-medium">Kažkas nepavyko</h1>
      <p className="text-ink-2">Įvyko netikėta klaida. Pabandyk dar kartą, o jei problema kartojasi, grįžk į pradžią.</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Bandyti dar kartą</Button>
        <Button href="/" variant="ghost">
          Į pradžią
        </Button>
      </div>
    </div>
  );
}
