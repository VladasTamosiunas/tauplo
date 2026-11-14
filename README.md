# Tauplo

Lietuviška gamifikuota finansinio raštingumo platforma: trys žaidimai, šeši kursai su testais ir PDF sertifikatais, Finansinis IQ su XP, serijomis ir ženkleliais, mokytojo skydelis su anonimine statistika ir atskira institucijų paraiška.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, PostgreSQL + Prisma 6, zod, Vitest, pdf-lib.

## Paleidimas

Reikia Node 20+ ir PostgreSQL (`pg_ctl`, `initdb` PATH'e).

```bash
npm install                # .npmrc įjungia legacy-peer-deps, žr. "Žinomi niuansai"
npm run db:start           # vietinis Postgres: localhost:54329, bazės tauplo ir tauplo_test
npx prisma migrate dev     # sukuria lenteles
npm run db:seed            # nebūtina: demo mokytojas, klasė TK-DEMO, 4 mokiniai
npm run dev                # http://localhost:3000
```

Demo prisijungimai po `db:seed`: `mokytoja@tauplo.test`, `aiste@`, `benas@`, `gabija@`, `dovydas@tauplo.test`. Slaptažodis visiems: `demo-slaptazodis`.

Testai ir patikra:

```bash
npm test            # 582 testai; DB testai naudoja tik tauplo_test ir atsisako veikti kitoje bazėje
npm run typecheck
npm run lint
npm run build
```

## Turinio rašymas be programavimo

Visas turinys yra JSON failuose. Žaidimų ir kursų variklis turinio neimportuoja, todėl turinio autoriai redaguoja tik `src/content/`.

- `src/content/games/*.json`: žaidimai. `kind: "scenario"` (biudžeto detektyvas, mokesčių labirintas) arba `kind: "fraud"` (sukčių medžioklė).
  - `choice` žingsnis turi 2 iki 4 pasirinkimų, kiekvienas su `tone` (`good`, `mid`, `bad`), pastaba ir poveikiu (`eur`, `stress`, `iq`).
  - `estimate` žingsnis prašo apskaičiuoti sumą. Teisingą atsakymą skaičiuoja variklis iš `incomeEur` ir `quantity`, jo JSON'e rašyti nereikia.
- `src/content/courses/*.json`: kursai su pamokomis ir testu. `quiz[].correct` yra teisingo varianto indeksas (nuo 0). Naują kursą reikia pridėti ir į `src/lib/courses/catalog.ts` importų sąrašą.
- Mokesčių tarifai neįrašomi tekste. Rašykite `{vsdPct}`, `{psdPct}`, `{gpmPct}`, `{expensePct}`, `{contributionBasePct}`, o reikšmės imamos iš `src/lib/games/tax-rules.ts`.
- Slugai: tik mažosios ASCII raidės, skaičiai ir brūkšneliai.
- Testai (`npm test`) patikrina, ar visi JSON failai atitinka schemą, ar nėra brūkšnių (— ir –) ir ar teisingi atsakymai egzistuoja.

## Svarbu prieš viešą paleidimą

1. **Mokesčių ir pensijų turinį turi patikrinti specialistas.** `TAX_RULES.reviewed` yra `false`, todėl žaidime rodoma nuoroda, kad modelis mokomasis. Patikrinkite VSD, PSD, GPM tarifus, išlaidų dalį ir bazę, tada pakeiskite reikšmes ir nustatykite `reviewed: true`. Pensijų kurso tekstas sąmoningai bendro pobūdžio ir nukreipia į sodra.lt bei vmi.lt.
2. **Privatumo politika** (`/privatumas`) parašyta kaip šablonas. Reikia teisininko, duomenų valdytojo rekvizitų ir kontaktinio el. pašto.
3. **Paskyros ištrynimo funkcijos dar nėra.** Privatumo tekste jis minimas, todėl prieš paleidimą arba įgyvendinkite, arba tvarkykite prašymus rankiniu būdu (ištrynus `User` eilutę, duomenys kaskadiškai pašalinami).
4. **Nėra el. pašto patvirtinimo ir slaptažodžio atkūrimo.** Tai reikia pridėti prieš realius vartotojus.
5. **Nėra užklausų ribojimo** prisijungimui, registracijai ir paraiškų formai. Prieš viešą paleidimą pridėkite (pavyzdžiui, per reverse proxy ar Redis).
6. **Paraiškos tik saugomos duomenų bazėje** (`Inquiry`), joms nėra pranešimo el. paštu.
7. Nustatykite `SITE_URL` produkcijoje (sitemap, robots, Open Graph).

## Talpinimas savo serveryje (be jokios platformos)

Projekte nėra nieko, kas priklausytų nuo Vercel ar kitos platformos: tai paprasta Next.js programa su Postgres. Ją galima paleisti bet kur, kur veikia Docker arba Node 22.

**Su Docker (rekomenduojama):**

```bash
cp .env.production.example .env     # nustatykite POSTGRES_PASSWORD ir SITE_URL
docker compose up -d --build        # programa + Postgres; migracijos pritaikomos paleidžiant
```

Programa klausosi `PORT` (numatyta 3000). Prieš ją pastatykite reverse proxy su HTTPS (pavyzdžiui, Caddy: `tauplo.example.lt { reverse_proxy localhost:3000 }`). Duomenys laikomi Docker tome `tauplo-data`; darykite jo atsargines kopijas (`docker compose exec db pg_dump -U tauplo tauplo > kopija.sql`).

**Be Docker:**

```bash
npm ci
DATABASE_URL=postgresql://... npx prisma migrate deploy
DATABASE_URL=postgresql://... SITE_URL=https://... npm run build
DATABASE_URL=postgresql://... SITE_URL=https://... PORT=3000 node .next/standalone/server.js
```

Po `npm run build` reikia nukopijuoti `.next/static` į `.next/standalone/.next/static` (Docker failas tai daro pats). Sertifikatų PDF skaito šriftą iš disko, todėl `next.config.ts` jį įtraukia į standalone paketą aiškiai (`outputFileTracingIncludes`); to nepadarius, programa pasileistų, bet sertifikato atsisiuntimas nebeveiktų.

## 3D žaidimas: Kuršių marių kapitonas

Dvylika mėnesių, trys uostai (Klaipėda, Juodkrantė, Nida), keturios pinigų vietos (kišenė, mokesčių indas, pagalvė, skola). Kiekvieną mėnesį žaidėjas renka maršrutą (pakrantė arba atvirose mariose), kiek pajamų atidėti mokesčiams ir pagalvei, ar atnaujinti laivą, ar imti paskolą ir ar atsisakyti sukčių pasiūlymo.

- **Taisyklės yra vienoje vietoje:** `src/lib/games/voyage-engine.ts` (grynos funkcijos, be I/O). Naršyklė ja žaidžia mėnuo po mėnesio, o serveris perskaičiuoja visus metus iš gryno pasirinkimų sąrašo (`replayVoyage`) ir saugo tik tai, ką suskaičiavo pats. Bet kokią naują taisyklę rašykite čia ir pirma parašykite testą.
- **Orai yra turinys, ne atsitiktinumas.** Kiekvieno mėnesio `weather` (kas iš tikrųjų įvyks) ir `forecast` (ką mato žaidėjas) yra `src/content/games/kursiu-mariu-kapitonas.json`. Kai kurios prognozės sąmoningai klysta. `frozen: true` mėnesiais atvirų marių maršrutas uždarytas. Dėl to naršyklė ir serveris visada gauna tą patį rezultatą.
- **Scenos modelis:** `src/lib/games/voyage-scene-model.ts` (sezono spalvos, uostų vietos, indų lygiai) yra testuojamas be three.js. `scene.ts` tik piešia, `life.ts` prideda žuvėdras, dūmus, plūdes, nendres ir šviečiančius langus.
- **Laivas plaukia ant bangų.** Vandens paviršiaus formulė (`waveHeight`) yra scenos modelyje, ir ją naudoja ir vanduo, ir laivas (`boatRideHeight`), todėl audroje korpusas nenuskęsta po banga ir nekabo virš vandens (tai saugo testas). Debesuotumas rodomas šešėliais ant vandens, o ne debesų kūnais, nes kamera žiūri iš viršaus ir dangaus nemato. Kameros slinkimas priklauso nuo laiko, ne nuo kadrų dažnio, todėl lėtame telefone uostas įrėminamas taip pat kaip nešiojamame.
- **Telefone scena lieka ekrane.** Žaidimo puslapyje scena prisegta po antrašte (`sticky`) ir telefone, nes mygtukas „Plaukti“ yra gerokai žemiau už ją, o laivas, išplaukiantis už ekrano, nieko nemoko. Metų pasirinkimas telefone yra viena slenkama eilutė, o ne keturios sudėtos kortelės. Patikrinimas: `node tools/play-voyage.mjs --phone` žaidžia metus 390 px ekrane ir kiekvieną mėnesį matuoja, kiek scenos matosi plaukiant.
- **Horizontalus slinkimas.** `node tools/overflow.mjs` dabar įvardija elementą, kuris išlenda už krašto. Tai reikėjo, nes vienas 1 px `sr-only` elementas, esantis slenkančioje eilutėje be `relative` tėvo, ištempė visą puslapį iki 628 px.
- **3D peržiūra be žaidimo:** `npm run dev`, tada `/zaidimai/vaizdas?season=0.15&port=nida&gear=2`. Šio maršruto produkcijoje nėra (grąžina 404), nebent nustatytas `TAUPLO_SCENE_PREVIEW=1`.
- **Keturi metai, nuo lengvų iki rizikingų.** `pirmieji-metai` (lengvi), `kursiu-mariu-kapitonas` (vidutiniai), `sunkus-metai` (sunkūs), `audringi-metai` (rizikingi: daug audrų, du gedimai, atviros marios vilioja, o draudimas atsiperka). Pavadinimai ir lygiai yra `src/lib/games/voyage-years.ts`, o pusiausvyrą saugo `voyage-years.test.ts`: kiekvienų metų atsargus žaidėjas laimi, išlaidautojas pralaimi, o paklaida mažėja per lengvus, vidutinius ir sunkius metus.
- **Terminuotas indėlis (`deposit` turinyje).** Dalis mėnesio pajamų užrakinama keturiems mėnesiams ir grįžta su palūkanomis (1,1 % per mėnesį, daugiau nei pagalvė, bet pinigų negalima naudoti sąskaitoms). Grįžę pinigai pridedami prie mėnesio pajamų prieš padalijimą, todėl žaidėjas pats nusprendžia, ką su jais daryti; palikti kišenėje jie nutekėtų norams. Bankas neužrakins tiek, kad kišenės pinigai kartu su pagalve nukristų žemiau vieno mėnesio išlaidų (`splitMonth`), todėl indėlis pats negali sukelti trūkumo. Neapmokėtos sąskaitos, kai pinigai buvo užrakinti, mažina grynąją vertę (`unpaidWhileLocked`), nes kitaip lošti su indėliais apsimokėtų. Planavimo ekranas rodo tą pačią `splitMonth` skaičiavimą kaip žaidimas (`depositPreview`), todėl parodytas skaičius negali skirtis nuo užfiksuoto.
- **Kur parduoti laimikį (`markets` turinyje).** Kiekvieną mėnesį galima parduoti namų uoste (įprasta kaina, kelionės nėra) arba kitame, kurio kaina kinta kas mėnesį, o kelionė kainuoja 45 €. Kainos sukurtos taip, kad vidutiniškai kelionė nenusimoka: atsitiktinis keliautojas vidutiniškai praranda, o skaitantis kainas uždirba apie 600 iki 800 € daugiau (tai saugo `voyage-years.test.ts` visuose keturiuose metuose). Geriausias uostas keičiasi per metus, todėl reikia skaityti. `marketOptions` rodo tikras pajamas ir grynąjį skirtumą, perskaičiuotą tuo pačiu `incomeFor`, kuriuo žaidimas fiksuoja.
- **Senos išsaugotos serijos nesikeičia.** `voyage-golden.test.ts` saugo dvylika rezultatų (keturi metai, trys žaidimo stiliai), užfiksuotų prieš indėlius ir rinkas. Jei taisyklės pakeitimas sugadina vieną iš jų, seni įrašai būtų vertinami kitaip.
- **Draudimas ir palūkanos.** Kiekvieną mėnesį galima apsidrausti: įmoka kainuoja, o draudimas padengia dalį remonto ir audros nuostolių, bet niekada sukčių. Žala išmokama prieš sąskaitas, todėl draudimas negali sukelti trūkumo, kurio be jo nebūtų (tai saugo testas). Pagalvė uždirba mažas palūkanas. Netikėti įvykiai (`surprise: true`) planavimo ekrane nerodomi.
- **„Kas laukia“ (`voyage-outlook.ts`)** neturi savo taisyklių: ji perleidžia likusius mėnesius pačiu varikliu (`playMonth`) pakrantės maršrutu be naujų sprendimų, todėl negali išsiskirti nuo žaidimo. Prieš tai ji ramino žaidėją, kuriam netrukus pritrūks, todėl yra testas, kad ji niekada nesako „pakanka“, kai pakrantė baigiasi trūkumu.
- **Tikslai ir „ką pakeitus būtų geriau“ (`voyage-goals.ts`).** Šeši tikslai duoda iki 60 XP, kuriuos skaičiuoja tik serveris iš perleidimo. Pasiūlymai yra tikri perleidimai su vienu pakeitimu, ne spėjimai.
- **Orai (`voyage-weather.ts`).** Ramu, bangu ir audra skiriasi lietumi, bangomis, debesimis, vėju, žaibu ir šviesa. Planuojant dangus rodo prognozę, o po plaukimo tikrą orą, todėl klaidinga prognozė matoma.
- **Įrankiai (`tools/`).** `play-voyage.mjs` sužaidžia visus metus tikroje naršyklėje ir patikrina, ar kiekvienas pasirinkimas pasikeitė; `shoot.mjs` fotografuoja su tikra įrenginio emuliacija; `overflow.mjs` ieško šoninio slinkimo telefone; `to-month.mjs` nuveda iki mėnesio. Jie veikia ir su dev, ir su produkcijos serveriu.
- **Naujų metų pridėjimas.** Užtenka naujo JSON failo `src/content/games/` ir dviejų eilučių: importo ir sąrašo `catalog.ts`, bei įrašo `voyage-years.ts`. Serveris, ženklelis, sąrašai ir pasirinkimo juosta jį pamato patys. Prieš tai paleiskite `voyage-years.test.ts`: jei nauji metai nelaimimi atsargiu žaidimu arba išlaidavimas juos laimi, testas parodys.
- **Ženklelis „Žiemos kapitonas“** skaičiuojamas pagal geriausią rezultatą per visus metus (`VOYAGE_SLUGS` iš katalogo).
- **Ko nesitikėti iš balo:** Finansinis IQ matuoja atsparumą (žiema, pagalvė, mokesčiai, sukčiai, skola), o ne pelną, todėl atsargus žaidėjas gauna 100 ir pakrantėje, ir atvirose mariose. Skirtumą rodo grynoji vertė ir pamokų tekstas.
- **Nematyta tikrame GPU:** sceną tikrinau tik su programiniu WebGL (be vaizdo plokštės). Spalvos ir našumas telefone dar nepatikrinti.

## Privatumo taisyklės, įgyvendintos kode

- Klasės statistika rodoma tik nuo 3 dalyvių (`MIN_COHORT`). Temos rodomos tik jei jas išbandė bent 3 mokiniai. Atsakyme niekada nėra vardų, el. paštų ar ID.
- Rezultatų lentelėje tik slapyvardžiai, tik `STUDENT` vaidmuo.
- Testo atsakymai (`correct`, paaiškinimai) nesiunčiami į naršyklę, kol serveris neįvertina atsakymų.
- Žaidimų rezultatai ir testai perskaičiuojami serveryje iš pateiktų pasirinkimų. Naršyklės skaičiais nepasitikima.
- Sertifikatą gali atsisiųsti tik jo savininkas, kitiems grąžinamas 404.
- Prisijungimo klaida vienoda neegzistuojančiam el. paštui ir blogam slaptažodžiui.

## Žinomi niuansai

- **`npm install` be `legacy-peer-deps` sustoja su klaida** (`Cannot read properties of null (reading 'edgesOut')`). Todėl `.npmrc` jį įjungia. Dėl to `vite` pridėtas kaip atskira dev priklausomybė, nes Vitest jo reikalauja.
- **Nepridėkite `src/app/loading.tsx`.** Su šakniniu `loading.tsx` Next pradeda srautinį atsakymą dar prieš `redirect()` ir `notFound()`, todėl užrakinti puslapiai grąžina 200 su meta-refresh, o ne 307/404. Turinys neprasisunkia, bet būsenos kodai klaidingi.
- **Mygtukų slėpimas:** `Button` jau turi `inline-flex`, todėl `hidden` ant paties `Button` neveikia. Slėpkite apgaubiantį elementą.
- **Sertifikato šriftas:** `src/assets/fonts/Geist-Regular.ttf` (SIL OFL 1.1) turi visas lietuviškas raides. Kitam šriftui tą patį reikia patikrinti prieš keičiant.
- Kiekvienas puslapis atvaizduojamas serveryje pagal užklausą, nes navigacija skaito sesijos slapuką.
- Viena trumpalaikė testų klaida (`classrooms.test.ts`, kambarių kūrimas) pasirodė vieną kartą per pilną testų paleidimą ir nepasikartojo per daugiau nei 10 bandymų. Jei pasikartos, pradėkite nuo `createClassroom` pakartojimo ciklo.

## Struktūra

```
src/content/        JSON turinys (žaidimai, kursai)
src/lib/            grynos funkcijos be I/O: variklis, skaičiuoklės, formatavimas, XP/IQ/serijos
src/server/         paslaugos su duomenų baze: progresas, klasės, paraiškos, naudotojai
src/app/            puslapiai ir server actions
src/components/     UI ir funkciniai komponentai
prisma/             schema, migracijos, seed
scripts/db.sh       vietinis Postgres
```
