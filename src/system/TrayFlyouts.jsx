import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store.js';
import { uiStore, ui } from '../state/wm.js';
import { settingsStore, setSettings } from '../state/settings.js';
import { launch } from './shell.jsx';
import { Icon } from './icons.jsx';

function AnalogClock({ date, size = 130 }) {
  const h = date.getHours() % 12;
  const m = date.getMinutes();
  const s = date.getSeconds();
  return (
    <svg width={size} height={size} viewBox="0 0 130 130" className="analog-clock">
      <defs>
        <radialGradient id="ac-face" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe8f1" />
        </radialGradient>
        <linearGradient id="ac-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f9fc" />
          <stop offset="1" stopColor="#8ea2b8" />
        </linearGradient>
      </defs>
      <circle cx="65" cy="65" r="62" fill="url(#ac-rim)" stroke="#7d8fa3" />
      <circle cx="65" cy="65" r="55" fill="url(#ac-face)" stroke="#a7b6c6" />
      {Array.from({ length: 60 }, (_, i) => (
        <line key={i} x1="65" y1={i % 5 ? 14 : 13} x2="65" y2={i % 5 ? 17 : 21} stroke={i % 5 ? '#9aa9ba' : '#2e3c4b'} strokeWidth={i % 5 ? 1 : 2.2} transform={`rotate(${i * 6} 65 65)`} />
      ))}
      <line x1="65" y1="65" x2="65" y2="34" stroke="#1d2833" strokeWidth="4.5" strokeLinecap="round" transform={`rotate(${h * 30 + m / 2} 65 65)`} />
      <line x1="65" y1="65" x2="65" y2="22" stroke="#1d2833" strokeWidth="3" strokeLinecap="round" transform={`rotate(${m * 6 + s / 10} 65 65)`} />
      <line x1="65" y1="74" x2="65" y2="20" stroke="#c62b1a" strokeWidth="1.2" transform={`rotate(${s * 6} 65 65)`} />
      <circle cx="65" cy="65" r="3.5" fill="#1d2833" />
      <ellipse cx="65" cy="40" rx="40" ry="22" fill="#fff" opacity="0.35" />
    </svg>
  );
}

export function Calendar({ value, onChange }) {
  const [view, setView] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const today = new Date();
  const start = new Date(view);
  start.setDate(1 - start.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="cal-nav" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
          ◀
        </button>
        <span className="cal-title">{view.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
        <button className="cal-nav" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
          ▶
        </button>
      </div>
      <div className="cal-grid">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="cal-dow">
            {d}
          </span>
        ))}
        {days.map((d) => (
          <button
            key={d.toISOString()}
            className={`cal-day ${d.getMonth() !== view.getMonth() ? 'other' : ''} ${same(d, today) ? 'today' : ''} ${same(d, value) ? 'sel' : ''}`}
            onClick={() => onChange?.(d)}
          >
            {d.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClockFlyout() {
  const [now, setNow] = useState(new Date());
  const [sel, setSel] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flyout clock-flyout">
      <div className="clock-flyout-date">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <div className="clock-flyout-body">
        <Calendar value={sel} onChange={setSel} />
        <div className="clock-flyout-clock">
          <AnalogClock date={now} />
          <div className="clock-flyout-time">{now.toLocaleTimeString([], { hour12: !settingsStore.get().clock24 })}</div>
        </div>
      </div>
      <div className="flyout-footer">
        <a
          onClick={() => {
            ui.set({ tray: null });
            launch('control', { page: 'datetime' });
          }}
        >
          Change date and time settings...
        </a>
      </div>
    </div>
  );
}

function VolumeFlyout() {
  const s = useStore(settingsStore);
  return (
    <div className="flyout volume-flyout">
      <div className="vol-col">
        <Icon name="cp-sound" size={32} />
        <input
          type="range"
          className="w7-range vol-slider"
          min="0"
          max="100"
          value={s.muted ? 0 : s.volume}
          aria-label="Volume"
          onChange={(e) => setSettings({ volume: +e.target.value, muted: false })}
        />
        <button className={`vol-mute ${s.muted ? 'muted' : ''}`} onClick={() => setSettings({ muted: !s.muted })} title={s.muted ? 'Unmute Speakers' : 'Mute Speakers'}>
          <svg width="20" height="20" viewBox="0 0 16 16">
            <path d="M2 6h3l4-3.5v11L5 10H2z" fill="#4a5a6c" />
            {s.muted ? <path d="M11 6l4 4M15 6l-4 4" stroke="#d22" strokeWidth="1.6" /> : <path d="M11 5.5c1.2 1.4 1.2 3.6 0 5M13 3.5c2.2 2.5 2.2 6.5 0 9" stroke="#4a5a6c" fill="none" strokeWidth="1.2" />}
          </svg>
        </button>
        <div className="vol-label">Speakers</div>
      </div>
      <div className="flyout-footer">
        <a
          onClick={() => {
            ui.set({ tray: null });
            launch('control', { page: 'sound' });
          }}
        >
          Mixer
        </a>
      </div>
    </div>
  );
}

function NetworkFlyout() {
  return (
    <div className="flyout network-flyout">
      <div className="net-title">Currently connected to:</div>
      <div className="net-row">
        <Icon name="network" size={32} />
        <div>
          <b>Network</b>
          <div>Internet access</div>
        </div>
      </div>
      <div className="net-title">Wireless Network Connection</div>
      {['HomeNetwork', 'CoffeeShop_Free', 'NETGEAR-5G'].map((n, i) => (
        <div className="net-ssid" key={n}>
          <span>{n}</span>
          <span className="net-bars">{'▂▄▆█'.slice(0, 4 - i)}</span>
        </div>
      ))}
      <div className="flyout-footer">
        <a
          onClick={() => {
            ui.set({ tray: null });
            launch('control', { page: 'network' });
          }}
        >
          Open Network and Sharing Center
        </a>
      </div>
    </div>
  );
}

function ActionFlyout() {
  return (
    <div className="flyout action-flyout">
      <div className="net-row">
        <Icon name="shield" size={32} />
        <div>
          <b>No current issues detected</b>
          <div>Windows will notify you when there is a problem.</div>
        </div>
      </div>
      <div className="flyout-footer">
        <a
          onClick={() => {
            ui.set({ tray: null });
            launch('control', { page: 'system' });
          }}
        >
          Open Action Center
        </a>
      </div>
    </div>
  );
}

function HiddenFlyout() {
  return (
    <div className="flyout hidden-flyout">
      <div className="hidden-icons">
        <span title="Safely Remove Hardware">
          <Icon name="drive-c" size={16} />
        </span>
        <span title="Windows Update">
          <Icon name="shield" size={16} />
        </span>
      </div>
      <div className="flyout-footer">
        <a onClick={() => ui.set({ tray: null })}>Customize...</a>
      </div>
    </div>
  );
}

export function TrayFlyouts() {
  const tray = useStore(uiStore, (s) => s.tray);
  useEffect(() => {
    if (!tray) return;
    const close = (e) => {
      if (!e.target.closest?.('.flyout')) ui.set({ tray: null });
    };
    const t = setTimeout(() => window.addEventListener('pointerdown', close), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', close);
    };
  }, [tray]);
  if (!tray) return null;
  const C = { clock: ClockFlyout, volume: VolumeFlyout, network: NetworkFlyout, action: ActionFlyout, hidden: HiddenFlyout }[tray];
  return C ? <C /> : null;
}

export { AnalogClock };
