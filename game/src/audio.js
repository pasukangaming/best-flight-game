// Solara Skies — sound, synthesised live, no audio files.
// One job: an engine hum that follows the throttle, wind that follows
// the speed, and short chimes for rings, landings and crashes.
// Everything is built from WebAudio oscillators and noise, so the game
// loads nothing over the network and works fully offline.

export function createSound() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let enabled = true;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: two detuned sawtooths through a low-pass filter.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 110;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped noise through a band-pass filter.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSource.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, when, dur, type, vol) {
    if (!ctx || !enabled) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime + when);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + dur + 0.05);
  }

  return {
    unlock,
    setEnabled(v) {
      enabled = v;
      if (!enabled && engineGain) engineGain.gain.value = 0;
    },
    // Called every frame with the plane's live state.
    update(throttle, speed, airborne) {
      if (!started || !enabled || !ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075, t, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + throttle * 62, t, 0.1);
      const wind = airborne ? Math.min(1, speed / 90) : 0;
      windGain.gain.setTargetAtTime(wind * 0.11, t, 0.15);
      windFilter.frequency.setTargetAtTime(300 + speed * 9, t, 0.15);
    },
    ring() {
      tone(880, 0, 0.35, 'sine', 0.22);
      tone(1318, 0.07, 0.4, 'sine', 0.18);
    },
    landed() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.5, 'triangle', 0.2));
    },
    crash() {
      if (!ctx || !enabled) return;
      const len = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      tone(70, 0, 0.6, 'sine', 0.3);
    },
    click() {
      tone(660, 0, 0.08, 'square', 0.08);
    },
  };
}
