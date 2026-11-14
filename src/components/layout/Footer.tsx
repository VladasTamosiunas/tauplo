import Link from "next/link";
import { Wordmark } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-28 border-t border-line">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto] md:items-start">
        <div className="grid max-w-[46ch] gap-3">
          <Wordmark className="text-[24px]" />
          <p className="text-[14px] leading-relaxed text-ink-2">
            Finansinio raštingumo žaidimai, kursai ir skaičiuoklės su Lietuvos pavyzdžiais. Tauplo yra mokymo priemonė, o ne finansinė ar mokesčių konsultacija, o skaičiavimai yra iliustraciniai.
          </p>
        </div>
        <nav aria-label="Svetainės nuorodos" className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          <Link href="/zaidimai" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">Žaidimai</Link>
          <Link href="/kursai" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">Kursai</Link>
          <Link href="/institucijoms" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">Institucijoms</Link>
          <Link href="/privatumas" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">Privatumas</Link>
        </nav>
      </div>
    </footer>
  );
}
