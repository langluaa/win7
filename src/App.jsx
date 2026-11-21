import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from './lib/store.js';
import { wmStore, uiStore, ui, wm, setRegistry } from './state/wm.js';
import { settingsStore, hexToRgb } from './state/settings.js';
import { APPS } from './apps/registry.js';
import { IconDefs } from './system/icons.jsx';
import { Window } from './system/Window.jsx';
import { Desktop } from './system/Desktop.jsx';
import { Taskbar } from './system/Taskbar.jsx';
import { StartMenu } from './system/StartMenu.jsx';
import { TrayFlyouts } from './system/TrayFlyouts.jsx';
import { ContextMenuLayer } from './system/ContextMenu.jsx';
import { BootScreen, LogonScreen, StatusScreen, OffScreen, SleepScreen, usePhase } from './system/Screens.jsx';
import { Screensaver } from './system/Screensaver.jsx';
import { messageBox } from './system/dialogs.jsx';
import { launch } from './system/shell.jsx';
import { sound } from './lib/sound.js';

setRegistry(APPS);

function mix(hex, base, a) {
  const c = hexToRgb(hex);
  const b = hexToRgb(base);
  return `rgb(${c.map((v, i) => Math.round(v * a + b[i] * (1 - a))).join(',')})`;
}

/** Push settings into CSS custom properties (glass color, taskbar size...). */
function useTheme() {
  const s = useStore(settingsStore);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--glass-rgb', hexToRgb(s.glassColor).join(', '));
    root.style.setProperty('--glass-a', String(s.glassIntensity));
    root.style.setProperty('--glass-solid', mix(s.glassColor, '#c2cfde', Math.min(0.85, s.glassIntensity + 0.15)));
    root.style.setProperty('--taskbar-h', s.taskbar.smallIcons ? '30px' : '40px');
    root.classList.toggle('no-transparency', !s.transparency);
    // Wake the taskbar-height dependents (desktop grid, maximized windows).
    uiStore.set((u) => ({ ...u }));
  }, [s.glassColor, s.glassIntensity, s.transparency, s.taskbar.smallIcons]);
}

function WindowLayer() {
  const windows = useStore(wmStore, (s) => s.windows);
  const activeId = useStore(wmStore, (s) => s.activeId);
  const peek = useStore(uiStore, (s) => s.peek);
  return (
    <div className="window-layer">
      {windows.map((w) => (
        <Window key={w.id} win={w} active={w.id === activeId} peeked={peek === 'desktop' || (peek && peek !== w.id && !(w.owner && w.owner === peek))} />
      ))}
    </div>
  );
}

function SnapPreview() {
  const p = useStore(uiStore, (s) => s.snapPreview);
  if (!p) return null;
  return <div className="snap-preview" style={{ left: p.x + 4, top: p.y + 4, width: p.w - 8, height: p.h - 8, '--ox': `${p.from.x - p.x}px`, '--oy': `${p.from.y - p.y}px` }} />;
}

function useGlobalKeys() {
  useEffect(() => {
    let metaAlone = false;
    const down = (e) => {
      if (uiStore.get().phase !== 'desktop') return;
      if (e.key === 'Meta' || e.key === 'OS') metaAlone = true;
      else metaAlone = false;
      if (e.ctrlKey && e.key === 'Escape') {
        e.preventDefault();
        ui.toggleStart();
      } else if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        launch('run');
      } else if (e.key === 'Escape') {
        ui.set({ startOpen: false, tray: null });
      } else if (e.altKey && e.key === 'F4') {
        const id = wmStore.get().activeId;
        if (id) {
          e.preventDefault();
          wm.close(id);
        }
      } else if (e.metaKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        wm.toggleDesktop();
      } else if (e.metaKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const id = wmStore.get().activeId;
        if (!id) return;
        e.preventDefault();
        const w = wmStore.get().windows.find((x) => x.id === id);
        if (e.key === 'ArrowUp') wm.maximize(id);
        else if (e.key === 'ArrowDown') w.maximized ? wm.unmaximize(id) : wm.minimize(id);
        else wm.snap(id, e.key === 'ArrowLeft' ? 'left' : 'right');
      }
    };
    const up = (e) => {
      if ((e.key === 'Meta' || e.key === 'OS') && metaAlone && uiStore.get().phase === 'desktop') ui.toggleStart();
      metaAlone = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
}

function useIdleScreensaver(active) {
  const ss = useStore(settingsStore, (s) => s.screensaver);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!active || ss.type === 'none') return;
    let t;
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(() => setRunning(true), ss.wait * 60 * 1000);
    };
    reset();
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel'];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [active, ss.type, ss.wait]);
  const stop = useCallback(() => setRunning(false), []);
  return running && ss.type !== 'none' ? <Screensaver type={ss.type} onExit={stop} /> : null;
}

function DesktopSession({ visible }) {
  useGlobalKeys();
  const ss = useIdleScreensaver(visible);
  useEffect(() => {
    let warned = false;
    const onQuota = () => {
      if (warned) return;
      warned = true;
      messageBox({ title: 'Low Disk Space', text: "You are running out of disk space on Local Disk (C:).\nThis browser's storage is full, so recent changes may not be saved. Delete some large files (such as pictures) and empty the Recycle Bin.", icon: 'warning' });
      setTimeout(() => (warned = false), 30000);
    };
    window.addEventListener('win7-quota', onQuota);
    return () => window.removeEventListener('win7-quota', onQuota);
  }, []);
  return (
    <div className={`session ${visible ? 'shown' : ''}`} aria-hidden={!visible}>
      <Desktop />
      <WindowLayer />
      <SnapPreview />
      <Taskbar />
      <StartMenu />
      <TrayFlyouts />
      <ContextMenuLayer />
      {ss}
    </div>
  );
}

function detectFont() {
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '20px monospace';
    const a = c.measureText('mmmmmmmmmmlli').width;
    c.font = '20px "Segoe UI", monospace';
    const b = c.measureText('mmmmmmmmmmlli').width;
    if (a === b) document.documentElement.classList.add('no-segoe');
  } catch {
    /* ignore */
  }
}

export default function App() {
  const phase = usePhase();
  useTheme();
  useEffect(detectFont, []);
  const sessionPhases = ['desktop', 'locked', 'sleep', 'unlocking'];
  const inSession = sessionPhases.includes(phase);

  useEffect(() => {
    if (phase === 'desktop') sound.play('startup');
  }, [phase]);

  return (
    <>
      <IconDefs />
      {inSession && <DesktopSession visible={phase === 'desktop'} />}
      {phase === 'boot' && <BootScreen />}
      {phase === 'login' && <LogonScreen />}
      {phase === 'locked' && <LogonScreen locked />}
      {phase === 'welcome' && <StatusScreen text="Welcome" next={() => ui.phase('desktop')} delay={1900} />}
      {phase === 'unlocking' && <StatusScreen text="Welcome" next={() => ui.phase('desktop')} delay={700} />}
      {phase === 'shuttingdown' && <StatusScreen text="Shutting down..." />}
      {phase === 'loggingoff' && <StatusScreen text="Logging off..." />}
      {phase === 'restarting' && <div className="screen off" />}
      {phase === 'off' && <OffScreen />}
      {phase === 'sleep' && <SleepScreen />}
    </>
  );
}
