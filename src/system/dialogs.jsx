import React, { useLayoutEffect, useRef, useState, useEffect, useMemo } from 'react';
import { wm, wmStore } from '../state/wm.js';
import { fs, fsStore, core, typeInfo } from '../state/fs.js';
import { useStore } from '../lib/store.js';
import { Icon } from './icons.jsx';
import { sound } from '../lib/sound.js';
import { getRegistry } from '../state/wm.js';

const resolvers = new Map();

function finish(winId, value) {
  const r = resolvers.get(winId);
  resolvers.delete(winId);
  wm.close(winId, true);
  r?.(value);
}

/** Size a dialog window to fit its content, then center it on its owner/screen. */
function useAutoSize(win, ref, deps = []) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cw = Math.ceil(el.scrollWidth) + 18;
    const ch = Math.ceil(el.scrollHeight) + 30 + 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight - 40;
    const w = Math.min(vw, cw);
    const h = Math.min(vh, ch);
    const owner = wmStore.get().windows.find((x) => x.id === win.owner && !x.minimized);
    const bx = owner && !owner.maximized ? owner.x + owner.w / 2 : vw / 2;
    const by = owner && !owner.maximized ? owner.y + owner.h / 2.4 : vh / 2.3;
    wm.setRect(win.id, {
      w,
      h,
      x: Math.round(Math.max(0, Math.min(vw - w, bx - w / 2))),
      y: Math.round(Math.max(0, Math.min(vh - h, by - h / 2))),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ---------------------------------------------------------------------------
// Message box

export function MessageBoxApp({ win }) {
  const { text, icon, buttons = ['OK'], defaultIndex = 0, detail } = win.props;
  const ref = useRef(null);
  useAutoSize(win, ref);
  useEffect(() => {
    wm.setGuard(win.id, async () => {
      finish(win.id, buttons.includes('Cancel') ? 'Cancel' : buttons[buttons.length - 1]);
      return false;
    });
    const btn = ref.current?.querySelector('.w7-btn.default');
    btn?.focus({ preventScroll: true });
    return () => wm.setGuard(win.id, null);
  }, [win.id, buttons]);
  return (
    <div className="msgbox" ref={ref}>
      <div className="msgbox-body">
        {icon && <Icon name={icon} size={32} className="msgbox-icon" />}
        <div className="msgbox-text">
          {String(text)
            .split('\n')
            .map((line, i) => (
              <div key={i} className={i === 0 && detail ? 'msgbox-main' : ''}>
                {line || ' '}
              </div>
            ))}
        </div>
      </div>
      <div className="msgbox-buttons">
        {buttons.map((b, i) => (
          <button key={b} className={`w7-btn ${i === defaultIndex ? 'default' : ''}`} onClick={() => finish(win.id, b)}>
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

export function messageBox({ title = 'Windows', text, icon = 'info', buttons = ['OK'], owner, defaultIndex = 0, detail }) {
  if (icon === 'error' || icon === 'warning') sound.play('error');
  else if (icon === 'question') sound.play('question');
  return new Promise((resolve) => {
    const id = wm.open('msgbox', { text, icon, buttons, defaultIndex, detail }, { dialog: true, owner, title, w: 360, h: 160, center: true, resizable: false });
    resolvers.set(id, resolve);
  });
}

export const alertError = (text, owner, title = 'Error') => messageBox({ title, text, icon: 'error', owner });

// ---------------------------------------------------------------------------
// Open / Save As dialog

const PLACES = [
  { id: 'desktop', label: 'Desktop', icon: 'folder-desktop' },
  { id: 'downloads', label: 'Downloads', icon: 'folder-downloads' },
  { id: 'documents', label: 'Documents', icon: 'folder-documents' },
  { id: 'pictures', label: 'Pictures', icon: 'folder-pictures' },
  { id: 'music', label: 'Music', icon: 'folder-music' },
  { id: 'C', label: 'Local Disk (C:)', icon: 'drive-c' },
];

export function FileDialogApp({ win }) {
  const { mode, filters = [{ label: 'All Files (*.*)', ext: [] }], defaultName = '', startIn = 'documents' } = win.props;
  const nodes = useStore(fsStore, (s) => s.nodes);
  const [folder, setFolder] = useState(nodes[startIn] ? startIn : 'documents');
  const [name, setName] = useState(defaultName);
  const [filter, setFilter] = useState(0);
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);
  const registry = getRegistry();

  useEffect(() => {
    wm.setGuard(win.id, async () => {
      finish(win.id, null);
      return false;
    });
    setTimeout(() => {
      inputRef.current?.focus();
      if (mode === 'save') {
        const dot = defaultName.lastIndexOf('.');
        inputRef.current?.setSelectionRange(0, dot > 0 ? dot : defaultName.length);
      }
    }, 50);
    return () => wm.setGuard(win.id, null);
  }, [win.id, mode, defaultName]);

  const exts = filters[filter]?.ext || [];
  const items = useMemo(
    () => core.children(nodes, folder).filter((n) => core.isContainer(n) || !exts.length || exts.includes(core.extOf(n.name))),
    [nodes, folder, exts]
  );

  const crumbs = [];
  for (let cur = nodes[folder]; cur; cur = nodes[cur.parent]) crumbs.unshift(cur);

  const submit = async () => {
    const typed = name.trim();
    if (!typed) return;
    if (mode === 'open') {
      const target = selected && nodes[selected] && nodes[selected].name === typed ? nodes[selected] : core.findChild(nodes, folder, typed);
      if (!target) return alertError(`${typed}\nFile not found.\nCheck the file name and try again.`, win.id, win.title);
      if (core.isContainer(target)) {
        setFolder(target.id);
        setName('');
        return;
      }
      return finish(win.id, target.id);
    }
    const err = core.validateName(typed);
    if (err) return alertError(err, win.id, win.title);
    let finalName = typed;
    const wanted = exts[0];
    if (wanted && !core.extOf(finalName)) finalName += '.' + wanted;
    const existing = core.findChild(nodes, folder, finalName);
    if (existing) {
      if (core.isContainer(existing)) {
        setFolder(existing.id);
        return;
      }
      const ans = await messageBox({
        title: 'Confirm Save As',
        text: `${finalName} already exists.\nDo you want to replace it?`,
        icon: 'warning',
        buttons: ['Yes', 'No'],
        defaultIndex: 1,
        owner: win.id,
      });
      if (ans !== 'Yes') return;
      return finish(win.id, { id: existing.id, parent: folder, name: finalName });
    }
    finish(win.id, { parent: folder, name: finalName });
  };

  return (
    <div className="filedlg">
      <div className="filedlg-top">
        <div className="filedlg-crumbs">
          <Icon name={typeInfo(nodes[folder], registry).icon} size={16} />
          {crumbs.map((c) => (
            <button key={c.id} className="crumb" onClick={() => setFolder(c.id)}>
              {c.type === 'drive' ? `${c.name} (${c.letter}:)` : c.name} <span className="crumb-sep">▸</span>
            </button>
          ))}
        </div>
        <button className="w7-btn filedlg-up" onClick={() => nodes[folder]?.parent && setFolder(nodes[folder].parent)} disabled={!nodes[folder]?.parent} title="Up one level">
          ↑
        </button>
      </div>
      <div className="filedlg-toolbar">
        <span>Organize ▾</span>
        <button
          className="tb-flat"
          onClick={() => {
            const id = fs.create({ parent: folder, name: 'New folder', type: 'folder' });
            setSelected(id);
          }}
        >
          New folder
        </button>
      </div>
      <div className="filedlg-main">
        <div className="filedlg-places w7-scroll">
          <div className="place-head">
            <Icon name="star" size={16} /> Favorites
          </div>
          {PLACES.map((p) => (
            <div key={p.id} className={`place ${folder === p.id ? 'sel' : ''}`} onClick={() => setFolder(p.id)}>
              <Icon name={p.icon} size={16} /> {p.label}
            </div>
          ))}
        </div>
        <div className="filedlg-list w7-scroll">
          <div className="fd-head">
            <span>Name</span>
            <span>Date modified</span>
            <span>Type</span>
          </div>
          {items.length === 0 && <div className="fd-empty">No items match your search.</div>}
          {items.map((n) => (
            <div
              key={n.id}
              className={`fd-row ${selected === n.id ? 'sel' : ''}`}
              onClick={() => {
                setSelected(n.id);
                if (!core.isContainer(n)) setName(n.name);
              }}
              onDoubleClick={() => {
                if (core.isContainer(n)) {
                  setFolder(n.id);
                  setSelected(null);
                } else if (mode === 'open') finish(win.id, n.id);
                else {
                  setName(n.name);
                }
              }}
            >
              <span className="fd-name">
                <Icon name={typeInfo(n, registry).icon} size={16} /> {n.name}
              </span>
              <span>{new Date(n.mtime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span>{typeInfo(n, registry).label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="filedlg-bottom">
        <div className="fd-field">
          <label>File name:</label>
          <input
            ref={inputRef}
            className="w7-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') finish(win.id, null);
            }}
          />
        </div>
        <div className="fd-field">
          <label>{mode === 'save' ? 'Save as type:' : 'Files of type:'}</label>
          <select className="w7-select" value={filter} onChange={(e) => setFilter(+e.target.value)}>
            {filters.map((f, i) => (
              <option key={f.label} value={i}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fd-buttons">
          <button className="w7-btn default" onClick={submit}>
            {mode === 'save' ? 'Save' : 'Open'}
          </button>
          <button className="w7-btn" onClick={() => finish(win.id, null)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * mode 'open' resolves to a file id; mode 'save' resolves to { id?, parent, name }.
 * Resolves to null when cancelled.
 */
export function fileDialog({ mode = 'open', title, filters, defaultName, startIn, owner }) {
  return new Promise((resolve) => {
    const id = wm.open(
      'filedlg',
      { mode, filters, defaultName, startIn },
      { dialog: true, owner, title: title || (mode === 'save' ? 'Save As' : 'Open'), w: 620, h: 430, center: true, resizable: true, maximizable: false, minimizable: false }
    );
    resolvers.set(id, resolve);
  });
}

// ---------------------------------------------------------------------------
// Generic dialog host: lets apps render arbitrary dialog content via render prop.

export function CustomDialogApp({ win }) {
  const ref = useRef(null);
  const render = win.props.render;
  useAutoSize(win, ref);
  useEffect(() => {
    wm.setGuard(win.id, async () => {
      finish(win.id, null);
      return false;
    });
    return () => {
      wm.setGuard(win.id, null);
    };
  }, [win.id]);
  if (!render) return null;
  return (
    <div className="custom-dialog" ref={ref}>
      {render((value) => finish(win.id, value))}
    </div>
  );
}

/** openDialog({ title, owner, render: (done) => <jsx/> }) -> Promise<value|null> */
export function openDialog({ title, owner, render, icon }) {
  return new Promise((resolve) => {
    const id = wm.open('customdlg', { render }, { dialog: true, owner, title, icon, w: 320, h: 200, center: true, resizable: false });
    resolvers.set(id, resolve);
  });
}
