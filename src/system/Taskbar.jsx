import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../lib/store.js';
import { wmStore, uiStore, wm, ui, getRegistry } from '../state/wm.js';
import { settingsStore, setSettings, setNested } from '../state/settings.js';
import { fs } from '../state/fs.js';
import { Icon, Flag } from './icons.jsx';
import { taskbarButtonRects } from './Window.jsx';
import { launch, openNode } from './shell.jsx';
import { useTap } from '../lib/pointer.js';

export function StartOrb({ open }) {
  return (
    <button
      className={`start-orb ${open ? 'open' : ''}`}
      aria-label="Start"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={() => ui.toggleStart()}
    >
      <svg viewBox="0 0 54 54" width="54" height="54" aria-hidden="true">
        <defs>
          <radialGradient id="orb-body" cx="0.5" cy="0.62" r="0.62">
            <stop offset="0" stopColor="#7fd6ff" />
            <stop offset="0.45" stopColor="#1f74c9" />
            <stop offset="0.85" stopColor="#0b2d6b" />
            <stop offset="1" stopColor="#06204f" />
          </radialGradient>
          <linearGradient id="orb-shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
          </linearGradient>
          <radialGradient id="orb-hot" cx="0.5" cy="0.7" r="0.6">
            <stop offset="0" stopColor="#b8f4ff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#3bb6ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="27" cy="27" r="19.5" fill="#0b1d38" opacity="0.6" />
        <circle className="orb-ring" cx="27" cy="27" r="18.6" fill="url(#orb-body)" stroke="#0a1a33" strokeWidth="1" />
        <circle className="orb-glow" cx="27" cy="27" r="18" fill="url(#orb-hot)" />
        <g transform="translate(17.3 16.6) scale(0.98)">
          <Flag />
        </g>
        <ellipse cx="27" cy="18" rx="14" ry="8.6" fill="url(#orb-shine)" />
        <circle cx="27" cy="27" r="18.6" fill="none" stroke="#9ad7ff" strokeOpacity="0.6" strokeWidth="0.8" />
      </svg>
    </button>
  );
}

function Thumbs({ group, anchor, onEnter, onLeave }) {
  const ref = useRef(null);
  const [x, setX] = useState(anchor.left);
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth || 200;
    setX(Math.max(4, Math.min(window.innerWidth - w - 4, anchor.left + anchor.width / 2 - w / 2)));
  }, [anchor, group.windows.length]);
  const activeId = useStore(wmStore, (s) => s.activeId);
  return (
    <div className="tb-thumbs" ref={ref} style={{ left: x }} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      {group.windows.map((w) => (
        <div
          key={w.id}
          className={`tb-thumb ${w.id === activeId ? 'active' : ''}`}
          onPointerEnter={() => settingsStore.get().taskbar.peek && ui.set({ peek: w.id })}
          onPointerLeave={() => ui.set({ peek: null })}
          onClick={() => {
            ui.set({ peek: null });
            wm.restore(w.id);
            onLeave(true);
          }}
        >
          <div className="tb-thumb-title">
            <Icon name={w.icon} size={16} />
            <span>{w.title}</span>
            <button
              className="tb-thumb-close"
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                wm.close(w.id);
              }}
            >
              ✕
            </button>
          </div>
          <div className="tb-thumb-preview">
            <MiniWindow win={w} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A tiny schematic preview of the window (title, chrome and app icon). */
function MiniWindow({ win }) {
  const ratio = win.w / win.h;
  const w = ratio > 1 ? 160 : 100 * ratio;
  const h = ratio > 1 ? 160 / ratio : 100;
  return (
    <div className="mini-win" style={{ width: Math.min(160, w), height: Math.min(100, h) }}>
      <div className="mini-win-body">
        <Icon name={win.icon} size={32} />
      </div>
    </div>
  );
}

function TaskButton({ group, active, onHover, onUnhover, small }) {
  const ref = useRef(null);
  const app = getRegistry()[group.app];
  const running = group.windows.length > 0;
  const [glow, setGlow] = useState(null);

  useLayoutEffect(() => {
    const update = () => {
      if (ref.current) taskbarButtonRects[group.app] = ref.current.getBoundingClientRect();
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  });

  const click = () => {
    onUnhover(true);
    if (!running) return launch(group.app);
    if (group.windows.length === 1) {
      const w = group.windows[0];
      if (active && !w.minimized) wm.minimize(w.id);
      else wm.restore(w.id);
      return;
    }
    // Cycle through the group's windows.
    const sorted = [...group.windows].sort((a, b) => b.z - a.z);
    const top = sorted.find((w) => !w.minimized);
    if (active && top) {
      const next = sorted[sorted.length - 1];
      wm.restore(next.id);
    } else wm.restore((top || sorted[0]).id);
  };

  const jump = (e) => {
    onUnhover(true);
    const pinned = settingsStore.get().taskbar.pinned.includes(group.app);
    const recent = settingsStore
      .get()
      .recentFiles.filter((r) => r.app === group.app && fs.get(r.id))
      .slice(0, 6);
    const items = [];
    if (recent.length) {
      items.push({ label: 'Recent', disabled: true });
      recent.forEach((r) => items.push({ label: fs.get(r.id).name, icon: 'file-text', onClick: () => openNode(r.id, group.app) }));
      items.push({ separator: true });
    }
    if (group.app === 'iexplore') {
      items.push({ label: 'Tasks', disabled: true }, { label: 'Open new tab', icon: 'iexplore', onClick: () => launch('iexplore') }, { separator: true });
    }
    items.push({ label: app.name, icon: app.icon, onClick: () => launch(group.app) });
    items.push({
      label: pinned ? 'Unpin this program from taskbar' : 'Pin this program to taskbar',
      onClick: () => {
        const list = settingsStore.get().taskbar.pinned;
        setNested('taskbar', { pinned: pinned ? list.filter((a) => a !== group.app) : [...list, group.app] });
      },
    });
    if (running) items.push({ label: group.windows.length > 1 ? 'Close all windows' : 'Close window', icon: 'error', onClick: () => group.windows.forEach((w) => wm.close(w.id)) });
    const r = ref.current.getBoundingClientRect();
    ui.menuAt(r.left, r.top - 4, items, { alignBottom: true, className: 'jumplist' });
  };

  const taps = useTap({ onContext: jump });

  return (
    <button
      ref={ref}
      className={`tb-btn ${running ? 'running' : ''} ${active ? 'active' : ''} ${group.windows.length > 1 ? 'stacked' : ''}`}
      style={{ '--hot': app?.hot || '#6ec6ff', '--gx': glow ? glow + 'px' : '50%' }}
      aria-label={app?.name}
      onClick={click}
      onPointerDown={taps.onPointerDown}
      onPointerUp={taps.onPointerUp}
      onContextMenu={taps.onContextMenu}
      onPointerMove={(e) => {
        taps.onPointerMove(e);
        const r = e.currentTarget.getBoundingClientRect();
        setGlow(e.clientX - r.left);
      }}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(group, ref.current.getBoundingClientRect())}
      onPointerLeave={() => {
        setGlow(null);
        onUnhover();
      }}
    >
      <span className="tb-btn-glow" />
      <Icon name={app?.icon} size={small ? 16 : 24} />
    </button>
  );
}

function Clock({ s }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !s.clock24 });
  const date = now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  const tray = useStore(uiStore, (u) => u.tray);
  return (
    <button
      className={`tb-clock ${tray === 'clock' ? 'open' : ''}`}
      title={now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => ui.set({ tray: tray === 'clock' ? null : 'clock', startOpen: false })}
    >
      <span>{time}</span>
      {!s.taskbar.smallIcons && <span>{date}</span>}
    </button>
  );
}

function TrayIcon({ id, title, children }) {
  const tray = useStore(uiStore, (u) => u.tray);
  return (
    <button
      className={`tray-icon ${tray === id ? 'open' : ''}`}
      title={title}
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => ui.set({ tray: tray === id ? null : id, startOpen: false })}
    >
      {children}
    </button>
  );
}

export function Taskbar() {
  const windows = useStore(wmStore, (s) => s.windows);
  const activeId = useStore(wmStore, (s) => s.activeId);
  const startOpen = useStore(uiStore, (s) => s.startOpen);
  const s = useStore(settingsStore);
  const [hover, setHover] = useState(null); // { group, rect }
  const hoverTimer = useRef(null);
  const leaveTimer = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const reg = getRegistry();

  const groups = useMemo(() => {
    const out = [];
    const byApp = new Map();
    for (const app of s.taskbar.pinned) {
      if (!reg[app]) continue;
      const g = { app, windows: [] };
      byApp.set(app, g);
      out.push(g);
    }
    for (const w of [...windows].sort((a, b) => a.created - b.created)) {
      if (w.dialog || w.closing || reg[w.app]?.hidden) continue;
      let g = byApp.get(w.app);
      if (!g) {
        g = { app: w.app, windows: [] };
        byApp.set(w.app, g);
        out.push(g);
      }
      g.windows.push(w);
    }
    return out;
  }, [windows, s.taskbar.pinned, reg]);

  const activeApp = windows.find((w) => w.id === activeId);
  const activeGroupApp = activeApp ? (activeApp.dialog ? windows.find((w) => w.id === activeApp.owner)?.app : activeApp.app) : null;

  const onHover = (group, rect) => {
    clearTimeout(leaveTimer.current);
    clearTimeout(hoverTimer.current);
    if (!group.windows.length) return setHover(null);
    hoverTimer.current = setTimeout(() => setHover({ group, rect }), hover ? 0 : 450);
  };
  const onUnhover = (now) => {
    clearTimeout(hoverTimer.current);
    clearTimeout(leaveTimer.current);
    if (now === true) {
      ui.set({ peek: null });
      return setHover(null);
    }
    leaveTimer.current = setTimeout(() => {
      setHover(null);
      ui.set({ peek: null });
    }, 350);
  };

  // Keep the thumbnail group fresh as windows change.
  const hoverGroup = hover && groups.find((g) => g.app === hover.group.app);
  const autoHide = s.taskbar.autoHide && !startOpen && !revealed && !hover;
  const vol = s.muted ? 0 : s.volume;

  return (
    <>
      {s.taskbar.autoHide && <div className="taskbar-reveal" onPointerEnter={() => setRevealed(true)} />}
      <div
        className={`taskbar ${autoHide ? 'hidden' : ''} ${s.taskbar.smallIcons ? 'small' : ''}`}
        onPointerLeave={() => setRevealed(false)}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) ui.set({ startOpen: false, tray: null });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (e.target.closest('.tb-btn')) return;
          ui.menu(e, [
            { label: 'Toolbars', submenu: [{ label: 'Address', disabled: true }, { label: 'Links', disabled: true }, { label: 'Desktop', disabled: true }] },
            { separator: true },
            { label: 'Cascade windows', onClick: () => cascadeAll() },
            { label: 'Show windows stacked', onClick: () => tileAll('v') },
            { label: 'Show windows side by side', onClick: () => tileAll('h') },
            { label: 'Show the desktop', onClick: () => wm.toggleDesktop() },
            { separator: true },
            { label: 'Start Task Manager', onClick: () => launch('taskmgr') },
            { separator: true },
            { label: 'Lock the taskbar', checked: s.taskbar.locked, onClick: () => setNested('taskbar', { locked: !s.taskbar.locked }) },
            { label: 'Properties', onClick: () => launch('control', { page: 'taskbar' }) },
          ]);
        }}
      >
        <StartOrb open={startOpen} />
        <div className="tb-buttons">
          {groups.map((g) => (
            <TaskButton key={g.app} group={g} small={s.taskbar.smallIcons} active={g.app === activeGroupApp} onHover={onHover} onUnhover={onUnhover} />
          ))}
        </div>
        <div className="tb-tray">
          <TrayIcon id="hidden" title="Show hidden icons">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M4 10l4-4 4 4" fill="none" stroke="#fff" strokeWidth="1.6" />
            </svg>
          </TrayIcon>
          <TrayIcon id="action" title="Action Center: No current issues detected">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 1v14" stroke="#e8e8e8" strokeWidth="1.4" />
              <path d="M3.6 2c3-1.4 5 1.3 9 0v6.5c-4 1.3-6-1.4-9 0z" fill="#fff" />
            </svg>
          </TrayIcon>
          <TrayIcon id="network" title="Internet access">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect x="1" y="9" width="5" height="4" fill="#cfe4ff" stroke="#fff" strokeWidth="0.6" />
              <rect x="1.8" y="9.8" width="3.4" height="2.4" fill="#2b86e0" />
              <rect x="9" y="3" width="6" height="5" fill="#cfe4ff" stroke="#fff" strokeWidth="0.6" />
              <rect x="9.8" y="3.8" width="4.4" height="3.4" fill="#2b86e0" />
              <path d="M3.5 13v2h9V8" stroke="#fff" fill="none" />
            </svg>
          </TrayIcon>
          <TrayIcon id="volume" title={`Speakers: ${vol}%`}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M2 6h3l4-3.5v11L5 10H2z" fill="#fff" stroke="#9ab" strokeWidth="0.5" />
              {vol > 0 ? (
                <>
                  <path d="M11 5.5c1.2 1.4 1.2 3.6 0 5" stroke="#fff" fill="none" strokeWidth="1.2" />
                  {vol > 40 && <path d="M13 3.5c2.2 2.5 2.2 6.5 0 9" stroke="#fff" fill="none" strokeWidth="1.2" />}
                </>
              ) : (
                <g>
                  <circle cx="12.5" cy="11.5" r="3.3" fill="#d22" stroke="#fff" strokeWidth="0.6" />
                  <path d="M11 10l3 3M14 10l-3 3" stroke="#fff" strokeWidth="1.1" />
                </g>
              )}
            </svg>
          </TrayIcon>
          <Clock s={s} />
        </div>
        <button
          className="tb-show-desktop"
          title="Show desktop"
          aria-label="Show desktop"
          onPointerEnter={() => {
            if (!s.taskbar.peek) return;
            clearTimeout(hoverTimer.current);
            hoverTimer.current = setTimeout(() => ui.set({ peek: 'desktop' }), 500);
          }}
          onPointerLeave={() => {
            clearTimeout(hoverTimer.current);
            ui.set({ peek: null });
          }}
          onClick={() => {
            clearTimeout(hoverTimer.current);
            ui.set({ peek: null });
            wm.toggleDesktop();
          }}
        />
      </div>
      {hoverGroup && hoverGroup.windows.length > 0 && (
        <Thumbs
          group={hoverGroup}
          anchor={hover.rect}
          onEnter={() => clearTimeout(leaveTimer.current)}
          onLeave={(now) => onUnhover(now)}
        />
      )}
    </>
  );
}

function visibleWindows() {
  return wmStore.get().windows.filter((w) => !w.minimized && !w.dialog && !w.closing);
}

function cascadeAll() {
  visibleWindows()
    .sort((a, b) => a.z - b.z)
    .forEach((w, i) => {
      wm.setRect(w.id, { maximized: false, snapped: null, x: 20 + i * 28, y: 20 + i * 28 });
      wm.focus(w.id);
    });
}

function tileAll(dir) {
  const list = visibleWindows();
  const n = list.length;
  if (!n) return;
  const W = window.innerWidth;
  const H = window.innerHeight - 40;
  list.forEach((w, i) =>
    wm.setRect(
      w.id,
      dir === 'h'
        ? { maximized: false, snapped: null, x: Math.round((W / n) * i), y: 0, w: Math.round(W / n), h: H }
        : { maximized: false, snapped: null, x: 0, y: Math.round((H / n) * i), w: W, h: Math.round(H / n) }
    )
  );
}

export { setSettings };
