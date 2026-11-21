import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.js';
import { settingsStore, updateGadget, removeGadget, addGadget } from '../state/settings.js';
import { taskbarHeight } from '../state/wm.js';
import { trackDrag } from '../lib/pointer.js';
import { openDialog } from './dialogs.jsx';
import { AnalogClock, Calendar } from './TrayFlyouts.jsx';

// ---------------------------------------------------------------------------
// Individual gadget bodies

function ClockGadget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="gad-clock">
      <AnalogClock date={now} size={126} />
    </div>
  );
}

function CalendarGadget() {
  const now = new Date();
  return (
    <div className="gad-cal">
      <div className="gad-cal-day">{now.getDate()}</div>
      <div className="gad-cal-month">{now.toLocaleDateString([], { month: 'long' })}</div>
      <div className="gad-cal-dow">{now.toLocaleDateString([], { weekday: 'long' })}</div>
    </div>
  );
}

function CpuGadget() {
  const [vals, setVals] = useState({ cpu: 4, ram: 32 });
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf;
    const loop = () => {
      frames++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const t = setInterval(() => {
      const now = performance.now();
      const fps = (frames * 1000) / (now - last);
      frames = 0;
      last = now;
      const cpu = Math.max(1, Math.min(100, Math.round((1 - Math.min(fps, 60) / 60) * 100 + 3 + Math.random() * 5)));
      const pm = performance.memory;
      const ram = pm ? Math.round((pm.usedJSHeapSize / pm.jsHeapSizeLimit) * 100) + 20 : 30 + Math.round(Math.random() * 6);
      setVals({ cpu, ram: Math.min(99, ram) });
    }, 1000);
    return () => {
      clearInterval(t);
      cancelAnimationFrame(raf);
    };
  }, []);
  const Dial = ({ value, label, color }) => {
    const a = -120 + (value / 100) * 240;
    return (
      <div className="gad-dial">
        <svg viewBox="0 0 60 50" width="60" height="50">
          <path d="M8 44 A26 26 0 0 1 52 44" fill="none" stroke="#333" strokeWidth="5" strokeLinecap="round" />
          <path d="M8 44 A26 26 0 0 1 52 44" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray="82" strokeDashoffset={82 - (value / 100) * 82} />
          <line x1="30" y1="40" x2={30 + 18 * Math.cos((a * Math.PI) / 180)} y2={40 + 18 * Math.sin((a * Math.PI) / 180)} stroke="#fff" strokeWidth="1.6" />
          <circle cx="30" cy="40" r="2.5" fill="#fff" />
        </svg>
        <span>{label}</span>
      </div>
    );
  };
  return (
    <div className="gad-cpu">
      <Dial value={vals.cpu} label={`CPU ${vals.cpu}%`} color="#5fd24f" />
      <Dial value={vals.ram} label={`RAM ${vals.ram}%`} color="#4aa5e8" />
    </div>
  );
}

const WEATHER = [
  { city: 'Redmond', t: 14, icon: 'cloud' },
  { city: 'Honolulu', t: 28, icon: 'sun' },
  { city: 'Reykjavik', t: 2, icon: 'snow' },
  { city: 'Nairobi', t: 24, icon: 'sun' },
];

function WeatherGadget({ gadget }) {
  const [i, setI] = useState(() => gadget.city ?? 0);
  const w = WEATHER[i % WEATHER.length];
  const icon =
    w.icon === 'sun' ? (
      <circle cx="24" cy="24" r="12" fill="#ffd23b" />
    ) : w.icon === 'snow' ? (
      <>
        <circle cx="20" cy="22" r="10" fill="#fff" />
        <circle cx="30" cy="24" r="8" fill="#eef4fa" />
        <path d="M18 38v2M24 38v2M30 38v2" stroke="#9cf" strokeWidth="2" />
      </>
    ) : (
      <>
        <circle cx="28" cy="18" r="8" fill="#ffd23b" />
        <ellipse cx="22" cy="28" rx="15" ry="9" fill="#fff" />
      </>
    );
  return (
    <button
      className="gad-weather"
      onClick={() => {
        const n = (i + 1) % WEATHER.length;
        setI(n);
        updateGadget(gadget.id, { city: n });
      }}
      title="Click to change city"
    >
      <svg viewBox="0 0 48 44" width="60" height="55">{icon}</svg>
      <div className="gad-w-temp">{w.t}&deg;C</div>
      <div className="gad-w-city">{w.city}</div>
    </button>
  );
}

function NoteGadget({ gadget }) {
  return (
    <textarea
      className="gad-note-text"
      value={gadget.text || ''}
      placeholder="Type a note..."
      spellCheck={false}
      onChange={(e) => updateGadget(gadget.id, { text: e.target.value })}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

const BODIES = { clock: ClockGadget, calendar: CalendarGadget, cpu: CpuGadget, weather: WeatherGadget, note: NoteGadget };

const CATALOG = [
  { type: 'clock', name: 'Clock', desc: 'An analog clock with a sweeping second hand.' },
  { type: 'calendar', name: 'Calendar', desc: "Today's date at a glance." },
  { type: 'cpu', name: 'CPU Meter', desc: 'Live CPU and memory dials.' },
  { type: 'weather', name: 'Weather', desc: 'A (pretend) local forecast.' },
  { type: 'note', name: 'Sticky Note', desc: 'A little note that stays on your desktop.' },
];

// ---------------------------------------------------------------------------

function Gadget({ gadget }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(false);
  const Body = BODIES[gadget.type];
  if (!Body) return null;

  const onDown = (e) => {
    if (e.target.closest('.gad-tools') || e.target.tagName === 'TEXTAREA') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = ref.current;
    const start = { x: gadget.x, y: gadget.y };
    const tb = taskbarHeight();
    trackDrag(e, {
      threshold: 3,
      onMove: ({ dx, dy }) => {
        const x = Math.max(-40, Math.min(window.innerWidth - 40, start.x + dx));
        const y = Math.max(0, Math.min(window.innerHeight - tb - 30, start.y + dy));
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      },
      onEnd: ({ dx, dy }) => {
        updateGadget(gadget.id, {
          x: Math.max(-40, Math.min(window.innerWidth - 40, start.x + dx)),
          y: Math.max(0, Math.min(window.innerHeight - tb - 30, start.y + dy)),
        });
      },
    });
  };

  return (
    <div
      ref={ref}
      className={`gadget gad-${gadget.type} ${hover ? 'hover' : ''}`}
      style={{ left: gadget.x, top: gadget.y, opacity: gadget.opacity ?? 1 }}
      onPointerDown={onDown}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Body gadget={gadget} />
      <div className="gad-tools">
        <button className="gad-close" title="Close" onClick={() => removeGadget(gadget.id)}>
          ✕
        </button>
        <button
          className="gad-opacity"
          title="Opacity"
          onClick={() => {
            const steps = [1, 0.8, 0.6, 0.4];
            const cur = gadget.opacity ?? 1;
            updateGadget(gadget.id, { opacity: steps[(steps.indexOf(cur) + 1) % steps.length] });
          }}
        >
          ◐
        </button>
      </div>
    </div>
  );
}

export function GadgetsLayer() {
  const gadgets = useStore(settingsStore, (s) => s.gadgets);
  if (!gadgets?.length) return null;
  return (
    <div className="gadgets-layer">
      {gadgets.map((g) => (
        <Gadget key={g.id} gadget={g} />
      ))}
    </div>
  );
}

export function openGadgetGallery(owner) {
  return openDialog({
    title: 'Gadget Gallery',
    icon: 'screensaver',
    owner,
    render: (done) => (
      <div className="gadget-gallery">
        <p className="gg-head">Double-click a gadget to add it to your desktop.</p>
        <div className="gg-grid">
          {CATALOG.map((c) => (
            <button
              key={c.type}
              className="gg-item"
              onDoubleClick={() => {
                addGadget(c.type);
              }}
              onClick={(e) => e.detail === 0 && addGadget(c.type)}
            >
              <span className="gg-preview">{GALLERY_PREVIEW[c.type]}</span>
              <span className="gg-name">{c.name}</span>
              <span className="gg-desc">{c.desc}</span>
            </button>
          ))}
        </div>
        <div className="props-buttons">
          <button className="w7-btn default" onClick={() => done(null)}>
            Close
          </button>
        </div>
      </div>
    ),
  });
}

const GALLERY_PREVIEW = {
  clock: (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="17" fill="#fff" stroke="#8a98a8" />
      <path d="M20 20V8M20 20l8 5" stroke="#1d232a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  calendar: (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="6" y="8" width="28" height="26" rx="2" fill="#fff" stroke="#8a98a8" />
      <rect x="6" y="8" width="28" height="7" fill="#d64" />
      <text x="20" y="30" textAnchor="middle" fontSize="15" fill="#333">
        21
      </text>
    </svg>
  ),
  cpu: (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <path d="M6 30 A14 14 0 0 1 34 30" fill="none" stroke="#5fd24f" strokeWidth="4" />
      <line x1="20" y1="28" x2="28" y2="18" stroke="#333" strokeWidth="2" />
    </svg>
  ),
  weather: (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="24" cy="16" r="7" fill="#ffd23b" />
      <ellipse cx="18" cy="26" rx="12" ry="7" fill="#fff" stroke="#ccc" />
    </svg>
  ),
  note: (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <path d="M8 6h24v22l-8 6H8z" fill="#fdf39b" stroke="#c9b53a" />
      <path d="M12 14h16M12 19h16M12 24h10" stroke="#c9b53a" strokeWidth="1.3" />
    </svg>
  ),
};
