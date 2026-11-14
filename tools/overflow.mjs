// Reports pages that scroll sideways at phone widths, using real device emulation.
//   node tools/overflow.mjs [--base http://localhost:3000] [--widths 400,360,320]
import { launch, sleep } from "./browser.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const base = arg("base", "http://localhost:3000");
const widths = arg("widths", "400,360,320").split(",").map(Number);
const pages = [
  "/", "/zaidimai", "/zaidimai/biudzeto-detektyvas", "/zaidimai/sukciu-medziokle", "/zaidimai/mokesciu-labirintas",
  "/zaidimai/kursiu-mariu-kapitonas", "/zaidimai/kursiu-mariu-kapitonas-sunkus-metai",
  "/kursai", "/kursai/pagalve", "/skaiciuokle", "/institucijoms", "/rezultatai", "/privatumas", "/prisijungti", "/registruotis",
];
const b = await launch({ webgl: false });
let bad = 0;
for (const w of widths) {
  let ok = 0;
  for (const p of pages) {
    await b.viewport(w, 900);
    await b.goto(base + p, 1100);
    const r = await b.js("({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth })");
    if (r.sw > r.vw) {
      bad++;
      console.log(`OVERFLOW @${w} ${p} (scrollWidth ${r.sw})`);
      // name the elements that reach past the edge. Skip anything inside a fixed layer (the closed mobile menu) or inside
      // a scroll container, but NOT an absolutely positioned child of one: that is exactly how a 1px sr-only span escaped
      // a scrolling row and widened the whole page.
      const who = await b.js(`(() => {
        const vw = document.documentElement.clientWidth;
        const inFixed = (e) => { for (let p = e; p; p = p.parentElement) if (getComputedStyle(p).position === "fixed") return true; return false; };
        const clippedByAncestor = (e) => {
          for (let p = e.parentElement; p; p = p.parentElement) {
            if (!/(auto|hidden|scroll|clip)/.test(getComputedStyle(p).overflowX)) continue;
            // an absolute box is only clipped when the scroll container is (or is inside) its containing block chain
            if (getComputedStyle(e).position !== "absolute") return true;
            for (let q = e.parentElement; q && q !== p.parentElement; q = q.parentElement) if (getComputedStyle(q).position !== "static") return true;
            return false;
          }
          return false;
        };
        return [...document.querySelectorAll("body *")]
          .filter((e) => e.getBoundingClientRect().right > vw + 1 && !inFixed(e) && !clippedByAncestor(e))
          .slice(0, 4)
          .map((e) => "    " + e.tagName.toLowerCase() + "." + String(e.className).slice(0, 48) + " right=" + Math.round(e.getBoundingClientRect().right));
      })()`);
      if (who.length) console.log(who.join("\n"));
    } else ok++;
  }
  console.log(`@${w}: ${ok} ok, ${pages.length - ok} overflow`);
  await sleep(50);
}
b.close();
process.exit(bad ? 1 : 0);
