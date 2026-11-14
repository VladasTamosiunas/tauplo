import { CompoundCalculator } from "@/components/calculator/CompoundCalculator";
import { Button } from "@/components/ui/Button";
import { Bezel } from "@/components/ui/Card";

/**
 * Editorial split. The headline sits in a left column at a reading-friendly size, with the one
 * working tool beside it. Both columns start at the same line, as in a printed page.
 */
export function Hero() {
  return (
    <section className="mx-auto grid max-w-[1120px] gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-16 lg:pb-28 lg:pt-20">
      <div className="grid content-start gap-7">
        <p className="rise font-display text-[13px] font-medium text-ink-2" style={{ ["--d" as string]: 0 }}>
          Finansinis raštingumas Lietuvoje
        </p>
        <h1 className="rise text-[clamp(36px,4.6vw,56px)] font-medium leading-[1.07]" style={{ ["--d" as string]: 1 }}>
          Išmok valdyti pinigus per praktiką, <em className="font-normal italic text-ink-2">o ne nuobodžią teoriją.</em>
        </h1>
        <p className="rise max-w-[44ch] text-[17px] leading-relaxed text-ink-2" style={{ ["--d" as string]: 2 }}>
          Žaidimai, trumpi kursai ir skaičiuoklės su tikrais Lietuvos pavyzdžiais, nuo GPM deklaravimo iki pensijų kaupimo.
        </p>
        <div className="rise flex flex-wrap items-center gap-x-4 gap-y-2" style={{ ["--d" as string]: 3 }}>
          <Button href="#zaisk">Pradėti žaisti</Button>
          <Button href="/institucijoms" variant="quiet" arrow>
            Institucijoms
          </Button>
        </div>
        <p className="rise text-[13.5px] text-ink-2" style={{ ["--d" as string]: 4 }}>
          Nemokama pradžia. Mokytojams ir institucijoms yra atskira paskyra.
        </p>
      </div>

      <div className="rise" style={{ ["--d" as string]: 2 }}>
        <Bezel>
          <CompoundCalculator />
        </Bezel>
      </div>
    </section>
  );
}
