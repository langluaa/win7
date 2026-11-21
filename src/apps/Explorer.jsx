import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useStore } from '../lib/store.js';
import { fsStore, fs, core, typeInfo, resolveAsset, IMAGE_EXT } from '../state/fs.js';
import { settingsStore, setNested } from '../state/settings.js';
import { wm, ui, uiStore, getRegistry } from '../state/wm.js';
import { Icon, ShortcutArrow } from '../system/icons.jsx';
import { trackDrag, useTap } from '../lib/pointer.js';
import { displayName, openNode, launch, setClipboard, pasteInto, deleteItems, newItem, showProperties, createShortcut, emptyRecycleBin, importFiles, downloadNode } from '../system/shell.jsx';
import { messageBox } from '../system/dialogs.jsx';

// ---------------------------------------------------------------------------
// Locations

const LIBS = {
  'lib:documents': { name: 'Documents', folder: 'documents', icon: 'folder-documents', extra: 'pub-docs' },
  'lib:music': { name: 'Music', folder: 'music', icon: 'folder-music', extra: 'pub-music' },
  'lib:pictures': { name: 'Pictures', folder: 'pictures', icon: 'folder-pictures', extra: 'pub-pics' },
  'lib:videos': { name: 'Videos', folder: 'videos', icon: 'folder-videos', extra: 'pub-videos' },
};

const SPECIAL = {
  computer: { name: 'Computer', icon: 'computer' },
  recycle: { name: 'Recycle Bin', icon: 'recycle-empty' },
  network: { name: 'Network', icon: 'network' },
  libraries: { name: 'Libraries', icon: 'library' },
  recent: { name: 'Recent Places', icon: 'recent-places' },
};

// Folder ids that are shown through a library when opened from the start menu etc.
const FOLDER_TO_LIB = { documents: 'lib:documents', music: 'lib:music', pictures: 'lib:pictures', videos: 'lib:videos' };

function normalize(path) {
  if (!path) return 'lib:documents';
  if (FOLDER_TO_LIB[path]) return FOLDER_TO_LIB[path];
  return path;
}

function locInfo(loc, nodes) {
  if (SPECIAL[loc]) return { ...SPECIAL[loc], special: true };
  if (LIBS[loc]) return { ...LIBS[loc], library: true };
  const n = nodes[loc];
  if (!n) return null;
  return { name: displayName(n), icon: typeInfo(n, getRegistry()).icon, node: n };
}

function crumbsFor(loc, nodes) {
  if (loc === 'computer') return [{ id: 'computer', label: 'Computer' }];
  if (loc === 'recycle') return [{ id: 'recycle', label: 'Recycle Bin' }];
  if (loc === 'network') return [{ id: 'network', label: 'Network' }];
  if (loc === 'recent') return [{ id: 'recent', label: 'Recent Places' }];
  if (loc === 'libraries') return [{ id: 'libraries', label: 'Libraries' }];
  if (LIBS[loc]) return [{ id: 'libraries', label: 'Libraries' }, { id: loc, label: LIBS[loc].name }];
  const out = [];
  for (let cur = nodes[loc]; cur; cur = nodes[cur.parent]) out.unshift({ id: cur.id, label: displayName(cur) });
  if (nodes[loc]?.parent === core.RECYCLE || loc === core.RECYCLE) return [{ id: 'recycle', label: 'Recycle Bin' }];
  return [{ id: 'computer', label: 'Computer' }, ...out];
}

function virtualItem(id, name, icon, extra = {}) {
  return { id, name, virtual: true, icon, type: 'folder', mtime: 1256601600000, ...extra };
}

function itemsFor(loc, nodes, settings) {
  if (loc === 'computer') return Object.values(nodes).filter((n) => n.type === 'drive');
  if (loc === 'recycle') return core.children(nodes, core.RECYCLE);
  if (loc === 'libraries') return Object.entries(LIBS).map(([id, l]) => virtualItem(id, l.name, l.icon, { label: 'Library' }));
  if (loc === 'network') return [virtualItem('net:pc', 'USER-PC', 'computer', { label: 'Computer' })];
  if (loc === 'recent') return settings.recentFiles.map((r) => nodes[r.id]).filter((n) => n && n.parent !== core.RECYCLE);
  if (LIBS[loc]) return [...core.children(nodes, LIBS[loc].folder), ...core.children(nodes, LIBS[loc].extra)];
  return core.children(nodes, loc);
}

function itemIcon(item, reg, recycleFull) {
  if (item.virtual) return item.icon;
  if (item.type === 'file' && IMAGE_EXT.includes(core.extOf(item.name))) return 'file-image';
  return typeInfo(item, reg).icon;
}

const VIEWS = [
  { id: 'xlarge', label: 'Extra large icons', size: 160 },
  { id: 'large', label: 'Large icons', size: 96 },
  { id: 'medium', label: 'Medium icons', size: 48 },
  { id: 'small', label: 'Small icons', size: 16 },
  { id: 'list', label: 'List', size: 16 },
  { id: 'details', label: 'Details', size: 16 },
  { id: 'tiles', label: 'Tiles', size: 48 },
  { id: 'content', label: 'Content', size: 32 },
];

const fmtDate = (t) => (t ? new Date(t).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

// ---------------------------------------------------------------------------
// Pieces

function NavButtons({ canBack, canFwd, onBack, onFwd, history, onJump }) {
  return (
    <div className="ex-navbtns">
      <button className="ex-round back" disabled={!canBack} onClick={onBack} aria-label="Back" title="Back">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M12 7H3M7 2.5L2.5 7 7 11.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button className="ex-round fwd" disabled={!canFwd} onClick={onFwd} aria-label="Forward" title="Forward">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M2 7h9M7 2.5L11.5 7 7 11.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        className="ex-recent-arrow"
        aria-label="Recent pages"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          ui.menuAt(r.left, r.bottom, history.length ? history : [{ label: '(Empty)', disabled: true }]);
        }}
      >
        <span />
      </button>
    </div>
  );
}

function AddressBar({ loc, nodes, onNavigate, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const crumbs = crumbsFor(loc, nodes);
  const info = locInfo(loc, nodes);
  const realPath = nodes[loc] ? fs.path(loc) : crumbs.map((c) => c.label).join('\\');

  useEffect(() => {
    if (editing) {
      setText(realPath);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, realPath]);

  const subMenu = (id, el) => {
    let kids = [];
    if (id === 'computer') kids = Object.values(nodes).filter((n) => n.type === 'drive');
    else if (id === 'libraries') kids = Object.entries(LIBS).map(([lid, l]) => ({ id: lid, name: l.name, virtualIcon: l.icon }));
    else if (LIBS[id]) kids = core.children(nodes, LIBS[id].folder).filter(core.isContainer);
    else kids = core.children(nodes, id).filter(core.isContainer);
    const r = el.getBoundingClientRect();
    ui.menuAt(
      r.left,
      r.bottom,
      kids.length
        ? kids.map((k) => ({ label: k.virtualIcon ? k.name : displayName(k), icon: k.virtualIcon || typeInfo(k, getRegistry()).icon, onClick: () => onNavigate(k.id), bold: k.id === loc }))
        : [{ label: '(Empty)', disabled: true }]
    );
  };

  const submit = () => {
    setEditing(false);
    const t = text.trim();
    if (!t || t === realPath) return;
    const lower = t.toLowerCase();
    const named = { computer: 'computer', 'recycle bin': 'recycle', network: 'network', libraries: 'libraries', documents: 'lib:documents', pictures: 'lib:pictures', music: 'lib:music', videos: 'lib:videos', desktop: 'desktop' };
    if (named[lower]) return onNavigate(named[lower]);
    if (lower === 'control panel') return launch('control');
    if (/^(https?:\/\/|www\.)/i.test(t)) return launch('iexplore', { url: t });
    const id = fs.resolve(t);
    if (id) {
      if (core.isContainer(fs.get(id))) return onNavigate(id);
      return openNode(id);
    }
    messageBox({ title: 'Windows Explorer', text: `Windows can't find '${t}'. Check the spelling and try again.`, icon: 'error' });
  };

  return (
    <div className={`ex-address ${editing ? 'editing' : ''}`}>
      <span className="ex-addr-icon">
        <Icon name={info?.icon || 'folder'} size={16} />
      </span>
      {editing ? (
        <input
          ref={inputRef}
          className="ex-addr-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="Address"
        />
      ) : (
        <div className="ex-crumbs" onClick={(e) => e.target === e.currentTarget && setEditing(true)}>
          <button className="ex-crumb-arrow first" onClick={(e) => subMenu('computer', e.currentTarget)} aria-label="Locations">
            <span />
          </button>
          {crumbs.map((c) => (
            <span key={c.id} className="ex-crumb-group">
              <button className="ex-crumb" onClick={() => onNavigate(c.id)}>
                {c.label}
              </button>
              <button className="ex-crumb-arrow" onClick={(e) => subMenu(c.id, e.currentTarget)} aria-label={`Folders in ${c.label}`}>
                <span />
              </button>
            </span>
          ))}
          <span className="ex-crumb-fill" onClick={() => setEditing(true)} />
        </div>
      )}
      <button className="ex-addr-refresh" aria-label="Refresh" title={`Refresh "${info?.name || ''}" (F5)`} onClick={onRefresh}>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M11.5 7A4.5 4.5 0 1 1 9.8 3.5" stroke="#3a6f2a" strokeWidth="1.8" fill="none" />
          <path d="M8 1.5h4v4z" fill="#3a6f2a" />
        </svg>
      </button>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="ex-search">
      <input className="ex-search-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} onKeyDown={(e) => e.key === 'Escape' && onChange('')} />
      {value ? (
        <button className="ex-search-clear" onClick={() => onChange('')} aria-label="Clear search">
          ✕
        </button>
      ) : (
        <svg className="ex-search-ico" width="14" height="14" viewBox="0 0 14 14">
          <circle cx="5.5" cy="5.5" r="4" fill="none" stroke="#5a7390" strokeWidth="1.5" />
          <path d="M8.5 8.5l4 4" stroke="#5a7390" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

function TreeItem({ id, label, icon, depth, loc, onNavigate, nodes, expandable = true, initiallyOpen = false, header = false }) {
  const [open, setOpen] = useState(initiallyOpen);
  const kids = useMemo(() => {
    if (!open) return [];
    if (id === 'computer') return Object.values(nodes).filter((n) => n.type === 'drive');
    if (id === 'libraries') return Object.entries(LIBS).map(([lid, l]) => ({ id: lid, name: l.name, icon: l.icon, virtual: true }));
    if (id === 'favorites') return [];
    if (LIBS[id]) return core.children(nodes, LIBS[id].folder).filter(core.isContainer);
    return core.children(nodes, id).filter(core.isContainer);
  }, [open, id, nodes]);
  const hasKids = expandable && (id === 'computer' || id === 'libraries' || LIBS[id] || core.children(nodes, id).some(core.isContainer));
  return (
    <>
      <div
        className={`ex-tree-item ${loc === id ? 'sel' : ''} ${header ? 'header' : ''}`}
        style={{ paddingLeft: 4 + depth * 14 }}
        data-drop={nodes[id] && core.isContainer(nodes[id]) ? id : LIBS[id] ? LIBS[id].folder : undefined}
        onClick={() => onNavigate(id)}
        onDoubleClick={() => setOpen(!open)}
      >
        <span
          className={`ex-expander ${hasKids ? '' : 'none'} ${open ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        />
        <Icon name={icon} size={16} />
        <span className="ex-tree-label">{label}</span>
      </div>
      {open &&
        kids.map((k) => (
          <TreeItem key={k.id} id={k.id} label={k.virtual ? k.name : displayName(k)} icon={k.virtual ? k.icon : typeInfo(k, getRegistry()).icon} depth={depth + 1} loc={loc} onNavigate={onNavigate} nodes={nodes} />
        ))}
    </>
  );
}

function NavPane({ loc, onNavigate, nodes }) {
  return (
    <div className="ex-nav w7-scroll">
      <div className="ex-tree-group">
        <div className={`ex-tree-item header ${loc === 'favorites' ? 'sel' : ''}`} style={{ paddingLeft: 4 }}>
          <span className="ex-expander open" />
          <Icon name="star" size={16} />
          <span className="ex-tree-label">Favorites</span>
        </div>
        <TreeItem id="desktop" label="Desktop" icon="folder-desktop" depth={1} loc={loc} onNavigate={onNavigate} nodes={nodes} expandable={false} />
        <TreeItem id="downloads" label="Downloads" icon="folder-downloads" depth={1} loc={loc} onNavigate={onNavigate} nodes={nodes} expandable={false} />
        <TreeItem id="recent" label="Recent Places" icon="recent-places" depth={1} loc={loc} onNavigate={onNavigate} nodes={nodes} expandable={false} />
      </div>
      <div className="ex-tree-group">
        <TreeItem id="libraries" label="Libraries" icon="library" depth={0} loc={loc} onNavigate={onNavigate} nodes={nodes} initiallyOpen header />
      </div>
      <div className="ex-tree-group">
        <TreeItem id="computer" label="Computer" icon="computer" depth={0} loc={loc} onNavigate={onNavigate} nodes={nodes} initiallyOpen header />
      </div>
      <div className="ex-tree-group">
        <TreeItem id="network" label="Network" icon="network" depth={0} loc={loc} onNavigate={onNavigate} nodes={nodes} expandable={false} header />
      </div>
    </div>
  );
}

function DriveTile({ node }) {
  if (node.optical) return <div className="ex-drive-sub">DVD RW Drive</div>;
  let used = node.used;
  try {
    used += JSON.stringify(fs.nodes).length;
  } catch {
    /* ignore */
  }
  const pct = used / node.capacity;
  const free = node.capacity - used;
  return (
    <>
      <div className="w7-progress ex-drive-bar">
        <div className={pct > 0.9 ? 'red' : 'blue'} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="ex-drive-sub">
        {core.formatSize(free)} free of {core.formatSize(node.capacity)}
      </div>
    </>
  );
}

function Thumb({ item, size }) {
  if (item.type === 'file' && size >= 48 && IMAGE_EXT.includes(core.extOf(item.name)) && item.content) {
    return (
      <div className="ex-thumb" style={{ width: size, height: size }}>
        <img src={resolveAsset(item.content)} alt="" draggable={false} />
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------

export default function Explorer({ win, active }) {
  const nodes = useStore(fsStore, (s) => s.nodes);
  const settings = useStore(settingsStore);
  const clipboard = useStore(uiStore, (s) => s.clipboard);
  const reg = getRegistry();
  const [loc, setLoc] = useState(() => normalize(win.props.path));
  const [hist, setHist] = useState({ back: [], fwd: [] });
  const [query, setQuery] = useState(win.props.search || '');
  const [sel, setSel] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const [band, setBand] = useState(null);
  const [dragInfo, setDragInfo] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const view = settings.explorer.view;
  const contentRef = useRef(null);
  const rootRef = useRef(null);
  const pendingRename = useRef(null);

  // Navigation requests from outside (e.g. opening "Computer" while this window is single).
  useEffect(() => {
    if (win.props._t) navigate(normalize(win.props.path));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props._t]);

  // If the folder we're in disappears, go up.
  useEffect(() => {
    if (!SPECIAL[loc] && !LIBS[loc] && !nodes[loc]) setLoc('computer');
  }, [nodes, loc]);

  const info = locInfo(loc, nodes) || SPECIAL.computer;

  useEffect(() => {
    wm.setTitle(win.id, query ? `Search Results in ${info.name}` : info.name);
  }, [info.name, query, win.id]);

  const navigate = useCallback(
    (to) => {
      if (to === 'net:pc') to = 'computer';
      if (to === 'favorites') to = 'desktop';
      if (to === loc) return;
      setHist((h) => ({ back: [...h.back, loc].slice(-30), fwd: [] }));
      setLoc(to);
      setQuery('');
      setSel(new Set());
      setRenaming(null);
    },
    [loc]
  );

  const goBack = () => {
    if (!hist.back.length) return;
    const prev = hist.back[hist.back.length - 1];
    setHist({ back: hist.back.slice(0, -1), fwd: [loc, ...hist.fwd] });
    setLoc(prev);
    setSel(new Set());
  };
  const goFwd = () => {
    if (!hist.fwd.length) return;
    const next = hist.fwd[0];
    setHist({ back: [...hist.back, loc], fwd: hist.fwd.slice(1) });
    setLoc(next);
    setSel(new Set());
  };
  const goUp = () => {
    const n = nodes[loc];
    if (LIBS[loc]) return navigate('libraries');
    if (n?.parent && nodes[n.parent]) return navigate(n.parent);
    if (n?.type === 'drive') return navigate('computer');
  };

  // Items (with search)
  const items = useMemo(() => {
    let list;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const roots = LIBS[loc] ? [LIBS[loc].folder, LIBS[loc].extra] : SPECIAL[loc] ? (loc === 'computer' ? ['C'] : [loc === 'recycle' ? core.RECYCLE : 'user']) : [loc];
      list = [];
      const walk = (pid, depth) => {
        if (depth > 12) return;
        for (const c of core.children(nodes, pid)) {
          if (c.name.toLowerCase().includes(q)) list.push(c);
          if (core.isContainer(c)) walk(c.id, depth + 1);
        }
      };
      roots.forEach((r) => walk(r, 0));
    } else list = itemsFor(loc, nodes, settings);
    const dir = sort.dir;
    const key = sort.key;
    const val = (n) => {
      if (key === 'name') return n.name.toLowerCase();
      if (key === 'date') return n.mtime || 0;
      if (key === 'type') return n.virtual ? n.label || '' : typeInfo(n, reg).label;
      if (key === 'size') return n.virtual ? 0 : core.sizeOf(nodes, n.id);
      if (key === 'deleted') return n.deletedAt || 0;
      if (key === 'origin') return n.origParent ? fs.path(n.origParent) : '';
      return n.name;
    };
    if (loc === 'computer' || loc === 'libraries' || loc === 'recent') return list;
    return [...list].sort((a, b) => {
      const fa = core.isContainer(a) || a.virtual ? 0 : 1;
      const fb = core.isContainer(b) || b.virtual ? 0 : 1;
      if (fa !== fb && key !== 'date') return fa - fb;
      const va = val(a);
      const vb = val(b);
      if (typeof va === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc, nodes, query, sort, settings.recentFiles, refreshKey]);

  useEffect(() => {
    if (pendingRename.current && items.some((i) => i.id === pendingRename.current)) {
      setSel(new Set([pendingRename.current]));
      setRenaming(pendingRename.current);
      pendingRename.current = null;
    }
  }, [items]);

  const writableFolder = LIBS[loc] ? LIBS[loc].folder : nodes[loc] && core.isContainer(nodes[loc]) && !nodes[loc].optical ? loc : null;
  const selItems = items.filter((i) => sel.has(i.id));
  const selIds = selItems.filter((i) => !i.virtual).map((i) => i.id);
  const inRecycle = loc === 'recycle';

  const open = (item) => {
    if (item.virtual) return navigate(item.id);
    if (core.isContainer(item)) return navigate(item.id);
    if (item.type === 'shortcut' && item.target?.path && (nodes[item.target.path] || SPECIAL[item.target.path])) return navigate(normalize(item.target.path));
    if (inRecycle) return showProperties(item.id, win.id);
    openNode(item);
  };

  const create = (kind) => {
    if (!writableFolder) return;
    const id = newItem(writableFolder, kind);
    pendingRename.current = id;
  };

  const doRename = (item, value) => {
    setRenaming(null);
    if (value == null) return;
    let name = value.trim();
    const shown = displayName(item);
    if (!name || name === shown) return;
    if (item.type === 'file' && shown !== item.name) name += item.name.slice(item.name.lastIndexOf('.'));
    const err = fs.rename(item.id, name);
    if (err) messageBox({ title: 'Rename', text: err, icon: 'error', owner: win.id });
  };

  // ------------------------------------------------------------- selection & drag
  const onItemDown = (item, e) => {
    rootRef.current?.focus({ preventScroll: true });
    if (e.button === 2) {
      if (!sel.has(item.id)) setSel(new Set([item.id]));
      return;
    }
    e.stopPropagation();
    if (e.shiftKey && anchor) {
      const a = items.findIndex((i) => i.id === anchor);
      const b = items.findIndex((i) => i.id === item.id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setSel(new Set(items.slice(lo, hi + 1).map((i) => i.id)));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(sel);
      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
      setSel(next);
      setAnchor(item.id);
      return;
    }
    let current = sel;
    if (!sel.has(item.id)) {
      current = new Set([item.id]);
      setSel(current);
    }
    setAnchor(item.id);
    if (renaming || item.virtual || e.pointerType === 'touch') return;
    const dragIds = items.filter((i) => current.has(i.id) && !i.virtual).map((i) => i.id);
    trackDrag(e, {
      threshold: 6,
      onMove: ({ x, y }) => {
        const el = document.elementsFromPoint(x, y).find((d) => d.dataset?.drop);
        const target = el?.dataset.drop;
        setDragInfo({ x, y, count: dragIds.length, target: target && !dragIds.includes(target) ? target : null });
      },
      onEnd: async ({ moved, x, y }) => {
        setDragInfo(null);
        if (!moved) return;
        const el = document.elementsFromPoint(x, y).find((d) => d.dataset?.drop);
        const target = el?.dataset.drop;
        if (!target || dragIds.includes(target)) return;
        if (target === core.RECYCLE) return deleteItems(dragIds, { owner: win.id });
        for (const id of dragIds) {
          const err = fs.move(id, target);
          if (err) await messageBox({ title: 'Move Item', text: err, icon: 'error', owner: win.id });
        }
      },
    });
  };

  const onBgDown = (e) => {
    if (e.target !== e.currentTarget && !e.target.classList.contains('ex-items')) return;
    rootRef.current?.focus({ preventScroll: true });
    if (e.button !== 0) return;
    setRenaming(null);
    const base = e.ctrlKey ? new Set(sel) : new Set();
    setSel(base);
    const box = contentRef.current;
    const br = box.getBoundingClientRect();
    const sx = e.clientX - br.left + box.scrollLeft;
    const sy = e.clientY - br.top + box.scrollTop;
    trackDrag(e, {
      threshold: e.pointerType === 'touch' ? 14 : 3,
      onMove: ({ x, y }) => {
        const cx = x - br.left + box.scrollLeft;
        const cy = y - br.top + box.scrollTop;
        const r = { x: Math.min(sx, cx), y: Math.min(sy, cy), w: Math.abs(cx - sx), h: Math.abs(cy - sy) };
        setBand(r);
        const next = new Set(base);
        box.querySelectorAll('[data-item]').forEach((el) => {
          const ir = el.getBoundingClientRect();
          const ix = ir.left - br.left + box.scrollLeft;
          const iy = ir.top - br.top + box.scrollTop;
          if (ix < r.x + r.w && ix + ir.width > r.x && iy < r.y + r.h && iy + ir.height > r.y) next.add(el.dataset.item);
        });
        setSel(next);
      },
      onEnd: () => setBand(null),
    });
  };

  // ------------------------------------------------------------- menus
  const viewMenu = () =>
    VIEWS.map((v) => ({ label: v.label, radio: true, checked: view === v.id, onClick: () => setNested('explorer', { view: v.id }) }));

  const sortMenu = () =>
    [
      ['name', 'Name'],
      ['date', 'Date modified'],
      ['type', 'Type'],
      ['size', 'Size'],
    ]
      .map(([k, l]) => ({ label: l, radio: true, checked: sort.key === k, onClick: () => setSort({ key: k, dir: sort.dir }) }))
      .concat([{ separator: true }, { label: 'Ascending', radio: true, checked: sort.dir === 1, onClick: () => setSort({ ...sort, dir: 1 }) }, { label: 'Descending', radio: true, checked: sort.dir === -1, onClick: () => setSort({ ...sort, dir: -1 }) }]);

  const bgMenu = (e) => {
    if (e.target !== e.currentTarget && !e.target.classList?.contains('ex-items')) return;
    setSel(new Set());
    const items = [
      { label: 'View', submenu: viewMenu() },
      { label: 'Sort by', submenu: sortMenu() },
      { label: 'Refresh', onClick: () => setRefreshKey((k) => k + 1) },
    ];
    if (inRecycle) {
      items.push({ separator: true }, { label: 'Empty Recycle Bin', disabled: !itemsFor('recycle', nodes, settings).length, onClick: () => emptyRecycleBin(win.id) });
    }
    if (writableFolder) {
      items.push(
        { separator: true },
        { label: 'Paste', disabled: !clipboard, onClick: () => pasteInto(writableFolder) },
        { label: 'Paste shortcut', disabled: !clipboard, onClick: () => clipboard.ids.forEach((id) => createShortcut(id, writableFolder)) },
        { separator: true },
        {
          label: 'New',
          submenu: [
            { label: 'Folder', icon: 'folder', onClick: () => create('folder') },
            { separator: true },
            { label: 'Bitmap image', icon: 'file-image', onClick: () => create('bitmap') },
            { label: 'Text Document', icon: 'file-text', onClick: () => create('text') },
          ],
        }
      );
    }
    items.push({ separator: true }, { label: 'Properties', disabled: !nodes[loc], onClick: () => showProperties(loc, win.id) });
    ui.menu(e, items);
  };

  const itemMenu = (item) => (e) => {
    const current = sel.has(item.id) ? sel : new Set([item.id]);
    if (!sel.has(item.id)) setSel(current);
    const ids = items.filter((i) => current.has(i.id) && !i.virtual).map((i) => i.id);
    const multi = current.size > 1;
    if (item.virtual) return ui.menu(e, [{ label: 'Open', bold: true, onClick: () => open(item) }]);
    if (item.type === 'drive') {
      return ui.menu(e, [
        { label: 'Open', bold: true, onClick: () => open(item) },
        { label: 'Open in new window', onClick: () => launch('explorer', { path: item.id }) },
        { separator: true },
        { label: 'Format...', disabled: true },
        { label: 'Eject', disabled: !item.optical },
        { separator: true },
        { label: 'Properties', onClick: () => showProperties(item.id, win.id) },
      ]);
    }
    if (inRecycle) {
      return ui.menu(e, [
        { label: 'Restore', bold: true, onClick: () => ids.forEach((id) => fs.restore(id)) },
        { separator: true },
        { label: 'Cut', onClick: () => setClipboard('cut', ids) },
        { separator: true },
        { label: 'Delete', onClick: () => deleteItems(ids, { owner: win.id, permanent: true }) },
        { separator: true },
        { label: 'Properties', onClick: () => showProperties(item.id, win.id) },
      ]);
    }
    const isFile = item.type === 'file';
    const isImage = isFile && IMAGE_EXT.includes(core.extOf(item.name));
    ui.menu(e, [
      { label: 'Open', bold: true, onClick: () => current.forEach((id) => open(items.find((i) => i.id === id))) },
      ...(core.isContainer(item) ? [{ label: 'Open in new window', onClick: () => launch('explorer', { path: item.id }) }] : []),
      ...(isImage ? [{ label: 'Edit', onClick: () => openNode(item.id, 'mspaint') }] : []),
      ...(isFile
        ? [
            {
              label: 'Open with',
              submenu: ['notepad', 'mspaint', 'photos', 'iexplore'].map((a) => ({ label: reg[a].name, icon: reg[a].icon, onClick: () => openNode(item.id, a) })),
            },
            { label: 'Download to this device', onClick: () => downloadNode(item.id) },
          ]
        : []),
      { separator: true },
      {
        label: 'Send to',
        submenu: [
          { label: 'Desktop (create shortcut)', icon: 'folder-desktop', onClick: () => ids.forEach((id) => createShortcut(id)) },
          { label: 'Documents', icon: 'folder-documents', onClick: () => ids.forEach((id) => fs.copy(id, 'documents')) },
        ],
      },
      { separator: true },
      { label: 'Cut', onClick: () => setClipboard('cut', ids) },
      { label: 'Copy', onClick: () => setClipboard('copy', ids) },
      ...(core.isContainer(item) ? [{ label: 'Paste', disabled: !clipboard, onClick: () => pasteInto(item.id) }] : []),
      { separator: true },
      { label: 'Create shortcut', disabled: multi || !writableFolder, onClick: () => createShortcut(item.id, writableFolder) },
      { label: 'Delete', disabled: item.system, onClick: () => deleteItems(ids, { owner: win.id }) },
      { label: 'Rename', disabled: multi || item.system, onClick: () => setRenaming(item.id) },
      { separator: true },
      { label: 'Properties', onClick: () => showProperties(item.id, win.id) },
    ]);
  };

  const organizeMenu = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    ui.menuAt(r.left, r.bottom, [
      { label: 'Cut', disabled: !selIds.length, onClick: () => setClipboard('cut', selIds) },
      { label: 'Copy', disabled: !selIds.length, onClick: () => setClipboard('copy', selIds) },
      { label: 'Paste', disabled: !clipboard || !writableFolder, onClick: () => pasteInto(writableFolder) },
      { label: 'Undo', disabled: true },
      { label: 'Redo', disabled: true },
      { separator: true },
      { label: 'Select all', onClick: () => setSel(new Set(items.map((i) => i.id))) },
      { separator: true },
      {
        label: 'Layout',
        submenu: [
          { label: 'Details pane', checked: settings.explorer.detailsPane, onClick: () => setNested('explorer', { detailsPane: !settings.explorer.detailsPane }) },
          { label: 'Navigation pane', checked: settings.explorer.navPane, onClick: () => setNested('explorer', { navPane: !settings.explorer.navPane }) },
        ],
      },
      { label: 'Folder and search options', onClick: () => launch('control', { page: 'appearance' }) },
      { separator: true },
      { label: 'Delete', disabled: !selIds.length, onClick: () => deleteItems(selIds, { owner: win.id, permanent: inRecycle }) },
      { label: 'Rename', disabled: selIds.length !== 1, onClick: () => setRenaming(selIds[0]) },
      { label: 'Remove properties', disabled: true },
      { label: 'Properties', disabled: !selIds.length && !nodes[loc], onClick: () => showProperties(selIds[0] || loc, win.id) },
      { separator: true },
      { label: 'Close', onClick: () => wm.close(win.id) },
    ]);
  };

  // ------------------------------------------------------------- keyboard
  const onKeyDown = (e) => {
    if (renaming || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key;
    if (k === 'Delete') deleteItems(selIds, { owner: win.id, permanent: e.shiftKey || inRecycle });
    else if (k === 'F2' && selIds.length === 1) setRenaming(selIds[0]);
    else if (k === 'Enter') selItems.forEach(open);
    else if (k === 'Backspace' || (e.altKey && k === 'ArrowLeft')) goBack();
    else if (e.altKey && k === 'ArrowRight') goFwd();
    else if (e.altKey && k === 'ArrowUp') goUp();
    else if (k === 'F5') setRefreshKey((x) => x + 1);
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a') {
      e.preventDefault();
      setSel(new Set(items.map((i) => i.id)));
    } else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') setClipboard('copy', selIds);
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'x') setClipboard('cut', selIds);
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'v' && writableFolder) pasteInto(writableFolder);
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && k.toLowerCase() === 'n') {
      e.preventDefault();
      create('folder');
    } else if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      const idx = items.findIndex((i) => i.id === (anchor || [...sel][0]));
      const step = view === 'details' || view === 'list' || view === 'content' ? 1 : k === 'ArrowLeft' || k === 'ArrowRight' ? 1 : Math.max(1, Math.floor((contentRef.current?.clientWidth || 400) / (view === 'large' ? 110 : view === 'medium' ? 84 : view === 'tiles' ? 250 : 180)));
      const dir = k === 'ArrowDown' || k === 'ArrowRight' ? 1 : -1;
      const next = items[Math.max(0, Math.min(items.length - 1, idx < 0 ? 0 : idx + dir * step))];
      if (next) {
        setSel(new Set([next.id]));
        setAnchor(next.id);
        contentRef.current?.querySelector(`[data-item="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  // ------------------------------------------------------------- render
  const v = VIEWS.find((x) => x.id === view) || VIEWS[5];
  const isLibrary = !!LIBS[loc];
  const recycleItems = itemsFor('recycle', nodes, settings);

  const commandButtons = () => {
    if (inRecycle)
      return (
        <>
          <button className="tb-flat" disabled={!recycleItems.length} onClick={() => emptyRecycleBin(win.id)}>
            Empty the Recycle Bin
          </button>
          <button className="tb-flat" disabled={!recycleItems.length} onClick={() => (selIds.length ? selIds : recycleItems.map((n) => n.id)).forEach((id) => fs.restore(id))}>
            {selIds.length ? (selIds.length === 1 ? 'Restore this item' : 'Restore the selected items') : 'Restore all items'}
          </button>
        </>
      );
    if (loc === 'computer')
      return (
        <>
          <button className="tb-flat" onClick={() => launch('control', { page: 'system' })}>
            System properties
          </button>
          <button className="tb-flat" onClick={() => launch('control', { page: 'programs' })}>
            Uninstall or change a program
          </button>
          <button className="tb-flat" onClick={() => launch('control')}>
            Open Control Panel
          </button>
        </>
      );
    if (selItems.length === 1 && selItems[0].type === 'file')
      return (
        <>
          <button className="tb-flat" onClick={() => open(selItems[0])}>
            <Icon name={reg[typeInfo(selItems[0], reg).app]?.icon || 'file'} size={16} /> Open
          </button>
          <button className="tb-flat" onClick={() => window.print()}>
            Print
          </button>
          <button className="tb-flat" onClick={() => downloadNode(selItems[0].id)}>
            Download
          </button>
          <button className="tb-flat" onClick={() => create('folder')} disabled={!writableFolder}>
            New folder
          </button>
        </>
      );
    return (
      <>
        {writableFolder && <button className="tb-flat">Share with ▾</button>}
        <button className="tb-flat" disabled={!writableFolder} onClick={() => create('folder')}>
          New folder
        </button>
      </>
    );
  };

  const columns =
    loc === 'computer'
      ? [
          ['name', 'Name', 220],
          ['type', 'Type', 120],
          ['total', 'Total Size', 100],
          ['free', 'Free Space', 100],
        ]
      : inRecycle
        ? [
            ['name', 'Name', 220],
            ['origin', 'Original Location', 200],
            ['deleted', 'Date Deleted', 150],
            ['size', 'Size', 80],
          ]
        : [
            ['name', 'Name', 230],
            ['date', 'Date modified', 150],
            ['type', 'Type', 130],
            ['size', 'Size', 80],
          ].concat(query ? [['folder', 'Folder', 200]] : []);

  const cell = (item, key) => {
    if (key === 'date') return fmtDate(item.mtime);
    if (key === 'type') return item.virtual ? item.label : typeInfo(item, reg).label;
    if (key === 'size') return core.isContainer(item) || item.virtual ? '' : core.formatSize(core.sizeOf(nodes, item.id));
    if (key === 'origin') return item.origParent && nodes[item.origParent] ? fs.path(item.origParent) : '';
    if (key === 'deleted') return fmtDate(item.deletedAt);
    if (key === 'total') return item.capacity ? core.formatSize(item.capacity) : '';
    if (key === 'free') return item.capacity ? core.formatSize(item.capacity - item.used) : '';
    if (key === 'folder') return item.parent && nodes[item.parent] ? `${displayName(nodes[item.parent])} (${fs.path(item.parent)})` : '';
    return '';
  };

  const effectiveView = loc === 'computer' ? 'tiles' : view;

  const renderItem = (item) => {
    const icon = itemIcon(item, reg);
    const selected = sel.has(item.id);
    const cut = clipboard?.op === 'cut' && clipboard.ids.includes(item.id);
    const isDrop = core.isContainer(item) && !item.virtual;
    const hasThumb = item.type === 'file' && v.size >= 48 && IMAGE_EXT.includes(core.extOf(item.name)) && item.content;
    const iconEl = (
      <span className="ex-item-icon" style={{ width: v.size, height: v.size }}>
        {hasThumb ? <Thumb item={item} size={v.size} /> : <Icon name={icon} size={v.size} />}
        {item.type === 'shortcut' && <ShortcutArrow size={v.size} />}
      </span>
    );
    const label =
      renaming === item.id ? (
        <RenameBox key="rn" value={item.type === 'file' && displayName(item) !== item.name ? displayName(item) : item.name} multiline={!['details', 'list', 'small'].includes(view)} onDone={(val) => doRename(item, val)} />
      ) : (
        <span className="ex-item-name">{displayName(item)}</span>
      );
    const common = {
      'data-item': item.id,
      'data-drop': isDrop ? item.id : undefined,
      className: `ex-item ${selected ? 'sel' : ''} ${cut ? 'cut' : ''} ${dragInfo?.target === item.id ? 'drop' : ''}`,
      onPointerDown: (e) => onItemDown(item, e),
    };
    return (
      <ItemRow key={item.id} {...common} onOpen={() => open(item)} onContext={itemMenu(item)}>
        {effectiveView === 'details' ? (
          columns.map(([key], i) =>
            i === 0 ? (
              <span key={key} className="ex-cell name">
                {iconEl}
                {label}
              </span>
            ) : (
              <span key={key} className="ex-cell dim">
                {cell(item, key)}
              </span>
            )
          )
        ) : effectiveView === 'tiles' || effectiveView === 'content' ? (
          <>
            {iconEl}
            <span className="ex-tile-text">
              {label}
              {item.type === 'drive' ? (
                <DriveTile node={item} />
              ) : (
                <>
                  <span className="ex-dim">{item.virtual ? item.label : typeInfo(item, reg).label}</span>
                  {!core.isContainer(item) && !item.virtual && <span className="ex-dim">{core.formatSize(core.sizeOf(nodes, item.id))}</span>}
                </>
              )}
            </span>
          </>
        ) : (
          <>
            {iconEl}
            {label}
          </>
        )}
      </ItemRow>
    );
  };

  const one = selItems.length === 1 ? selItems[0] : null;

  const bgTaps = useTap({ onContext: bgMenu });

  return (
    <div className="explorer" ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="ex-top">
        <NavButtons
          canBack={hist.back.length > 0}
          canFwd={hist.fwd.length > 0}
          onBack={goBack}
          onFwd={goFwd}
          history={[...hist.back].reverse().slice(0, 8).map((h) => ({ label: locInfo(h, nodes)?.name || h, onClick: () => navigate(h) }))}
        />
        <AddressBar loc={loc} nodes={nodes} onNavigate={navigate} onRefresh={() => setRefreshKey((k) => k + 1)} />
        <SearchBox value={query} onChange={setQuery} placeholder={`Search ${info.name}`} />
      </div>
      <div className="ex-body">
        <div className="ex-command">
          <button className="tb-flat" onClick={organizeMenu}>
            Organize <span className="dd">▾</span>
          </button>
          {commandButtons()}
          <span className="ex-cmd-fill" />
          <button
            className="tb-flat ex-view-btn"
            title="Change your view."
            onClick={() => {
              const order = ['large', 'medium', 'list', 'details', 'tiles'];
              setNested('explorer', { view: order[(order.indexOf(view) + 1) % order.length] });
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect x="1" y="2" width="5" height="5" fill="#4a7ec0" />
              <rect x="1" y="9" width="5" height="5" fill="#4a7ec0" />
              <path d="M8 3h7M8 6h5M8 10h7M8 13h5" stroke="#1e3287" />
            </svg>
          </button>
          <button
            className="tb-flat ex-view-dd"
            aria-label="More options"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              ui.menuAt(r.left - 120, r.bottom, viewMenu());
            }}
          >
            ▾
          </button>
          <button className="tb-flat" title="Show the preview pane." onClick={() => setNested('explorer', { detailsPane: !settings.explorer.detailsPane })}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#4a6b90" />
              <rect x="9" y="3" width="5" height="10" fill="#bcd5f0" />
            </svg>
          </button>
          <button className="tb-flat" title="Get help." onClick={() => launch('help', { topic: 'explorer' })}>
            <Icon name="help" size={16} />
          </button>
        </div>
        <div className="ex-main">
          {settings.explorer.navPane && <NavPane loc={loc} onNavigate={navigate} nodes={nodes} />}
          <div
            className="ex-content w7-scroll"
            ref={contentRef}
            data-drop={writableFolder || (inRecycle ? core.RECYCLE : undefined)}
            onPointerDown={(e) => {
              bgTaps.onPointerDown(e);
              onBgDown(e);
            }}
            onPointerUp={bgTaps.onPointerUp}
            onPointerMove={bgTaps.onPointerMove}
            onContextMenu={(e) => {
              e.preventDefault();
              if (e.nativeEvent.pointerType !== 'touch') bgMenu(e);
            }}
            onDragOver={(e) => {
              if (writableFolder && e.dataTransfer?.types?.includes('Files')) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (writableFolder && e.dataTransfer?.files?.length) importFiles(e.dataTransfer.files, writableFolder);
            }}
          >
            {isLibrary && !query && (
              <div className="ex-libhead">
                <div>
                  <div className="ex-libtitle">{info.name} library</div>
                  <div className="ex-libsub">
                    Includes: <a>2 locations</a>
                  </div>
                </div>
                <div className="ex-arrange">
                  Arrange by: <a>Folder ▾</a>
                </div>
              </div>
            )}
            {loc === 'computer' && <div className="ex-group-head">Hard Disk Drives (1)</div>}
            {effectiveView === 'details' && (
              <div className="ex-colheads" style={{ gridTemplateColumns: columns.map((c) => `${c[2]}px`).join(' ') }}>
                {columns.map(([key, label]) => (
                  <button key={key} className={`ex-colhead ${sort.key === key ? 'sorted' : ''}`} onClick={() => setSort({ key, dir: sort.key === key ? -sort.dir : 1 })}>
                    {label}
                    {sort.key === key && <span className={`sort-arrow ${sort.dir < 0 ? 'down' : ''}`} />}
                  </button>
                ))}
              </div>
            )}
            <div
              className={`ex-items view-${effectiveView}`}
              style={effectiveView === 'details' ? { '--cols': columns.map((c) => `${c[2]}px`).join(' ') } : undefined}
              key={refreshKey}
            >
              {loc === 'computer' ? (
                <>
                  {items.filter((i) => !i.optical).map(renderItem)}
                  <div className="ex-group-head inline">Devices with Removable Storage (1)</div>
                  {items.filter((i) => i.optical).map(renderItem)}
                </>
              ) : (
                items.map(renderItem)
              )}
            </div>
            {items.length === 0 && <div className="ex-empty">{query ? 'No items match your search.' : inRecycle ? '' : 'This folder is empty.'}</div>}
            {band && <div className="ex-band" style={{ left: band.x, top: band.y, width: band.w, height: band.h }} />}
          </div>
        </div>
        {settings.explorer.detailsPane && (
          <div className="ex-details">
            {one ? (
              <>
                <span className="ex-details-icon">
                  {one.type === 'file' && IMAGE_EXT.includes(core.extOf(one.name)) ? <img src={resolveAsset(one.content)} alt="" /> : <Icon name={itemIcon(one, reg)} size={48} />}
                </span>
                <div className="ex-details-info">
                  <div className="ex-details-name">{displayName(one)}</div>
                  <div className="ex-dim">{one.virtual ? one.label : typeInfo(one, reg).label}</div>
                </div>
                {!one.virtual && one.type !== 'drive' && (
                  <div className="ex-details-grid">
                    <span>Date modified:</span>
                    <span>{fmtDate(one.mtime)}</span>
                    {!core.isContainer(one) && (
                      <>
                        <span>Size:</span>
                        <span>{core.formatSize(core.sizeOf(nodes, one.id))}</span>
                      </>
                    )}
                    <span>Date created:</span>
                    <span>{fmtDate(one.ctime)}</span>
                  </div>
                )}
                {one.type === 'drive' && (
                  <div className="ex-details-grid">
                    <span>Total size:</span>
                    <span>{one.capacity ? core.formatSize(one.capacity) : '—'}</span>
                    <span>File system:</span>
                    <span>{one.optical ? '' : 'NTFS'}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="ex-details-icon">
                  <Icon name={inRecycle ? (recycleItems.length ? 'recycle-full' : 'recycle-empty') : info.icon} size={48} />
                </span>
                <div className="ex-details-info">
                  <div className="ex-details-name">{selItems.length > 1 ? `${selItems.length} items selected` : `${items.length} item${items.length === 1 ? '' : 's'}`}</div>
                  {selItems.length > 1 && <div className="ex-dim">Total size: {core.formatSize(selItems.reduce((s, i) => s + (i.virtual ? 0 : core.sizeOf(nodes, i.id)), 0))}</div>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {dragInfo && (
        <div className="ex-drag-tip" style={{ left: dragInfo.x + 14, top: dragInfo.y + 18 }}>
          {dragInfo.target ? `→ Move to ${locInfo(dragInfo.target, nodes)?.name || (dragInfo.target === core.RECYCLE ? 'Recycle Bin' : '')}` : `${dragInfo.count} item${dragInfo.count > 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  );
}

function ItemRow({ children, onOpen, onContext, ...rest }) {
  const taps = useTap({ onDouble: onOpen, onContext });
  return (
    <div
      {...rest}
      onPointerDown={(e) => {
        taps.onPointerDown(e);
        rest.onPointerDown(e);
      }}
      onPointerUp={taps.onPointerUp}
      onPointerMove={taps.onPointerMove}
      onPointerCancel={taps.onPointerCancel}
      onContextMenu={(e) => {
        e.stopPropagation();
        taps.onContextMenu(e);
      }}
      onDoubleClick={(e) => e.nativeEvent.pointerType !== 'touch' && onOpen()}
    >
      {children}
    </div>
  );
}

function RenameBox({ value, onDone, multiline }) {
  const [v, setV] = useState(value);
  const ref = useRef(null);
  useEffect(() => {
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
  }, []);
  const props = {
    ref,
    className: 'ex-rename',
    value: v,
    spellCheck: false,
    onChange: (e) => setV(e.target.value),
    onPointerDown: (e) => e.stopPropagation(),
    onBlur: () => onDone(v),
    onKeyDown: (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        onDone(v);
      }
      if (e.key === 'Escape') onDone(null);
    },
  };
  return multiline ? <textarea {...props} rows={2} /> : <input {...props} />;
}
