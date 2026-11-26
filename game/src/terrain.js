// Solara Skies — the bay itself: terrain, water, runway, rings, clouds.
// One job: answer "how high is the ground here?" and hand the renderer
// the lists of things to draw (terrain cells, rings, airfield buildings,
// clouds). All placement is seeded, so the bay never changes shape.

import { CONFIG, PALETTE } from './config.js';
import { makeNoise, makeRng } from './random.js';

const SEED = 20261126;
const noise = makeNoise(SEED);
const rng = makeRng(SEED + 7);

// --- Heightfield -----------------------------------------------------------

const HALF = CONFIG.worldSize / 2;
export const CELLS = CONFIG.terrainCells;
export const CELL = CONFIG.worldSize / CELLS;

// Two mountain peaks and a chain of low hills around the bay.
const PEAKS = [
  { x: -1250, z: 1150, height: 210, radius: 620 },
  { x: 1350, z: 950, height: 175, radius: 540 },
  { x: -300, z: 1500, height: 95, radius: 700 },
  { x: 1500, z: -1400, height: 120, radius: 560 },
];

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function islandMask(x, z) {
  // Land fills the chart out to ~1700 m, then falls away into open sea.
  const d = Math.hypot(x, z);
  return 1 - smoothstep(1700, 2100, d);
}

function rawHeight(x, z) {
  const hills = noise.fbm(x * 0.0016 + 11, z * 0.0016 + 7, 4);
  let h = 6 + hills * 34;
  for (const p of PEAKS) {
    const d = Math.hypot(x - p.x, z - p.z);
    const fall = Math.max(0, 1 - d / p.radius);
    h += p.height * fall * fall;
  }
  // A lagoon in the south bay: open water ringed by beaches.
  const lagoon = 1 - smoothstep(200, 520, Math.hypot(x - 100, z - 900));
  h -= 30 * lagoon;
  // Blend land down into the sea away from the island.
  const mask = islandMask(x, z);
  h = h * (0.3 + 0.7 * mask) - 12 * (1 - mask);
  return h;
}

function flattenRunway(x, z) {
  // Keep the airfield table-flat so landings read as landings.
  const r = CONFIG.runway;
  const dx = Math.abs(x - r.x);
  const dz = Math.abs(z - r.z);
  if (dx < 130 && dz < r.length / 2 + 130) {
    const edgeX = Math.max(0, (dx - 70) / 60);
    const edgeZ = Math.max(0, (dz - (r.length / 2 + 70)) / 60);
    const edge = Math.max(edgeX, edgeZ);
    const t = Math.min(1, edge);
    return t; // 0 inside the field, 1 outside it
  }
  return 1;
}

export function groundHeight(x, z) {
  if (x < -HALF || x > HALF || z < -HALF || z > HALF) return -20;
  const h = rawHeight(x, z);
  const t = flattenRunway(x, z);
  return h * t + 1.6 * (1 - t);
}

// Precomputed grid, so the renderer never recomputes a height twice.
export const HEIGHTS = (() => {
  const grid = new Float32Array((CELLS + 1) * (CELLS + 1));
  for (let j = 0; j <= CELLS; j++) {
    for (let i = 0; i <= CELLS; i++) {
      const x = -HALF + i * CELL;
      const z = -HALF + j * CELL;
      grid[j * (CELLS + 1) + i] = groundHeight(x, z);
    }
  }
  return grid;
})();

export function heightAtGrid(i, j) {
  return HEIGHTS[j * (CELLS + 1) + i];
}

export function cellX(i) {
  return -HALF + i * CELL;
}
export function cellZ(j) {
  return -HALF + j * CELL;
}

// --- Terrain colour ---------------------------------------------------------

export function terrainColour(h, slope) {
  if (h < 1.2) return PALETTE.sand;
  if (h < 8) return slope > 0.55 ? PALETTE.forest : PALETTE.grass;
  if (h < 55) return slope > 0.6 ? PALETTE.rock : PALETTE.forest;
  if (h < 120) return PALETTE.rock;
  return PALETTE.snow;
}

// --- The ring course --------------------------------------------------------

export const RINGS = (() => {
  const spots = [
    { x: 0, z: -1400, y: 90 },
    { x: -700, z: -1250, y: 120 },
    { x: -1150, z: -500, y: 110 },
    { x: -900, z: 350, y: 80 },
    { x: -150, z: 900, y: 130 },
    { x: 750, z: 800, y: 100 },
    { x: 1200, z: 0, y: 140 },
    { x: 700, z: -900, y: 90 },
  ];
  return spots.map((s, i) => ({
    index: i,
    x: s.x,
    y: s.y,
    z: s.z,
    radius: 26,
    passed: false,
    // Rings face along the course, toward the next ring.
    heading: Math.atan2(
      (spots[(i + 1) % spots.length].x - s.x),
      (spots[(i + 1) % spots.length].z - s.z),
    ),
  }));
})();

// --- Airfield buildings ------------------------------------------------------

export const BUILDINGS = [
  // Two hangars east of the runway.
  { x: 95, z: -520, w: 46, d: 34, h: 16, colour: '#b8c4c9', roof: '#5d7d8c' },
  { x: 95, z: -640, w: 46, d: 34, h: 16, colour: '#b8c4c9', roof: '#5d7d8c' },
  // Control tower west of the runway.
  { x: -95, z: -580, w: 18, d: 18, h: 52, colour: '#cfd6da', roof: '#2f6fd0' },
  // Fuel shed.
  { x: 95, z: -760, w: 22, d: 16, h: 9, colour: '#d8c9a3', roof: '#8a6f4d' },
];

// --- Clouds ------------------------------------------------------------------

export const CLOUDS = (() => {
  const list = [];
  for (let i = 0; i < 42; i++) {
    const x = (rng() - 0.5) * 3800;
    const z = (rng() - 0.5) * 3800;
    const y = 280 + rng() * 190;
    const puffs = [];
    const n = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < n; p++) {
      puffs.push({
        dx: (rng() - 0.5) * 130,
        dy: (rng() - 0.5) * 16,
        dz: (rng() - 0.5) * 60,
        r: 34 + rng() * 42,
      });
    }
    list.push({ x, y, z, puffs, alpha: 0.55 + rng() * 0.3 });
  }
  return list;
})();

// --- Runway helpers -----------------------------------------------------------

export function onRunway(x, z) {
  const r = CONFIG.runway;
  return Math.abs(x - r.x) < r.width / 2 + 6 && Math.abs(z - r.z) < r.length / 2 + 6;
}

export function runwayCentre() {
  return { x: CONFIG.runway.x, z: CONFIG.runway.z, y: 1.6 };
}
