import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.js';
import { uiStore, ui, getRegistry } from '../state/wm.js';
import { settingsStore } from '../state/settings.js';
import { fsStore, fs, core, typeInfo } from '../state/fs.js';
import { Icon, UserPicture } from './icons.jsx';
import { launch, openPath, openNode, displayName } from './shell.jsx';
import { power } from './power.js';
import { isTouchDevice } from '../lib/pointer.js';

const PINNED_DEFAULT = ['getstarted'];

const ALL_PROGRAMS = [
  { app: 'iexplore' },
  { app: 'photos' },
  { app: 'winver', label: 'About Windows' },
  {
    folder: 'Accessories',
    items: [{ app: 'calc' }, { app: 'cmd' }, { app: 'notepad' }, { app: 'mspaint' }, { app: 'run' }, { app: 'explorer' }, { app: 'taskmgr' }],
  },
  { folder: 'Games', items: [{ app: 'minesweeper' }] },
  { folder: 'Maintenance', items: [{ app: 'help' }, { app: 'control', label: 'Control Panel' }] },
  { folder: 'Startup', items: [] },
];

const RIGHT = [
  { id: 'user', icon: 'folder-user', action: () => openPath('user') },
  { id: 'Documents', icon: 'folder-documents', action: () => openPath('documents') },
  { id: 'Pictures', icon: 'folder-pictures', action: () => openPath('pictures') },
  { id: 'Music', icon: 'folder-music', action: () => openPath('music') },
  { sep: true },
  { id: 'Games', icon: 'games', action: () => openPath('savedgames') },
  { id: 'Computer', icon: 'computer', action: () => openPath('computer') },
  { sep: true },
  { id: 'Control Panel', icon: 'controlpanel', action: () => launch('control') },
  { id: 'Devices and Printers', icon: 'printer', action: () => launch('control', { page: 'devices' }) },
  { id: 'Default Programs', icon: 'defaultprograms', action: () => launch('control', { page: 'defaults' }) },
  { id: 'Help and Support', icon: 'help', action: () => launch('help') },
  { sep: true },
  { id: 'Run...', icon: 'run', action: () => launch('run') },
];

const CP_SEARCH = [
  ['Change desktop background', 'background'],
  ['Personalization', 'personalization'],
  ['Change window glass colors', 'color'],
  ['Change account picture', 'users'],
  ['User Accounts', 'users'],
  ['Date and Time', 'datetime'],
  ['System', 'system'],
  ['Screen saver', 'screensaver'],
  ['Taskbar and Start Menu', 'taskbar'],
  ['Sound', 'sound'],
  ['Programs and Features', 'programs'],
  ['Display', 'display'],
  ['Reset this computer', 'recovery'],
];

function ProgramItem({ app, label, onOpen, big = true, onHoverIcon }) {
  const reg = getRegistry();
  const a = reg[app];
  if (!a) return null;
  return (
    <button className={`sm-prog ${big ? 'big' : ''}`} onClick={() => onOpen(app)} onPointerEnter={() => onHoverIcon?.(a.icon)} onPointerLeave={() => onHoverIcon?.(null)}>
      <Icon name={a.icon} size={big ? 32 : 16} />
      <span>{label || a.name}</span>
    </button>
  );
}

function AllPrograms({ onOpen }) {
  const [open, setOpen] = useState({ Accessories: true });
  const reg = getRegistry();
  const render = (list, depth = 0) =>
    list.map((it) => {
      if (it.folder) {
        return (
          <div key={it.folder}>
            <button className="sm-prog folder" style={{ paddingLeft: 6 + depth * 14 }} onClick={() => setOpen((o) => ({ ...o, [it.folder]: !o[it.folder] }))}>
              <Icon name="folder" size={16} />
              <span>{it.folder}</span>
            </button>
            {open[it.folder] && (it.items.length ? render(it.items, depth + 1) : <div className="sm-empty" style={{ paddingLeft: 26 + (depth + 1) * 14 }}>(Empty)</div>)}
          </div>
        );
      }
      const a = reg[it.app];
      if (!a) return null;
      return (
        <button key={it.app} className="sm-prog" style={{ paddingLeft: 6 + depth * 14 }} onClick={() => onOpen(it.app)}>
          <Icon name={a.icon} size={16} />
          <span>{it.label || a.name}</span>
        </button>
      );
    });
  return <div className="sm-all w7-scroll">{render(ALL_PROGRAMS)}</div>;
}

function search(q, nodes, reg) {
  const t = q.trim().toLowerCase();
  if (!t) return null;
  const programs = Object.entries(reg)
    .filter(([, a]) => !a.hidden && (a.name.toLowerCase().includes(t) || (a.keywords || []).some((k) => k.includes(t))))
    .slice(0, 6)
    .map(([id, a]) => ({ kind: 'app', id, label: a.name, icon: a.icon }));
  const cp = CP_SEARCH.filter(([l]) => l.toLowerCase().includes(t))
    .slice(0, 4)
    .map(([label, page]) => ({ kind: 'cp', id: page, label, icon: 'controlpanel' }));
  const files = Object.values(nodes)
    .filter((n) => n.parent && n.parent !== core.RECYCLE && !n.system && n.name.toLowerCase().includes(t))
    .slice(0, 6)
    .map((n) => ({ kind: 'file', id: n.id, label: displayName(n), icon: typeInfo(n, reg).icon }));
  return { programs, cp, files };
}

export function StartMenu() {
  const open = useStore(uiStore, (s) => s.startOpen);
  const s = useStore(settingsStore);
  const nodes = useStore(fsStore, (st) => st.nodes);
  const [all, setAll] = useState(false);
  const [q, setQ] = useState('');
  const [pic, setPic] = useState(null);
  const [shutMenu, setShutMenu] = useState(false);
  const inputRef = useRef(null);
  const ref = useRef(null);
  const reg = getRegistry();

  useEffect(() => {
    if (open) {
      setAll(false);
      setQ('');
      setShutMenu(false);
      if (!isTouchDevice()) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current?.contains(e.target) || e.target.closest?.('.start-orb') || e.target.closest?.('.w7-menu')) return;
      ui.toggleStart(false);
    };
    const key = (e) => {
      if (e.key === 'Escape') ui.toggleStart(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const results = useMemo(() => search(q, nodes, reg), [q, nodes, reg]);

  const mfu = useMemo(
    () =>
      Object.entries(s.startUsage)
        .filter(([id]) => reg[id] && !reg[id].hidden && !PINNED_DEFAULT.includes(id))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id]) => id),
    [s.startUsage, reg]
  );

  if (!open) return null;

  const go = (app, props) => {
    ui.toggleStart(false);
    launch(app, props);
  };

  const pick = (r) => {
    ui.toggleStart(false);
    if (r.kind === 'app') launch(r.id);
    else if (r.kind === 'cp') launch('control', { page: r.id });
    else openNode(r.id);
  };

  const first = results && [...results.programs, ...results.cp, ...results.files][0];

  const doPower = (action) => {
    ui.toggleStart(false);
    power[action]();
  };

  return (
    <div className="start-menu" ref={ref} role="menu" aria-label="Start menu" onContextMenu={(e) => e.preventDefault()}>
      <div className="sm-left">
        <div className="sm-list w7-scroll">
          {results ? (
            <div className="sm-results">
              {!results.programs.length && !results.cp.length && !results.files.length && <div className="sm-noresults">No items match your search.</div>}
              {[
                ['Programs', results.programs],
                ['Control Panel', results.cp],
                ['Files', results.files],
              ].map(([title, list]) =>
                list.length ? (
                  <div key={title}>
                    <div className="sm-res-head">
                      {title} ({list.length})
                    </div>
                    {list.map((r) => (
                      <button key={r.kind + r.id} className={`sm-prog ${r === first ? 'hot' : ''}`} onClick={() => pick(r)}>
                        <Icon name={r.icon} size={16} />
                        <span>{r.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null
              )}
              <div className="sm-sep" />
              <button className="sm-prog see-more" onClick={() => go('explorer', { path: 'user', search: q })}>
                <Icon name="folder-search" size={16} />
                <span>See more results</span>
              </button>
            </div>
          ) : all ? (
            <AllPrograms onOpen={go} />
          ) : (
            <>
              <ProgramItem app="getstarted" onOpen={go} onHoverIcon={setPic} />
              <div className="sm-sep" />
              {mfu.map((id) => (
                <ProgramItem key={id} app={id} onOpen={go} onHoverIcon={setPic} />
              ))}
            </>
          )}
        </div>
        {!results && (
          <>
            <div className="sm-sep" />
            <button className="sm-allprogs" onClick={() => setAll(!all)}>
              <span className={`sm-tri ${all ? 'back' : ''}`} />
              {all ? 'Back' : 'All Programs'}
            </button>
          </>
        )}
        <div className="sm-search">
          <input
            ref={inputRef}
            className="sm-search-input"
            placeholder="Search programs and files"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && first) pick(first);
              if (e.key === 'Escape') ui.toggleStart(false);
            }}
            aria-label="Search programs and files"
          />
          {q ? (
            <button className="sm-search-btn clear" onClick={() => setQ('')} aria-label="Clear">
              ✕
            </button>
          ) : (
            <span className="sm-search-btn">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="5.5" cy="5.5" r="4" fill="none" stroke="#3d5a78" strokeWidth="1.6" />
                <path d="M8.5 8.5l4 4" stroke="#3d5a78" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          )}
        </div>
      </div>
      <div className="sm-right">
        <div className="sm-userpic">
          <div className="sm-userpic-frame">{pic ? <Icon name={pic} size={48} /> : <UserPicture name={s.userPicture} size={48} />}</div>
        </div>
        <div className="sm-links">
          {RIGHT.map((r, i) =>
            r.sep ? (
              <div key={i} className="sm-rsep" />
            ) : (
              <button
                key={r.id}
                className={`sm-link ${r.id === 'user' ? 'username' : ''}`}
                onPointerEnter={() => setPic(r.icon)}
                onPointerLeave={() => setPic(null)}
                onClick={() => {
                  ui.toggleStart(false);
                  r.action();
                }}
              >
                {r.id === 'user' ? s.username : r.id}
              </button>
            )
          )}
        </div>
        <div className="sm-power">
          <button className="sm-shutdown" onClick={() => doPower('shutdown')}>
            Shut down
          </button>
          <button className={`sm-shutdown-arrow ${shutMenu ? 'open' : ''}`} aria-label="Shut down options" onClick={() => setShutMenu(!shutMenu)}>
            <span />
          </button>
          {shutMenu && (
            <div className="w7-menu sm-power-menu">
              {[
                ['Switch user', 'switchUser'],
                ['Log off', 'logoff'],
                ['Lock', 'lock'],
                null,
                ['Restart', 'restart'],
                ['Sleep', 'sleep'],
              ].map((it, i) =>
                it ? (
                  <div key={it[1]} className="w7-menu-item" onClick={() => doPower(it[1])} onPointerEnter={(e) => e.currentTarget.classList.add('hot')} onPointerLeave={(e) => e.currentTarget.classList.remove('hot')}>
                    <span className="mi-label">{it[0]}</span>
                  </div>
                ) : (
                  <div key={i} className="w7-menu-sep" />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { fs };
