import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../lib/store.js';
import { fsStore, fs, core, typeInfo } from '../state/fs.js';
import { settingsStore, setSettings, WALLPAPERS } from '../state/settings.js';
import { wm, ui, uiStore, getRegistry, taskbarHeight } from '../state/wm.js';
import { trackDrag, useTap } from '../lib/pointer.js';
import { Icon, ShortcutArrow } from './icons.jsx';
import { SYS_ITEMS, displayName, openNode, setClipboard, pasteInto, deleteItems, newItem, showProperties, createShortcut, importFiles, emptyRecycleBin, launch } from './shell.jsx';
import { messageBox } from './dialogs.jsx';
import { layoutIcons } from '../lib/layout.js';
import { openGadgetGallery } from './Gadgets.jsx';

export const CELL = {
  small: { w: 74, h: 62, icon: 32 },
  medium: { w: 80, h: 88, icon: 48 },
  large: { w: 104, h: 132, icon: 96 },
};
const ORIGIN = { x: 4, y: 4 };

export function wallpaperCss(s) {
  if (s.wallpaper === 'solid') return { background: s.solidColor };
  const url = s.wallpaper === 'custom' && s.customWallpaper ? s.customWallpaper : `${import.meta.env.BASE_URL}${(WALLPAPERS.find((w) => w.id === s.wallpaper) || WALLPAPERS[0]).file}`;
  const pos = {
    fill: { backgroundSize: 'cover', backgroundPosition: 'center' },
    fit: { backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' },
    stretch: { backgroundSize: '100% 100%' },
    tile: { backgroundSize: 'auto', backgroundRepeat: 'repeat' },
    center: { backgroundSize: 'auto', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' },
  }[s.wallpaperPosition || 'fill'];
  return { backgroundColor: s.solidColor || '#000', backgroundImage: `url("${url}")`, backgroundRepeat: 'no-repeat', ...pos };
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

function DesktopIcon({ item, pos, cell, selected, cut, renaming, onPointerDown, onOpen, onContext, onRename, dropTarget }) {
  const taps = useTap({ onDouble: onOpen, onContext });
  const [draft, setDraft] = useState(item.editName);
  const inputRef = useRef(null);
  useEffect(() => {
    if (renaming) {
      setDraft(item.editName);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [renaming, item.editName]);
  return (
    <div
      className={`desk-icon ${selected ? 'selected' : ''} ${cut ? 'cut' : ''} ${dropTarget ? 'drop' : ''}`}
      style={{ left: ORIGIN.x + pos.c * cell.w, top: ORIGIN.y + pos.r * cell.h, width: cell.w - 2 }}
      data-key={item.key}
      onPointerDown={(e) => {
        taps.onPointerDown(e);
        onPointerDown(e);
      }}
      onPointerMove={taps.onPointerMove}
      onPointerUp={taps.onPointerUp}
      onPointerCancel={taps.onPointerCancel}
      onContextMenu={taps.onContextMenu}
      onDoubleClick={(e) => e.nativeEvent.pointerType !== 'touch' && onOpen()}
      title={item.tip}
    >
      <div className="desk-icon-img" style={{ width: cell.icon, height: cell.icon }}>
        <Icon name={item.icon} size={cell.icon} />
        {item.shortcut && <ShortcutArrow size={cell.icon} />}
      </div>
      {renaming ? (
        <textarea
          ref={inputRef}
          className="desk-rename"
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={() => onRename(draft)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              onRename(draft);
            }
            if (e.key === 'Escape') onRename(null);
          }}
        />
      ) : (
        <div className="desk-label">{item.label}</div>
      )}
    </div>
  );
}

export function Desktop() {
  const settings = useStore(settingsStore);
  const nodes = useStore(fsStore, (s) => s.nodes);
  const clipboard = useStore(uiStore, (s) => s.clipboard);
  const vp = useViewport();
  const [selection, setSelection] = useState(() => new Set());
  const [band, setBand] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [drag, setDrag] = useState(null); // { keys, dx, dy, over }
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef(null);
  const reg = getRegistry();
  const cell = CELL[settings.iconSize] || CELL.medium;
  const tb = taskbarHeight();
  const rows = Math.max(1, Math.floor((vp.h - tb - ORIGIN.y) / cell.h));
  const cols = Math.max(1, Math.floor((vp.w - ORIGIN.x) / cell.w));
  const recycleFull = useMemo(() => Object.values(nodes).some((n) => n.parent === core.RECYCLE), [nodes]);

  const items = useMemo(() => {
    const list = [];
    const order = ['computer', 'user', 'network', 'recycle', 'controlpanel'];
    for (const k of order) {
      if (!settings.sysIcons[k]) continue;
      const s = SYS_ITEMS['sys:' + k];
      const icon = k === 'recycle' ? (recycleFull ? 'recycle-full' : 'recycle-empty') : s.icon;
      list.push({ key: s.key, label: s.name, editName: s.name, icon, sys: true });
    }
    let files = core.children(nodes, 'desktop');
    const sorters = {
      name: (a, b) => core.compareNodes(a, b),
      size: (a, b) => core.sizeOf(nodes, b.id) - core.sizeOf(nodes, a.id),
      type: (a, b) => typeInfo(a, reg).label.localeCompare(typeInfo(b, reg).label) || a.name.localeCompare(b.name),
      date: (a, b) => b.mtime - a.mtime,
    };
    files = [...files].sort(sorters[settings.sortBy] || sorters.name);
    for (const n of files) {
      const t = typeInfo(n, reg);
      list.push({ key: n.id, node: n, label: displayName(n), editName: n.type === 'file' && displayName(n) !== n.name ? displayName(n) : n.name, icon: t.icon, shortcut: n.type === 'shortcut', tip: n.type === 'file' ? `Type: ${t.label}\nSize: ${core.formatSize(core.sizeOf(nodes, n.id))}\nDate modified: ${new Date(n.mtime).toLocaleString()}` : undefined });
    }
    return list;
  }, [nodes, settings.sysIcons, settings.sortBy, recycleFull, reg]);

  const layout = useMemo(
    () => layoutIcons(items.map((i) => i.key), settings.iconPositions, rows, cols, settings.autoArrange),
    [items, settings.iconPositions, rows, cols, settings.autoArrange]
  );

  // Clean up selection when items disappear.
  useEffect(() => {
    setSelection((sel) => {
      const keys = new Set(items.map((i) => i.key));
      const next = new Set([...sel].filter((k) => keys.has(k)));
      return next.size === sel.size ? sel : next;
    });
  }, [items]);

  // Newly created items (from "New >" menu) go into rename mode.
  const pendingRename = useRef(null);
  useEffect(() => {
    if (pendingRename.current && items.some((i) => i.key === pendingRename.current)) {
      setSelection(new Set([pendingRename.current]));
      setRenaming(pendingRename.current);
      pendingRename.current = null;
    }
  }, [items]);

  const savePositions = useCallback((next) => setSettings((s) => ({ iconPositions: { ...s.iconPositions, ...next } })), []);

  const itemAt = (x, y) => {
    const el = document.elementsFromPoint(x, y).find((e) => e.classList?.contains('desk-icon'));
    return el ? el.dataset.key : null;
  };

  const isContainerKey = (k) => k === 'sys:recycle' || k === 'sys:computer' || k === 'sys:user' || (fs.get(k) && (core.isContainer(fs.get(k)) || fs.get(k).type === 'shortcut'));

  const onIconDown = (key) => (e) => {
    if (e.button === 2) {
      if (!selection.has(key)) setSelection(new Set([key]));
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    ref.current?.focus({ preventScroll: true });
    wm.blurAll();
    let sel = selection;
    if (e.ctrlKey || e.metaKey) {
      sel = new Set(selection);
      sel.has(key) ? sel.delete(key) : sel.add(key);
      setSelection(sel);
      return;
    }
    if (!sel.has(key)) {
      sel = new Set([key]);
      setSelection(sel);
    }
    if (renaming) return;
    const keys = [...sel];
    trackDrag(e, {
      threshold: 5,
      onMove: ({ x, y, dx, dy }) => {
        const over = itemAt(x, y);
        setDrag({ keys, dx, dy, over: over && !keys.includes(over) && isContainerKey(over) ? over : null });
      },
      onEnd: async ({ moved, x, y, dx, dy }) => {
        setDrag(null);
        if (!moved) return;
        const over = itemAt(x, y);
        if (over && !keys.includes(over) && isContainerKey(over)) {
          const fileKeys = keys.filter((k) => !k.startsWith('sys:'));
          if (over === 'sys:recycle') return deleteItems(fileKeys);
          const target = over === 'sys:user' ? 'user' : over === 'sys:computer' ? null : fs.get(over);
          if (target && typeof target === 'object' && target.type === 'shortcut') {
            const t = target.target || {};
            if (t.app && fileKeys.length === 1) return openNode(fileKeys[0], t.app);
            if (t.path) fileKeys.forEach((k) => fs.move(k, t.path));
            return;
          }
          const dest = typeof target === 'string' ? target : target?.id;
          if (dest) {
            for (const k of fileKeys) {
              const err = fs.move(k, dest);
              if (err) await messageBox({ title: 'Move Item', text: err, icon: 'error' });
            }
          }
          return;
        }
        // Reposition on the grid.
        const dc = Math.round(dx / cell.w);
        const dr = Math.round(dy / cell.h);
        if (!dc && !dr) return;
        const taken = new Map(Object.entries(layout).filter(([k]) => !keys.includes(k)).map(([k, p]) => [`${p.c},${p.r}`, k]));
        const next = { ...Object.fromEntries(Object.entries(layout).map(([k, p]) => [k, p])) };
        for (const k of keys) {
          let c = Math.max(0, Math.min(cols - 1, layout[k].c + dc));
          let r = Math.max(0, Math.min(rows - 1, layout[k].r + dr));
          // Find the nearest free cell if occupied.
          if (taken.has(`${c},${r}`)) {
            let best = null;
            for (let rad = 1; rad < 30 && !best; rad++)
              for (let cc = c - rad; cc <= c + rad; cc++)
                for (let rr = r - rad; rr <= r + rad; rr++) {
                  if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
                  if (!taken.has(`${cc},${rr}`) && !best) best = { c: cc, r: rr };
                }
            if (best) ({ c, r } = best);
          }
          taken.set(`${c},${r}`, k);
          next[k] = { c, r };
        }
        if (settings.autoArrange) setSettings({ autoArrange: false });
        savePositions(next);
      },
    });
  };

  const onBgDown = (e) => {
    if (e.target !== e.currentTarget && !e.target.classList.contains('desk-icons')) return;
    ui.toggleStart(false);
    wm.blurAll();
    ref.current?.focus({ preventScroll: true });
    if (renaming) return;
    if (e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const base = e.ctrlKey ? new Set(selection) : new Set();
    setSelection(base);
    trackDrag(e, {
      threshold: e.pointerType === 'touch' ? 12 : 2,
      onMove: ({ x, y }) => {
        const r = { x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
        setBand(r);
        const next = new Set(base);
        for (const it of items) {
          const p = layout[it.key];
          const ix = ORIGIN.x + p.c * cell.w + 8;
          const iy = ORIGIN.y + p.r * cell.h;
          if (ix < r.x + r.w && ix + cell.w - 16 > r.x && iy < r.y + r.h && iy + cell.h - 6 > r.y) next.add(it.key);
        }
        setSelection(next);
      },
      onEnd: () => setBand(null),
    });
  };

  const doRename = (key, value) => {
    setRenaming(null);
    if (value === null || value === undefined) return;
    const it = items.find((i) => i.key === key);
    if (!it || it.sys) {
      if (key === 'sys:user' && value.trim()) setSettings({ username: value.trim() });
      return;
    }
    let name = value.trim();
    if (!name || name === it.editName) return;
    const n = it.node;
    if (n.type === 'file' && it.editName !== n.name) name += n.name.slice(n.name.lastIndexOf('.'));
    const err = fs.rename(n.id, name);
    if (err) messageBox({ title: 'Rename', text: err, icon: 'error' });
  };

  const selectedFileIds = () => [...selection].filter((k) => !k.startsWith('sys:'));

  const openKey = (key) => {
    if (SYS_ITEMS[key]) return SYS_ITEMS[key].open();
    openNode(key);
  };

  const create = (kind) => {
    const id = newItem('desktop', kind);
    if (id) pendingRename.current = id;
  };

  const iconMenu = (key) => (e) => {
    const sel = selection.has(key) ? selection : new Set([key]);
    if (!selection.has(key)) setSelection(sel);
    const node = fs.get(key);
    const ids = [...sel].filter((k) => !k.startsWith('sys:'));
    const multi = sel.size > 1;
    let items;
    if (key === 'sys:recycle') {
      items = [
        { label: 'Open', bold: true, onClick: () => openKey(key) },
        { label: 'Empty Recycle Bin', disabled: !recycleFull, onClick: () => emptyRecycleBin() },
        { separator: true },
        { label: 'Create shortcut', disabled: true },
        { label: 'Rename', disabled: true },
        { separator: true },
        { label: 'Properties', onClick: () => showProperties(key) },
      ];
    } else if (key.startsWith('sys:')) {
      items = [
        { label: 'Open', bold: true, onClick: () => openKey(key) },
        ...(key === 'sys:computer' ? [{ label: 'Manage', icon: 'shield', onClick: () => launch('control', { page: 'system' }) }, { separator: true }, { label: 'Map network drive...', disabled: true }] : []),
        { separator: true },
        { label: 'Create shortcut', disabled: true },
        { label: 'Delete', onClick: () => setSettings((s) => ({ sysIcons: { ...s.sysIcons, [key.slice(4)]: false } })) },
        { label: 'Rename', disabled: key !== 'sys:user', onClick: () => setRenaming(key) },
        { separator: true },
        { label: 'Properties', onClick: () => showProperties(key) },
      ];
    } else {
      const reg = getRegistry();
      const isFile = node?.type === 'file';
      const openWith = isFile
        ? [
            {
              label: 'Open with',
              submenu: ['notepad', 'mspaint', 'photos', 'iexplore'].map((a) => ({ label: reg[a].name, icon: reg[a].icon, onClick: () => openNode(key, a) })),
            },
          ]
        : [];
      items = [
        { label: 'Open', bold: true, onClick: () => ids.forEach((id) => openNode(id)) },
        ...(isFile && node.content?.startsWith('data:image') ? [{ label: 'Edit', onClick: () => openNode(key, 'mspaint') }, { label: 'Set as desktop background', onClick: () => setSettings({ wallpaper: 'custom', customWallpaper: node.content }) }] : []),
        ...(isFile && node.content?.startsWith('asset:') ? [{ label: 'Set as desktop background', onClick: () => setSettings({ wallpaper: WALLPAPERS.find((w) => node.content.includes(w.file))?.id || 'harmony' }) }] : []),
        ...openWith,
        { separator: true },
        { label: 'Send to', submenu: [{ label: 'Documents', icon: 'folder-documents', onClick: () => ids.forEach((id) => fs.copy(id, 'documents')) }, { label: 'Desktop (create shortcut)', icon: 'folder-desktop', onClick: () => ids.forEach((id) => createShortcut(id)) }] },
        { separator: true },
        { label: 'Cut', onClick: () => setClipboard('cut', ids) },
        { label: 'Copy', onClick: () => setClipboard('copy', ids) },
        { separator: true },
        { label: 'Create shortcut', disabled: multi, onClick: () => createShortcut(key) },
        { label: 'Delete', onClick: () => deleteItems(ids) },
        { label: 'Rename', disabled: multi, onClick: () => setRenaming(key) },
        { separator: true },
        { label: 'Properties', onClick: () => showProperties(key) },
      ];
    }
    ui.menu(e, items);
  };

  const bgMenu = (e) => {
    if (e.target !== e.currentTarget && !e.target.classList?.contains('desk-icons')) return;
    setSelection(new Set());
    const s = settingsStore.get();
    ui.menu(e, [
      {
        label: 'View',
        submenu: [
          { label: 'Large icons', checked: s.iconSize === 'large', radio: true, onClick: () => setSettings({ iconSize: 'large' }) },
          { label: 'Medium icons', checked: s.iconSize === 'medium', radio: true, onClick: () => setSettings({ iconSize: 'medium' }) },
          { label: 'Small icons', checked: s.iconSize === 'small', radio: true, onClick: () => setSettings({ iconSize: 'small' }) },
          { separator: true },
          { label: 'Auto arrange icons', checked: s.autoArrange, onClick: () => setSettings({ autoArrange: !s.autoArrange, iconPositions: {} }) },
          { label: 'Align icons to grid', checked: s.alignToGrid, onClick: () => setSettings({ alignToGrid: !s.alignToGrid }) },
          { separator: true },
          { label: 'Show desktop icons', checked: s.showDesktopIcons, onClick: () => setSettings({ showDesktopIcons: !s.showDesktopIcons }) },
          { label: 'Show desktop gadgets', checked: true, disabled: true },
        ],
      },
      {
        label: 'Sort by',
        submenu: [
          ['name', 'Name'],
          ['size', 'Size'],
          ['type', 'Item type'],
          ['date', 'Date modified'],
        ].map(([k, l]) => ({ label: l, onClick: () => setSettings({ sortBy: k, iconPositions: {} }) })),
      },
      {
        label: 'Refresh',
        onClick: () => {
          setRefreshing(true);
          setTimeout(() => setRefreshing(false), 180);
        },
      },
      { separator: true },
      { label: 'Paste', disabled: !uiStore.get().clipboard, onClick: () => pasteInto('desktop') },
      { label: 'Paste shortcut', disabled: !uiStore.get().clipboard, onClick: () => uiStore.get().clipboard.ids.forEach((id) => createShortcut(id)) },
      { separator: true },
      {
        label: 'New',
        submenu: [
          { label: 'Folder', icon: 'folder', onClick: () => create('folder') },
          { label: 'Shortcut', icon: 'file-exe', onClick: () => fs.create({ parent: 'desktop', name: 'Notepad', type: 'shortcut', target: { app: 'notepad' } }) },
          { separator: true },
          { label: 'Bitmap image', icon: 'file-image', onClick: () => create('bitmap') },
          { label: 'Text Document', icon: 'file-text', onClick: () => create('text') },
        ],
      },
      { separator: true },
      { label: 'Screen resolution', icon: 'cp-display', onClick: () => launch('control', { page: 'display' }) },
      { label: 'Gadgets', icon: 'screensaver', onClick: () => openGadgetGallery() },
      { label: 'Personalize', icon: 'cp-appearance', onClick: () => launch('control', { page: 'personalization' }) },
    ]);
  };

  const onKeyDown = (e) => {
    if (renaming) return;
    const ids = selectedFileIds();
    if (e.key === 'Delete') deleteItems(ids, { permanent: e.shiftKey });
    else if (e.key === 'F2' && selection.size === 1) setRenaming([...selection][0]);
    else if (e.key === 'Enter') [...selection].forEach(openKey);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setSelection(new Set(items.map((i) => i.key)));
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') setClipboard('copy', ids);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') setClipboard('cut', ids);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') pasteInto('desktop');
    else if (e.key === 'F5') {
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 180);
    }
  };

  const bgTaps = useTap({ onContext: bgMenu });

  return (
    <div
      ref={ref}
      className={`desktop size-${settings.iconSize}`}
      tabIndex={-1}
      style={wallpaperCss(settings)}
      onPointerDown={(e) => {
        bgTaps.onPointerDown(e);
        onBgDown(e);
      }}
      onPointerMove={bgTaps.onPointerMove}
      onPointerUp={bgTaps.onPointerUp}
      onContextMenu={(e) => {
        e.preventDefault();
        if (e.nativeEvent.pointerType !== 'touch') bgMenu(e);
      }}
      onKeyDown={onKeyDown}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
      }}
      onDrop={async (e) => {
        e.preventDefault();
        if (e.dataTransfer?.files?.length) await importFiles(e.dataTransfer.files, 'desktop');
      }}
    >
      {settings.showDesktopIcons && !refreshing && (
        <div className="desk-icons">
          {items.map((it) => (
            <DesktopIcon
              key={it.key}
              item={it}
              pos={layout[it.key]}
              cell={cell}
              selected={selection.has(it.key)}
              cut={clipboard?.op === 'cut' && clipboard.ids.includes(it.key)}
              renaming={renaming === it.key}
              dropTarget={drag?.over === it.key}
              onPointerDown={onIconDown(it.key)}
              onOpen={() => openKey(it.key)}
              onContext={iconMenu(it.key)}
              onRename={(v) => doRename(it.key, v)}
            />
          ))}
        </div>
      )}
      {drag && (
        <div className="desk-drag-ghosts" style={{ transform: `translate(${drag.dx}px, ${drag.dy}px)` }}>
          {drag.keys.map((k) => {
            const it = items.find((i) => i.key === k);
            const p = layout[k];
            if (!it || !p) return null;
            return (
              <div key={k} className="desk-icon ghost" style={{ left: ORIGIN.x + p.c * cell.w, top: ORIGIN.y + p.r * cell.h, width: cell.w - 2 }}>
                <div className="desk-icon-img" style={{ width: cell.icon, height: cell.icon }}>
                  <Icon name={it.icon} size={cell.icon} />
                </div>
                <div className="desk-label">{it.label}</div>
              </div>
            );
          })}
        </div>
      )}
      {band && <div className="select-band" style={{ left: band.x, top: band.y, width: band.w, height: band.h }} />}
    </div>
  );
}
