// Solara Skies — the cockpit: HUD, instruments, menus.
// One job: paint everything that is not the world — the dashboard with
// its lit gauges, the compass, the digital readouts, the mission panel
// and the title / game-over screens — on top of the rendered frame.

import { CONFIG, PALETTE } from './config.js';
import { headingDegrees, speedKnots, altitudeFeet } from './plane.js';
import { RINGS } from './terrain.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function litText(ctx, text, x, y, size, colour, align = 'center') {
  ctx.font = `bold ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = colour;
  ctx.shadowBlur = 12;
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

// An analogue dial: face, ticks, needle, glowing numerals.
function drawGauge(ctx, cx, cy, radius, value, max, label, unit, colour, zones) {
  ctx.save();
  ctx.translate(cx, cy);
  const face = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
  face.addColorStop(0, '#2b3440');
  face.addColorStop(0.8, '#161c24');
  face.addColorStop(1, '#0a0d12');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Zones (red arcs) and ticks.
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  for (const z of zones || []) {
    ctx.strokeStyle = z.colour;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 6, start + sweep * z.from, start + sweep * z.to);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c8d2dc';
  ctx.fillStyle = '#c8d2dc';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const a = start + (sweep * i) / 10;
    const r1 = radius - 8;
    const r2 = radius - (i % 5 === 0 ? 20 : 14);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  // Needle.
  const frac = Math.max(0, Math.min(1, value / max));
  const na = start + sweep * frac;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3;
  ctx.shadowColor = colour;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(-Math.cos(na) * radius * 0.18, -Math.sin(na) * radius * 0.18);
  ctx.lineTo(Math.cos(na) * (radius - 12), Math.sin(na) * (radius - 12));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8eef4';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  // Label and digital value under the hub.
  ctx.font = `bold ${Math.max(10, radius * 0.16)}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fb0c0';
  ctx.fillText(label, 0, radius * 0.52);
  ctx.fillStyle = colour;
  ctx.font = `bold ${Math.max(12, radius * 0.24)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(`${Math.round(value)}`, 0, radius * 0.28);
  ctx.fillStyle = '#7c8a99';
  ctx.font = `${Math.max(9, radius * 0.12)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(unit, 0, radius * 0.72);
  ctx.restore();
}

// Artificial horizon: a rolling ball with a fixed wings marker.
function drawHorizon(ctx, cx, cy, radius, pitch, roll) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(-roll);
  const offset = Math.max(-radius, Math.min(radius, pitch * radius * 1.4));
  ctx.fillStyle = '#3f7ec2';
  ctx.fillRect(-radius, -radius + offset, radius * 2, radius - offset);
  ctx.fillStyle = '#8a6b45';
  ctx.fillRect(-radius, offset, radius * 2, radius - offset + radius);
  ctx.fillStyle = '#e8eef4';
  ctx.fillRect(-radius, offset - 1.5, radius * 2, 3);
  ctx.restore();
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings marker.
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.55, cy);
  ctx.lineTo(cx - radius * 0.15, cy);
  ctx.moveTo(cx + radius * 0.15, cy);
  ctx.lineTo(cx + radius * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawCompass(ctx, w, heading) {
  const cy = 30;
  const halfSpan = 150;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
  roundRect(ctx, w / 2 - 190, 10, 380, 42, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(w / 2 - 190, 10, 380, 42);
  ctx.clip();
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels = [
    [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
    [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
  ];
  for (let d = -360; d < 720; d += 15) {
    const rel = ((d - heading + 540) % 360) - 180;
    const x = w / 2 + (rel / 60) * halfSpan;
    if (x < w / 2 - 195 || x > w / 2 + 195) continue;
    const isCard = labels.some(([deg]) => deg === ((d % 360) + 360) % 360);
    ctx.fillStyle = isCard ? '#ffd76a' : '#c8d2dc';
    const label = labels.find(([deg]) => deg === ((d % 360) + 360) % 360);
    ctx.fillText(label ? label[1] : String(((d % 360) + 360) % 360), x, cy + 2);
    ctx.strokeStyle = isCard ? '#ffd76a' : '#5a6673';
    ctx.beginPath();
    ctx.moveTo(x, 44);
    ctx.lineTo(x, 48);
    ctx.stroke();
  }
  ctx.restore();
  // Centre lubber line and digital heading.
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 7, 10);
  ctx.lineTo(w / 2 + 7, 10);
  ctx.lineTo(w / 2, 20);
  ctx.closePath();
  ctx.fill();
  litText(ctx, `${String(Math.round(heading)).padStart(3, '0')}°`, w / 2, 66, 17, PALETTE.hudAmber);
}

// Arrow at the screen edge pointing toward the next ring.
function drawNextRingArrow(ctx, cam, plane, w, h) {
  const next = RINGS[plane.ringsPassed];
  if (!next || plane.crashed || plane.landed) return;
  const p = cam.project(next.x, next.y, next.z);
  const cx = w / 2;
  const cy = h / 2;
  let ax;
  let ay;
  let angle;
  if (p && p.x > 40 && p.x < w - 40 && p.y > 80 && p.y < h - 180) {
    // Ring is on screen: a small diamond marker under it.
    ax = p.x;
    ay = p.y - 46;
    angle = -Math.PI / 2;
  } else {
    // Off screen: clamp a marker to the frame edge.
    const tx = p ? p.x : cx;
    const ty = p ? p.y : cy;
    const dx = tx - cx;
    const dy = ty - cy;
    angle = Math.atan2(dy, dx);
    const margin = 60;
    const t = Math.min(
      Math.abs((w / 2 - margin) / (dx || 1)),
      Math.abs((h / 2 - margin) / (dy || 1)),
      1,
    );
    ax = cx + dx * t;
    ay = cy + dy * t;
  }
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.ringGold;
  ctx.shadowColor = PALETTE.ringGold;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff7dd';
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`RING ${next.index + 1}`, ax, ay + 26);
}

// --- Dashboard ---------------------------------------------------------------------

function drawDashboard(ctx, game, w, h, time) {
  const plane = game.plane;
  const panelH = 148;
  const y0 = h - panelH;
  // Panel body.
  const grad = ctx.createLinearGradient(0, y0, 0, h);
  grad.addColorStop(0, '#1c232e');
  grad.addColorStop(1, '#0b0e13');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, y0 + 26);
  ctx.quadraticCurveTo(w / 2, y0 - 16, w, y0 + 26);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#39434f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, y0 + 26);
  ctx.quadraticCurveTo(w / 2, y0 - 16, w, y0 + 26);
  ctx.stroke();

  const gy = y0 + 78;
  // Airspeed (left), altimeter (right), horizon (centre).
  drawGauge(ctx, 92, gy, 52, speedKnots(plane), 180, 'AIRSPEED', 'KT', PALETTE.hudGreen, [
    { from: 0.82, to: 1, colour: PALETTE.hudRed },
  ]);
  drawGauge(ctx, w - 92, gy, 52, altitudeFeet(plane), 1500, 'ALTITUDE', 'FT', '#7db3e8', []);
  drawHorizon(ctx, w / 2, gy, 44, plane.pitch, plane.roll);

  // Throttle + fuel, left of centre.
  const tx = w / 2 - 250;
  ctx.fillStyle = '#9fb0c0';
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THR', tx, gy - 34);
  ctx.fillStyle = '#10151c';
  roundRect(ctx, tx + 42, gy - 42, 120, 16, 8);
  ctx.fill();
  ctx.fillStyle = plane.throttle > 0.85 ? PALETTE.hudAmber : PALETTE.hudGreen;
  roundRect(ctx, tx + 42, gy - 42, 120 * plane.throttle, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#9fb0c0';
  ctx.fillText('FUEL', tx, gy + 4);
  ctx.fillStyle = '#10151c';
  roundRect(ctx, tx + 42, gy - 4, 120, 16, 8);
  ctx.fill();
  ctx.fillStyle = plane.fuel < 25 ? PALETTE.hudRed : PALETTE.hudGreen;
  roundRect(ctx, tx + 42, gy - 4, 120 * (plane.fuel / 100), 16, 8);
  ctx.fill();
  if (plane.fuel < 25) {
    ctx.fillStyle = PALETTE.hudRed;
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('LOW FUEL', tx + 42, gy + 26);
  }

  // Score, rings and time, right of centre.
  const sx = w / 2 + 130;
  ctx.fillStyle = '#9fb0c0';
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', sx, gy - 34);
  litText(ctx, String(game.score), sx + 62, gy - 26, 22, '#fff7dd', 'left');
  // Ring pips.
  for (let i = 0; i < CONFIG.ringCount; i++) {
    const px = sx + i * 22;
    ctx.fillStyle = i < plane.ringsPassed ? PALETTE.ringGold : '#39434f';
    ctx.shadowColor = i < plane.ringsPassed ? PALETTE.ringGold : 'transparent';
    ctx.shadowBlur = i < plane.ringsPassed ? 8 : 0;
    ctx.beginPath();
    ctx.arc(px + 8, gy + 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = '#9fb0c0';
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('TIME', sx, gy + 34);
  const t = Math.max(0, Math.ceil(game.timeLeft));
  const mm = Math.floor(t / 60);
  const ss = String(t % 60).padStart(2, '0');
  litText(ctx, `${mm}:${ss}`, sx + 62, gy + 34, 18, t < 30 ? PALETTE.hudRed : '#fff7dd', 'left');

  // Damage warning.
  if (plane.damage > 0) {
    ctx.fillStyle = plane.damage > 60 ? PALETTE.hudRed : PALETTE.hudAmber;
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HULL ${Math.round(100 - plane.damage)}%`, w / 2, y0 + 22);
  }
}

// --- Readouts ------------------------------------------------------------------------

function drawReadouts(ctx, game, w, time) {
  const plane = game.plane;
  const blink = Math.floor(time * 2) % 2 === 0;
  // Dark pills behind the corner readouts so they stay readable
  // against a bright cloud or the sun.
  ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
  roundRect(ctx, 12, 14, 196, 58, 10);
  ctx.fill();
  roundRect(ctx, w - 208, 14, 196, 58, 10);
  ctx.fill();
  litText(ctx, `SPD ${speedKnots(plane)} KT`, 24, 34, 22, PALETTE.hudGreen, 'left');
  litText(ctx, `ALT ${altitudeFeet(plane)} FT`, w - 24, 34, 22, '#7db3e8', 'right');
  litText(ctx, `HDG ${String(Math.round(headingDegrees(plane))).padStart(3, '0')}°`, w - 24, 62, 17, PALETTE.hudAmber, 'right');
  if (plane.onGround && !plane.landed) {
    litText(ctx, plane.speed > 1 ? 'ROLLING' : 'PARKED — HOLD SHIFT TO THROTTLE UP', 24, 62, 14, '#c8d2dc', 'left');
  }
  if (game.message && game.messageUntil > time) {
    const alpha = Math.min(1, (game.messageUntil - time) / 0.5);
    ctx.globalAlpha = alpha;
    litText(ctx, game.message, w / 2, 118, 26, '#fff7dd');
    ctx.globalAlpha = 1;
  }
  if (game.flashRing && game.flashRingUntil > time) {
    ctx.globalAlpha = Math.min(1, (game.flashRingUntil - time) / 0.4);
    litText(ctx, `RING ${game.flashRing}  +${CONFIG.ringScore}`, w / 2, 150, 20, PALETTE.ringGold);
    ctx.globalAlpha = 1;
  }
  if (blink && game.timeLeft < 30 && game.state === 'flying') {
    litText(ctx, 'TIME LOW', w / 2, 92, 16, PALETTE.hudRed);
  }
}

// --- Screens --------------------------------------------------------------------------

function drawTitle(ctx, w, h, time) {
  ctx.fillStyle = 'rgba(8, 14, 24, 0.42)';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const bob = Math.sin(time * 1.4) * 6;
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ffd76a';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#fff7dd';
  ctx.font = 'bold 64px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('SOLARA SKIES', cx, 170 + bob);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#cfe6f7';
  ctx.font = '22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Fly the Kestrel through eight golden rings, then bring her home.', cx, 214 + bob);
  ctx.fillStyle = '#9fb0c0';
  ctx.font = '17px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('A flight game over Solara Bay — keyboard and mouse, no network, all yours.', cx, 244 + bob);
  // Controls card.
  ctx.fillStyle = 'rgba(10, 16, 26, 0.72)';
  roundRect(ctx, cx - 250, 290, 500, 168, 14);
  ctx.fill();
  ctx.strokeStyle = '#39434f';
  ctx.stroke();
  ctx.fillStyle = '#e8eef4';
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  const rows = [
    ['↑ / ↓  or  W / S', 'Pitch up / down'],
    ['← / →  or  A / D', 'Bank left / right'],
    ['SHIFT', 'Throttle up      CTRL  Throttle down'],
    ['Mouse (hold button)', 'Steer with the pointer'],
    ['ENTER', 'Take off'],
  ];
  rows.forEach(([k, v], i) => {
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(k, cx - 228, 322 + i * 28);
    ctx.fillStyle = '#e8eef4';
    ctx.fillText(v, cx - 40, 322 + i * 28);
  });
  const pulse = 0.6 + 0.4 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#fff7dd';
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PRESS ENTER OR CLICK TO FLY', cx, h - 190);
  ctx.globalAlpha = 1;
}

function drawEndScreen(ctx, game, w, h) {
  ctx.fillStyle = 'rgba(8, 14, 24, 0.55)';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  ctx.textAlign = 'center';
  if (game.state === 'complete') {
    ctx.fillStyle = '#7dff9a';
    ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('MISSION COMPLETE', cx, 180);
    ctx.fillStyle = '#fff7dd';
    ctx.font = '22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`All eight rings, and the Kestrel home on the runway.`, cx, 226);
  } else if (game.state === 'landed') {
    ctx.fillStyle = '#7db3e8';
    ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('WHEELS DOWN', cx, 180);
    ctx.fillStyle = '#fff7dd';
    ctx.font = '22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('You landed at Solara Bay Airfield.', cx, 226);
  } else {
    ctx.fillStyle = PALETTE.hudRed;
    ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(game.state === 'timeout' ? 'OUT OF TIME' : 'CRASHED', cx, 180);
    ctx.fillStyle = '#fff7dd';
    ctx.font = '22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(game.crashReason || 'The clock ran out over the bay.', cx, 226);
  }
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`SCORE  ${game.score}`, cx, 290);
  ctx.fillStyle = '#c8d2dc';
  ctx.font = '18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`Rings ${game.plane.ringsPassed} / ${CONFIG.ringCount}    •    Time left ${Math.max(0, Math.ceil(game.timeLeft))}s    •    Fuel ${Math.round(game.plane.fuel)}%`, cx, 330);
  ctx.fillStyle = '#fff7dd';
  ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PRESS R TO FLY AGAIN', cx, 400);
}

// --- Frame -------------------------------------------------------------------------------

export function drawHud(ctx, game, cam, w, h, time) {
  if (game.state === 'title') {
    drawTitle(ctx, w, h, time);
    return;
  }
  drawCompass(ctx, w, headingDegrees(game.plane));
  drawReadouts(ctx, game, w, time);
  drawNextRingArrow(ctx, cam, game.plane, w, h);
  drawDashboard(ctx, game, w, h, time);
  if (game.state === 'complete' || game.state === 'landed' || game.state === 'crashed' || game.state === 'timeout') {
    drawEndScreen(ctx, game, w, h);
  }
}
