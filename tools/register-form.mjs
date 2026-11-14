// Drives the REAL registration form in Chrome the way a person would: empty submit, invalid input, a valid sign-up, and a duplicate.
// (tools/browser.mjs `register()` posts the server action over HTTP, which proves the backend but not the form.)
//   node tools/register-form.mjs [--base http://localhost:3200]
// Creates one throwaway user (zmogus<timestamp>@example.lt) in whatever database the target server uses.
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./browser.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("base", "http://localhost:3200");
const email = `zmogus${Date.now()}@example.lt`;

const driver = async () => {
  const b = await launch({ webgl: false });
  await b.viewport(1280, 900, { scheme: "light" });
  return {
    b,
    open: () => b.goto(`${BASE}/registruotis`, 2500),
    // React controls inputs, so set the value through the native setter and fire the event it listens to
    type: (id, value) =>
      b.js(`(() => { const el = document.getElementById(${JSON.stringify(id)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event("input", { bubbles: true })); })()`),
    role: (r) => b.js(`document.querySelector('input[name="role"][value="${r}"]').click()`),
    // click, then wait until the button stops saying "Kuriama..." or the page leaves /registruotis (up to 15 s), and report how long it took
    submit: async () => {
      const t0 = Date.now();
      await b.js(`document.querySelector('form button[type="submit"]')?.click()`);
      await sleep(400);
      for (let i = 0; i < 60; i++) {
        const s = await b.js(`({ path: location.pathname, pending: document.querySelector('form button[type="submit"]')?.textContent.includes("Kuriama") ?? false })`);
        if (s.path !== "/registruotis" || !s.pending) break;
        await sleep(250);
      }
      await sleep(600);
      return Date.now() - t0;
    },
    state: () => b.js(`({ url: location.pathname, errors: [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim()), button: document.querySelector('form button[type="submit"]')?.textContent.trim() ?? null, heading: document.querySelector("h1")?.textContent.trim() })`),
  };
};

const a = await driver();
await a.open();
console.log("1. page             :", JSON.stringify(await a.state()));

await a.submit();
console.log("2. empty submit     :", JSON.stringify(await a.state()));

await a.role("STUDENT");
await a.type("displayName", "Rasa");
await a.type("email", "ne-el-pastas");
await a.type("password", "trumpas");
await a.submit();
console.log("3. bad email, short :", JSON.stringify(await a.state()));
console.log("   values kept      :", await a.b.js(`JSON.stringify({ name: document.getElementById("displayName").value, email: document.getElementById("email").value, role: document.querySelector('input[name="role"]:checked')?.value ?? null, passwordKept: document.getElementById("password").value !== "" })`));

await a.type("email", email);
await a.type("password", "geras-slaptazodis");
const took = await a.submit();
console.log("4. valid sign-up    :", JSON.stringify(await a.state()), `(settled after ${took} ms)`);
writeFileSync("/tmp/shots/reg-after.png", await a.b.screenshot());

const c = await driver();
await c.open();
await c.role("ADULT");
await c.type("displayName", "Antras");
await c.type("email", email);
await c.type("password", "geras-slaptazodis");
await c.submit();
console.log("5. same email again :", JSON.stringify(await c.state()));

console.log("page errors         :", [...a.b.errors, ...c.b.errors].join(" | ") || "none");
a.b.close();
c.b.close();
