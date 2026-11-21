import { createStore, newId } from '../lib/store.js';

export const wmStore = createStore({ windows: [], activeId: null, z: 10 });
export const uiStore = createStore({
  startOpen: false,
  menu: null, // { x, y, items }
  tray: null, // 'clock' | 'volume' | 'network' | 'hidden' | 'action'
  peek: null, // null | 'desktop' | windowId
  phase: 'boot', // boot | login | welcome | desktop | loggingoff | shutdown | off | sleep | restart
  clipboard: null, // { op: 'cut'|'copy', ids: [] }
  snapPreview: null, // { x, y, w, h }
  taskbarRects: {}, // appId -> DOMRect for minimize animations
});

const guards = new Map(); // winId -> async () => boolean (true = ok to close)
let registry = {};
export const setRegistry = (r) => (registry = r);
export const getRegistry = () => registry;

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });
export const isCompact = () => window.innerWidth < 700 || window.innerHeight < 500;

function cascade(windows, w, h, taskbarH) {
  const vp = viewport();
  const n = windows.filter((x) => !x.dialog).length % 8;
  const x = Math.max(0, Math.min(vp.w - w, 60 + n * 26 + Math.round((vp.w - w - 160) * 0.12)));
  const y = Math.max(0, Math.min(vp.h - taskbarH - h, 30 + n * 26));
  return { x, y };
}

const update = (id, patch) =>
  wmStore.set((s) => ({
    ...s,
    windows: s.windows.map((w) => (w.id === id ? { ...w, ...(typeof patch === 'function' ? patch(w) : patch) } : w)),
  }));

export function taskbarHeight() {
  return document.documentElement.style.getPropertyValue('--taskbar-h') === '30px' ? 30 : 40;
}

export const wm = {
  open(appId, props = {}, opts = {}) {
    const app = registry[appId];
    if (!app) return null;
    props = { ...(app.defaultProps || {}), ...props };
    const s = wmStore.get();
    if (app.single) {
      const existing = s.windows.find((w) => w.app === appId && !w.closing);
      if (existing) {
        if (props && Object.keys(props).length) update(existing.id, { props: { ...existing.props, ...props, _t: Date.now() } });
        wm.restore(existing.id);
        return existing.id;
      }
    }
    const vp = viewport();
    const tb = taskbarHeight();
    const w = Math.min(opts.w || app.size?.w || 640, vp.w);
    const h = Math.min(opts.h || app.size?.h || 460, vp.h - tb);
    let pos;
    if (opts.owner) {
      const owner = s.windows.find((x) => x.id === opts.owner);
      if (owner) pos = { x: owner.x + Math.round((owner.w - w) / 2), y: owner.y + Math.round((owner.h - h) / 3) };
    }
    if (!pos && app.position) pos = app.position(vp, w, h, tb);
    if (!pos && (opts.center || app.center)) pos = { x: Math.round((vp.w - w) / 2), y: Math.round((vp.h - tb - h) / 2.4) };
    if (!pos) pos = cascade(s.windows, w, h, tb);
    pos.x = Math.max(0, Math.min(vp.w - w, pos.x));
    pos.y = Math.max(0, Math.min(vp.h - tb - h, pos.y));
    const id = newId('w');
    const z = s.z + 1;
    const maximize = (app.resizable !== false && app.maximizable !== false && !opts.dialog && isCompact()) || opts.maximized;
    const win = {
      id,
      app: appId,
      title: opts.title || app.title || app.name,
      icon: opts.icon || app.icon,
      x: pos.x,
      y: pos.y,
      w,
      h,
      z,
      minimized: false,
      maximized: !!maximize,
      snapped: null,
      restore: null,
      props,
      dialog: !!opts.dialog,
      owner: opts.owner || null,
      resizable: opts.resizable ?? app.resizable !== false,
      maximizable: opts.maximizable ?? (app.maximizable !== false && !opts.dialog),
      minimizable: opts.minimizable ?? !opts.dialog,
      created: Date.now(),
    };
    wmStore.set({ ...s, windows: [...s.windows, win], activeId: id, z });
    uiStore.set((u) => ({ ...u, startOpen: false, menu: null }));
    return id;
  },

  focus(id) {
    const s = wmStore.get();
    const win = s.windows.find((w) => w.id === id);
    if (!win) return;
    // A window with an open modal dialog passes focus to the dialog.
    const modal = s.windows.find((w) => w.owner === id && w.dialog && !w.closing);
    if (modal) return wm.focus(modal.id);
    if (s.activeId === id && win.z === s.z) return;
    const z = s.z + 1;
    wmStore.set({ ...s, z, activeId: id, windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)) });
  },

  blurAll() {
    wmStore.set((s) => (s.activeId ? { ...s, activeId: null } : s));
  },

  setTitle(id, title) {
    const w = wmStore.get().windows.find((x) => x.id === id);
    if (w && w.title !== title) update(id, { title });
  },

  setGuard(id, fn) {
    if (fn) guards.set(id, fn);
    else guards.delete(id);
  },

  async close(id, force = false) {
    const win = wmStore.get().windows.find((w) => w.id === id);
    if (!win || win.closing) return;
    const modal = wmStore.get().windows.find((w) => w.owner === id && w.dialog && !w.closing);
    if (modal && !force) return wm.focus(modal.id);
    if (!force && guards.has(id)) {
      const ok = await guards.get(id)();
      if (!ok) return;
    }
    guards.delete(id);
    // Close owned dialogs too.
    wmStore.get().windows.filter((w) => w.owner === id).forEach((w) => wm.close(w.id, true));
    update(id, { closing: true });
    setTimeout(() => {
      wmStore.set((s) => {
        const windows = s.windows.filter((w) => w.id !== id);
        let activeId = s.activeId;
        if (activeId === id) {
          const owner = win.owner && windows.find((w) => w.id === win.owner);
          const next = owner || [...windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
          activeId = next ? next.id : null;
        }
        return { ...s, windows, activeId };
      });
      win.onClosed?.();
    }, 190);
  },

  minimize(id) {
    const s = wmStore.get();
    const next = s.windows.filter((w) => w.id !== id && !w.minimized && !w.closing).sort((a, b) => b.z - a.z)[0];
    wmStore.set({
      ...s,
      activeId: s.activeId === id ? next?.id || null : s.activeId,
      windows: s.windows.map((w) => (w.id === id || w.owner === id ? { ...w, minimized: true } : w)),
    });
  },

  restore(id) {
    const s = wmStore.get();
    wmStore.set({ ...s, windows: s.windows.map((w) => (w.id === id || w.owner === id ? { ...w, minimized: false } : w)) });
    wm.focus(id);
  },

  toggleMax(id) {
    const w = wmStore.get().windows.find((x) => x.id === id);
    if (!w || !w.maximizable) return;
    if (w.maximized) update(id, { maximized: false });
    else update(id, { maximized: true, snapped: null });
  },

  maximize(id) {
    update(id, (w) => (w.maximizable ? { maximized: true, snapped: null } : {}));
  },

  unmaximize(id) {
    update(id, { maximized: false });
  },

  snap(id, side) {
    const vp = viewport();
    const tb = taskbarHeight();
    update(id, (w) => ({
      restore: w.snapped ? w.restore : { x: w.x, y: w.y, w: w.w, h: w.h },
      snapped: side,
      maximized: false,
      x: side === 'left' ? 0 : Math.floor(vp.w / 2),
      y: 0,
      w: Math.ceil(vp.w / 2),
      h: vp.h - tb,
    }));
  },

  unsnap(id) {
    update(id, (w) => (w.snapped && w.restore ? { snapped: null, w: w.restore.w, h: w.restore.h, restore: null } : { snapped: null }));
  },

  setRect(id, rect) {
    update(id, rect);
  },

  minimizeAll() {
    wmStore.set((s) => ({ ...s, activeId: null, windows: s.windows.map((w) => ({ ...w, minimized: true, wasShown: !w.minimized })) }));
  },

  /** "Show desktop" toggle: minimize everything, or bring back what was showing. */
  toggleDesktop() {
    const s = wmStore.get();
    const anyShown = s.windows.some((w) => !w.minimized);
    if (anyShown) return wm.minimizeAll();
    wmStore.set({ ...s, windows: s.windows.map((w) => (w.wasShown ? { ...w, minimized: false, wasShown: false } : w)) });
    const top = wmStore.get().windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
    if (top) wm.focus(top.id);
  },

  closeAll() {
    guards.clear();
    wmStore.set((s) => ({ ...s, windows: [], activeId: null }));
  },

  /** Ask every window's guard (unsaved changes) before shutting down. */
  async confirmCloseAll() {
    for (const w of [...wmStore.get().windows]) {
      const g = guards.get(w.id);
      if (g) {
        wm.restore(w.id);
        const ok = await g();
        if (!ok) return false;
        guards.delete(w.id);
      }
    }
    wm.closeAll();
    return true;
  },

  windowsOf(appId) {
    return wmStore.get().windows.filter((w) => w.app === appId && !w.closing);
  },
};

export const ui = {
  set: (patch) => uiStore.set((s) => ({ ...s, ...patch })),
  menu(e, items) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    uiStore.set((s) => ({ ...s, menu: { x, y, items, key: Date.now() }, tray: null }));
  },
  menuAt(x, y, items, opts = {}) {
    uiStore.set((s) => ({ ...s, menu: { x, y, items, key: Date.now(), ...opts }, tray: null }));
  },
  closeMenu: () => uiStore.set((s) => (s.menu ? { ...s, menu: null } : s)),
  toggleStart: (v) => uiStore.set((s) => ({ ...s, startOpen: v ?? !s.startOpen, menu: null, tray: null })),
  phase: (phase) => uiStore.set((s) => ({ ...s, phase, startOpen: false, menu: null, tray: null })),
};
