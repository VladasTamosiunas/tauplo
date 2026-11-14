// Plays the game forward to a given month with fixed choices and screenshots the planning step there.
//   node tools/to-month.mjs --month 9 --out /tmp/m9.png [--slug ...] [--tax 0] [--cushion 0] [--deposit 20 --deposit-months 5,6] [--scheme dark] [--w 1280] [--base http://localhost:3200]
// --deposit is the share to lock (a whole percentage) in the months listed by --deposit-months; other months lock nothing.
import { writeFileSync } from "node:fs";
import { launch, register, sleep } from "./browser.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("base", "http://localhost:3200");
const SLUG = arg("slug", "kursiu-mariu-kapitonas");
const TARGET = Number(arg("month", "9"));
const TAX = arg("tax", "0");
const CUSH = arg("cushion", "0");
const OUT = arg("out", "/tmp/month.png");
const DEPOSIT = arg("deposit", "0");
const DEPOSIT_MONTHS = arg("deposit-months", "").split(",").filter(Boolean).map(Number);
const W = Number(arg("w", "1280"));

const { token } = await register(BASE, "Skaitytojas");
const b = await launch();
await b.viewport(W, 1000, { scheme: arg("scheme", "light") });
await b.setCookie("tauplo_session", token, BASE);
await b.goto(`${BASE}/zaidimai/${SLUG}`, 3500);

const chip = (legend, label) =>
  b.js(`(() => { const fs=[...document.querySelectorAll("fieldset")].find(f=>f.textContent.includes(${JSON.stringify(legend)})); const l=fs&&[...fs.querySelectorAll("label")].find(l=>l.textContent.replace(/\\s/g," ").trim()===${JSON.stringify(label + " %")}); if(l) l.click(); })()`);

for (let m = 1; m < TARGET; m++) {
  await chip("Į mokesčių indą", TAX);
  await chip("Į pagalvę", CUSH);
  await chip("Į terminuotą indėlį", DEPOSIT_MONTHS.includes(m) ? DEPOSIT : "0");
  await sleep(150);
  await b.js(`(() => { const l=[...document.querySelectorAll("label")].find(l=>l.textContent.includes("Atsisakyti šio pasiūlymo")); if(l && !l.querySelector("input").checked) l.click(); })()`);
  await sleep(120);
  await b.js(`[...document.querySelectorAll("button")].find(x=>x.textContent.trim().startsWith("Plaukti į"))?.click()`);
  await sleep(3000);
  await b.js(`[...document.querySelectorAll("button")].find(x=>/Kitas mėnuo/.test(x.textContent.trim()))?.click()`);
  await sleep(600);
}
await sleep(1200);
const clip = arg("clip", "");
let c;
if (clip) {
  const [x, y, cw, ch] = clip.split(",").map(Number);
  c = { x, y, width: cw, height: ch };
}
writeFileSync(OUT, await b.screenshot(c));
console.log("saved", OUT, b.errors.length ? `(errors: ${b.errors.join(" | ")})` : "");
b.close();
