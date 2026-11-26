// Solara Skies — the renderer: a small software 3D projector and every
// brush stroke of the bay. One job: take the game state and paint one
// frame on the canvas. No state lives here beyond a scratch buffer.

import { CONFIG, PALETTE } from './config.js';
import {
  HEIGHTS, CELLS, CELL, cellX, cellZ, groundHeight,
  terrainColour, RINGS, BUILDINGS, CLOUDS, onRunway,
} from './terrain.js';

// --- Colour helpers -----------------------------------------------------------

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
function shade(hex, f) {
  const c = hexRgb(hex);
  return `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`;
}
const HAZE = hexRgb(PALETTE.skyHorizon);

// --- Vector helpers -----------------------------------------------------------

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// Basis for a heading / pitch / roll triple. Returns [right, up, forward].
export function basis(yaw, pitch, roll) {
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const f = [sy * cp, sp, cy * cp];
  const r0 = [cy, 0, -sy];
  const u0 = [-sy * sp, cp, -cy * sp];
  // Roll rotates the right/up frame around the forward axis. Positive
  // roll is a bank to the right: the right wing drops toward the ground,
  // so the right vector tilts down (toward -up) as roll grows.
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const r = [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr];
  const u = [u0[0] * cr + r0[0] * sr, u0[1] * cr + r0[1] * sr, u0[2] * cr + r0[2] * sr];
  return [r, u, f];
}

// --- Camera --------------------------------------------------------------------

const SUN_DIR = norm([-0.45, 0.55, -0.7]);

export function makeCamera(plane, width, height, override) {
  const chaseDistance = override?.distance ?? CONFIG.chaseDistance;
  const chaseHeight = override?.height ?? CONFIG.chaseHeight;
  const [pr, pu, pf] = basis(plane.yaw, plane.pitch, plane.roll);
  // Chase position: behind and above the plane, in the plane's own frame.
  const cam = [
    plane.x - pf[0] * chaseDistance + pu[0] * chaseHeight,
    plane.y - pf[1] * chaseDistance + pu[1] * chaseHeight,
    plane.z - pf[2] * chaseDistance + pu[2] * chaseHeight,
  ];
  // Keep the camera out of the sea and out of the hills.
  const floor = groundHeight(cam[0], cam[2]) + 2.2;
  if (cam[1] < floor) cam[1] = floor;
  const camPitch = plane.pitch - 0.1;
  const camRoll = plane.roll * CONFIG.cameraRollFollow;
  const [r, u, f] = basis(plane.yaw, camPitch, camRoll);
  const focal = (height / 2) / Math.tan((CONFIG.fovDegrees * Math.PI) / 360);
  const cx = width / 2;
  const cy = height / 2;
  return {
    pos: cam,
    r,
    u,
    f,
    focal,
    cx,
    cy,
    project(x, y, z) {
      const vx = x - cam[0];
      const vy = y - cam[1];
      const vz = z - cam[2];
      const px = vx * r[0] + vy * r[1] + vz * r[2];
      const py = vx * u[0] + vy * u[1] + vz * u[2];
      const pz = vx * f[0] + vy * f[1] + vz * f[2];
      if (pz < 0.6) return null;
      return { x: cx + (px * focal) / pz, y: cy - (py * focal) / pz, d: pz };
    },
    // Same projection, but a point just behind the near plane is clamped
    // onto it instead of dropped: ground quads under the camera then
    // still cover the bottom of the frame instead of leaving a hole.
    projectClamped(x, y, z) {
      const vx = x - cam[0];
      const vy = y - cam[1];
      const vz = z - cam[2];
      const px = vx * r[0] + vy * r[1] + vz * r[2];
      const py = vx * u[0] + vy * u[1] + vz * u[2];
      const pz = Math.max(0.6, vx * f[0] + vy * f[1] + vz * f[2]);
      return { x: cx + (px * focal) / pz, y: cy - (py * focal) / pz, d: pz };
    },
  };
}

// --- Sky, sea, terrain ----------------------------------------------------------

function drawSky(ctx, cam, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.45, PALETTE.skyMid);
  g.addColorStop(0.72, PALETTE.skyHorizon);
  g.addColorStop(1, '#dceefb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun: a far point along the sun direction, drawn as glow + core.
  const sx = cam.pos[0] + SUN_DIR[0] * 4000;
  const sy = cam.pos[1] + SUN_DIR[1] * 4000;
  const sz = cam.pos[2] + SUN_DIR[2] * 4000;
  const s = cam.project(sx, sy, sz);
  if (s) {
    const glow = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 120);
    glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 215, 106, 0.55)');
    glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(s.x - 130, s.y - 130, 260, 260);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSea(ctx, cam) {
  const H = 2000;
  const corners = [
    cam.projectClamped(-H, 0.35, -H),
    cam.projectClamped(H, 0.35, -H),
    cam.projectClamped(H, 0.35, H),
    cam.projectClamped(-H, 0.35, H),
  ];
  ctx.fillStyle = PALETTE.seaDeep;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx, cam) {
  const quads = [];
  const camX = cam.pos[0];
  const camZ = cam.pos[2];
  const maxD = CONFIG.viewDistance;
  const i0 = Math.max(0, Math.floor((camX - maxD + 2000) / CELL) - 1);
  const i1 = Math.min(CELLS - 1, Math.ceil((camX + maxD + 2000) / CELL) + 1);
  const j0 = Math.max(0, Math.floor((camZ - maxD + 2000) / CELL) - 1);
  const j1 = Math.min(CELLS - 1, Math.ceil((camZ + maxD + 2000) / CELL) + 1);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x0 = cellX(i);
      const z0 = cellZ(j);
      const cx = x0 + CELL / 2;
      const cz = z0 + CELL / 2;
      const dx = cx - camX;
      const dz = cz - camZ;
      const dist = Math.hypot(dx, dz);
      if (dist > maxD) continue;
      // Behind the camera: skip unless very close (the plane may sit on it).
      const ahead = dx * cam.f[0] + dz * cam.f[2];
      if (ahead < -80) continue;
      const h00 = HEIGHTS[j * (CELLS + 1) + i];
      const h10 = HEIGHTS[j * (CELLS + 1) + i + 1];
      const h01 = HEIGHTS[(j + 1) * (CELLS + 1) + i];
      const h11 = HEIGHTS[(j + 1) * (CELLS + 1) + i + 1];
      const p00 = cam.projectClamped(x0, h00, z0);
      const p10 = cam.projectClamped(x0 + CELL, h10, z0);
      const p11 = cam.projectClamped(x0 + CELL, h11, z0 + CELL);
      const p01 = cam.projectClamped(x0, h01, z0 + CELL);
      // Flat shading from the quad's normal.
      const e1 = [CELL, h10 - h00, 0];
      const e2 = [0, h01 - h00, CELL];
      const n = norm(cross(e1, e2));
      const light = 0.72 + 0.28 * Math.max(0, dot(n, SUN_DIR));
      const hAvg = (h00 + h10 + h01 + h11) / 4;
      const slope = Math.hypot(h10 - h00, h01 - h00) / CELL;
      const base = terrainColour(hAvg, slope);
      const haze = Math.min(0.72, Math.max(0, ((p00.d + p11.d) / 2 - 500) / CONFIG.fogDistance));
      const col = hexRgb(base);
      const lit = [col[0] * light, col[1] * light, col[2] * light];
      const final = [
        lit[0] + (HAZE[0] - lit[0]) * haze,
        lit[1] + (HAZE[1] - lit[1]) * haze,
        lit[2] + (HAZE[2] - lit[2]) * haze,
      ];
      quads.push({
        d: (p00.d + p10.d + p11.d + p01.d) / 4,
        pts: [p00, p10, p11, p01],
        fill: `rgb(${final[0] | 0},${final[1] | 0},${final[2] | 0})`,
      });
    }
  }
  quads.sort((a, b) => b.d - a.d);
  for (const q of quads) {
    ctx.fillStyle = q.fill;
    ctx.beginPath();
    ctx.moveTo(q.pts[0].x, q.pts[0].y);
    for (let k = 1; k < 4; k++) ctx.lineTo(q.pts[k].x, q.pts[k].y);
    ctx.closePath();
    ctx.fill();
  }
}

// --- Runway and airfield ---------------------------------------------------------

function drawQuadStrip(ctx, cam, points, fill) {
  const pts = points.map(([x, y, z]) => cam.project(x, y, z));
  if (pts.some((p) => p === null)) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function drawRunway(ctx, cam) {
  const r = CONFIG.runway;
  const hw = r.width / 2;
  const hl = r.length / 2;
  const y = 1.75;
  // Apron.
  drawQuadStrip(ctx, cam, [
    [r.x - 120, y - 0.05, r.z - hl - 90],
    [r.x + 120, y - 0.05, r.z - hl - 90],
    [r.x + 120, y - 0.05, r.z + hl + 90],
    [r.x - 120, y - 0.05, r.z + hl + 90],
  ], '#9fb27a');
  // Asphalt.
  drawQuadStrip(ctx, cam, [
    [r.x - hw, y, r.z - hl],
    [r.x + hw, y, r.z - hl],
    [r.x + hw, y, r.z + hl],
    [r.x - hw, y, r.z + hl],
  ], PALETTE.runway);
  // Centreline dashes.
  for (let z = r.z - hl + 30; z < r.z + hl - 20; z += 60) {
    drawQuadStrip(ctx, cam, [
      [r.x - 1.6, y + 0.06, z],
      [r.x + 1.6, y + 0.06, z],
      [r.x + 1.6, y + 0.06, z + 26],
      [r.x - 1.6, y + 0.06, z + 26],
    ], PALETTE.runwayMark);
  }
  // Threshold bars at both ends.
  for (const zend of [r.z - hl + 8, r.z + hl - 8]) {
    for (let k = -3; k <= 3; k++) {
      if (k === 0) continue;
      drawQuadStrip(ctx, cam, [
        [r.x + k * 6 - 2.2, y + 0.06, zend - 4],
        [r.x + k * 6 + 2.2, y + 0.06, zend - 4],
        [r.x + k * 6 + 2.2, y + 0.06, zend + 4],
        [r.x + k * 6 - 2.2, y + 0.06, zend + 4],
      ], PALETTE.runwayMark);
    }
  }
  // Windsock: pole + orange cone, west of the strip.
  const wp = cam.project(-70, 14, r.z - 100);
  const wb = cam.project(-70, 1.8, r.z - 100);
  if (wp && wb) {
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(1, 60 / wp.d);
    ctx.beginPath();
    ctx.moveTo(wb.x, wb.y);
    ctx.lineTo(wp.x, wp.y);
    ctx.stroke();
    const tip = cam.project(-58, 13, r.z - 100);
    if (tip) {
      ctx.fillStyle = '#ff7a2f';
      ctx.beginPath();
      ctx.moveTo(wp.x, wp.y);
      ctx.lineTo(tip.x, tip.y - 3);
      ctx.lineTo(tip.x, tip.y + 3);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawBox(ctx, cam, b) {
  const y0 = groundHeight(b.x, b.z) + 0.5;
  const hx = b.w / 2;
  const hz = b.d / 2;
  const y1 = y0 + b.h;
  const corners = [
    [b.x - hx, y0, b.z - hz], [b.x + hx, y0, b.z - hz],
    [b.x + hx, y0, b.z + hz], [b.x - hx, y0, b.z + hz],
    [b.x - hx, y1, b.z - hz], [b.x + hx, y1, b.z - hz],
    [b.x + hx, y1, b.z + hz], [b.x - hx, y1, b.z + hz],
  ];
  const proj = corners.map(([x, y, z]) => cam.project(x, y, z));
  if (proj.some((p) => p === null)) return;
  const faces = [
    { idx: [4, 5, 6, 7], fill: b.roof }, // roof
    { idx: [0, 1, 5, 4], fill: b.colour }, // north wall
    { idx: [1, 2, 6, 5], fill: shade(b.colour, 0.82) }, // east wall
    { idx: [2, 3, 7, 6], fill: shade(b.colour, 0.92) }, // south wall
    { idx: [3, 0, 4, 7], fill: shade(b.colour, 0.75) }, // west wall
  ];
  const drawn = faces
    .map((f) => ({ ...f, d: f.idx.reduce((s, i) => s + proj[i].d, 0) / 4 }))
    .sort((a, b2) => b2.d - a.d);
  for (const f of drawn) {
    ctx.fillStyle = f.fill;
    ctx.beginPath();
    ctx.moveTo(proj[f.idx[0]].x, proj[f.idx[0]].y);
    for (let k = 1; k < 4; k++) ctx.lineTo(proj[f.idx[k]].x, proj[f.idx[k]].y);
    ctx.closePath();
    ctx.fill();
  }
}

// --- Rings ------------------------------------------------------------------------

function drawRings(ctx, cam, nextIndex, time) {
  for (const ring of RINGS) {
    if (ring.passed) continue; // flown rings are history; the HUD pips keep score
    const c = cam.project(ring.x, ring.y, ring.z);
    if (!c || c.d > 1300) continue;
    const u = [Math.cos(ring.heading), 0, -Math.sin(ring.heading)];
    const v = [0, 1, 0];
    const pts = [];
    const N = 28;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const x = ring.x + (Math.cos(a) * ring.radius * u[0] + Math.sin(a) * ring.radius * v[0]);
      const y = ring.y + (Math.cos(a) * ring.radius * u[1] + Math.sin(a) * ring.radius * v[1]);
      const z = ring.z + (Math.cos(a) * ring.radius * u[2] + Math.sin(a) * ring.radius * v[2]);
      const p = cam.project(x, y, z);
      if (p) pts.push(p);
    }
    if (pts.length < 8) continue;
    const isNext = ring.index === nextIndex;
    const baseWidth = Math.max(2, Math.min(16, 520 / c.d));
    const pulse = isNext ? 1 + 0.35 * Math.sin(time * 5) : 1;
    const colour = PALETTE.ringGold;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 223, 122, 0.35)';
    ctx.lineWidth = baseWidth * 3 * pulse;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = colour;
    ctx.lineWidth = baseWidth * pulse;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.stroke();
  }
}

// --- Clouds ------------------------------------------------------------------------

function drawClouds(ctx, cam) {
  const items = [];
  for (const cloud of CLOUDS) {
    const c = cam.project(cloud.x, cloud.y, cloud.z);
    if (!c || c.d < 30 || c.d > 3200) continue;
    items.push({ cloud, c });
  }
  items.sort((a, b) => b.c.d - a.c.d);
  for (const { cloud, c } of items) {
    const scale = cam.focal / c.d;
    for (const puff of cloud.puffs) {
      const p = cam.project(cloud.x + puff.dx, cloud.y + puff.dy, cloud.z + puff.dz);
      if (!p) continue;
      const r = puff.r * scale;
      if (r < 2) continue;
      const g = ctx.createRadialGradient(p.x, p.y, r * 0.1, p.x, p.y, r);
      g.addColorStop(0, `rgba(255, 255, 255, ${cloud.alpha})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- The Kestrel ----------------------------------------------------------------------

const FUSELAGE_STATIONS = [
  { z: 3.7, w: 0.12, h: 0.12 },
  { z: 3.1, w: 0.55, h: 0.55 },
  { z: 1.6, w: 0.85, h: 0.9 },
  { z: 0.2, w: 0.95, h: 1.0 },
  { z: -1.4, w: 0.8, h: 0.85 },
  { z: -2.9, w: 0.45, h: 0.5 },
  { z: -3.5, w: 0.1, h: 0.12 },
];

function fuselageFaces() {
  const faces = [];
  for (let s = 0; s < FUSELAGE_STATIONS.length - 1; s++) {
    const a = FUSELAGE_STATIONS[s];
    const b = FUSELAGE_STATIONS[s + 1];
    const ring = (st) => [
      [0, st.h, st.z], // top
      [st.w, 0, st.z], // right
      [0, -st.h * 0.9, st.z], // bottom
      [-st.w, 0, st.z], // left
    ];
    const ra = ring(a);
    const rb = ring(b);
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      faces.push({
        pts: [ra[k], rb[k], rb[k2], ra[k2]],
        colour: k === 0 ? PALETTE.planeCream : k === 2 ? '#c9b48a' : PALETTE.planeTeal,
      });
    }
  }
  return faces;
}

function planeFaces() {
  const faces = fuselageFaces();
  // Main wing: a thin tapered slab with a gold stripe on top.
  const wing = (z0, z1, span, rootChord, tipChord, y, colour) => {
    const hw = span / 2;
    const top = [
      [-hw, y + 0.09, z0 - tipChord / 2], [hw, y + 0.09, z0 - tipChord / 2],
      [hw, y + 0.09, z0 + tipChord / 2], [-hw, y + 0.09, z0 + tipChord / 2],
    ];
    faces.push({ pts: top, colour });
    const lead = [
      [-hw, y - 0.09, z0 + tipChord / 2], [hw, y - 0.09, z0 + tipChord / 2],
      [hw, y + 0.09, z0 + tipChord / 2], [-hw, y + 0.09, z0 + tipChord / 2],
    ];
    faces.push({ pts: lead, colour: shade(colour, 0.75) });
  };
  wing(0.55, 0.55, 11.4, 1.7, 1.1, 0.15, PALETTE.planeTeal);
  wing(-2.85, -2.85, 3.8, 1.1, 0.8, 0.35, PALETTE.planeTeal);
  // Tail fin: vertical, red.
  faces.push({
    pts: [[0, 0.4, -2.6], [0, 0.4, -3.5], [0, 1.9, -3.5], [0, 1.7, -2.7]],
    colour: PALETTE.planeRed,
  });
  // Canopy: dark glass over the cockpit.
  faces.push({
    pts: [[-0.5, 0.85, 1.5], [0.5, 0.85, 1.5], [0.45, 1.25, 0.4], [-0.45, 1.25, 0.4]],
    colour: '#1d3a4d',
  });
  faces.push({
    pts: [[-0.5, 0.85, 1.5], [-0.45, 1.25, 0.4], [-0.42, 1.2, -0.4], [-0.5, 0.8, -0.2]],
    colour: '#274b61',
  });
  faces.push({
    pts: [[0.5, 0.85, 1.5], [0.5, 0.8, -0.2], [0.42, 1.2, -0.4], [0.45, 1.25, 0.4]],
    colour: '#274b61',
  });
  return faces;
}

const PLANE_FACES = planeFaces();

export function drawPlane(ctx, cam, plane) {
  const [r, u, f] = basis(plane.yaw, plane.pitch, plane.roll);
  const toWorld = ([lx, ly, lz]) => [
    plane.x + lx * r[0] + ly * u[0] + lz * f[0],
    plane.y + lx * r[1] + ly * u[1] + lz * f[1],
    plane.z + lx * r[2] + ly * u[2] + lz * f[2],
  ];
  const drawn = [];
  for (const face of PLANE_FACES) {
    const pts = face.pts.map(toWorld).map(([x, y, z]) => cam.project(x, y, z));
    if (pts.some((p) => p === null)) continue;
    drawn.push({ pts, colour: face.colour, d: pts.reduce((s, p) => s + p.d, 0) / pts.length });
  }
  drawn.sort((a, b) => b.d - a.d);
  for (const face of drawn) {
    ctx.fillStyle = face.colour;
    ctx.beginPath();
    ctx.moveTo(face.pts[0].x, face.pts[0].y);
    for (let k = 1; k < face.pts.length; k++) ctx.lineTo(face.pts[k].x, face.pts[k].y);
    ctx.closePath();
    ctx.fill();
  }
  // Propeller: a translucent disc plus two blades, spinning with the engine.
  const hub = toWorld([0, 0, 3.75]);
  const hp = cam.project(hub[0], hub[1], hub[2]);
  if (hp && plane.throttle > 0.02) {
    const discR = (1.35 * cam.focal) / hp.d;
    ctx.fillStyle = 'rgba(220, 230, 235, 0.10)';
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, discR, 0, Math.PI * 2);
    ctx.fill();
    const a = plane.propAngle;
    for (const off of [0, Math.PI]) {
      const bx = Math.cos(a + off);
      const by = Math.sin(a + off);
      const tip1 = toWorld([bx * 1.3, by * 1.3, 3.78]);
      const tip2 = toWorld([-bx * 1.3, -by * 1.3, 3.78]);
      const p1 = cam.project(tip1[0], tip1[1], tip1[2]);
      const p2 = cam.project(tip2[0], tip2[1], tip2[2]);
      if (p1 && p2) {
        ctx.strokeStyle = 'rgba(40, 50, 55, 0.55)';
        ctx.lineWidth = Math.max(2, discR * 0.09);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }
  // Landing gear: two small wheels when the gear is down and slow.
  if (plane.gearDown && plane.speed < 40) {
    for (const side of [-1, 1]) {
      const wpos = toWorld([side * 1.1, -1.05, 0.9]);
      const wp = cam.project(wpos[0], wpos[1], wpos[2]);
      if (wp) {
        ctx.fillStyle = '#22262a';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, Math.max(2, 26 / wp.d), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// --- Frame -------------------------------------------------------------------------

export function drawWorld(ctx, game, w, h, time) {
  const cam = makeCamera(game.plane, w, h, game.camOverride);
  drawSky(ctx, cam, w, h);
  drawSea(ctx, cam);
  drawTerrain(ctx, cam);
  drawRunway(ctx, cam);
  for (const b of BUILDINGS) drawBox(ctx, cam, b);
  drawRings(ctx, cam, game.plane.ringsPassed, time);
  drawClouds(ctx, cam);
  drawPlane(ctx, cam, game.plane);
  return cam;
}

// Exported for the HUD's next-ring arrow.
export { onRunway };
