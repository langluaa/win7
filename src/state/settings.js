import { createStore, load, save, debounce } from '../lib/store.js';

const KEY = 'win7.settings.v1';

// Aero colorization presets (name, hex, default intensity 0..1).
export const GLASS_COLORS = [
  { name: 'Sky', hex: '#74b8fc', a: 0.42 },
  { name: 'Twilight', hex: '#0046ad', a: 0.66 },
  { name: 'Sea', hex: '#00a0a0', a: 0.55 },
  { name: 'Leaf', hex: '#3e9e2a', a: 0.62 },
  { name: 'Lime', hex: '#84c51c', a: 0.45 },
  { name: 'Sun', hex: '#fadc0e', a: 0.42 },
  { name: 'Pumpkin', hex: '#ff9c00', a: 0.5 },
  { name: 'Ruby', hex: '#ce0f0f', a: 0.62 },
  { name: 'Fuchsia', hex: '#ff0099', a: 0.42 },
  { name: 'Blush', hex: '#fcc7f8', a: 0.38 },
  { name: 'Violet', hex: '#6e3ba1', a: 0.55 },
  { name: 'Lavender', hex: '#8d5a94', a: 0.42 },
  { name: 'Taupe', hex: '#9c8c6c', a: 0.42 },
  { name: 'Chocolate', hex: '#4f1b1b', a: 0.66 },
  { name: 'Slate', hex: '#555555', a: 0.38 },
  { name: 'Frost', hex: '#fcfcfc', a: 0.36 },
];

export const WALLPAPERS = [
  { id: 'harmony', name: 'Harmony', file: 'wallpapers/harmony.svg', group: 'Windows Desktop Backgrounds' },
  { id: 'aurora', name: 'Aurora', file: 'wallpapers/aurora.svg', group: 'Scenes' },
  { id: 'lake', name: 'Lake', file: 'wallpapers/lake.svg', group: 'Landscapes' },
  { id: 'dunes', name: 'Dunes', file: 'wallpapers/dunes.svg', group: 'Landscapes' },
  { id: 'leaves', name: 'Leaves', file: 'wallpapers/leaves.svg', group: 'Nature' },
  { id: 'bloom', name: 'Bloom', file: 'wallpapers/bloom.svg', group: 'Nature' },
  { id: 'nightfall', name: 'Nightfall', file: 'wallpapers/nightfall.svg', group: 'Scenes' },
];

export const SOLID_COLORS = ['#3a6ea5', '#1d4c79', '#2b5797', '#004e98', '#000000', '#404040', '#008080', '#5a7a3a', '#7b3f00', '#6d2e86', '#a0522d', '#c0c0c0'];

export const THEMES = [
  { id: 'win7', name: 'Windows 7', wallpaper: 'harmony', color: 'Sky' },
  { id: 'scenes', name: 'Scenes', wallpaper: 'aurora', color: 'Sea' },
  { id: 'landscapes', name: 'Landscapes', wallpaper: 'lake', color: 'Twilight' },
  { id: 'nature', name: 'Nature', wallpaper: 'leaves', color: 'Leaf' },
  { id: 'desert', name: 'Desert', wallpaper: 'dunes', color: 'Pumpkin' },
  { id: 'bloom', name: 'Bloom', wallpaper: 'bloom', color: 'Fuchsia' },
  { id: 'night', name: 'Nightfall', wallpaper: 'nightfall', color: 'Violet' },
];

export const USER_PICTURES = ['flower', 'sunset', 'ocean', 'leaf', 'ball', 'guitar', 'robot', 'kitten'];

export const defaultSettings = () => ({
  username: 'User',
  password: '',
  userPicture: 'flower',
  wallpaper: 'harmony', // id | 'custom' | 'solid'
  customWallpaper: null, // data URL
  solidColor: '#3a6ea5',
  wallpaperPosition: 'fill',
  glassColor: '#74b8fc',
  glassIntensity: 0.42,
  transparency: true,
  iconSize: 'medium',
  autoArrange: false,
  alignToGrid: true,
  showDesktopIcons: true,
  sortBy: 'name',
  iconPositions: {},
  sysIcons: { computer: true, user: true, network: false, recycle: true, controlpanel: false },
  taskbar: { autoHide: false, smallIcons: false, peek: true, locked: true, pinned: ['iexplore', 'explorer', 'notepad', 'mspaint'] },
  startUsage: { calc: 6, notepad: 5, mspaint: 4, minesweeper: 3, cmd: 2, photos: 1 },
  recentFiles: [],
  clock24: false,
  sounds: true,
  volume: 70,
  muted: false,
  screensaver: { type: 'none', wait: 10 },
  bootAnimation: true,
  browser: {
    home: 'about:home',
    favorites: [
      { title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Windows_7' },
      { title: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html' },
      { title: 'Example Domain', url: 'https://example.com/' },
    ],
  },
  notepad: { wordWrap: false, statusBar: false, font: { family: 'Lucida Console', size: 10, bold: false, italic: false } },
  explorer: { view: 'details', navPane: true, detailsPane: true },
});

function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  const out = { ...base };
  for (const k of Object.keys(saved)) {
    const b = base[k];
    const s = saved[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s) && k !== 'iconPositions' && k !== 'startUsage' ? { ...b, ...s } : s;
  }
  return out;
}

export const settingsStore = createStore(merge(defaultSettings(), load(KEY, null)));

const persist = debounce(() => {
  if (!save(KEY, settingsStore.get())) window.dispatchEvent(new CustomEvent('win7-quota'));
}, 300);
settingsStore.subscribe(persist);

export function setSettings(patch) {
  settingsStore.set((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
}

export function setNested(key, patch) {
  settingsStore.set((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
}

export function bumpUsage(appId) {
  settingsStore.set((s) => ({ ...s, startUsage: { ...s.startUsage, [appId]: (s.startUsage[appId] || 0) + 1 } }));
}

export function addRecentFile(fileId, appId) {
  settingsStore.set((s) => ({
    ...s,
    recentFiles: [{ id: fileId, app: appId }, ...s.recentFiles.filter((r) => r.id !== fileId)].slice(0, 12),
  }));
}

export function resetSettings() {
  settingsStore.set(defaultSettings());
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
