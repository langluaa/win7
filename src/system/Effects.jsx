import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../lib/store.js';
import { fxStore, fx } from '../state/fx.js';
import { settingsStore } from '../state/settings.js';
import { WALLPAPERS } from '../state/settings.js';
import { sound } from '../lib/sound.js';

// ---------------------------------------------------------------------------
// 1. Fake stop error, styled like the classic Windows 7 text-mode "blue screen".
//    The wording makes clear it's a harmless prank; the layout mimics a real bugcheck.

const STOP_CODES = [
  ['JOKE_VIRUS_NOT_A_REAL_PROBLEM', '0x0000DEAD', 'prank.sys'],
  ['NOSTALGIA_OVERFLOW', '0x0000C0DE', 'memories.sys'],
  ['TOO_MUCH_FUN_EXCEPTION', '0x0000F00D', 'chaos.sys'],
  ['IRQL_NOT_LESS_THAN_HILARIOUS', '0x0000BEEF', 'giggle.sys'],
];

function BlueScreen() {
  const [dump, setDump] = useState(0);
  const [pick] = useState(() => STOP_CODES[(Math.random() * STOP_CODES.length) | 0]);
  const [addr] = useState(() => 'F' + ((Math.random() * 0xfffffff) | 0).toString(16).toUpperCase().padStart(7, '0'));
  useEffect(() => {
    sound.play('boom');
    const t = setInterval(() => setDump((d) => (d >= 100 ? 100 : d + Math.ceil(Math.random() * 6))), 140);
    return () => clearInterval(t);
  }, []);
  const [name, code, sys] = pick;
  return (
    <div className="fx-bsod" role="img" aria-label="Simulated Windows 7 stop error (a joke)">
      <pre className="fx-bsod-pre">{`A problem has been detected and Windows has been shut down to prevent damage
to your computer. (Just kidding. Nothing is actually wrong.)

${name}

If this is the first time you've seen this stop error screen,
relax and take a breath. This is a harmless prank running inside the
Windows 7 simulator. Nothing on your real computer has changed.

If this screen appears again, follow these steps:

Check to make sure you are having a reasonable amount of fun. Disable any
real worries you may have installed. If you need to use Safe Mode to remove
or disable components, press Esc or click anywhere to return to the desktop.

Technical information:

*** STOP: ${code} (0xBAADF00D, 0x00000000, 0xC0FFEE00, 0x1DEADBEEF)

***  ${sys} - Address ${addr} base at F0010000, DateStamp 4ae7a2b1

Beginning dump of physical memory
Dumping physical memory to disk: ${dump}${dump >= 100 ? `
Physical memory dump complete. (0 real bytes written.)
Contact nobody, because nothing actually happened.

Press Esc or click anywhere to continue.` : ''}`}</pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Earthquake: shake the whole desktop.

function Earthquake() {
  useEffect(() => {
    const root = document.querySelector('.session');
    if (!root) return;
    sound.play('boom');
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const mag = 6 + Math.sin((t - t0) / 600) * 4;
      const x = (Math.random() * 2 - 1) * mag;
      const y = (Math.random() * 2 - 1) * mag;
      const r = (Math.random() * 2 - 1) * 0.6;
      root.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      root.style.transform = '';
    };
  }, []);
  return <div className="fx-fill fx-quake-tint" />;
}

// ---------------------------------------------------------------------------
// 9. Flip the whole screen upside down.

function Flip() {
  useEffect(() => {
    const root = document.querySelector('.session');
    if (!root) return;
    root.style.transition = 'transform 0.8s cubic-bezier(.6,.1,.3,1)';
    root.style.transform = 'rotate(180deg)';
    return () => {
      root.style.transform = '';
      setTimeout(() => root && (root.style.transition = ''), 850);
    };
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// 10. Fake "format C:" — a console that pretends to wipe the disk, then owns up.

function FakeFormat() {
  const [pct, setPct] = useState(-1);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let p = 0;
    const warm = setTimeout(() => {
      setPct(0);
      const t = setInterval(() => {
        p += Math.random() * 5;
        if (p >= 100) {
          p = 100;
          setPct(100);
          clearInterval(t);
          setTimeout(() => setDone(true), 500);
        } else setPct(Math.floor(p));
      }, 160);
    }, 1400);
    return () => clearTimeout(warm);
  }, []);
  const bars = pct >= 0 ? Math.round(pct / 2) : 0;
  return (
    <div className="fx-fill fx-format">
      <pre>{`Microsoft Windows [Version 6.1.7601]
(c) 2009 Totally Not A Real Company. Good luck.

C:\\>format C: /Q /Y
WARNING, ALL DATA ON NON-REMOVABLE DISK
DRIVE C: WILL BE LOST (it won't, this is a joke).
Proceeding with Quick Format...
`}
{pct >= 0 && `\n${pct}% completed.\n[${'\u2588'.repeat(bars)}${'\u2591'.repeat(50 - bars)}]\n`}
{done && `
Format complete.

...

...just kidding!  (\u256F\u00B0\u25A1\u00B0)\u256F

Your files are exactly where you left them. Nothing was formatted,
deleted, harmed, or even mildly inconvenienced.

C:\\>_

Press Esc or the Stop button to return to the desktop.`}</pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 11. Starfield warp.

function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const g = c.getContext('2d');
    let w = (c.width = innerWidth);
    let h = (c.height = innerHeight);
    const N = Math.min(800, Math.floor((w * h) / 2200));
    const stars = Array.from({ length: N }, () => ({ x: Math.random() * w - w / 2, y: Math.random() * h - h / 2, z: Math.random() * w }));
    let raf;
    const draw = () => {
      g.fillStyle = 'rgba(0,0,8,0.4)';
      g.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      for (const s of stars) {
        s.z -= 8;
        if (s.z <= 0) {
          s.x = Math.random() * w - w / 2;
          s.y = Math.random() * h - h / 2;
          s.z = w;
        }
        const k = 128 / s.z;
        const px = cx + s.x * k;
        const py = cy + s.y * k;
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        const size = (1 - s.z / w) * 3;
        const shade = Math.min(255, (1 - s.z / w) * 320) | 0;
        g.fillStyle = `rgb(${shade},${shade},${Math.min(255, shade + 40)})`;
        g.fillRect(px, py, size, size);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => {
      w = c.width = innerWidth;
      h = c.height = innerHeight;
    };
    addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
    };
  }, []);
  return <canvas ref={ref} className="fx-fill fx-starfield" />;
}

// ---------------------------------------------------------------------------
// 12. Fireworks over the desktop.

function Fireworks() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const g = c.getContext('2d');
    let w = (c.width = innerWidth);
    let h = (c.height = innerHeight);
    const parts = [];
    let raf;
    let t = 0;
    const burst = () => {
      const x = w * (0.15 + Math.random() * 0.7);
      const y = h * (0.12 + Math.random() * 0.45);
      const hue = (Math.random() * 360) | 0;
      const n = 60 + ((Math.random() * 40) | 0);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        const sp = 1.5 + Math.random() * 4;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: hue + (Math.random() * 30 - 15) });
      }
    };
    const draw = () => {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, 0, w, h);
      if (t++ % 32 === 0) burst();
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += 0.03;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.012;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        g.globalAlpha = Math.max(0, p.life);
        g.fillStyle = `hsl(${p.hue},100%,${55 + p.life * 20}%)`;
        g.fillRect(p.x, p.y, 2.4, 2.4);
      }
      g.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => {
      w = c.width = innerWidth;
      h = c.height = innerHeight;
    };
    addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
    };
  }, []);
  return <canvas ref={ref} className="fx-fill fx-fireworks" />;
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

const EFFECTS = {
  bsod: BlueScreen,
  matrix: Matrix,
  melt: Melt,
  cascade: Cascade,
  popups: PopupStorm,
  bonzi: Bonzi,
  glitch: Glitch,
  earthquake: Earthquake,
  flip: Flip,
  format: FakeFormat,
  starfield: Starfield,
  fireworks: Fireworks,
};
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
