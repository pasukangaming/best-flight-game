// Solara Skies — the Kestrel and how she flies.
// One job: hold the plane's state and step the arcade flight model.
// No drawing here, no input reading here: update() takes a control
// snapshot and a clock step and returns what happened (ring flown,
// landed, crashed, fuel gone).

import { CONFIG } from './config.js';
import { groundHeight, onRunway, RINGS } from './terrain.js';

export function createPlane() {
  return {
    x: 0,
    y: 1.8,
    z: -260, // parked at the southern end of the runway, nose north
    yaw: Math.PI, // facing -z (north, up the runway)
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: CONFIG.fuelMax,
    damage: 0,
    bounceAt: -10, // seconds (plane clock) of the last rough touchdown
    time: 0, // seconds the plane has been flying
    gearDown: true,
    onGround: true,
    verticalSpeed: 0,
    ringsPassed: 0,
    landed: false,
    crashed: false,
    crashReason: '',
    propAngle: 0,
  };
}

// A control snapshot: pitch/roll in -1..1, throttleUp/throttleDown booleans.
export function updatePlane(p, ctl, dt, events) {
  if (p.crashed || p.landed) return;
  p.time += dt;

  // Throttle.
  if (ctl.throttleUp) p.throttle = Math.min(1, p.throttle + CONFIG.throttleStep * dt);
  if (ctl.throttleDown) p.throttle = Math.max(0, p.throttle - CONFIG.throttleStep * dt);

  // Target speed follows the throttle; the engine spools toward it.
  const targetSpeed = p.throttle * CONFIG.maxSpeed;
  const spool = p.onGround ? 2.2 : 1.1;
  p.speed += (targetSpeed - p.speed) * Math.min(1, spool * dt);
  if (p.fuel <= 0) p.speed = Math.max(0, p.speed - 14 * dt);

  // Attitude: stick input moves pitch and roll toward their targets.
  const pitchTarget = ctl.pitch * 0.42;
  const rollTarget = ctl.roll * 1.05;
  p.pitch += (pitchTarget - p.pitch) * Math.min(1, CONFIG.pitchRate * 2.4 * dt);
  p.roll += (rollTarget - p.roll) * Math.min(1, CONFIG.rollRate * 2.2 * dt);
  // Ease back to level when the stick is centred.
  if (Math.abs(ctl.roll) < 0.05) p.roll *= Math.max(0, 1 - 0.9 * dt);
  if (Math.abs(ctl.pitch) < 0.05) p.pitch *= Math.max(0, 1 - 0.7 * dt);

  // Bank turns the nose; speed keeps the plane honest. Positive roll is
  // a bank to the right, which turns the nose to the right (yaw grows).
  const turnAuthority = Math.min(1, p.speed / 40);
  p.yaw += p.roll * CONFIG.turnFromRoll * turnAuthority * dt;

  // Forward motion, climb from pitch, sink when slow.
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  const climb = Math.sin(p.pitch) * p.speed * CONFIG.climbFactor;
  let sink = 0;
  if (p.speed < CONFIG.stallSpeed && !p.onGround) {
    sink = CONFIG.gravitySink * (1 - p.speed / CONFIG.stallSpeed);
  }
  p.verticalSpeed = climb - sink;
  p.x += fx * p.speed * dt;
  p.z += fz * p.speed * dt;
  p.y += p.verticalSpeed * dt;

  // Propeller spins with the engine.
  p.propAngle += (2 + p.throttle * 38) * dt;

  // Fuel only burns while the engine works.
  if (p.throttle > 0.02 && p.speed > 1) {
    p.fuel = Math.max(0, p.fuel - CONFIG.fuelBurn * p.throttle * dt);
    if (p.fuel === 0) events.push({ type: 'fuel-empty' });
  }

  // Rings: flying through the next ring's disc scores it.
  const next = RINGS[p.ringsPassed];
  if (next) {
    const dx = p.x - next.x;
    const dy = p.y - next.y;
    const dz = p.z - next.z;
    const along = dx * Math.sin(next.heading) + dz * Math.cos(next.heading);
    const radial = Math.hypot(dx * Math.cos(next.heading) - dz * Math.sin(next.heading), dy);
    if (Math.abs(along) < 6 && radial < next.radius) {
      next.passed = true;
      p.ringsPassed++;
      events.push({ type: 'ring', index: next.index });
    }
  }

  // Ground contact. The 0.05 m tolerance keeps float jitter at the
  // contact plane from flipping the plane airborne for one frame.
  const ground = groundHeight(p.x, p.z);
  const groundY = ground + 1.6;
  const overWater = ground < 0.4 && !onRunway(p.x, p.z);
  if (p.y <= groundY + 0.05) {
    if (p.y < groundY) p.y = groundY;
    if (p.onGround) {
      // Rolling along the ground: drag slows the plane.
      if (p.speed > 2 && Math.abs(p.pitch) < 0.08) {
        p.speed = Math.max(0, p.speed - 6 * dt);
      }
    } else if (onRunway(p.x, p.z) && p.verticalSpeed > -CONFIG.safeLandingSink
      && Math.abs(p.roll) < 0.35 && Math.abs(p.pitch) < 0.3 && p.speed < 70) {
      // A gentle touchdown on the strip.
      p.onGround = true;
      p.landed = true;
      events.push({ type: 'landed' });
    } else if (p.verticalSpeed < -CONFIG.crashVerticalSpeed || Math.abs(p.roll) > 0.9) {
      p.crashed = true;
      p.crashReason = overWater ? 'ditched in the bay' : 'hit the ground hard';
      events.push({ type: 'crashed', reason: p.crashReason });
    } else {
      // A rough but survivable bump: bounce, and take damage only from a
      // real thump, at most once every second and a half, so a bumpy
      // landing does not shred the airframe in one bad second.
      const thump = Math.abs(p.verticalSpeed);
      if (thump > 2 && p.time - p.bounceAt > 1.5) {
        p.damage = Math.min(100, p.damage + Math.min(20, 6 + thump * 2));
        p.bounceAt = p.time;
      }
      p.y = groundY;
      p.verticalSpeed = 2.5;
      p.pitch = 0.12;
      events.push({ type: 'bounce' });
      if (p.damage >= 100) {
        p.crashed = true;
        p.crashReason = 'airframe gave out';
        events.push({ type: 'crashed', reason: p.crashReason });
      }
    }
  } else if (p.y > groundY + 0.5) {
    // Clearly clear of the ground: now she is truly airborne.
    p.onGround = false;
  }
  // Between contact and 0.5 m up she is still leaving the ground: keep
  // onGround so the stall sink cannot grab her during rotation.

  // Leaving the charted bay: turn the plane gently back toward home.
  const dist = Math.hypot(p.x, p.z);
  if (dist > 1950) {
    const homeYaw = Math.atan2(-p.x, -p.z);
    let diff = homeYaw - p.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.yaw += diff * Math.min(1, 0.6 * dt);
    events.push({ type: 'edge' });
  }
}

// Heading in degrees, 0 = north (-z), 90 = east.
export function headingDegrees(p) {
  const deg = (Math.atan2(Math.sin(p.yaw), -Math.cos(p.yaw)) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

// Airspeed in knots, for the dials.
export function speedKnots(p) {
  return Math.round(p.speed * 1.944);
}

// Altitude in feet above sea level, for the dials.
export function altitudeFeet(p) {
  return Math.round(p.y * 3.281);
}
