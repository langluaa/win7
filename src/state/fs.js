import { createStore, load, save, debounce } from '../lib/store.js';
import * as core from './fsCore.js';

const KEY = 'win7.fs.v1';

const WELCOME = `Welcome to Windows 7 Ultimate (web edition)

This is a desktop simulator that runs entirely in your browser.
Everything you create is saved in this browser's local storage:
files, folders, desktop icon positions and your personalization.

Things to try
  - Drag, resize, snap (drag a window to the screen edge) and
    maximize windows. Double-click a title bar to maximize.
  - Right-click (or long-press on touch screens) the desktop.
  - Open Control Panel > Appearance and Personalization to change
    the wallpaper and Aero glass color.
  - Draw something in Paint and save it to your Pictures folder.
  - Beat Minesweeper on Advanced.

Keyboard shortcuts
  Windows key / Ctrl+Esc   Start menu
  Alt+Shift+R              Run dialog
  F2                       Rename selected item
  Delete                   Move to Recycle Bin

This project is a fan-made tribute and is not affiliated with
or endorsed by Microsoft.
`;

const TODO = `Shopping list
- Milk
- Coffee beans
- New mouse pad

Remember: back up the Documents folder!
`;

function sys(id, name, parent, type = 'folder', extra = {}) {
  return { id, name, parent, type, system: true, ctime: 1256601600000, mtime: 1256601600000, ...extra };
}
function file(id, name, parent, content, extra = {}) {
  return { id, name, parent, type: 'file', content, ctime: 1700000000000, mtime: 1700000000000, ...extra };
}
function link(id, name, parent, target) {
  return { id, name, parent, type: 'shortcut', target, ctime: 1700000000000, mtime: 1700000000000 };
}

export function defaultFs(username = 'User') {
  const list = [
    sys('C', 'Local Disk', null, 'drive', { letter: 'C', capacity: 128 * 1024 ** 3, used: 41.3 * 1024 ** 3 }),
    sys('D', 'DVD RW Drive', null, 'drive', { letter: 'D', optical: true }),
    sys('perflogs', 'PerfLogs', 'C'),
    sys('progfiles', 'Program Files', 'C'),
    sys('progfiles86', 'Program Files (x86)', 'C'),
    sys('users', 'Users', 'C'),
    sys('windows', 'Windows', 'C'),
    sys('system32', 'System32', 'windows'),
    sys('web', 'Web', 'windows'),
    sys('wallpapers', 'Wallpaper', 'web'),
    sys('pf-ie', 'Internet Explorer', 'progfiles'),
    sys('pf-games', 'Microsoft Games', 'progfiles'),
    sys('pf-acc', 'Windows NT', 'progfiles'),
    sys('pf-common', 'Common Files', 'progfiles'),
    sys('public', 'Public', 'users'),
    sys('pub-docs', 'Public Documents', 'public'),
    sys('pub-pics', 'Public Pictures', 'public'),
    sys('pub-music', 'Public Music', 'public'),
    sys('pub-videos', 'Public Videos', 'public'),
    sys('user', username, 'users'),
    sys('contacts', 'Contacts', 'user'),
    sys('desktop', 'Desktop', 'user'),
    sys('documents', 'Documents', 'user'),
    sys('downloads', 'Downloads', 'user'),
    sys('favorites', 'Favorites', 'user'),
    sys('links', 'Links', 'user'),
    sys('music', 'Music', 'user'),
    sys('pictures', 'Pictures', 'user'),
    sys('savedgames', 'Saved Games', 'user'),
    sys('searches', 'Searches', 'user'),
    sys('videos', 'Videos', 'user'),
    sys('samplepics', 'Sample Pictures', 'pub-pics'),
    file('w-harmony', 'img0.jpg', 'wallpapers', 'asset:wallpapers/harmony.svg', { system: true }),
    file('sp1', 'Aurora.jpg', 'samplepics', 'asset:wallpapers/aurora.svg'),
    file('sp2', 'Lake.jpg', 'samplepics', 'asset:wallpapers/lake.svg'),
    file('sp3', 'Dunes.jpg', 'samplepics', 'asset:wallpapers/dunes.svg'),
    file('sp4', 'Leaves.jpg', 'samplepics', 'asset:wallpapers/leaves.svg'),
    file('sp5', 'Bloom.jpg', 'samplepics', 'asset:wallpapers/bloom.svg'),
    file('sp6', 'Nightfall.jpg', 'samplepics', 'asset:wallpapers/nightfall.svg'),
    file('s32-1', 'notepad.exe', 'system32', '', { system: true, exe: 'notepad' }),
    file('s32-2', 'calc.exe', 'system32', '', { system: true, exe: 'calc' }),
    file('s32-3', 'mspaint.exe', 'system32', '', { system: true, exe: 'mspaint' }),
    file('s32-4', 'cmd.exe', 'system32', '', { system: true, exe: 'cmd' }),
    file('s32-5', 'control.exe', 'system32', '', { system: true, exe: 'control' }),
    file('s32-6', 'winver.exe', 'system32', '', { system: true, exe: 'winver' }),
    file('win-1', 'explorer.exe', 'windows', '', { system: true, exe: 'explorer' }),
    file('ie-1', 'iexplore.exe', 'pf-ie', '', { system: true, exe: 'iexplore' }),
    file('mg-1', 'Minesweeper.exe', 'pf-games', '', { system: true, exe: 'minesweeper' }),
    file('mg-2', 'ChaosLab.exe', 'pf-games', '', { system: true, exe: 'chaos' }),
    file('doc-welcome', 'Welcome.txt', 'documents', WELCOME),
    file('doc-todo', 'To-do.txt', 'documents', TODO),
    link('fav-1', 'Desktop', 'favorites', { path: 'desktop' }),
    link('fav-2', 'Downloads', 'favorites', { path: 'downloads' }),
    link('lnk-ie', 'Internet Explorer', 'desktop', { app: 'iexplore' }),
    link('lnk-mine', 'Minesweeper', 'desktop', { app: 'minesweeper' }),
    link('lnk-paint', 'Paint', 'desktop', { app: 'mspaint' }),
    link('lnk-calc', 'Calculator', 'desktop', { app: 'calc' }),
    link('lnk-chaos', 'Chaos Lab', 'desktop', { app: 'chaos' }),
    file('desk-readme', 'Read me.txt', 'desktop', WELCOME),
  ];
  return Object.fromEntries(list.map((n) => [n.id, n]));
}

const saved = load(KEY, null);
export const fsStore = createStore({ nodes: saved?.nodes || defaultFs(), error: null });

const persist = debounce(() => {
  const ok = save(KEY, { nodes: fsStore.get().nodes });
  if (!ok) window.dispatchEvent(new CustomEvent('win7-quota'));
}, 400);
fsStore.subscribe(persist);

const setNodes = (nodes) => fsStore.set((s) => (s.nodes === nodes ? s : { ...s, nodes }));
const nodes = () => fsStore.get().nodes;

export const fs = {
  get nodes() {
    return nodes();
  },
  get: (id) => nodes()[id],
  children: (id) => core.children(nodes(), id),
  path: (id) => core.pathOf(nodes(), id),
  resolve: (p) => core.resolvePath(nodes(), p),
  findChild: (parent, name) => core.findChild(nodes(), parent, name),
  uniqueName: (parent, name) => core.uniqueName(nodes(), parent, name),
  create(opts) {
    const [n, id] = core.createNode(nodes(), opts);
    setNodes(n);
    return id;
  },
  write(id, content) {
    setNodes(core.updateNode(nodes(), id, { content }));
  },
  rename(id, name) {
    const [n, err] = core.renameNode(nodes(), id, name);
    if (!err) setNodes(n);
    return err;
  },
  move(id, parent) {
    const [n, err] = core.moveNode(nodes(), id, parent);
    if (!err) setNodes(n);
    return err;
  },
  copy(id, parent) {
    const [n, newId] = core.copyNode(nodes(), id, parent);
    setNodes(n);
    return newId;
  },
  trash(id) {
    setNodes(core.trashNode(nodes(), id));
  },
  restore(id) {
    setNodes(core.restoreNode(nodes(), id));
  },
  purge(id) {
    setNodes(core.purgeNode(nodes(), id));
  },
  emptyRecycle() {
    setNodes(core.emptyRecycle(nodes()));
  },
  reset(username) {
    setNodes(defaultFs(username));
  },
};

export { core };

// ---------------------------------------------------------------------------
// File types / associations

const TYPES = {
  txt: { label: 'Text Document', icon: 'file-text', app: 'notepad' },
  log: { label: 'Text Document', icon: 'file-text', app: 'notepad' },
  ini: { label: 'Configuration settings', icon: 'file-text', app: 'notepad' },
  md: { label: 'MD File', icon: 'file-text', app: 'notepad' },
  js: { label: 'JScript Script File', icon: 'file-text', app: 'notepad' },
  css: { label: 'Cascading Style Sheet Document', icon: 'file-text', app: 'notepad' },
  json: { label: 'JSON File', icon: 'file-text', app: 'notepad' },
  csv: { label: 'CSV File', icon: 'file-text', app: 'notepad' },
  htm: { label: 'HTML Document', icon: 'file-html', app: 'iexplore' },
  html: { label: 'HTML Document', icon: 'file-html', app: 'iexplore' },
  url: { label: 'Internet Shortcut', icon: 'file-html', app: 'iexplore' },
  png: { label: 'PNG image', icon: 'file-image', app: 'photos' },
  jpg: { label: 'JPEG image', icon: 'file-image', app: 'photos' },
  jpeg: { label: 'JPEG image', icon: 'file-image', app: 'photos' },
  gif: { label: 'GIF image', icon: 'file-image', app: 'photos' },
  bmp: { label: 'Bitmap image', icon: 'file-image', app: 'photos' },
  svg: { label: 'SVG Document', icon: 'file-image', app: 'photos' },
  webp: { label: 'WEBP File', icon: 'file-image', app: 'photos' },
  exe: { label: 'Application', icon: 'file-exe' },
  mp3: { label: 'MP3 Format Sound', icon: 'file-audio' },
  wav: { label: 'Wave Sound', icon: 'file-audio' },
  mp4: { label: 'MP4 Video', icon: 'file-video' },
  zip: { label: 'Compressed (zipped) Folder', icon: 'file-zip' },
};

export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
export const TEXT_EXT = ['txt', 'log', 'ini', 'md', 'js', 'css', 'json', 'csv', 'htm', 'html'];

export const SPECIAL_FOLDER_ICONS = {
  C: 'drive-c',
  D: 'drive-dvd',
  user: 'folder-user',
  desktop: 'folder-desktop',
  documents: 'folder-documents',
  'pub-docs': 'folder-documents',
  downloads: 'folder-downloads',
  favorites: 'folder-favorites',
  music: 'folder-music',
  'pub-music': 'folder-music',
  pictures: 'folder-pictures',
  'pub-pics': 'folder-pictures',
  videos: 'folder-videos',
  'pub-videos': 'folder-videos',
  savedgames: 'folder-games',
  contacts: 'folder-contacts',
  searches: 'folder-search',
  links: 'folder-favorites',
};

export function typeInfo(node, appsRegistry) {
  if (!node) return { label: '', icon: 'file' };
  if (node.type === 'drive') return { label: node.optical ? 'CD Drive' : 'Local Disk', icon: SPECIAL_FOLDER_ICONS[node.id] };
  if (node.type === 'folder') return { label: 'File folder', icon: SPECIAL_FOLDER_ICONS[node.id] || 'folder' };
  if (node.type === 'shortcut') {
    const t = node.target || {};
    if (t.app && appsRegistry?.[t.app]) return { label: 'Shortcut', icon: appsRegistry[t.app].icon };
    if (t.path) return { label: 'Shortcut', icon: SPECIAL_FOLDER_ICONS[t.path] || 'folder' };
    if (t.url) return { label: 'Internet Shortcut', icon: 'file-html' };
    if (t.file) {
      const f = fsStore.get().nodes[t.file];
      return { label: 'Shortcut', icon: f && f.type !== 'shortcut' ? typeInfo(f, appsRegistry).icon : 'file' };
    }
    return { label: 'Shortcut', icon: 'file' };
  }
  if (node.exe && appsRegistry?.[node.exe]) return { label: 'Application', icon: appsRegistry[node.exe].icon, app: node.exe };
  const ext = core.extOf(node.name);
  const t = TYPES[ext];
  if (t) return t;
  return { label: ext ? `${ext.toUpperCase()} File` : 'File', icon: 'file' };
}

export function resolveAsset(content) {
  if (typeof content !== 'string') return '';
  if (content.startsWith('asset:')) return `${import.meta.env.BASE_URL}${content.slice(6)}`;
  return content;
}
