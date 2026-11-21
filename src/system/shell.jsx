import React from 'react';
import { wm, ui, uiStore, getRegistry } from '../state/wm.js';
import { fs, core, typeInfo, IMAGE_EXT, TEXT_EXT, resolveAsset } from '../state/fs.js';
import { addRecentFile, bumpUsage, settingsStore } from '../state/settings.js';
import { messageBox, openDialog } from './dialogs.jsx';
import { Icon } from './icons.jsx';
import { sound } from '../lib/sound.js';

// Virtual (non-filesystem) desktop/shell objects
export const SYS_ITEMS = {
  'sys:computer': { key: 'sys:computer', name: 'Computer', icon: 'computer', open: () => openPath('computer') },
  'sys:user': { key: 'sys:user', get name() { return settingsStore.get().username; }, icon: 'folder-user', open: () => openPath('user') },
  'sys:network': { key: 'sys:network', name: 'Network', icon: 'network', open: () => openPath('network') },
  'sys:recycle': { key: 'sys:recycle', name: 'Recycle Bin', icon: 'recycle-empty', open: () => openPath('recycle') },
  'sys:controlpanel': { key: 'sys:controlpanel', name: 'Control Panel', icon: 'controlpanel', open: () => launch('control') },
};

export function launch(appId, props = {}, opts) {
  const app = getRegistry()[appId];
  if (!app) return null;
  bumpUsage(appId);
  return wm.open(appId, props, opts);
}

export function openPath(path) {
  return launch('explorer', { path });
}

/** Should the extension be hidden in labels? (Explorer's "Hide extensions for known file types") */
export function displayName(node) {
  if (!node) return '';
  if (node.type === 'drive') return `${node.name} (${node.letter}:)`;
  if (node.type === 'shortcut') return node.name;
  if (node.type !== 'file') return node.name;
  const ext = core.extOf(node.name);
  if (ext && (IMAGE_EXT.includes(ext) || TEXT_EXT.includes(ext) || ext === 'exe' || ext === 'url')) return core.baseOf(node.name);
  return node.name;
}

export function appForNode(node) {
  if (!node) return null;
  if (node.exe) return node.exe;
  return typeInfo(node, getRegistry()).app || null;
}

export async function openNode(idOrNode, withApp) {
  const node = typeof idOrNode === 'string' ? fs.get(idOrNode) : idOrNode;
  if (!node) return;
  if (core.isContainer(node)) return openPath(node.id);
  if (node.type === 'shortcut') {
    const t = node.target || {};
    if (t.app) return launch(t.app, t.props || {});
    if (t.file) {
      if (fs.get(t.file)) return openNode(t.file);
      return messageBox({ title: 'Problem with Shortcut', text: `The item '${node.name}' that this shortcut refers to has been changed or moved, so this shortcut will no longer work properly.`, icon: 'warning' });
    }
    if (t.path) {
      if (!fs.get(t.path) && !['computer', 'recycle', 'network', 'libraries'].includes(t.path)) {
        return messageBox({ title: 'Problem with Shortcut', text: `The item '${node.name}' that this shortcut refers to has been changed or moved, so this shortcut will no longer work properly.`, icon: 'warning' });
      }
      return openPath(t.path);
    }
    if (t.url) return launch('iexplore', { url: t.url });
    return;
  }
  const app = withApp || appForNode(node);
  if (node.exe) return launch(node.exe);
  if (!app) {
    return messageBox({
      title: 'Windows',
      text: `Windows can't open this file:\n\nFile: ${node.name}\n\nTo open this file, Windows needs to know what program you want to use to open it.`,
      icon: 'warning',
    });
  }
  addRecentFile(node.id, app);
  if (app === 'iexplore' && core.extOf(node.name) === 'url') {
    const m = /URL=(.*)/i.exec(node.content || '');
    return launch('iexplore', { url: m ? m[1].trim() : 'about:blank' });
  }
  return launch(app, { fileId: node.id });
}

// ---------------------------------------------------------------------------
// Clipboard and file operations shared by the desktop and Explorer

export function setClipboard(op, ids) {
  uiStore.set((s) => ({ ...s, clipboard: ids.length ? { op, ids } : null }));
}

export async function pasteInto(folderId) {
  const clip = uiStore.get().clipboard;
  if (!clip) return [];
  const out = [];
  for (const id of clip.ids) {
    if (!fs.get(id)) continue;
    if (clip.op === 'cut') {
      const err = fs.move(id, folderId);
      if (err) await messageBox({ title: 'Move Item', text: err, icon: 'error' });
      else out.push(id);
    } else out.push(fs.copy(id, folderId));
  }
  if (clip.op === 'cut') setClipboard(null, []);
  return out;
}

export async function deleteItems(ids, { owner, permanent = false } = {}) {
  const list = ids.map((id) => fs.get(id)).filter(Boolean);
  const blocked = list.find((n) => n.system);
  if (blocked) {
    await messageBox({ title: 'Delete File', text: `You can't delete '${blocked.name}'.\nThis is a protected system item.`, icon: 'warning', owner });
    return false;
  }
  if (!list.length) return false;
  const inBin = list.every((n) => n.parent === core.RECYCLE);
  const perm = permanent || inBin;
  const what = list.length === 1 ? `this ${core.isContainer(list[0]) ? 'folder' : list[0].type === 'shortcut' ? 'shortcut' : 'file'}` : `these ${list.length} items`;
  const ans = await messageBox({
    title: list.length === 1 ? (core.isContainer(list[0]) ? 'Delete Folder' : 'Delete File') : 'Delete Multiple Items',
    text: perm ? `Are you sure you want to permanently delete ${what}?` : `Are you sure you want to move ${what} to the Recycle Bin?${list.length === 1 ? `\n\n${list[0].name}` : ''}`,
    icon: 'warning',
    buttons: ['Yes', 'No'],
    owner,
  });
  if (ans !== 'Yes') return false;
  for (const n of list) perm ? fs.purge(n.id) : fs.trash(n.id);
  sound.play('recycle');
  return true;
}

export async function emptyRecycleBin(owner) {
  const items = fs.children(core.RECYCLE);
  if (!items.length) return;
  const ans = await messageBox({
    title: 'Delete Multiple Items',
    text: items.length === 1 ? `Are you sure you want to permanently delete this item?` : `Are you sure you want to permanently delete these ${items.length} items?`,
    icon: 'warning',
    buttons: ['Yes', 'No'],
    owner,
  });
  if (ans === 'Yes') {
    fs.emptyRecycle();
    sound.play('recycle');
  }
}

export function createShortcut(id, parent = 'desktop') {
  const n = fs.get(id);
  if (!n) return;
  const target = core.isContainer(n) ? { path: n.id } : n.exe ? { app: n.exe } : { path: n.id };
  if (!core.isContainer(n) && !n.exe) {
    // Shortcut to a file: open the file itself.
    return fs.create({ parent, name: `${displayName(n)} - Shortcut`, type: 'shortcut', target: { file: n.id } });
  }
  return fs.create({ parent, name: `${displayName(n)} - Shortcut`, type: 'shortcut', target });
}

export function newItem(parent, kind) {
  if (kind === 'folder') return fs.create({ parent, name: 'New folder', type: 'folder' });
  if (kind === 'text') return fs.create({ parent, name: 'New Text Document.txt', content: '' });
  if (kind === 'bitmap') return fs.create({ parent, name: 'New Bitmap Image.png', content: blankPng() });
  return null;
}

function blankPng() {
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// Properties dialog

export function showProperties(id, owner) {
  const sysItem = SYS_ITEMS[id];
  if (id === 'sys:computer') return launch('control', { page: 'system' });
  const node = sysItem ? null : fs.get(id);
  if (!node && id !== 'sys:recycle') return;
  const reg = getRegistry();
  if (id === 'sys:recycle') {
    const items = fs.children(core.RECYCLE);
    return openDialog({
      title: 'Recycle Bin Properties',
      owner,
      render: (done) => (
        <div className="props">
          <div className="props-head">
            <Icon name={items.length ? 'recycle-full' : 'recycle-empty'} size={32} /> <b>Recycle Bin</b>
          </div>
          <hr className="w7-hr" />
          <div className="props-grid">
            <span>Items:</span>
            <span>{items.length}</span>
            <span>Size:</span>
            <span>{core.formatSize(items.reduce((s, n) => s + core.sizeOf(fs.nodes, n.id), 0))}</span>
          </div>
          <div className="props-buttons">
            <button className="w7-btn default" onClick={() => done(true)}>
              OK
            </button>
          </div>
        </div>
      ),
    });
  }
  const info = typeInfo(node, reg);
  const size = core.sizeOf(fs.nodes, node.id);
  const count = core.isContainer(node) ? countDeep(node.id) : null;
  const fmt = (t) => new Date(t).toLocaleString([], { dateStyle: 'full', timeStyle: 'medium' });
  let nameRef = null;
  const apply = () => {
    if (nameRef && nameRef.value !== node.name && !node.system) {
      const err = fs.rename(node.id, nameRef.value);
      if (err) {
        messageBox({ title: 'Rename', text: err, icon: 'error' });
        return false;
      }
    }
    return true;
  };
  return openDialog({
    title: `${displayName(node)} Properties`,
    owner,
    render: (done) => (
      <div className="props">
        <div className="w7-tabs">
          <button className="w7-tab active">General</button>
          {node.type === 'shortcut' && <button className="w7-tab">Shortcut</button>}
          <button className="w7-tab">Security</button>
          <button className="w7-tab">Details</button>
        </div>
        <div className="w7-tabpanel">
          <div className="props-head">
            <Icon name={info.icon} size={32} />
            <input className="w7-input" defaultValue={node.name} ref={(r) => (nameRef = r)} disabled={!!node.system} style={{ flex: 1 }} />
          </div>
          <hr className="w7-hr" />
          <div className="props-grid">
            <span>Type of file:</span>
            <span>{info.label}</span>
            {info.app && (
              <>
                <span>Opens with:</span>
                <span className="props-opens">
                  <Icon name={reg[info.app]?.icon} size={16} /> {reg[info.app]?.name}
                </span>
              </>
            )}
          </div>
          <hr className="w7-hr" />
          <div className="props-grid">
            <span>Location:</span>
            <span className="props-loc">{node.parent === core.RECYCLE ? 'Recycle Bin' : fs.path(node.parent)}</span>
            <span>Size:</span>
            <span>
              {core.formatSize(size)} ({size.toLocaleString()} bytes)
            </span>
            <span>Size on disk:</span>
            <span>
              {core.formatSize(Math.ceil(size / 4096) * 4096)} ({(Math.ceil(size / 4096) * 4096).toLocaleString()} bytes)
            </span>
            {count && (
              <>
                <span>Contains:</span>
                <span>
                  {count.files.toLocaleString()} Files, {count.folders.toLocaleString()} Folders
                </span>
              </>
            )}
          </div>
          <hr className="w7-hr" />
          <div className="props-grid">
            <span>Created:</span>
            <span>{fmt(node.ctime)}</span>
            <span>Modified:</span>
            <span>{fmt(node.mtime)}</span>
          </div>
          <hr className="w7-hr" />
          <div className="props-grid">
            <span>Attributes:</span>
            <span>
              <label className="w7-label">
                <input type="checkbox" className="w7-check" defaultChecked={!!node.system} disabled /> Read-only
              </label>{' '}
              <label className="w7-label" style={{ marginLeft: 12 }}>
                <input type="checkbox" className="w7-check" /> Hidden
              </label>
            </span>
          </div>
        </div>
        <div className="props-buttons">
          <button className="w7-btn default" onClick={() => apply() && done(true)}>
            OK
          </button>
          <button className="w7-btn" onClick={() => done(null)}>
            Cancel
          </button>
          <button className="w7-btn" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    ),
  });
}

function countDeep(id) {
  let files = 0;
  let folders = 0;
  const walk = (pid) => {
    for (const c of fs.children(pid)) {
      if (core.isContainer(c)) {
        folders++;
        walk(c.id);
      } else files++;
    }
  };
  walk(id);
  return { files, folders };
}

// ---------------------------------------------------------------------------
// Importing real files from the host OS (drag & drop)

const MAX_IMPORT = 2.5 * 1024 * 1024;

export async function importFiles(fileList, parent) {
  const created = [];
  for (const f of Array.from(fileList)) {
    const ext = core.extOf(f.name);
    try {
      if (IMAGE_EXT.includes(ext) || f.type.startsWith('image/')) {
        created.push(fs.create({ parent, name: f.name, content: await readImage(f) }));
      } else if (TEXT_EXT.includes(ext) || f.type.startsWith('text/') || f.size < 64 * 1024) {
        if (f.size > MAX_IMPORT) throw new Error('too big');
        created.push(fs.create({ parent, name: f.name, content: await f.text() }));
      } else {
        throw new Error('unsupported');
      }
    } catch {
      await messageBox({ title: 'Copy File', text: `'${f.name}' could not be copied.\nOnly text files and images up to 2.5 MB can be stored in this browser.`, icon: 'warning' });
    }
  }
  return created;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      if (file.size < 600 * 1024) return resolve(url);
      // Downscale large photos so they fit in localStorage.
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = url;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function downloadNode(id) {
  const n = fs.get(id);
  if (!n || n.type !== 'file') return;
  const a = document.createElement('a');
  const content = resolveAsset(n.content || '');
  a.href = content.startsWith('data:') || content.startsWith('/') || content.startsWith('.') || content.includes('/wallpapers/') ? content : URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = n.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export { ui };
