import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.js';
import { wm, wmStore, getRegistry } from '../state/wm.js';
import { fs, core } from '../state/fs.js';
import { settingsStore } from '../state/settings.js';
import { Icon, Flag } from '../system/icons.jsx';
import { launch, openNode, openPath } from '../system/shell.jsx';
import { messageBox, fileDialog } from '../system/dialogs.jsx';

// ---------------------------------------------------------------------------
// Run dialog

const RUN_MAP = {
  notepad: ['notepad'],
  calc: ['calc'],
  mspaint: ['mspaint'],
  paint: ['mspaint'],
  cmd: ['cmd'],
  explorer: ['explorer', { path: 'lib:documents' }],
  iexplore: ['iexplore'],
  control: ['control'],
  'control panel': ['control'],
  winver: ['winver'],
  winmine: ['minesweeper'],
  minesweeper: ['minesweeper'],
  taskmgr: ['taskmgr'],
  desk: ['control', { page: 'display' }],
  'desk.cpl': ['control', { page: 'display' }],
  'sysdm.cpl': ['control', { page: 'system' }],
  'timedate.cpl': ['control', { page: 'datetime' }],
  'appwiz.cpl': ['control', { page: 'programs' }],
  'mmsys.cpl': ['control', { page: 'sound' }],
  help: ['help'],
};

export function RunDialog({ win }) {
  const [value, setValue] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('win7.run')) || '');
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const go = async () => {
    const v = value.trim();
    if (!v) return;
    try {
      localStorage.setItem('win7.run', v);
    } catch {
      /* ignore */
    }
    const key = v.toLowerCase().replace(/\.exe$/, '');
    if (RUN_MAP[key]) {
      launch(...RUN_MAP[key]);
      return wm.close(win.id);
    }
    if (/^(https?:\/\/|www\.)/i.test(v)) {
      launch('iexplore', { url: v });
      return wm.close(win.id);
    }
    const id = fs.resolve(v) || fs.resolve(`${fs.path('user')}\\${v}`);
    if (id) {
      core.isContainer(fs.get(id)) ? openPath(id) : openNode(id);
      return wm.close(win.id);
    }
    await messageBox({ title: v, text: `Windows cannot find '${v}'. Make sure you typed the name correctly, and then try again.`, icon: 'error', owner: win.id });
  };
  return (
    <div className="run w7-face">
      <div className="run-top">
        <Icon name="run" size={32} />
        <p>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</p>
      </div>
      <div className="run-row">
        <label htmlFor={`run-${win.id}`}>Open:</label>
        <input
          id={`run-${win.id}`}
          ref={ref}
          className="w7-input"
          list={`run-list-${win.id}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go();
            if (e.key === 'Escape') wm.close(win.id);
          }}
        />
        <datalist id={`run-list-${win.id}`}>
          {Object.keys(RUN_MAP).map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </div>
      <div className="run-admin">
        <Icon name="shield" size={16} /> This task will be created with administrative privileges.
      </div>
      <div className="run-buttons">
        <button className="w7-btn default" onClick={go} disabled={!value.trim()}>
          OK
        </button>
        <button className="w7-btn" onClick={() => wm.close(win.id)}>
          Cancel
        </button>
        <button
          className="w7-btn"
          onClick={async () => {
            const id = await fileDialog({ mode: 'open', title: 'Browse', owner: win.id, startIn: 'system32' });
            if (id) setValue(fs.path(id));
          }}
        >
          Browse...
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// About Windows

export function Winver({ win }) {
  const s = useStore(settingsStore);
  const product = win.props.product;
  useEffect(() => wm.setTitle(win.id, product ? `About ${product}` : 'About Windows'), [product, win.id]);
  return (
    <div className="winver w7-face">
      <div className="winver-banner">
        <svg width="54" height="54" viewBox="-2 -1 22 22">
          <Flag />
        </svg>
        <span className="winver-name">Windows</span>
        <span className="winver-7">7</span>
        <span className="winver-ed">Ultimate</span>
      </div>
      <div className="winver-body">
        <p>
          {product ? `${product} for ` : ''}Windows 7 Ultimate &mdash; web simulator
          <br />
          Version 6.1 (Build 7601: Service Pack 1)
        </p>
        <p>
          This is a fan-made recreation that runs entirely in your browser. It is not affiliated with, endorsed by, or connected to Microsoft. All icons, wallpapers
          and sounds in this simulator are original artwork.
        </p>
        <p className="winver-lic">
          This product is used by:
          <br />
          <b>&nbsp;&nbsp;&nbsp;&nbsp;{s.username}</b>
        </p>
      </div>
      <div className="winver-buttons">
        <button className="w7-btn default" onClick={() => wm.close(win.id)} autoFocus>
          OK
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task Manager

function Graph({ data, color = '#00ff00', max = 100 }) {
  const w = 200;
  const h = 80;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg className="tm-graph" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {Array.from({ length: 8 }, (_, i) => (
        <line key={'h' + i} x1="0" x2={w} y1={(i * h) / 8} y2={(i * h) / 8} stroke="#008040" strokeWidth="0.5" />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <line key={'v' + i} y1="0" y2={h} x1={(i * w) / 12} x2={(i * w) / 12} stroke="#008040" strokeWidth="0.5" />
      ))}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function TaskManager({ win }) {
  const windows = useStore(wmStore, (s) => s.windows);
  const [tab, setTab] = useState('apps');
  const [sel, setSel] = useState(null);
  const [cpu, setCpu] = useState(() => Array(40).fill(2));
  const [mem, setMem] = useState(() => Array(40).fill(30));
  const reg = getRegistry();
  const apps = windows.filter((w) => !w.dialog && !w.closing);

  useEffect(() => {
    let last = performance.now();
    let frames = 0;
    let raf;
    const loop = () => {
      frames++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const t = setInterval(() => {
      const now = performance.now();
      const fps = (frames * 1000) / (now - last);
      frames = 0;
      last = now;
      // Approximate "CPU" from how far below 60fps we are, plus a little noise.
      const load = Math.max(1, Math.min(100, Math.round((1 - Math.min(fps, 60) / 60) * 100 + 2 + Math.random() * 6 + apps.length)));
      setCpu((c) => [...c.slice(1), load]);
      const pm = performance.memory;
      const m = pm ? Math.round((pm.usedJSHeapSize / pm.jsHeapSizeLimit) * 100) + 25 : 30 + apps.length * 2 + Math.random() * 2;
      setMem((x) => [...x.slice(1), Math.min(100, m)]);
    }, 1000);
    return () => {
      clearInterval(t);
      cancelAnimationFrame(raf);
    };
  }, [apps.length]);

  const procs = [
    ['System Idle Process', 'SYSTEM', 100 - cpu[cpu.length - 1], 24],
    ['System', 'SYSTEM', 0, 1084],
    ['csrss.exe', 'SYSTEM', 0, 1312],
    ['dwm.exe', settingsStore.get().username, 1, 22480],
    ['explorer.exe', settingsStore.get().username, 1, 38212],
    ...apps.map((w, i) => [`${w.app}.exe`, settingsStore.get().username, i === 0 ? Math.max(0, cpu[cpu.length - 1] - 3) : 0, 6000 + w.app.length * 2311]),
    ['taskhost.exe', settingsStore.get().username, 0, 4120],
    ['svchost.exe', 'NETWORK SERVICE', 0, 9632],
  ];

  return (
    <div className="taskmgr w7-face">
      <div className="w7-tabs tm-tabs">
        {[
          ['apps', 'Applications'],
          ['procs', 'Processes'],
          ['perf', 'Performance'],
        ].map(([k, l]) => (
          <button key={k} className={`w7-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="w7-tabpanel tm-panel">
        {tab === 'apps' && (
          <>
            <div className="tm-list w7-scroll">
              <div className="tm-head">
                <span>Task</span>
                <span>Status</span>
              </div>
              {apps.map((w) => (
                <div key={w.id} className={`tm-row ${sel === w.id ? 'sel' : ''}`} onClick={() => setSel(w.id)} onDoubleClick={() => wm.restore(w.id)}>
                  <span>
                    <Icon name={w.icon} size={16} /> {w.title}
                  </span>
                  <span>Running</span>
                </div>
              ))}
            </div>
            <div className="tm-buttons">
              <button className="w7-btn" disabled={!sel} onClick={() => sel && wm.close(sel, true)}>
                End Task
              </button>
              <button className="w7-btn" disabled={!sel} onClick={() => sel && wm.restore(sel)}>
                Switch To
              </button>
              <button className="w7-btn" onClick={() => launch('run')}>
                New Task...
              </button>
            </div>
          </>
        )}
        {tab === 'procs' && (
          <div className="tm-list w7-scroll">
            <div className="tm-head four">
              <span>Image Name</span>
              <span>User Name</span>
              <span>CPU</span>
              <span>Memory</span>
            </div>
            {procs.map(([n, u, c, m], i) => (
              <div key={i} className="tm-row four">
                <span>{n}</span>
                <span>{u}</span>
                <span>{String(c).padStart(2, '0')}</span>
                <span>{m.toLocaleString()} K</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'perf' && (
          <div className="tm-perf">
            <div className="tm-gauge">
              <div className="tm-label">CPU Usage</div>
              <div className="tm-meter">{cpu[cpu.length - 1]} %</div>
            </div>
            <div className="tm-gauge wide">
              <div className="tm-label">CPU Usage History</div>
              <Graph data={cpu} />
            </div>
            <div className="tm-gauge">
              <div className="tm-label">Memory</div>
              <div className="tm-meter">{Math.round(mem[mem.length - 1])} %</div>
            </div>
            <div className="tm-gauge wide">
              <div className="tm-label">Physical Memory Usage History</div>
              <Graph data={mem} color="#ffff00" />
            </div>
          </div>
        )}
      </div>
      <div className="tm-status">
        <span>Processes: {procs.length}</span>
        <span>CPU Usage: {cpu[cpu.length - 1]}%</span>
        <span>Physical Memory: {Math.round(mem[mem.length - 1])}%</span>
      </div>
      {!reg && <span />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Help and Support (original text describing this simulator)

const TOPICS = {
  start: {
    title: 'Getting started with your desktop',
    body: (
      <>
        <p>Welcome! This simulator recreates the look and feel of the Windows 7 Ultimate desktop in a web page. Everything you do is saved in this browser.</p>
        <h3>Opening programs</h3>
        <p>Click the round Start button in the lower-left corner, then click a program. You can also double-click (or double-tap) icons on the desktop.</p>
        <h3>Working with windows</h3>
        <ul>
          <li>Drag a title bar to move a window. Drag any edge or corner to resize it.</li>
          <li>Drag a window to the top of the screen to maximize it, or to the left or right edge to make it fill half the screen.</li>
          <li>Double-click a title bar to maximize or restore.</li>
          <li>Point to a taskbar button to see a preview; point at a preview to peek at that window.</li>
          <li>Point to the small rectangle at the far right of the taskbar to see through all windows; click it to show the desktop.</li>
        </ul>
        <h3>Files and folders</h3>
        <p>Use Windows Explorer to create folders and text files, rename them (F2), move them by dragging, and delete them to the Recycle Bin. You can drag real files from your computer onto the desktop or into an Explorer window to copy them in.</p>
      </>
    ),
  },
  touch: {
    title: 'Using a touch screen',
    body: (
      <ul>
        <li>Tap to select, double-tap to open.</li>
        <li>Press and hold to open a shortcut menu (same as right-clicking).</li>
        <li>On small screens, programs open maximized automatically.</li>
        <li>In Minesweeper, press and hold a tile to place a flag.</li>
      </ul>
    ),
  },
  keys: {
    title: 'Keyboard shortcuts',
    body: (
      <table className="help-table">
        <tbody>
          {[
            ['Windows logo key or Ctrl+Esc', 'Open or close the Start menu'],
            ['Alt+Shift+R', 'Open the Run dialog box'],
            ['Windows logo key + D', 'Show the desktop'],
            ['Windows logo key + Arrow keys', 'Maximize, minimize or snap the active window'],
            ['F2', 'Rename the selected item'],
            ['Delete', 'Move the selected item to the Recycle Bin'],
            ['Ctrl+C / Ctrl+X / Ctrl+V', 'Copy, cut and paste files'],
            ['Backspace', 'Go back in Explorer'],
            ['F2 / F4 / F5 (Minesweeper)', 'New game / Statistics / Options'],
          ].map(([k, v]) => (
            <tr key={k}>
              <td>
                <b>{k}</b>
              </td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
  storage: {
    title: 'Where are my files saved?',
    body: (
      <>
        <p>Your files, desktop arrangement and settings are stored in this browser&rsquo;s local storage. They stay on this device and are not uploaded anywhere.</p>
        <p>Browsers limit local storage to a few megabytes, so very large pictures may not fit. To keep a copy, open Control Panel &gt; System and Security &gt; Backup and Restore and click &ldquo;Back up now&rdquo;.</p>
      </>
    ),
  },
  notepad: { title: 'Using Notepad', body: <p>Notepad is a basic text editor. Use File &gt; Save to store a document in your Documents folder. Format &gt; Word Wrap wraps long lines, and Edit &gt; Find searches the text.</p> },
  calc: { title: 'Using Calculator', body: <p>Click the buttons or type with your keyboard. Use View &gt; Scientific for trigonometry, powers and parentheses. MS, MR, M+ and M- work with the memory.</p> },
  minesweeper: { title: 'How to play Minesweeper', body: <p>Uncover every square that doesn&rsquo;t hide a mine. A number tells you how many mines touch that square. Right-click (or press and hold) to flag a square you think hides a mine. Click a number whose mines are all flagged to uncover its neighbors.</p> },
  explorer: { title: 'Working with files and folders', body: <p>Use the navigation pane on the left to jump between libraries and drives. Change how items are shown with the Views button. Type in the search box to find files in the current folder and its subfolders.</p> },
  iexplore: { title: 'Browsing the web', body: <p>Type an address or a search term in the address bar and press Enter. Note that many websites refuse to be displayed inside another page; use Tools &gt; Open in real browser for those.</p> },
};

export function Help({ win }) {
  const [topic, setTopic] = useState(win.props.topic && TOPICS[win.props.topic] ? win.props.topic : 'start');
  const [q, setQ] = useState('');
  useEffect(() => {
    if (win.props._t && win.props.topic && TOPICS[win.props.topic]) setTopic(win.props.topic);
  }, [win.props._t, win.props.topic]);
  useEffect(() => wm.setTitle(win.id, win.app === 'getstarted' ? 'Getting Started' : 'Windows Help and Support'), [win.app, win.id]);
  const results = q.trim() ? Object.entries(TOPICS).filter(([, t]) => t.title.toLowerCase().includes(q.toLowerCase())) : null;
  return (
    <div className="help">
      <div className="help-top">
        <button className="ex-round back" aria-label="Home" onClick={() => setTopic('start')}>
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M12 7H3M7 2.5L2.5 7 7 11.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input className="w7-input help-search" placeholder="Search Help" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search Help" />
      </div>
      <div className="help-body">
        <div className="help-nav">
          {Object.entries(TOPICS).map(([k, t]) => (
            <a key={k} className={k === topic ? 'current' : ''} onClick={() => setTopic(k)}>
              {t.title}
            </a>
          ))}
        </div>
        <div className="help-content w7-scroll">
          {results ? (
            <>
              <h1>Search results</h1>
              {results.length ? (
                results.map(([k, t]) => (
                  <p key={k}>
                    <a
                      onClick={() => {
                        setTopic(k);
                        setQ('');
                      }}
                    >
                      {t.title}
                    </a>
                  </p>
                ))
              ) : (
                <p>No results.</p>
              )}
            </>
          ) : (
            <>
              <h1>{TOPICS[topic].title}</h1>
              {TOPICS[topic].body}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
