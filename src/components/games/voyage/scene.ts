import * as THREE from "three";
import {
  PORT_POSITIONS,
  boatPath,
  cameraGoalFor,
  mooringFor,
  boatRideHeight,
  waveHeight,
  HULL_FREEBOARD,
  HULL_HEIGHT,
  duneHeight,
  seeded,
  skyForSeason,
  type JarFill,
  type PortSlug,
} from "@/lib/games/voyage-scene-model";
import type { Weather } from "@/lib/games/schema";
import { applyWeather, weatherLook } from "@/lib/games/voyage-weather";
import { createLife } from "./life";

/**
 * The Curonian Lagoon as a low-poly diorama. Every shape is built here from primitives, so there
 * are no model files to download. The scene is a pure renderer: it receives numbers (season, port,
 * jar levels) and draws them. No game rules live here.
 */

export type SceneInit = { canvas: HTMLCanvasElement; reducedMotion: boolean };
export type SceneState = {
  season: number;
  port: PortSlug;
  gear: number;
  jars: JarFill;
  dark: boolean;
  /** What the sky is doing. Defaults to calm. */
  weather?: Weather;
};

export type VoyageScene = {
  setState: (s: SceneState) => void;
  /** Sail the boat to `to` over `ms` milliseconds. Resolves when it has arrived. */
  sail: (to: PortSlug, ms: number) => Promise<void>;
  resize: (w: number, h: number) => void;
  dispose: () => void;
};

const col = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const std = (c: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, flatShading: true, ...extra });

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cone(r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 6) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  return m;
}

/* ---------------------------------- boat ---------------------------------- */

function buildBoat(gear: number) {
  const g = new THREE.Group();
  const hull = std("#e8821c"); // amber: used for nothing else in the lagoon
  const keel = std("#7a3b12");
  const trim = std("#f7efe0");
  const sail = std("#fbf4e6", { side: THREE.DoubleSide, flatShading: false });
  const stripe = std("#c0392b", { side: THREE.DoubleSide, flatShading: false });
  const accent = std("#1e2a5a");

  // hull: a tapered box built from two wedges
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-0.5, 0);
  hullShape.lineTo(0.5, 0);
  hullShape.lineTo(0.38, 0.34);
  hullShape.lineTo(-0.38, 0.34);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.8, bevelEnabled: false });
  hullGeo.translate(0, 0, -0.9);
  const hullMesh = new THREE.Mesh(hullGeo, hull);
  hullMesh.castShadow = true;
  g.add(hullMesh);

  // bow: a point so the boat reads as having a front
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 4), hull);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = Math.PI / 4;
  bow.position.set(0, 0.17, 1.25);
  bow.scale.set(1, 1, 0.68);
  bow.castShadow = true;
  g.add(bow);

  g.add(box(0.74, 0.1, 1.72, keel, 0, 0.0, -0.02)); // waterline strip
  g.add(box(0.8, 0.07, 1.7, trim, 0, 0.34, -0.05));
  g.add(box(0.52, 0.44, 0.5, accent, 0, 0.4, -0.5)); // wheelhouse
  g.add(box(0.58, 0.07, 0.56, trim, 0, 0.84, -0.5));

  // mast and sail; better gear gets a bigger sail and a second mast
  const mast = cyl(0.025, 0.03, 1.5 + gear * 0.15, trim, 0, 0.34, 0.35, 6);
  g.add(mast);
  const sailGeo = new THREE.BufferGeometry();
  const sh = 1.15 + gear * 0.18;
  sailGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.45, 0.35, 0, 0.45 + sh, 0.35, 0, 0.45, -0.55], 3));
  sailGeo.computeVertexNormals();
  g.add(new THREE.Mesh(sailGeo, sail));
  const bandGeo = new THREE.BufferGeometry();
  const bandLow = 0.45 + sh * 0.42;
  const bandHigh = 0.45 + sh * 0.62;
  // The sail is a triangle from the mast (z = 0.35) back to the boom end (z = -0.55) at the bottom, narrowing to the
  // mast at the top. Two triangles lie on it between those heights, just proud of the cloth.
  const zLow = 0.35 - (0.9 * (bandLow - 0.45)) / sh;
  const zHigh = 0.35 - (0.9 * (bandHigh - 0.45)) / sh;
  bandGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0.004, bandLow, 0.35, 0.004, bandHigh, 0.35, 0.004, bandLow, zLow, 0.004, bandHigh, 0.35, 0.004, bandHigh, zHigh, 0.004, bandLow, zLow], 3),
  );
  bandGeo.computeVertexNormals();
  g.add(new THREE.Mesh(bandGeo, stripe));
  if (gear >= 2) g.add(cyl(0.02, 0.025, 1.1, trim, 0, 0.34, 0.95, 6));
  if (gear >= 3) {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.18), std("#f59e0b", { side: THREE.DoubleSide }));
    flag.position.set(0.17, 1.6 + gear * 0.15, 0.35);
    g.add(flag);
  }
  return g;
}

/* ---------------------------------- ports --------------------------------- */

/** A pitched roof (triangular prism) sitting on a wall of the given width and depth. */
function gable(w: number, d: number, h: number, mat: THREE.Material, x: number, y: number, z: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/**
 * A stone footing that reaches below the waterline, so a port looks built into the lagoon rather than floating on it.
 * It tops out at 0.1, under the decks (which are 0.2 and higher), so it shows as a low stone ledge and never hides a deck.
 */
function footing(w: number, d: number, mat: THREE.Material) {
  return box(w + 0.2, 0.72, d + 0.2, mat, 0, -0.62, 0);
}

/** A soft white dot, strongest in the middle and clear at the edge. It is the foam where a quay meets the water and, smaller, a snowflake. */
function softDotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(32, 32, 8, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.65)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

function buildKlaipeda(snowMat: THREE.Material) {
  const g = new THREE.Group();
  const brick = std("#b4553a");
  const steel = std("#46525e");
  const cargo = [std("#c0392b"), std("#1f6f8b"), std("#e0a526"), std("#1e2a5a")];
  const stone = std("#7d7a73");
  g.add(footing(5.2, 2.4, stone));
  g.add(box(5.2, 0.24, 2.4, std("#9a978e"), 0, 0, 0)); // quay deck
  const roofTile = std("#4a3a36");
  for (let i = 0; i < 3; i++) {
    const h = 0.8 + seeded(i + 5) * 0.4;
    const x = -1.7 + i * 1.05;
    g.add(box(0.9, h, 1.1, brick, x, 0.24, -0.5));
    g.add(gable(1.04, 1.24, 0.42, roofTile, x, 0.24 + h, -0.5));
    g.add(gable(0.9, 1.1, 0.12, snowMat, x, 0.24 + h + 0.42, -0.5));
  }
  // container stack
  for (let i = 0; i < 6; i++) {
    g.add(box(0.5, 0.26, 0.24, cargo[i % 4], 1.1 + (i % 3) * 0.55, 0.24 + Math.floor(i / 3) * 0.26, 0.2));
  }
  // portal crane
  g.add(box(0.12, 1.7, 0.12, steel, 2.1, 0.24, -0.7));
  g.add(box(0.12, 1.7, 0.12, steel, 2.1, 0.24, 0.9));
  g.add(box(0.14, 0.14, 1.9, steel, 2.1, 1.95, 0.1));
  g.add(box(2.1, 0.12, 0.12, steel, 1.1, 1.8, 0.1));
  return g;
}

function buildJuodkrante(snowMat: THREE.Material) {
  const g = new THREE.Group();
  const wood = std("#8a5a33");
  const dark = std("#5b3a20");
  g.add(box(1.7, 0.16, 4.6, wood, 0, 0, -0.4)); // pier running out into the lagoon
  for (let i = 0; i < 7; i++) g.add(cyl(0.05, 0.05, 0.5, dark, i % 2 ? 0.7 : -0.7, -0.35, -2.3 + i * 0.75, 5));
  g.add(box(1.5, 0.7, 1.1, std("#e7c27d"), 0.1, 0.16, 1.4)); // amber stall
  g.add(box(1.7, 0.12, 1.3, std("#c0392b"), 0.1, 0.86, 1.4)); // awning
  g.add(box(1.7, 0.07, 1.3, snowMat, 0.1, 0.98, 1.4));
  // amber lumps on the counter, glowing
  const amber = std("#f59e0b", { emissive: new THREE.Color("#b45309"), emissiveIntensity: 0.6, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 + seeded(i) * 0.05, 0), amber);
    a.position.set(-0.3 + i * 0.22, 0.88 + 0.04, 1.0);
    g.add(a);
  }
  // fishing hut on the shore
  g.add(box(0.9, 0.55, 0.9, std("#5d7f8a"), -1.7, 0.1, 0.4));
  g.add(cone(0.8, 0.5, std("#a04a2b"), -1.7, 0.65, 0.4, 4)).rotation.y = Math.PI / 4;
  return g;
}

function buildNida(snowMat: THREE.Material) {
  const g = new THREE.Group();
  const sand = std("#e8d4a2");
  const white = std("#f6f2e8");
  const redroof = std("#b23a2a");
  g.add(footing(4.2, 2.3, std("#a99a72")));
  g.add(box(4.2, 0.2, 2.3, sand, 0, 0, 0));
  // lighthouse: Nida has the famous one
  g.add(cyl(0.34, 0.5, 2.4, white, -1.3, 0.2, -0.3, 10));
  g.add(cyl(0.4, 0.4, 0.14, std("#2b2b2b"), -1.3, 2.6, -0.3, 10));
  g.add(cone(0.34, 0.34, redroof, -1.3, 2.75, -0.3, 10));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), std("#fff1b0", { emissive: new THREE.Color("#ffcf5a"), emissiveIntensity: 1.2 }));
  lamp.position.set(-1.3, 2.62, -0.3);
  g.add(lamp);
  const light = new THREE.PointLight("#ffd27a", 1.6, 9, 1.5);
  light.position.set(-1.3, 2.7, -0.3);
  g.add(light);
  // fishermen's houses in Nida style: steep roofs
  for (let i = 0; i < 3; i++) {
    const x = 0.5 + i * 1.05;
    g.add(box(0.8, 0.5, 0.9, std(["#7d9aa8", "#c9a56b", "#8aa37a"][i]), x, 0.2, 0.5));
    const roof = cone(0.78, 0.62, i % 2 ? redroof : std("#8c3b2c"), x, 0.7, 0.5, 4);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.add(cone(0.6, 0.12, snowMat, x, 1.16, 0.5, 4)).rotation.y = Math.PI / 4;
  }
  return g;
}

/* ---------------------------------- terrain ------------------------------- */

function buildSpit(snowMat: THREE.MeshStandardMaterial) {
  const size = 60;
  const seg = 110;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors: number[] = [];
  const sand = col(0.9, 0.8, 0.58);
  const grass = col(0.34, 0.52, 0.3);
  const pine = col(0.16, 0.34, 0.24);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = duneHeight(x, z);
    pos.setY(i, h - 0.5);
    // sand at the crest, grass and pine lower down, so the spit reads as dunes with forest behind
    const c = h > 1.2 ? sand : h > 0.35 ? sand.clone().lerp(grass, 0.6) : h > 0.05 ? grass.clone().lerp(pine, 0.4) : sand;
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  void snowMat;
  return mesh;
}

function buildTrees(snowMat: THREE.Material) {
  const g = new THREE.Group();
  const trunk = std("#5b3a20");
  const needles = [std("#1d4a35"), std("#235a40"), std("#2d6a4a")];
  for (let i = 0; i < 70; i++) {
    const a = seeded(i * 3 + 1);
    const b = seeded(i * 3 + 2);
    const x = 7.2 + a * 7;
    const z = -9 + b * 21;
    const h = duneHeight(x, z);
    if (h < 0.05 || h > 1.6) continue;
    const s = 0.7 + seeded(i + 40) * 0.7;
    const t = new THREE.Group();
    t.add(cyl(0.05 * s, 0.07 * s, 0.35 * s, trunk, 0, 0, 0, 5));
    t.add(cone(0.4 * s, 0.9 * s, needles[i % 3], 0, 0.3 * s, 0, 6));
    t.add(cone(0.3 * s, 0.7 * s, needles[(i + 1) % 3], 0, 0.75 * s, 0, 6));
    t.add(cone(0.2 * s, 0.5 * s, snowMat, 0, 1.15 * s, 0, 6));
    t.position.set(x, h - 0.5, z);
    g.add(t);
  }
  return g;
}

/* ---------------------------------- jars ---------------------------------- */

function buildJar(color: string) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.56, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: "#cfe8f0", transparent: true, opacity: 0.35, roughness: 0.1, side: THREE.DoubleSide }),
  );
  glass.position.y = 0.28;
  g.add(glass);
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 14), std(color, { flatShading: false, roughness: 0.4 }));
  fill.position.y = 0.03;
  fill.userData.fill = true;
  g.add(fill);
  g.add(cyl(0.21, 0.21, 0.05, std("#444"), 0, 0.56, 0, 14));
  return g;
}

/* ---------------------------------- scene --------------------------------- */

export function createVoyageScene({ canvas, reducedMotion }: SceneInit): VoyageScene {
  // A touch screen or a narrow window is almost always a phone or tablet: draw fewer pixels and cheaper shadows there.
  const light = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !light, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = light ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xdfe7ea, 0.03);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);

  const hemi = new THREE.HemisphereLight(0xcfe3f5, 0xd9c79a, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(light ? 512 : 1024, light ? 512 : 1024);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  // sky: a big inverted sphere with a vertical gradient
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float t = clamp(vP.y * 1.6 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(t, 0.7)), 1.0); }",
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 16), skyMat);
  scene.add(sky);

  // water: a plane with a gently animated vertex wave
  const waterGeo = new THREE.PlaneGeometry(140, 140, 70, 70);
  waterGeo.rotateX(-Math.PI / 2);
  const waterBase = waterGeo.attributes.position.array.slice() as Float32Array;
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1b8a98, roughness: 0.18, metalness: 0.05, flatShading: true, transparent: true, opacity: 0.94 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.receiveShadow = true;
  scene.add(water);

  const snowMat = std("#f4f8fb", { roughness: 0.9 });
  const snowAmount = { v: 0 };
  snowMat.opacity = 1;

  scene.add(buildSpit(snowMat));
  scene.add(buildTrees(snowMat));
  const life = createLife();
  scene.add(life.group);

  const ports: Record<PortSlug, THREE.Group> = { klaipeda: buildKlaipeda(snowMat), juodkrante: buildJuodkrante(snowMat), nida: buildNida(snowMat) };
  (Object.keys(ports) as PortSlug[]).forEach((k) => {
    ports[k].position.set(PORT_POSITIONS[k].x, 0.02, PORT_POSITIONS[k].z);
    scene.add(ports[k]);
  });
  // foam around each port, so the stone and the pier posts meet the water instead of hovering over it
  const foamTex = softDotTexture();
  const foamMat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.6, depthWrite: false });
  const FOAM_SIZE: Record<PortSlug, [number, number]> = { klaipeda: [7.4, 4.6], juodkrante: [3.6, 6.4], nida: [6.4, 4.5] };
  (Object.keys(ports) as PortSlug[]).forEach((k) => {
    const [fw, fd] = FOAM_SIZE[k];
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = 0.07;
    foam.renderOrder = 1;
    ports[k].add(foam);
  });
  ports.klaipeda.rotation.y = Math.PI * 0.04;
  ports.juodkrante.rotation.y = -Math.PI * 0.5;
  ports.nida.rotation.y = Math.PI * 0.02;

  // jars on the Klaipeda quay (so the player sees the money they are splitting)
  const jarGroup = new THREE.Group();
  const jars = { tax: buildJar("#d97706"), cushion: buildJar("#2f55d4"), cash: buildJar("#7dd3fc") };
  Object.values(jars).forEach((j, i) => {
    j.position.set(-0.7 + i * 0.7, 0, 0);
    jarGroup.add(j);
  });
  jarGroup.scale.setScalar(0.9);
  jarGroup.position.set(-2.6, 0.28, -6.2);
  scene.add(jarGroup);

  // snow particles
  const SNOW_COUNT = 260;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(SNOW_COUNT * 3);
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowPos[i * 3] = (seeded(i) - 0.5) * 30;
    snowPos[i * 3 + 1] = seeded(i + 100) * 14;
    snowPos[i * 3 + 2] = (seeded(i + 200) - 0.5) * 30;
  }
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const flakeTex = softDotTexture();
  const flakes = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({ color: 0xffffff, map: flakeTex, size: 0.2, sizeAttenuation: true, transparent: true, opacity: 0.0, depthWrite: false, alphaTest: 0.02 }),
  );
  scene.add(flakes);

  // rain: streaks that fall diagonally with the wind. One draw call; hidden when it is not raining.
  const RAIN_COUNT = 700;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 6); // each drop: a top point and a bottom point
  const dropX = new Float32Array(RAIN_COUNT);
  const dropY = new Float32Array(RAIN_COUNT);
  const dropZ = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    dropX[i] = (seeded(i + 300) - 0.5) * 34;
    dropY[i] = seeded(i + 400) * 14;
    dropZ[i] = (seeded(i + 500) - 0.5) * 34;
  }
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const RAIN_LEN = 0.7;
  const writeRain = () => {
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPos[i * 6] = dropX[i];
      rainPos[i * 6 + 1] = dropY[i];
      rainPos[i * 6 + 2] = dropZ[i];
      rainPos[i * 6 + 3] = dropX[i] - windStrength * 0.18;
      rainPos[i * 6 + 4] = dropY[i] - RAIN_LEN;
      rainPos[i * 6 + 5] = dropZ[i];
    }
    (rainGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  };
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe0ee, transparent: true, opacity: 0, depthWrite: false }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  // Cloud cover is shown by the shade it throws on the water. The camera looks down at the lagoon and never sees the sky,
  // so cloud meshes could only ever hang between the lens and the water and hide the ports (they did).
  const cloudUniforms = { time: { value: 0 }, cover: { value: 0 } };
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCloudTime = cloudUniforms.time;
    shader.uniforms.uCloudCover = cloudUniforms.cover;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vCloudPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCloudPos = position.xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vCloudPos;
uniform float uCloudTime;
uniform float uCloudCover;
float cloudHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cloudNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cloudHash(i), cloudHash(i + vec2(1.0, 0.0)), f.x), mix(cloudHash(i + vec2(0.0, 1.0)), cloudHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`,
      )
      .replace(
        "#include <fog_fragment>",
        `vec2 cloudP = vCloudPos * 0.07 + vec2(uCloudTime * 0.012, uCloudTime * 0.004);
float cloudN = cloudNoise(cloudP) * 0.6 + cloudNoise(cloudP * 2.3 + 7.0) * 0.4;
float cloudShade = smoothstep(0.62 - uCloudCover * 0.3, 0.8 - uCloudCover * 0.2, cloudN) * uCloudCover;
gl_FragColor.rgb *= 1.0 - cloudShade * 0.55;
#include <fog_fragment>`,
      );
  };

  // lightning: a soft flash of the sky and sun, never a hard strobe (at most once every few seconds)
  let flash = 0;
  let nextFlash = 4;

  // boat wake: foam flecks that trail behind the boat while it sails
  const WAKE_COUNT = 26;
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xf4f8fb, transparent: true, opacity: 0.0, depthWrite: false });
  const wake = new THREE.Group();
  const wakeFlecks: { m: THREE.Mesh; age: number }[] = [];
  for (let i = 0; i < WAKE_COUNT; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.16, 6), wakeMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
    m.visible = false;
    wake.add(m);
    wakeFlecks.push({ m, age: 1 });
  }
  scene.add(wake);
  let wakeIndex = 0;
  let wakeClock = 0;

  let boat = buildBoat(1);
  boat.scale.setScalar(1.45);
  let boatGear = 1;
  const boatPivot = new THREE.Group();
  boatPivot.add(boat);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.42, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 2; // transparent things on the water draw after it, whatever their distance from the camera
  ring.position.y = 0.04 + (HULL_HEIGHT - HULL_FREEBOARD); // just above the water, in the pivot's own space
  boatPivot.add(ring);
  scene.add(boatPivot);

  let state: SceneState = { season: 0.5, port: "klaipeda", gear: 1, jars: { tax: 0, cushion: 0, cash: 0 }, dark: false, weather: "calm" };
  let at: PortSlug = "klaipeda";
  let sailing: { from: PortSlug; to: PortSlug; start: number; ms: number; done: () => void } | null = null;
  let disposed = false;
  let raf = 0;
  let camAngle = -0.5;
  let waveAmp = 0.05;
  let windStrength = 0.12;
  let lightningRate = 0;
  const camTarget = new THREE.Vector3(0, 0, 0);
  const camGoal = new THREE.Vector3(0, 0, 0);
  let camDist = 16.5;
  let lastFrameT = 0;
  /** Where the boat's keel sits at (x, z): on the swell, or on flat water when motion is reduced and no swell is drawn. */
  const rideAt = (x: number, z: number, t: number) => boatRideHeight(x, z, t, reducedMotion ? 0 : waveAmp, windStrength);

  function applyLook() {
    const weatherNow = state.weather ?? "calm";
    const wx = weatherLook(weatherNow);
    const look = applyWeather(skyForSeason(state.season), weatherNow);
    const night = state.dark ? 0.55 : 1;
    const top = new THREE.Color(...look.top).multiplyScalar(night);
    const horizon = new THREE.Color(...look.horizon).multiplyScalar(night);
    skyMat.uniforms.top.value.copy(top);
    skyMat.uniforms.horizon.value.copy(horizon);
    (scene.fog as THREE.FogExp2).color.copy(horizon);
    (scene.fog as THREE.FogExp2).density = look.fogDensity;
    scene.background = horizon;
    sun.color.setRGB(...look.sun);
    sun.intensity = (1.0 + look.sunHeight * 2.4) * (state.dark ? 0.55 : 1);
    sun.position.set(-12, 6 + look.sunHeight * 22, 10);
    hemi.intensity = (0.5 + look.sunHeight * 0.5) * (state.dark ? 0.6 : 1);
    waterMat.color.setRGB(...look.waterTint);
    foamMat.opacity = (state.dark ? 0.3 : 0.6) * (0.55 + 0.45 * Math.min(1, look.sunHeight * 2));
    snowAmount.v = look.snow;
    // weather you can see: rain falls only when it is not snowing, clouds fade in with the cloud cover
    rain.visible = wx.rain > 0 && look.snow < 0.5;
    (rain.material as THREE.LineBasicMaterial).opacity = wx.rain * 0.7;
    writeRain();
    cloudUniforms.cover.value = wx.cloud;
    waveAmp = 0.05 * (0.4 + wx.waveHeight * 1.6);
    windStrength = wx.wind;
    lightningRate = wx.lightning;
    life.setMood(look.snow, state.dark);
    (flakes.material as THREE.PointsMaterial).opacity = look.snow * 0.85;
    // snow settles on roofs and treetops by tinting the shared snow material toward the ground colour
    snowMat.color.set(look.snow > 0.15 ? "#f4f8fb" : "#8fae7a");
    snowMat.emissive.setScalar(0);
    snowMat.visible = true;
  }

  function applyJars() {
    const set = (jar: THREE.Group, level: number) => {
      const fill = jar.children.find((c) => c.userData.fill) as THREE.Mesh;
      const h = Math.max(0.001, level * 0.5);
      fill.scale.y = h / 0.5;
      fill.position.y = 0.03 - (0.5 - h) / 2;
    };
    set(jars.tax, state.jars.tax);
    set(jars.cushion, state.jars.cushion);
    set(jars.cash, state.jars.cash);
  }

  function rebuildBoat(gear: number) {
    boatPivot.remove(boat);
    boat.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    boat = buildBoat(gear);
    boat.scale.setScalar(1.45);
    boatPivot.add(boat);
    boatGear = gear;
  }

  function placeBoat(port: PortSlug) {
    const m = mooringFor(port);
    boatPivot.position.set(m.x, rideAt(m.x, m.z, lastFrameT), m.z);
    boatPivot.rotation.y = Math.PI * 0.8;
    at = port;
  }

  function focusOn(port: PortSlug) {
    const g = cameraGoalFor(port);
    camGoal.set(g.x, 0, g.z);
  }

  function setState(s: SceneState) {
    const portChanged = s.port !== state.port;
    state = s;
    applyLook();
    applyJars();
    if (s.gear !== boatGear) rebuildBoat(s.gear);
    if (!sailing && (portChanged || at !== s.port)) placeBoat(s.port);
    focusOn(s.port);
  }

  function sail(to: PortSlug, ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (reducedMotion || to === at) {
        placeBoat(to);
        resolve();
        return;
      }
      sailing = { from: at, to, start: performance.now(), ms, done: resolve };
    });
  }

  function resize(w: number, h: number) {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    // narrow screens need the camera further back to keep the whole lagoon in view
    camDist = camera.aspect < 0.8 ? 25 : camera.aspect < 1.3 ? 20 : 16.5;
    camera.updateProjectionMatrix();
  }

  function frame(now: number) {
    if (disposed) return;
    if (document.hidden) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const t = now / 1000;
    // seconds since the last frame, capped so a tab that was paused does not make the camera jump
    const dt = Math.min(0.1, Math.max(0, t - lastFrameT));
    lastFrameT = t;

    if (!reducedMotion) {
      const wp = waterGeo.attributes.position;
      for (let i = 0; i < wp.count; i++) {
        const x = waterBase[i * 3];
        const z = waterBase[i * 3 + 2];
        if (x * x + z * z > 900) continue; // beyond 30 units the fog hides the waves
        wp.setY(i, waveHeight(x, z, t, waveAmp, windStrength));
      }
      wp.needsUpdate = true;
      waterGeo.computeVertexNormals();
      camAngle = -0.5 + Math.sin(t * 0.12) * 0.1;
      life.update(t);

      if (rain.visible) {
        const fall = 0.3 + windStrength * 0.22;
        for (let i = 0; i < RAIN_COUNT; i++) {
          dropY[i] -= fall;
          dropX[i] += windStrength * 0.1;
          if (dropY[i] < -0.4) {
            dropY[i] = 14;
            dropX[i] = (seeded(i + 300 + Math.floor(t)) - 0.5) * 34;
          }
        }
        writeRain();
      }
      cloudUniforms.time.value = t;

      // soft lightning: a quick lift of the sky colour, then a slow fade
      if (lightningRate > 0 && t > nextFlash) {
        flash = 1;
        nextFlash = t + 4 + (1 - lightningRate) * 6 + seeded(Math.floor(t)) * 5;
      }
      if (flash > 0) {
        flash = Math.max(0, flash - 0.045);
        const lift = flash * 0.22;
        hemi.intensity += lift;
        skyMat.uniforms.top.value.offsetHSL(0, 0, lift * 0.35);
      }

      if (snowAmount.v > 0.05) {
        const a = snowGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < SNOW_COUNT; i++) {
          let y = a.getY(i) - 0.012 - seeded(i) * 0.012;
          if (y < -0.4) y = 14;
          a.setY(i, y);
          a.setX(i, a.getX(i) + Math.sin(t + i) * 0.003);
        }
        a.needsUpdate = true;
      }
    }

    if (sailing) {
      const k = (now - sailing.start) / sailing.ms;
      const p = boatPath(sailing.from, sailing.to, Math.min(1, k));
      boatPivot.position.set(p.x, rideAt(p.x, p.z, t), p.z);
      boatPivot.rotation.y = p.heading;
      boat.rotation.z = Math.sin(t * 2.2) * 0.05;
      wakeClock += 1;
      if (wakeClock % 3 === 0) {
        const f = wakeFlecks[wakeIndex++ % WAKE_COUNT];
        f.age = 0;
        f.m.visible = true;
        const wx2 = p.x - Math.sin(p.heading) * 1.3;
        const wz2 = p.z - Math.cos(p.heading) * 1.3;
        f.m.position.set(wx2, (reducedMotion ? 0 : waveHeight(wx2, wz2, t, waveAmp, windStrength)) + 0.05, wz2);
        f.m.scale.setScalar(1);
      }
      if (k >= 1) {
        const done = sailing.done;
        at = sailing.to;
        sailing = null;
        placeBoat(at);
        done();
      }
    } else if (!reducedMotion) {
      boatPivot.position.y = rideAt(boatPivot.position.x, boatPivot.position.z, t);
      boat.rotation.z = Math.sin(t * 1.1) * 0.03;
    }

    if (sailing) {
      // follow the boat while it sails; otherwise rest on the port
      camGoal.set(boatPivot.position.x * 0.8, 0, boatPivot.position.z * 0.8 + 0.5);
    }
    wakeFlecks.forEach((f) => {
      if (f.age >= 1) {
        f.m.visible = false;
        return;
      }
      f.age += 0.025;
      f.m.scale.setScalar(1 + f.age * 2.4);
      (f.m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - f.age);
    });
    // the same glide on a slow phone and a fast laptop: 0.04 and 0.07 per frame were tuned at 60 frames a second
    const glide = 1 - Math.pow(1 - (sailing ? 0.07 : 0.04), dt * 60);
    camTarget.lerp(camGoal, reducedMotion ? 1 : glide);
    camera.position.set(camTarget.x + Math.sin(camAngle) * camDist * 0.62, camDist * 0.46, camTarget.z + Math.cos(camAngle) * camDist * 0.82);
    camera.lookAt(camTarget.x, 0.6, camTarget.z);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  applyLook();
  applyJars();
  placeBoat("klaipeda");
  focusOn("klaipeda");
  camTarget.copy(camGoal);
  raf = requestAnimationFrame(frame);

  return {
    setState,
    sail,
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      life.dispose();
      wakeFlecks.forEach((f) => (f.m.material as THREE.Material).dispose());
      ringMat.dispose();
      foamTex.dispose();
      flakeTex.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material;
          (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
    },
  };
}
