import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privatumas ir BDAR",
  description: "Kokius duomenis Tauplo renka, kaip jie naudojami ir kaip apsaugomi mokinių duomenys klasių statistikoje.",
};

const SECTIONS = [
  {
    title: "Kokius duomenis saugome",
    body: [
      "Kai susikuri paskyrą, saugome el. paštą, slapyvardį, pasirinktą vaidmenį ir užšifruotą slaptažodį. Slaptažodžio tiesiogiai neįmanoma perskaityti nei mums, nei kam nors kitam.",
      "Mokymosi metu saugome tavo pažangą: perskaitytas pamokas, testų rezultatus, žaidimų rezultatus, XP, Finansinį IQ, ženklelius ir dienų seriją.",
    ],
  },
  {
    title: "Klasių ir kampanijų statistika yra anoniminė",
    body: [
      "Mokytojas ar institucijos atstovas mato tik suvestinę: vidutinį Finansinį IQ, baigtų kursų skaičių ir temų įsisavinimą. Vardų, el. pašto adresų ar atskirų mokinių rezultatų jis nemato.",
      "Jei klasėje yra mažiau nei 3 mokiniai, rodome tik dalyvių skaičių, nes mažesnėje grupėje suvestinė leistų atpažinti atskirą žmogų. Tema taip pat nerodoma, kol ja nepasinaudojo bent 3 mokiniai.",
    ],
  },
  {
    title: "Rezultatų lentelė",
    body: ["Rezultatų lentelėje rodomas tik slapyvardis, lygis ir XP. Registruodamasis nenaudok pavardės. Jei nenori būti matomas, parašyk mums ir pašalinsime tave iš lentelės."],
  },
  {
    title: "Organizacijų paraiškos",
    body: ["Organizacijų paraiškose saugome pavadinimą, kontaktinį asmenį, el. paštą ir žinutę. Tuos duomenis naudojame tik atsakyti į paraišką. Paraišką pateikiate tik davę aiškų sutikimą."],
  },
  {
    title: "Tavo teisės",
    body: [
      "Gali prašyti peržiūrėti, ištaisyti ar ištrinti savo duomenis, taip pat apriboti jų tvarkymą. Paskyros ištrynimas pašalina ir tavo pažangą, ženklelių ir sertifikatų įrašus.",
      "Jei manai, kad duomenys tvarkomi netinkamai, gali kreiptis į Valstybinę duomenų apsaugos inspekciją.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto grid max-w-[760px] gap-8 px-4 py-14 sm:px-6">
      <div className="grid gap-3">
        <h1 className="text-[clamp(32px,4.2vw,48px)] font-medium leading-[1.1]">Privatumas ir BDAR</h1>
        <p className="text-[17px] text-ink-2">Trumpai ir aiškiai: ką saugome, kam tai reikalinga ir kas tuos duomenis mato.</p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} className="grid gap-2.5">
          <h2 className="text-[22px] font-bold">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p} className="max-w-[65ch] text-[16px] leading-[1.65]">
              {p}
            </p>
          ))}
        </section>
      ))}
      <p className="rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
        Prieš viešai paleidžiant svetainę, šį tekstą turi peržiūrėti teisininkas ir įrašyti duomenų valdytojo rekvizitus bei kontaktinį el. paštą.
      </p>
    </div>
  );
}
