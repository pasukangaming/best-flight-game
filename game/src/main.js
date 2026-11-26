// Solara Skies — the game itself: state, loop, missions and screenshots.
// One job: own the frame loop, own the game state (title / flying /
// landed / crashed / complete), turn flight-model events into score and
// messages, and set up deterministic "shot" scenes so the screenshots
// the maker takes always show the game at its best.

import { CONFIG } from './config.js';
import { createPlane, updatePlane } from './plane.js';
import { createInput } from './input.js';
import { createSound } from './audio.js';
import { drawWorld } from './render.js';
import { drawHud } from './hud.js';
import { RINGS } from './terrain.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot') || '';

const game = {
  state: 'title', // title | flying | landed | crashed | complete | timeout
  plane: createPlane(),
  score: 0,
  timeLeft: CONFIG.missionTime,
  message: '',
  messageUntil: 0,
  flashRing: 0,
  flashRingUntil: 0,
  crashReason: '',
  time: 0,
};

const input = createInput(canvas);
const sound = createSound();

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function showMessage(text, seconds) {
  game.message = text;
  game.messageUntil = game.time + seconds;
}

function resetRings() {
  for (const ring of RINGS) ring.passed = false;
}

function startFlight() {
  game.plane = createPlane();
  resetRings();
  game.score = 0;
  game.timeLeft = CONFIG.missionTime;
  game.state = 'flying';
  game.crashReason = '';
  showMessage('Full throttle, then pull up gently — Ring 1 is north', 4);
  sound.unlock();
  sound.click();
}

function restart() {
  startFlight();
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === 'ring') {
      game.score += CONFIG.ringScore;
      game.flashRing = ev.index + 1;
      game.flashRingUntil = game.time + 1.6;
      sound.ring();
      if (game.plane.ringsPassed === CONFIG.ringCount) {
        showMessage('All rings! Bring her home to the runway', 5);
      }
    } else if (ev.type === 'landed') {
      const fuelBonus = Math.round(game.plane.fuel * 2);
      const timeBonus = Math.round(game.timeLeft) * CONFIG.timeBonusPerSecond;
      game.score += CONFIG.landingScore + fuelBonus + timeBonus;
      sound.landed();
      if (game.plane.ringsPassed === CONFIG.ringCount) {
        game.state = 'complete';
        showMessage('Mission complete — welcome home', 6);
      } else {
        game.state = 'landed';
        showMessage(`Landed! ${game.plane.ringsPassed} of ${CONFIG.ringCount} rings flown`, 6);
      }
    } else if (ev.type === 'crashed') {
      game.state = 'crashed';
      game.crashReason = `The Kestrel ${ev.reason}.`;
      sound.crash();
    } else if (ev.type === 'fuel-empty') {
      showMessage('Fuel empty — glide her down gently', 4);
    } else if (ev.type === 'bounce') {
      showMessage('Rough touchdown — check the hull', 2.5);
    }
  }
}

// --- Screenshot scenes -----------------------------------------------------------
// ?shot=start  parked on the runway, title up, morning light
// ?shot=play   mid-flight, chasing Ring 3 over the bay
// ?shot=ring   threading a ring, gold dead ahead
// ?shot=land   final approach, runway and tower in frame, gear down
// Each scene is deterministic: same seed, same frame, every retake.

function applyShot() {
  if (!SHOT) return;
  const p = game.plane;
  if (SHOT === 'start') {
    game.state = 'title';
    p.x = 0;
    p.y = 1.8;
    p.z = -260;
    p.yaw = Math.PI;
    p.throttle = 0.25;
    p.speed = 0;
    // Pull the chase camera back and up so the whole Kestrel shows
    // under the title, with the runway running away ahead of her.
    game.camOverride = { distance: 26, height: 9 };
  } else if (SHOT === 'play') {
    game.state = 'flying';
    p.onGround = false;
    p.x = -980;
    p.y = 118;
    p.z = -880;
    p.yaw = Math.atan2(-1150 - p.x, -500 - p.z); // nose on Ring 3
    p.pitch = 0.02;
    p.roll = -0.12;
    p.speed = 62;
    p.throttle = 0.72;
    p.ringsPassed = 2;
    RINGS[0].passed = true;
    RINGS[1].passed = true;
    game.score = 500;
    game.timeLeft = 232;
    showMessage('Ring 3 ahead — keep her level', 999);
  } else if (SHOT === 'ring') {
    game.state = 'flying';
    p.onGround = false;
    p.x = -860;
    p.y = 84;
    p.z = 300;
    p.yaw = Math.atan2(-900 - p.x, 350 - p.z); // nose on Ring 4
    p.pitch = 0.05;
    p.roll = 0.18;
    p.speed = 68;
    p.throttle = 0.8;
    p.ringsPassed = 3;
    RINGS[0].passed = true;
    RINGS[1].passed = true;
    RINGS[2].passed = true;
    game.score = 750;
    game.timeLeft = 198;
    showMessage('Through the ring!', 999);
  } else if (SHOT === 'land') {
    game.state = 'flying';
    p.onGround = false;
    p.x = 12;
    p.y = 32;
    p.z = 40;
    p.yaw = Math.PI;
    p.pitch = -0.06;
    p.roll = 0.02;
    p.speed = 46;
    p.throttle = 0.3;
    p.gearDown = true;
    p.ringsPassed = 8;
    for (const ring of RINGS) ring.passed = true;
    game.score = 2000;
    game.timeLeft = 141;
    showMessage('Final approach — Solara Bay runway ahead', 999);
  }
  // Freeze the scene: screenshots must not depend on frame timing.
  game.time = 12.5;
}

applyShot();

// --- Main loop ----------------------------------------------------------------------

let last = performance.now();
let statusTick = 0;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (!SHOT) game.time += dt;

  const w = window.innerWidth;
  const h = window.innerHeight;

  if (game.state === 'title') {
    if (input.consume('Enter', ' ')) startFlight();
  } else if (game.state === 'flying') {
    // A screenshot scene is frozen: the plane holds its pose so every
    // retake of the same shot shows the same frame.
    if (SHOT) {
      // No physics, no clock: the scene is a still life.
    } else {
      game.timeLeft -= dt;
      if (game.timeLeft <= 0) {
        game.timeLeft = 0;
        game.state = 'timeout';
        game.crashReason = 'The clock ran out over the bay.';
        sound.crash();
      } else {
        const events = [];
        updatePlane(game.plane, input.snapshot(), dt, events);
        handleEvents(events);
      }
    }
  } else if (game.state === 'landed' || game.state === 'crashed' || game.state === 'complete' || game.state === 'timeout') {
    if (input.consume('r', 'R', 'Enter', ' ')) restart();
  }

  // Click / tap also starts and restarts, for the mouse.
  sound.update(game.plane.throttle, game.plane.speed, !game.plane.onGround);

  const cam = drawWorld(ctx, game, w, h, game.time);
  drawHud(ctx, game, cam, w, h, game.time);

  // Screen-reader status line, updated twice a second.
  statusTick += dt;
  if (statusTick > 0.5) {
    statusTick = 0;
    const status = document.getElementById('status');
    if (status) {
      status.textContent = `Solara Skies: ${game.state}. Score ${game.score}. `
        + `Rings ${game.plane.ringsPassed} of ${CONFIG.ringCount}. `
        + `Speed ${Math.round(game.plane.speed * 1.944)} knots, `
        + `altitude ${Math.round(game.plane.y * 3.281)} feet, fuel ${Math.round(game.plane.fuel)} percent.`;
    }
  }

  requestAnimationFrame(frame);
}

// Click / tap starts the flight from the title screen, for the mouse.
canvas.addEventListener('pointerdown', () => {
  sound.unlock();
  if (game.state === 'title') startFlight();
});

requestAnimationFrame(frame);
