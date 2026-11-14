import { Button } from "@/components/ui/Button";

const MODELS = [
  { t: "Mokykloms ir savivaldybėms", d: "Klasės skydelis: mokytojas skiria žaidimus ir mato anoniminę klasės pažangą. Savivaldybė gali rengti olimpiadą." },
  { t: "Valstybinėms įstaigoms", d: "Bendro prekės ženklo moduliai pagal jūsų iniciatyvą: mokesčiai, pensijos, vartotojų teisės, kova su sukčiavimu." },
  { t: "ES ir valstybės programoms", d: "Techninis ir metodinis partneris projektams su poveikio rodikliais ir BDAR atitinkančia ataskaita." },
];

/**
 * A flat dark panel with hairline-divided rows. No glow, no rounded slab: it reads as a
 * different room of the same publication, using the same type and the same small radius.
 */
export function InstitutionsBand() {
  return (
    <section className="px-4 pb-4 sm:px-6" aria-labelledby="inst-h">
      <div className="reveal mx-auto max-w-[1120px] rounded-[10px] bg-band text-on-band">
        <div className="grid gap-12 px-6 py-14 sm:px-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:py-16">
          <div className="grid content-start gap-6">
            <h2 id="inst-h" className="max-w-[16ch] text-[clamp(30px,3.8vw,46px)] font-medium leading-[1.1]">
              Kurkime finansinį raštingumą kartu
            </h2>
            <p className="max-w-[44ch] text-[16.5px] leading-relaxed text-on-band-2">
              Mokykloms, savivaldybėms ir valstybės įstaigoms siūlome paruoštus įrankius ir bendrus projektus su aiškiais rodikliais.
            </p>
            <div>
              <Button href="/institucijoms" variant="light" arrow>
                Sužinoti daugiau
              </Button>
            </div>
          </div>

          <ul className="border-t border-white/15">
            {MODELS.map((m, i) => (
              <li key={m.t} className="reveal border-b border-white/15 py-5" style={{ ["--i" as string]: i + 1 }}>
                <h3 className="mb-1 font-serif text-[20px] font-medium">{m.t}</h3>
                <p className="max-w-[48ch] text-[15px] leading-relaxed text-on-band-2">{m.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
