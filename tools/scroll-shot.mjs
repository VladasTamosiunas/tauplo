// Screenshot what a phone actually shows after the player scrolls to a control, with real device emulation.
//   node tools/scroll-shot.mjs <path> <out.png> --to "Plaukti" [--w 390] [--h 844] [--wait 6000] [--base http://localhost:3200]
// --to is text inside the button or label to scroll to (centred in the viewport).
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./browser.mjs";

const [, , path, out] = process.argv;
if (!path || !out) {
  console.error('usage: node tools/scroll-shot.mjs <path> <out.png> --to "text" [--w N] [--h N]');
  process.exit(2);
}
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const b = await launch();
await b.viewport(Number(arg("w", 390)), Number(arg("h", 844)), { scheme: "light" });
await b.goto(arg("base", "http://localhost:3200") + path, Number(arg("wait", 6000)));
const to = arg("to", "");
if (to) {
  const found = await b.js(
    `(() => { const el=[...document.querySelectorAll("button,label,a")].find(e=>e.textContent.includes(${JSON.stringify(to)})); if(!el) return false; el.scrollIntoView({block:"center"}); return true; })()`,
  );
  if (!found) console.error(`no control containing "${to}"`);
  await sleep(1200);
}
// where the scene ended up, so the report is a measurement and not only a picture
const box = await b.js(`(() => { const c=document.querySelector("canvas"); if(!c) return null; const r=c.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }; })()`);
console.log("canvas box in viewport:", JSON.stringify(box));
writeFileSync(out, await b.screenshot());
console.log("saved", out, b.errors.length ? `(page errors: ${b.errors.join(" | ")})` : "");
b.close();
