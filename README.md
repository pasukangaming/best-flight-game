[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/pasukangaming/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/pasukangaming/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Solara Skies

An original flight game for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly the **Kestrel**, a little cream-and-teal prop plane, over **Solara Bay** — an island archipelago with mountains, beaches, a lighthouse bay and one small airfield. Thread **eight golden rings**, then bring her home to the runway before the fuel or the clock runs out.

No libraries, no network, no build step: plain static files under `game/`, all art drawn in code, all sound synthesised live with WebAudio.

## How to play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and open http://localhost:8080).

| Control | What it does |
| --- | --- |
| ↑ / ↓ or W / S | Pitch up / down |
| ← / → or A / D | Bank left / right (banking turns the nose) |
| SHIFT | Throttle up |
| CTRL | Throttle down |
| Mouse (hold button) | Steer with the pointer |
| ENTER | Take off / start |
| R | Fly again after landing or crashing |

**The mission:** take off from Solara Bay Airfield, fly through the eight golden rings in order (the gold arrow points at the next one), then land gently back on the runway. Each ring is +250 points; a landing is +500 plus fuel and time bonuses. Watch the fuel gauge — an empty tank means gliding — and the clock: you have 5 minutes.

**Landing:** line up with the strip, keep the wings level, come down slowly. A gentle touchdown scores; a hard one bends the airframe, and a very hard one ends the flight.

## What is in the game

- `game/index.html` — the page: one canvas, one module script.
- `game/src/config.js` — every tuning number and the palette.
- `game/src/random.js` — seeded random numbers and value noise.
- `game/src/terrain.js` — the bay: heightfield, runway, ring course, airfield buildings, clouds.
- `game/src/plane.js` — the Kestrel's arcade flight model, rings, landings, crashes.
- `game/src/input.js` — keyboard and mouse, one snapshot per frame.
- `game/src/audio.js` — engine hum, wind and chimes, all synthesised.
- `game/src/render.js` — a small software 3D projector: sky, sea, terrain, runway, rings, clouds, the plane.
- `game/src/hud.js` — the cockpit: lit airspeed and altitude dials, artificial horizon, compass, fuel, score, timer, menus.
- `game/src/main.js` — the frame loop, the mission state machine, and the deterministic screenshot scenes (`?shot=start|play|ring|land`).
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to the output and writes `dossier.json` with the vendored make.fun library.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — four real renders of the game running in a browser.

## Screenshots

1. `1-start.jpg` — the Kestrel parked on the runway, title up, morning light.
2. `2-play.jpg` — mid-flight over the bay, chasing Ring 3.
3. `3-ring.jpg` — threading a golden ring, low over the water.
4. `4-land.jpg` — final approach, runway and tower ahead, gear down.

## Licence

MIT — see [LICENSE](LICENSE).
