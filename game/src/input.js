// Solara Skies — keyboard and mouse.
// One job: turn raw key and pointer events into one control snapshot
// the flight model reads each frame. No game logic lives here.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, active: false, down: false };

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(keyName(e));
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width - 0.5;
    mouse.y = (e.clientY - rect.top) / rect.height - 0.5;
    mouse.active = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    mouse.down = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width - 0.5;
    mouse.y = (e.clientY - rect.top) / rect.height - 0.5;
    mouse.active = true;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  function pressed(...names) {
    return names.some((n) => keys.has(n));
  }

  // Snapshot for this frame. Keyboard always wins; the mouse steers
  // only while its button is held, so a resting pointer never fights you.
  function snapshot() {
    let pitch = 0;
    let roll = 0;
    if (pressed('ArrowUp', 'w')) pitch += 1;
    if (pressed('ArrowDown', 's')) pitch -= 1;
    if (pressed('ArrowLeft', 'a')) roll -= 1;
    if (pressed('ArrowRight', 'd')) roll += 1;
    if (mouse.down && mouse.active) {
      roll += Math.max(-1, Math.min(1, mouse.x * 2.4));
      pitch += Math.max(-1, Math.min(1, -mouse.y * 2.0));
    }
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      throttleUp: pressed('Shift', 'q', 'e'),
      throttleDown: pressed('Control', 'c'),
      anyKey: keys.size > 0,
    };
  }

  function consume(...names) {
    const hit = names.some((n) => keys.has(n));
    names.forEach((n) => keys.delete(n));
    return hit;
  }

  return { snapshot, consume, pressed, keys };
}
