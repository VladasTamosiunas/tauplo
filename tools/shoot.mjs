// Screenshot a page with real device emulation (so phone widths are real, not a cropped wider layout).
//   node tools/shoot.mjs <path> <out.png> [--w 1280] [--h 900] [--scheme light|dark] [--clip x,y,w,h] [--base http://localhost:3200] [--wait 3500]
import { writeFileSync } from "node:fs";
import { launch } from "./browser.mjs";

const [, , path, out] = process.argv;
if (!path || !out) {
  console.error("usage: node tools/shoot.mjs <path> <out.png> [--w N] [--h N] [--scheme light|dark] [--clip x,y,w,h]");
  process.exit(2);
}
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const w = Number(arg("w", 1280));
const h = Number(arg("h", 900));
const clip = arg("clip", "");
const b = await launch();
await b.viewport(w, h, { scheme: arg("scheme", "light") });
await b.goto(arg("base", "http://localhost:3200") + path, Number(arg("wait", 3500)));
let c;
if (clip) {
  const [x, y, cw, ch] = clip.split(",").map(Number);
  c = { x, y, width: cw, height: ch };
}
writeFileSync(out, await b.screenshot(c));
console.log("saved", out, b.errors.length ? `(page errors: ${b.errors.join(" | ")})` : "");
b.close();
