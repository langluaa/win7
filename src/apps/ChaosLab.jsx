import React from 'react';
import { useStore } from '../lib/store.js';
import { fxStore, fx } from '../state/fx.js';
import { wm } from '../state/wm.js';

const CARDS = [
  { id: 'bsod', name: 'Blue Screen of Jokes', desc: 'A fake crash screen. Looks dire, does nothing.', emoji: ':(' },
  { id: 'matrix', name: 'Matrix Rain', desc: 'Glowing green characters cascade down the screen.', emoji: '🌧' },
  { id: 'melt', name: 'Screen Melt', desc: 'The desktop drips down like warm candle wax.', emoji: '🫠' },
  { id: 'cascade', name: 'Falling Windows', desc: 'Decoy windows rain down and pile up at the bottom.', emoji: '🪟' },
  { id: 'popups', name: 'Pop-up Storm', desc: 'Silly message boxes that multiply when you close them.', emoji: '🗯' },
  { id: 'bonzi', name: 'Desktop Buddy', desc: 'A googly-eyed blob bounces around babbling.', emoji: '👾' },
  { id: 'glitch', name: 'Glitch Out', desc: 'The whole screen flickers, shifts and inverts.', emoji: '📺' },
  { id: 'earthquake', name: 'Earthquake', desc: 'The entire desktop shakes and rumbles.', emoji: '🫨' },
  { id: 'flip', name: 'Flip Screen', desc: 'Turns the whole desktop upside down.', emoji: '🙃' },
  { id: 'format', name: 'Format C: (Not Really)', desc: 'Pretends to wipe the disk, then owns up to the joke.', emoji: '💾' },
  { id: 'starfield', name: 'Warp Speed', desc: 'Fly through a field of stars at light speed.', emoji: '🌌' },
  { id: 'fireworks', name: 'Fireworks', desc: 'A celebratory firework show over your desktop.', emoji: '🎆' },
];

export default function ChaosLab({ win }) {
  const active = useStore(fxStore, (s) => s.active);
  return (
    <div className="chaos">
      <div className="chaos-head">
        <h1>Chaos Lab</h1>
        <p>
          Harmless joke &ldquo;viruses&rdquo; for your pretend PC. Every effect is just an animation inside this simulator &mdash; it can&rsquo;t touch your real computer, your files or the internet. Press <b>Esc</b> or the <b>Stop</b> button to end any effect.
        </p>
      </div>
      <div className="chaos-grid">
        {CARDS.map((c) => (
          <button key={c.id} data-fx={c.id} className={`chaos-card ${active === c.id ? 'on' : ''}`} onClick={() => fx.toggle(c.id)}>
            <span className="chaos-emoji">{c.emoji}</span>
            <span className="chaos-name">{c.name}</span>
            <span className="chaos-desc">{c.desc}</span>
            <span className="chaos-action">{active === c.id ? 'Running — click to stop' : 'Unleash'}</span>
          </button>
        ))}
      </div>
      <div className="chaos-foot">
        <button className="w7-btn" disabled={!active} onClick={() => fx.stop()}>
          Stop everything
        </button>
        <button className="w7-btn" onClick={() => wm.close(win.id)}>
          Close
        </button>
      </div>
    </div>
  );
}
