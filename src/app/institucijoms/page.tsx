import type { Metadata } from "next";
import { InquiryForm } from "@/components/institutions/InquiryForm";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Institucijoms",
  description: "Partnerystė su mokyklomis, savivaldybėmis ir valstybės įstaigomis: klasės skydelis, bendro prekės ženklo moduliai ir ES projektų partnerystė.",
};

const MODELS = [
  {
    title: "Mokykloms ir savivaldybėms",
    text: "Paruoštas klasės skydelis: mokytojas sukuria klasę, mokiniai prisijungia kodu, o mokytojas mato anoniminę klasės pažangą. Savivaldybė gali rengti finansinio raštingumo olimpiadą.",
    points: ["Klasės arba kampanijos kodas", "Pažanga pagal temas be mokinių vardų", "Statistika rodoma nuo 3 mokinių"],
  },
  {
    title: "Valstybinėms įstaigoms",
    text: "Bendro prekės ženklo moduliai pagal konkrečią iniciatyvą: mokesčių raštingumas, pensijų pakopos, vartotojų teisės arba kova su sukčiavimu.",
    points: ["Turinys rašomas JSON failais be programavimo", "Žaidimai ir kursai su jūsų pavadinimu", "Sertifikatai su unikaliu kodu"],
  },
  {
    title: "ES ir valstybės programoms",
    text: "Techninis ir metodinis partneris pilietinio švietimo projektams, finansuojamiems iš ES ar valstybės lėšų, su aiškiais poveikio rodikliais.",
    points: ["Suvestinės ataskaitos poveikio rodikliams", "BDAR atitinkantis duomenų tvarkymas", "Bendras projekto planas"],
  },
];

export default function InstitutionsPage() {
  return (
    <>
      <section className="bg-band text-on-band">
        <div className="mx-auto grid max-w-[1120px] gap-5 px-4 py-16 sm:px-6">
          <h1 className="max-w-[20ch] text-[clamp(32px,4.2vw,48px)] font-medium leading-[1.1]">Kurkime finansinį raštingumą kartu</h1>
          <p className="max-w-[56ch] text-[17px] text-on-band-2">
            Mokykloms, savivaldybėms ir valstybės įstaigoms siūlome paruoštus įrankius ir bendrus projektus su aiškiais rodikliais.
          </p>
          <a
            href="#paraiska"
            className="mt-2 inline-flex w-fit items-center justify-center whitespace-nowrap rounded-lg bg-[#f5f6fa] px-[18px] py-[13px] text-[15px] font-semibold text-[#1e2a5a] hover:shadow-[0_8px_24px_-10px_rgba(0,0,0,.5)] active:translate-y-px"
          >
            Pateikti paraišką
          </a>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1120px] gap-8 px-4 py-16 sm:px-6" aria-labelledby="models-h">
        <h2 id="models-h" className="max-w-[26ch] text-[clamp(24px,2.8vw,32px)] font-medium leading-[1.15]">
          Trys bendradarbiavimo modeliai
        </h2>
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
          {MODELS.map((m) => (
            <Card key={m.title} className="grid content-start gap-3">
              <h3 className="text-[19px] font-bold">{m.title}</h3>
              <p className="text-[15px]">{m.text}</p>
              <ul className="grid gap-2 text-[15px] text-ink-2">
                {m.points.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-[9px] h-px w-3 shrink-0 bg-ink-2" />
                    {p}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section id="paraiska" className="mx-auto grid max-w-[1120px] gap-8 px-4 pb-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14" aria-labelledby="inq-h">
        <div className="grid content-start gap-3">
          <h2 id="inq-h" className="text-[clamp(24px,2.8vw,32px)] font-medium leading-[1.15]">
            Paraiška partnerystei
          </h2>
          <p className="max-w-[46ch] text-[16px] text-ink-2">
            Ši forma skirta organizacijoms. Mokiniai, mokytojai ir suaugę besimokantieji registruojasi atskirai.
          </p>
        </div>
        <Card className="shadow-card">
          <InquiryForm />
        </Card>
      </section>
    </>
  );
}
