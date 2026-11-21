import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../lib/store.js';
import { fxStore, fx } from '../state/fx.js';
import { settingsStore } from '../state/settings.js';
import { WALLPAPERS } from '../state/settings.js';
import { sound } from '../lib/sound.js';

// ---------------------------------------------------------------------------
// 1. Fake stop error ("Blue Screen"). Original wording / layout, not a copy.

function BlueScreen() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    sound.play('boom');
    const t = setInterval(() => setCount((c) => (c >= 100 ? 100 : c + Math.ceil(Math.random() * 7))), 220);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fx-bsod" role="img" aria-label="Simulated crash screen">
      <div className="fx-bsod-inner">
        <div className="fx-bsod-face">:(</div>
        <p>Your PC ran into a problem and needs to restart.</p>
        <p>We&rsquo;re just collecting some error info, and then we will restart for you.</p>
        <p className="fx-bsod-pct">{count}% complete</p>
        <div className="fx-bsod-foot">
          <div className="fx-bsod-qr">
            <svg viewBox="0 0 21 21" width="72" height="72" aria-hidden="true">
              {Array.from({ length: 21 * 21 }, (_, i) => {
                const x = i % 21;
                const y = (i / 21) | 0;
                const finder = (a, b) => a < 7 && b < 7;
                const corner = finder(x, y) || finder(20 - x, y) || finder(x, 20 - y);
                const on = corner ? (x % 6 !== 0 && y % 6 !== 0) || x === 0 || y === 0 : (x * 7 + y * 13 + x * y) % 3 === 0;
                return on ? <rect key={i} x={x} y={y} width="1" height="1" fill="#fff" /> : null;
              })}
            </svg>
          </div>
          <div className="fx-bsod-text">
            <p>For more pretend information about this issue, you can use the provided QR code.</p>
            <p>Stop code: FATAL_TASK_ERR</p>
            <p className="fx-bsod-hint">Press Esc or click to dismiss.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Matrix rain

function Matrix() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const g = c.getContext('2d');
    let w = (c.width = innerWidth);
    let h = (c.height = innerHeight);
    const font = 16;
    let cols = Math.floor(w / font);
    let drops = Array(cols).fill(0).map(() => Math.random() * -50);
    const chars = 'ｱｲｳｴｵｶｷｸ01ﾊﾋﾌﾍﾎ日月火水木金土ABCDEF<>/\\*+'.split('');
    let raf;
    const draw = () => {
      g.fillStyle = 'rgba(0,0,0,0.07)';
      g.fillRect(0, 0, w, h);
      g.font = `${font}px monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = chars[(Math.random() * chars.length) | 0];
        const x = i * font;
        const y = drops[i] * font;
        g.fillStyle = '#c9ffd0';
        g.fillText(ch, x, y);
        g.fillStyle = '#19ff4a';
        g.fillText(chars[(Math.random() * chars.length) | 0], x, y - font);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.7 + Math.random() * 0.5;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => {
      w = c.width = innerWidth;
      h = c.height = innerHeight;
      cols = Math.floor(w / font);
      drops = Array(cols).fill(0).map(() => Math.random() * -50);
    };
    addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
    };
  }, []);
  return <canvas ref={ref} className="fx-fill fx-matrix" />;
}

// ---------------------------------------------------------------------------
// 3. Melting screen: slices of the wallpaper drip downward.

function Melt() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas.getContext('2d');
    let w = (canvas.width = innerWidth);
    let h = (canvas.height = innerHeight);
    const s = settingsStore.get();
    const base = import.meta.env.BASE_URL;
    const url = s.wallpaper === 'custom' && s.customWallpaper ? s.customWallpaper : s.wallpaper === 'solid' ? null : `${base}${(WALLPAPERS.find((x) => x.id === s.wallpaper) || WALLPAPERS[0]).file}`;
    let raf;
    let started = false;
    const sliceW = 3;
    let speeds = [];
    const start = () => {
      speeds = Array(Math.ceil(w / sliceW)).fill(0).map(() => 0.2 + Math.random() * 2.4);
      started = true;
      tick();
    };
    const tick = () => {
      for (let i = 0; i < speeds.length; i++) {
        const x = i * sliceW;
        const drop = speeds[i] * (1.5 + Math.sin((Date.now() / 900) + i) * 0.5);
        // copy a 1px-tall strip downward to create the drip
        g.drawImage(canvas, x, 0, sliceW + 1, h - drop, x, drop, sliceW + 1, h - drop);
      }
      raf = requestAnimationFrame(tick);
    };
    const paintBg = () => {
      g.fillStyle = s.solidColor || '#1c4f86';
      g.fillRect(0, 0, w, h);
    };
    if (url) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.max(w / img.width, h / img.height);
        g.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);
        start();
      };
      img.onerror = () => {
        paintBg();
        start();
      };
      img.src = url;
    } else {
      paintBg();
      start();
    }
    return () => raf && cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="fx-fill fx-melt" />;
}

// ---------------------------------------------------------------------------
// 4. Cascading / falling windows (pure decoy divs that bounce down).

const DECOY_TITLES = ['System32', 'free_robux.exe', 'TotallyLegit.scr', 'DO_NOT_OPEN', 'you_got_pranked', 'C:\\Windows', 'hehe.bat', 'error', 'virus.exe', 'clippy.dll'];

function Cascade() {
  const [wins, setWins] = useState([]);
  const raf = useRef(0);
  const list = useRef([]);
  useEffect(() => {
    let id = 0;
    const spawn = setInterval(() => {
      if (list.current.length > 80) return;
      const w = 160 + Math.random() * 140;
      list.current.push({
        id: id++,
        w,
        h: 90 + Math.random() * 70,
        x: Math.random() * (innerWidth - w),
        y: -120,
        vy: 1 + Math.random() * 2,
        vx: Math.random() * 3 - 1.5,
        title: DECOY_TITLES[(Math.random() * DECOY_TITLES.length) | 0],
      });
    }, 160);
    const step = () => {
      const floor = innerHeight - 40;
      for (const win of list.current) {
        win.vy += 0.25;
        win.y += win.vy;
        win.x += win.vx;
        if (win.y + win.h > floor) {
          win.y = floor - win.h;
          win.vy *= -0.55;
          win.vx *= 0.8;
        }
        if (win.x < 0 || win.x + win.w > innerWidth) win.vx *= -1;
      }
      setWins([...list.current]);
      raf.current = requestAnimationFrame(step);
    };
    step();
    return () => {
      clearInterval(spawn);
      cancelAnimationFrame(raf.current);
    };
  }, []);
  return (
    <div className="fx-fill fx-cascade">
      {wins.map((w) => (
        <div key={w.id} className="fx-decoy" style={{ left: w.x, top: w.y, width: w.w, height: w.h }}>
          <div className="fx-decoy-title">
            <span>{w.title}</span>
            <span className="fx-decoy-btns">
              <i />
              <i />
              <i className="x" />
            </span>
          </div>
          <div className="fx-decoy-body">
            <span className="fx-decoy-ico">⚠</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Popup storm: scary-but-silly message boxes that multiply when closed.

const POPUPS = [
  'Your computer has NOT been infected. This is a joke.',
  'WARNING: excessive nostalgia detected.',
  'A wild pop-up appeared!',
  'Click here to win 0 dollars!',
  'Downloading more RAM... please wait forever.',
  'Your pretend files are pretend-encrypted.',
  'ERROR: success.',
  'Are you sure? Are you sure you\u2019re sure?',
  'This pop-up is self-aware and slightly embarrassed.',
  'Task failed successfully.',
];

function PopupStorm() {
  const [items, setItems] = useState([]);
  const next = useRef(0);
  const add = useCallback((n = 1) => {
    setItems((cur) => {
      if (cur.length > 60) return cur;
      const add = [];
      for (let i = 0; i < n; i++) {
        const w = 300;
        add.push({ id: next.current++, x: Math.random() * (innerWidth - w), y: Math.random() * (innerHeight - 200), text: POPUPS[(Math.random() * POPUPS.length) | 0] });
      }
      return [...cur, ...add];
    });
  }, []);
  useEffect(() => {
    add(3);
    const t = setInterval(() => add(1), 700);
    return () => clearInterval(t);
  }, [add]);
  const close = (id) => {
    sound.play('error');
    setItems((cur) => cur.filter((x) => x.id !== id));
    add(items.length < 40 ? 2 : 0); // closing one spawns two, up to a cap
  };
  return (
    <div className="fx-fill fx-popups">
      {items.map((p) => (
        <div key={p.id} className="fx-popup" style={{ left: p.x, top: p.y }}>
          <div className="fx-popup-title">
            <span>⚠ Important Message</span>
            <button onClick={() => close(p.id)} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="fx-popup-body">
            <span className="fx-popup-ico">?</span>
            <span>{p.text}</span>
          </div>
          <div className="fx-popup-btns">
            <button className="w7-btn" onClick={() => close(p.id)}>
              OK
            </button>
            <button className="w7-btn" onClick={() => close(p.id)}>
              Cancel
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Bouncing critter (an original googly-eyed blob that drags a trail of text).

function Bonzi() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let vx = 4;
    let vy = 3;
    let raf;
    const size = 140;
    const lines = ['Hiya!', 'I am 100% not a virus.', 'Wanna hear a joke?', 'Boo!', 'Just vibing.', 'Catch me!'];
    let bubble = el.querySelector('.fx-bonzi-bubble');
    let lastSwap = 0;
    const step = (t) => {
      x += vx;
      y += vy;
      if (x < 0 || x + size > innerWidth) {
        vx *= -1;
        x = Math.max(0, Math.min(innerWidth - size, x));
      }
      if (y < 0 || y + size > innerHeight - 40) {
        vy *= -1;
        y = Math.max(0, Math.min(innerHeight - 40 - size, y));
      }
      el.style.transform = `translate(${x}px, ${y}px)`;
      if (t - lastSwap > 1800) {
        lastSwap = t;
        bubble.textContent = lines[(Math.random() * lines.length) | 0];
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="fx-fill fx-bonzi-layer">
      <div className="fx-bonzi" ref={ref}>
        <div className="fx-bonzi-bubble">Hiya!</div>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <ellipse cx="70" cy="80" rx="52" ry="56" fill="#6a3fb0" stroke="#3f2070" strokeWidth="3" />
          <ellipse cx="70" cy="70" rx="40" ry="42" fill="#efe0c0" />
          <circle cx="55" cy="58" r="15" fill="#fff" stroke="#333" strokeWidth="2" />
          <circle cx="85" cy="58" r="15" fill="#fff" stroke="#333" strokeWidth="2" />
          <circle cx="58" cy="60" r="6" fill="#111" />
          <circle cx="88" cy="60" r="6" fill="#111" />
          <path d="M52 84q18 16 36 0" fill="none" stroke="#7a4a20" strokeWidth="3" strokeLinecap="round" />
          <path d="M70 24l-8-14 22 6z" fill="#e23d22" />
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Glitch / invert flicker over the whole screen.

function Glitch() {
  useEffect(() => {
    let raf;
    const root = document.querySelector('.session');
    const tick = () => {
      const hue = (Math.random() * 360) | 0;
      const inv = Math.random() > 0.6 ? 1 : 0;
      const sx = (Math.random() * 10 - 5).toFixed(1);
      const sy = (Math.random() * 10 - 5).toFixed(1);
      if (root) {
        root.style.filter = `hue-rotate(${hue}deg) invert(${inv}) contrast(${1 + Math.random()})`;
        root.style.transform = `translate(${sx}px, ${sy}px)`;
      }
      raf = setTimeout(() => requestAnimationFrame(tick), 60 + Math.random() * 90);
    };
    tick();
    return () => {
      clearTimeout(raf);
      if (root) {
        root.style.filter = '';
        root.style.transform = '';
      }
    };
  }, []);
  return <div className="fx-fill fx-glitch-scan" />;
}

const EFFECTS = { bsod: BlueScreen, matrix: Matrix, melt: Melt, cascade: Cascade, popups: PopupStorm, bonzi: Bonzi, glitch: Glitch };
const DISMISS_ON_CLICK = new Set(['bsod']);

export function EffectsLayer() {
  const active = useStore(fxStore, (s) => s.active);
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        fx.stop();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);
  if (!active) return null;
  const C = EFFECTS[active];
  if (!C) return null;
  return (
    <div className={`fx-root fx-${active}`} onClick={DISMISS_ON_CLICK.has(active) ? () => fx.stop() : undefined}>
      <C />
      {!DISMISS_ON_CLICK.has(active) && (
        <button
          className="fx-panic"
          onClick={(e) => {
            e.stopPropagation();
            fx.stop();
          }}
          title="Stop (Esc)"
        >
          ✕ Stop the chaos
        </button>
      )}
    </div>
  );
}
