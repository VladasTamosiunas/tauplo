import * as THREE from "three";
import { PORT_POSITIONS, seeded, type PortSlug } from "@/lib/games/voyage-scene-model";

/**
 * Small things that make the lagoon feel inhabited: gulls, chimney smoke, buoys, reeds, drifting
 * fishing boats, and windows that glow when the days are short. Everything is built from
 * primitives and animated through transforms only. `setMood` is told how wintry it is (0 to 1).
 */

export type Life = {
  group: THREE.Group;
  update: (t: number) => void;
  setMood: (winter: number, night: boolean) => void;
  dispose: () => void;
};

const flat = (c: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...extra });

/* ---- gulls: two flat wings that flap while the bird circles a port ---- */

function buildGull() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: "#f7f7f4", side: THREE.DoubleSide });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.04, 0.34, 0.02, 0.1, 0.3, 0.02, -0.1], 3));
  wingGeo.computeVertexNormals();
  const l = new THREE.Mesh(wingGeo, mat);
  const r = new THREE.Mesh(wingGeo, mat);
  r.scale.x = -1;
  g.add(l, r);
  g.userData.wings = [l, r];
  return g;
}

/* ---- smoke: a few soft puffs that rise, grow and fade ---- */

function buildSmoke(count: number) {
  const g = new THREE.Group();
  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({ color: "#d9dde0", transparent: true, opacity: 0.0, depthWrite: false }),
    );
    m.userData.phase = i / count;
    puffs.push(m);
    g.add(m);
  }
  g.userData.puffs = puffs;
  return g;
}

function buildBuoy(color: string) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), flat(color));
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 8), flat("#f6f2e8"));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 4), flat("#444"));
  pole.position.y = 0.3;
  g.add(body, stripe, pole);
  return g;
}

function buildReeds(seed: number) {
  const g = new THREE.Group();
  const mat = flat("#a8946a");
  for (let i = 0; i < 14; i++) {
    const h = 0.5 + seeded(seed + i) * 0.5;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, h, 4), mat);
    stalk.position.set((seeded(seed + i + 50) - 0.5) * 1.3, h / 2, (seeded(seed + i + 90) - 0.5) * 0.6);
    stalk.rotation.z = (seeded(seed + i + 130) - 0.5) * 0.3;
    g.add(stalk);
  }
  return g;
}

/** A small fishing boat that drifts on its own, so the lagoon is not empty when the player's boat is elsewhere. */
function buildFisher(hull: string) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 1.0), flat(hull));
  body.position.y = 0.09;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), flat("#f2ead8"));
  cabin.position.set(0, 0.28, -0.2);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), flat("#444"));
  pole.position.set(0, 0.5, 0.25);
  g.add(body, cabin, pole);
  return g;
}

export function createLife(): Life {
  const group = new THREE.Group();

  // gulls circle the three ports at different heights and speeds
  const gulls: { g: THREE.Group; port: PortSlug; r: number; speed: number; phase: number; h: number }[] = [];
  (Object.keys(PORT_POSITIONS) as PortSlug[]).forEach((port, pi) => {
    for (let i = 0; i < 3; i++) {
      const g = buildGull();
      g.scale.setScalar(0.62);
      group.add(g);
      gulls.push({ g, port, r: 2.2 + seeded(pi * 7 + i) * 2.2, speed: 0.35 + seeded(pi * 7 + i + 20) * 0.35, phase: seeded(pi * 7 + i + 40) * 6.28, h: 2.2 + seeded(pi * 7 + i + 60) * 1.6 });
    }
  });

  // smoke from a chimney in each port
  const smokes: { s: THREE.Group; at: THREE.Vector3 }[] = [];
  const chimneys: Record<PortSlug, [number, number, number]> = {
    klaipeda: [-3.9, 0.9, -9.5],
    juodkrante: [2.1, 0.9, 0.5],
    nida: [0.2, 1.5, 8.9],
  };
  (Object.keys(chimneys) as PortSlug[]).forEach((k) => {
    const s = buildSmoke(5);
    const c = chimneys[k];
    s.position.set(c[0], c[1], c[2]);
    group.add(s);
    smokes.push({ s, at: new THREE.Vector3(...c) });
  });

  // buoys marking the channel between the ports
  const buoys: { b: THREE.Group; phase: number }[] = [];
  const buoyAt: [number, number, string][] = [
    [-1.2, -6, "#c0392b"], [0.4, -4.2, "#f6f2e8"], [1.7, -2.4, "#c0392b"],
    [0.6, 2.4, "#f6f2e8"], [-0.4, 4.6, "#c0392b"], [-1.8, 6.4, "#f6f2e8"],
  ];
  buoyAt.forEach(([x, z, c], i) => {
    const b = buildBuoy(c);
    b.position.set(x, -0.28, z);
    group.add(b);
    buoys.push({ b, phase: i * 0.9 });
  });

  // reeds along the spit shore
  [[7.4, -6], [7.9, -2.5], [7.2, 1.5], [7.8, 5]].forEach(([x, z], i) => {
    const r = buildReeds(i * 13);
    r.position.set(x, -0.35, z);
    group.add(r);
  });

  // two ambient fishing boats drifting slowly along fixed lanes
  const fishers = [
    { g: buildFisher("#2f5d73"), a: [-6, -3] as [number, number], b: [-5, 3] as [number, number], speed: 0.018, phase: 0.2 },
    { g: buildFisher("#9a4a2b"), a: [4.8, 3] as [number, number], b: [3.6, 8] as [number, number], speed: 0.014, phase: 0.7 },
  ];
  fishers.forEach((f) => group.add(f.g));

  // warm windows: small emissive panes on a few houses, brighter the more wintry (darker) the month is
  const windowMat = new THREE.MeshBasicMaterial({ color: "#ffd27a" });
  const windows: THREE.Mesh[] = [];
  const winAt: [number, number, number][] = [
    [-4.82, 0.8, -9.55], [-3.77, 0.8, -9.55], [-2.72, 0.8, -9.55],
  ];
  winAt.forEach(([x, y, z]) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), windowMat);
    w.position.set(x, y, z);
    w.visible = false;
    group.add(w);
    windows.push(w);
  });

  let winter = 0;

  function setMood(w: number, night: boolean) {
    winter = w;
    const lit = w > 0.35 || night;
    windows.forEach((m) => (m.visible = lit));
  }

  function update(t: number) {
    gulls.forEach((o, i) => {
      const c = PORT_POSITIONS[o.port];
      const a = t * o.speed + o.phase;
      o.g.position.set(c.x + Math.cos(a) * o.r, o.h + Math.sin(t * 1.3 + i) * 0.18, c.z + Math.sin(a) * o.r);
      o.g.rotation.y = -a + Math.PI;
      const flap = Math.sin(t * 6 + i) * 0.5;
      const wings = o.g.userData.wings as THREE.Mesh[];
      wings[0].rotation.z = flap;
      wings[1].rotation.z = -flap;
      o.g.visible = winter < 0.85; // gulls leave in the deepest cold
    });
    smokes.forEach(({ s }) => {
      (s.userData.puffs as THREE.Mesh[]).forEach((p) => {
        const k = (t * 0.22 + (p.userData.phase as number)) % 1;
        p.position.set(Math.sin(k * 5 + p.userData.phase * 9) * 0.12 + k * 0.5, k * 1.6, 0);
        p.scale.setScalar(0.5 + k * 1.6);
        (p.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (0.18 + winter * 0.32);
      });
    });
    buoys.forEach(({ b, phase }) => {
      b.position.y = -0.28 + Math.sin(t * 1.3 + phase) * 0.04;
      b.rotation.z = Math.sin(t * 1.1 + phase) * 0.12;
    });
    fishers.forEach((f) => {
      const k = (Math.sin(t * f.speed * 6.28 + f.phase * 6.28) + 1) / 2;
      const x = f.a[0] + (f.b[0] - f.a[0]) * k;
      const z = f.a[1] + (f.b[1] - f.a[1]) * k;
      f.g.position.set(x, -0.3 + Math.sin(t * 1.2 + f.phase) * 0.025, z);
      f.g.rotation.y = Math.atan2(f.b[0] - f.a[0], f.b[1] - f.a[1]) + (Math.cos(t * f.speed * 6.28 + f.phase * 6.28) < 0 ? Math.PI : 0);
    });
  }

  function dispose() {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
    });
  }

  setMood(0, false);
  return { group, update, setMood, dispose };
}
