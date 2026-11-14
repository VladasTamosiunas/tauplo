// Plays a whole year of a voyage game in real Chrome and reports what the server saved.
// Every choice is applied by clicking its visible label and then READ BACK; the run fails if one did not take.
//
//   node tools/play-voyage.mjs [--slug kursiu-mariu-kapitonas] [--tax 20] [--cushion 30] [--insure 4,5,10]
//        [--deposit 20 --deposit-months 5,6] [--market "4:Klaipėda,5:Klaipėda,6:Juodkrantė"] [--follow-forecast] [--phone] [--base http://localhost:3200] [--shoot-end /tmp/end.png]
// --phone plays at 390x844 with real device emulation and checks that the scene is on screen when the boat sails.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { launch, register, sleep } from "./browser.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("base", "http://localhost:3200");
const SLUG = arg("slug", "kursiu-mariu-kapitonas");
const TAX = arg("tax", "20");
const CUSH = arg("cushion", "30");
const INSURE = arg("insure", "").split(",").filter(Boolean).map(Number);
const DEPOSIT = arg("deposit", "0");
const DEPOSIT_MONTHS = arg("deposit-months", "").split(",").filter(Boolean).map(Number);
const MARKETS = Object.fromEntries(arg("market", "").split(",").filter(Boolean).map((x) => x.split(":")).map(([m, name]) => [Number(m), name]));
const FOLLOW = process.argv.includes("--follow-forecast");
const PHONE = process.argv.includes("--phone");
const SHOOT = arg("shoot-end", "");

const psql = (q) => execSync(`psql -h localhost -p 54329 -U tauplo -d tauplo -tAc ${JSON.stringify(q)}`).toString().trim();
const { email, token } = await register(BASE, "Kapitonas");
const b = await launch();
if (PHONE) await b.viewport(390, 844, { scheme: "light" });
else await b.viewport(1280, 1000, { mobile: false });
await b.setCookie("tauplo_session", token, BASE);
await b.goto(`${BASE}/zaidimai/${SLUG}`, 3500);

const norm = (expr) => `${expr}.replace(/\\s/g, " ").trim()`;
const chip = async (legend, label) => {
  await b.js(`(() => { const fs=[...document.querySelectorAll("fieldset")].find(f=>f.textContent.includes(${JSON.stringify(legend)})); const l=fs&&[...fs.querySelectorAll("label")].find(l=>${norm("l.textContent")}===${JSON.stringify(label + " %")}); if(l) l.click(); })()`);
  await sleep(120);
  return b.js(`(() => { const fs=[...document.querySelectorAll("fieldset")].find(f=>f.textContent.includes(${JSON.stringify(legend)})); const on=fs&&fs.querySelector("input:checked"); return on?${norm("on.parentElement.textContent")}:null; })()`);
};
const toggle = async (text, want) => {
  const state = () => b.js(`(() => { const l=[...document.querySelectorAll("label")].find(l=>l.textContent.includes(${JSON.stringify(text)})); return l ? l.querySelector("input").checked : null; })()`);
  if ((await state()) === null) return null;
  if ((await state()) !== want) await b.js(`[...document.querySelectorAll("label")].find(l=>l.textContent.includes(${JSON.stringify(text)})).click()`);
  await sleep(120);
  return state();
};

const failures = [];
const sceneVisible = [];
const lines = [];
for (let m = 1; m <= 12; m++) {
  const view = await b.js(`(() => { const t=document.body.innerText; const r=[...document.querySelectorAll('input[name="route"]')]; return { forecast:(t.match(/Prognozė: (\\S+)/)||[])[1]||"", openOk:Boolean(r[1]&&!r[1].disabled) }; })()`);
  const wantOpen = FOLLOW && view.openOk && view.forecast === "ramu";

  const tax = await chip("Į mokesčių indą", TAX);
  const cush = await chip("Į pagalvę", CUSH);
  // where to sell: click the named port's card, then read back which card is checked (home is the card marked "namie")
  const wantMarket = MARKETS[m];
  if (wantMarket) {
    await b.js(`(() => { const i = [...document.querySelectorAll('input[name="market"]')].find((x) => x.parentElement.textContent.includes(${JSON.stringify(wantMarket)})); if (i) i.click(); })()`);
    await sleep(150);
    const got = await b.js(`(() => { const i = document.querySelector('input[name="market"]:checked'); return i ? i.parentElement.textContent : null; })()`);
    if (got === null || !got.includes(wantMarket)) failures.push(`m${m}: market card reads ${got}`);
  }
  const wantDep = DEPOSIT_MONTHS.includes(m) ? DEPOSIT : "0";
  const dep = await chip("Į terminuotą indėlį", wantDep);
  if (dep !== null && dep !== `${wantDep} %`) failures.push(`m${m}: deposit chip reads ${dep}`);
  if (tax !== `${TAX} %`) failures.push(`m${m}: tax chip reads ${tax}`);
  if (cush !== `${CUSH} %`) failures.push(`m${m}: cushion chip reads ${cush}`);

  await b.js(`(() => { const labs=[...document.querySelectorAll("fieldset label")].filter(l=>l.querySelector('input[name="route"]')); (labs[${wantOpen ? 1 : 0}])?.click(); })()`);
  await sleep(120);
  const route = await b.js(`(() => { const r=[...document.querySelectorAll('input[name="route"]')]; return r[1]&&r[1].checked?"open":"coast"; })()`);
  if (route !== (wantOpen ? "open" : "coast")) failures.push(`m${m}: route is ${route}`);

  const wantIns = INSURE.includes(m);
  const ins = await toggle("Apdrausti šį mėnesį", wantIns);
  if (ins !== null && ins !== wantIns) failures.push(`m${m}: insurance is ${ins}, wanted ${wantIns}`);

  const scam = await toggle("Atsisakyti šio pasiūlymo", true);
  if (scam === false) failures.push(`m${m}: scam not refused`);

  lines.push(`${String(m).padStart(2)}  ${wantIns ? "ins" : "   "}  ${route.padEnd(5)}  ${view.forecast.padEnd(6)}  ${scam === null ? "" : "scam refused"}`);
  if (PHONE) {
    await b.js(`[...document.querySelectorAll("button")].find(x=>x.textContent.trim().startsWith("Plaukti į"))?.scrollIntoView({ block: "center" })`);
    await sleep(500);
  }
  await b.js(`[...document.querySelectorAll("button")].find(x=>x.textContent.trim().startsWith("Plaukti į"))?.click()`);
  await sleep(900);
  if (PHONE) {
    const seen = await b.js(`(() => { const r = document.querySelector("canvas").getBoundingClientRect(); const vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); return Math.round((vis / r.height) * 100); })()`);
    sceneVisible.push(seen);
    if (seen < 90) failures.push(`m${m}: only ${seen}% of the scene is on screen while sailing`);
  }
  await sleep(2300);
  await b.js(`[...document.querySelectorAll("button")].find(x=>/Kitas mėnuo|Rodyti metų rezultatą/.test(x.textContent.trim()))?.click()`);
  await sleep(700);
}

await sleep(2500);
const end = await b.js("document.body.innerText");
console.log(lines.join("\n"));
if (PHONE) console.log("\nscene visible while sailing (% of its height, per month):", sceneVisible.join(" "));
console.log("\nchoices that did not take:", failures.length ? "\n  " + failures.join("\n  ") : "none");
console.log("year-end screen:", end.includes("Pinigai kiekvieno mėnesio pabaigoje"), "| saved:", /\+\d+ XP/.test(end));
const uid = psql(`select id from "User" where email='${email}'`);
console.log("server saved:", psql(`select "gameSlug" || '  iq ' || iq || '  net ' || eur from "GameRun" where "userId"='${uid}' order by "createdAt" desc limit 1`));
console.log("script errors:", b.errors.length ? b.errors.join(" | ") : "none");
if (SHOOT) {
  writeFileSync(SHOOT, await b.screenshot());
  console.log("screenshot:", SHOOT);
}
b.close();
process.exit(failures.length ? 1 : 0);
