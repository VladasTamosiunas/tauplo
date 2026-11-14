// Small helpers for driving real Chrome over the DevTools protocol. No dependencies.
// Used by tools/play-voyage.mjs, tools/shoot.mjs and tools/overflow.mjs.
import { spawn } from "node:child_process";

export const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let nextPort = 9400 + Math.floor(Math.random() * 400);

/** Starts Chrome (software WebGL, so the 3D scene draws without a GPU) and returns a small client. */
export async function launch({ webgl = true } = {}) {
  const port = nextPort++;
  const flags = ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/tauplo-chrome-${port}`, "about:blank"];
  if (webgl) flags.unshift("--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist");
  const chrome = spawn(CHROME, flags, { stdio: "ignore" });

  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const tabs = await (await fetch(`http://localhost:${port}/json`)).json();
      const page = tabs.find((t) => t.type === "page");
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r) => (ws.onopen = r));
      }
    } catch {}
    await sleep(250);
  }
  if (!ws) throw new Error("Chrome did not start");

  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d.result ?? d);
      pending.delete(d.id);
    }
    if (d.method === "Runtime.exceptionThrown") errors.push((d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text ?? "").slice(0, 160));
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");

  return {
    send,
    errors,
    /** Evaluates JavaScript in the page and returns the value. */
    js: async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value,
    /** Emulates a device. `mobile` makes Chrome lay the page out at exactly `width` (a plain window cannot go below ~500px). */
    viewport: (width, height, { mobile = width < 600, scheme = "light" } = {}) =>
      send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile }).then(() =>
        send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] }),
      ),
    setCookie: (name, value, url) => send("Network.setCookie", { name, value, url }),
    goto: async (url, wait = 2500) => {
      await send("Page.navigate", { url });
      await sleep(wait);
    },
    screenshot: async (clip) => {
      const params = { format: "png", captureBeyondViewport: true };
      if (clip) params.clip = { ...clip, scale: 1 };
      return Buffer.from((await send("Page.captureScreenshot", params)).data, "base64");
    },
    close: () => {
      try {
        ws.close();
      } catch {}
      chrome.kill();
    },
  };
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Registers a throwaway student through the real form and returns its session token. */
export async function register(base, name = "Tikrintojas") {
  const html = await (await fetch(base + "/registruotis")).text();
  const fd = new FormData();
  for (const m of html.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?\/?>/g)) fd.set(m[1], m[2] ? decode(m[2]) : "");
  const email = `${name.toLowerCase()}${Date.now()}@example.lt`;
  Object.entries({ role: "STUDENT", displayName: name, email, password: "geras-slaptazodis" }).forEach(([k, v]) => fd.set(k, v));
  const res = await fetch(base + "/registruotis", { method: "POST", body: fd, redirect: "manual" });
  const token = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("tauplo_session="))?.split("=")[1];
  if (!token) throw new Error("registration did not return a session");
  return { email, token };
}
