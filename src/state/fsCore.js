// Pure virtual-filesystem helpers. Nodes live in a flat map: { [id]: node }.
// node = { id, name, type: 'drive'|'folder'|'file'|'shortcut', parent, content?, target?,
//          ctime, mtime, system?, origParent?, deletedAt? }

export const RECYCLE = 'recycle';
export const INVALID_CHARS = /[\\/:*?"<>|]/;

const now = () => Date.now();
let counter = 0;
const makeId = () => `f${now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function extOf(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function baseOf(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export const isContainer = (n) => !!n && (n.type === 'folder' || n.type === 'drive');

export function children(nodes, parentId) {
  const list = [];
  for (const id in nodes) if (nodes[id].parent === parentId) list.push(nodes[id]);
  return list.sort(compareNodes);
}

export function compareNodes(a, b) {
  const fa = isContainer(a) ? 0 : 1;
  const fb = isContainer(b) ? 0 : 1;
  if (fa !== fb) return fa - fb;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export function findChild(nodes, parentId, name) {
  const lower = name.toLowerCase();
  for (const id in nodes) {
    const n = nodes[id];
    if (n.parent === parentId && n.name.toLowerCase() === lower) return n;
  }
  return null;
}

/** "New folder", "New folder (2)", ... - the same numbering Explorer uses. */
export function uniqueName(nodes, parentId, desired, ignoreId) {
  const taken = (name) => {
    const c = findChild(nodes, parentId, name);
    return c && c.id !== ignoreId;
  };
  if (!taken(desired)) return desired;
  const ext = extOf(desired);
  const base = ext ? baseOf(desired) : desired;
  for (let i = 2; ; i++) {
    const candidate = ext ? `${base} (${i}).${ext}` : `${base} (${i})`;
    if (!taken(candidate)) return candidate;
  }
}

export function validateName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'You must type a file name.';
  if (INVALID_CHARS.test(trimmed)) return 'A file name can\'t contain any of the following characters:\n\\ / : * ? " < > |';
  if (trimmed.length > 200) return 'The file name is too long.';
  return null;
}

export function createNode(nodes, { parent, name, type = 'file', content = '', target, id }) {
  const nid = id || makeId();
  const t = now();
  const node = { id: nid, name: uniqueName(nodes, parent, name), type, parent, ctime: t, mtime: t };
  if (type === 'file') node.content = content;
  if (type === 'shortcut') node.target = target;
  return [{ ...nodes, [nid]: node }, nid];
}

export function updateNode(nodes, id, patch) {
  if (!nodes[id]) return nodes;
  return { ...nodes, [id]: { ...nodes[id], ...patch, mtime: now() } };
}

export function renameNode(nodes, id, name) {
  const node = nodes[id];
  if (!node) return [nodes, 'The item no longer exists.'];
  const err = validateName(name);
  if (err) return [nodes, err];
  const trimmed = name.trim();
  const clash = findChild(nodes, node.parent, trimmed);
  if (clash && clash.id !== id) return [nodes, `There is already a file with the same name in this location.`];
  return [{ ...nodes, [id]: { ...node, name: trimmed, mtime: now() } }, null];
}

export function isDescendant(nodes, id, ancestorId) {
  let cur = nodes[id];
  let guard = 0;
  while (cur && guard++ < 1000) {
    if (cur.id === ancestorId) return true;
    cur = nodes[cur.parent];
  }
  return false;
}

export function moveNode(nodes, id, newParent) {
  const node = nodes[id];
  if (!node || node.system) return [nodes, 'This item can\'t be moved.'];
  if (node.parent === newParent) return [nodes, null];
  if (isDescendant(nodes, newParent, id)) return [nodes, 'The destination folder is a subfolder of the source folder.'];
  const name = uniqueName(nodes, newParent, node.name, id);
  return [{ ...nodes, [id]: { ...node, parent: newParent, name } }, null];
}

export function copyNode(nodes, id, newParent) {
  const src = nodes[id];
  if (!src) return [nodes, null];
  if (isDescendant(nodes, newParent, id)) return [nodes, null];
  let out = { ...nodes };
  const walk = (srcId, parent, rename) => {
    const s = nodes[srcId];
    const nid = makeId();
    const t = now();
    const copy = { ...s, id: nid, parent, ctime: t, mtime: t, system: undefined };
    copy.name = rename ? uniqueName(out, parent, s.parent === parent ? `${baseOf(s.name)} - Copy${extOf(s.name) ? '.' + extOf(s.name) : ''}` : s.name) : s.name;
    if (isContainer(s)) copy.type = 'folder';
    out[nid] = copy;
    for (const c of children(nodes, srcId)) walk(c.id, nid, false);
    return nid;
  };
  const newId = walk(id, newParent, true);
  return [out, newId];
}

export function trashNode(nodes, id) {
  const node = nodes[id];
  if (!node || node.system) return nodes;
  return { ...nodes, [id]: { ...node, parent: RECYCLE, origParent: node.parent, deletedAt: now() } };
}

export function restoreNode(nodes, id) {
  const node = nodes[id];
  if (!node || node.parent !== RECYCLE) return nodes;
  const dest = nodes[node.origParent] ? node.origParent : 'desktop';
  const restored = { ...node, parent: dest, name: uniqueName(nodes, dest, node.name, id) };
  delete restored.origParent;
  delete restored.deletedAt;
  return { ...nodes, [id]: restored };
}

export function purgeNode(nodes, id) {
  if (!nodes[id] || nodes[id].system) return nodes;
  const out = { ...nodes };
  const walk = (nid) => {
    for (const c of children(out, nid)) walk(c.id);
    delete out[nid];
  };
  walk(id);
  return out;
}

export function emptyRecycle(nodes) {
  let out = nodes;
  for (const c of children(nodes, RECYCLE)) out = purgeNode(out, c.id);
  return out;
}

export function pathOf(nodes, id) {
  const parts = [];
  let cur = nodes[id];
  let guard = 0;
  while (cur && guard++ < 1000) {
    parts.unshift(cur.type === 'drive' ? cur.letter + ':' : cur.name);
    cur = nodes[cur.parent];
  }
  if (parts.length === 1) return parts[0] + '\\';
  return parts.join('\\');
}

/** Resolve "C:\Users\User" (case-insensitive) to a node id, or null. */
export function resolvePath(nodes, path) {
  if (!path) return null;
  const clean = path.trim().replace(/\//g, '\\').replace(/\\+$/, '');
  const parts = clean.split('\\').filter(Boolean);
  if (!parts.length) return null;
  const drive = Object.values(nodes).find((n) => n.type === 'drive' && (n.letter + ':').toLowerCase() === parts[0].toLowerCase());
  if (!drive) return null;
  let cur = drive.id;
  for (const p of parts.slice(1)) {
    if (p === '.') continue;
    if (p === '..') {
      cur = nodes[cur].parent || cur;
      continue;
    }
    const c = findChild(nodes, cur, p);
    if (!c) return null;
    cur = c.id;
  }
  return cur;
}

export function sizeOf(nodes, id) {
  const n = nodes[id];
  if (!n) return 0;
  if (n.type === 'file') return typeof n.content === 'string' ? contentBytes(n.content) : 0;
  if (n.type === 'shortcut') return 1024;
  return children(nodes, id).reduce((s, c) => s + sizeOf(nodes, c.id), 0);
}

function contentBytes(content) {
  if (content.startsWith('data:')) {
    const comma = content.indexOf(',');
    return Math.round(((content.length - comma - 1) * 3) / 4);
  }
  if (content.startsWith('asset:')) return 845000 + (content.length * 7919) % 300000;
  return new Blob([content]).size;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
