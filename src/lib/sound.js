import { settingsStore } from '../state/settings.js';

// All system sounds are synthesized with WebAudio (no audio files needed).
let ctx = null;
const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

function tone(ac, out, { f, t = 0, d = 0.4, type = 'sine', g = 0.2, attack = 0.01, f2 }) {
  const o = ac.createOscillator();
  const gain = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, ac.currentTime + t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, ac.currentTime + t + d);
  gain.gain.setValueAtTime(0, ac.currentTime + t);
  gain.gain.linearRampToValueAtTime(g, ac.currentTime + t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + d);
  o.connect(gain).connect(out);
  o.start(ac.currentTime + t);
  o.stop(ac.currentTime + t + d + 0.05);
}

const SOUNDS = {
  // An original, soft four-note welcome chord.
  startup(ac, out) {
    const notes = [[311.13, 0], [392, 0.18], [466.16, 0.36], [622.25, 0.6], [783.99, 0.85]];
    notes.forEach(([f, t]) => {
      tone(ac, out, { f, t, d: 2.6 - t, g: 0.09, attack: 0.25, type: 'triangle' });
      tone(ac, out, { f: f * 2, t, d: 1.6 - t / 2, g: 0.025, attack: 0.3 });
    });
  },
  logoff(ac, out) {
    [[622.25, 0], [466.16, 0.15], [392, 0.3], [311.13, 0.45]].forEach(([f, t]) => tone(ac, out, { f, t, d: 1.2, g: 0.08, attack: 0.08, type: 'triangle' }));
  },
  error(ac, out) {
    tone(ac, out, { f: 830, d: 0.5, g: 0.16, type: 'triangle' });
    tone(ac, out, { f: 622, t: 0.09, d: 0.6, g: 0.14, type: 'triangle' });
  },
  question(ac, out) {
    tone(ac, out, { f: 700, d: 0.3, g: 0.12, type: 'sine' });
    tone(ac, out, { f: 935, t: 0.1, d: 0.45, g: 0.12, type: 'sine' });
  },
  notify(ac, out) {
    tone(ac, out, { f: 1046, d: 0.35, g: 0.1 });
    tone(ac, out, { f: 1318, t: 0.08, d: 0.4, g: 0.08 });
  },
  click(ac, out) {
    tone(ac, out, { f: 1800, d: 0.03, g: 0.05, type: 'square' });
  },
  recycle(ac, out) {
    const len = 0.35;
    const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2) * (i % 900 < 450 ? 1 : 0.4);
    const src = ac.createBufferSource();
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 2200;
    const g = ac.createGain();
    g.gain.value = 0.25;
    src.buffer = buf;
    src.connect(filt).connect(g).connect(out);
    src.start();
  },
  win(ac, out) {
    [523, 659, 784, 1046].forEach((f, i) => tone(ac, out, { f, t: i * 0.12, d: 0.5, g: 0.1, type: 'triangle' }));
  },
  boom(ac, out) {
    tone(ac, out, { f: 160, f2: 40, d: 0.7, g: 0.35, type: 'sawtooth' });
  },
};

export const sound = {
  play(name) {
    const s = settingsStore.get();
    if (!s.sounds || s.muted || !s.volume) return;
    try {
      const ac = getCtx();
      if (!ac) return;
      const out = ac.createGain();
      out.gain.value = s.volume / 100;
      out.connect(ac.destination);
      SOUNDS[name]?.(ac, out);
    } catch {
      /* audio unavailable */
    }
  },
};
