import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MenuBar } from '../system/MenuBar.jsx';
import { wm } from '../state/wm.js';
import { fs, fsStore, core } from '../state/fs.js';
import { settingsStore, setNested, addRecentFile } from '../state/settings.js';
import { useStore } from '../lib/store.js';
import { messageBox, fileDialog, openDialog } from '../system/dialogs.jsx';
import { launch } from '../system/shell.jsx';
import { Icon } from '../system/icons.jsx';

const TXT_FILTERS = [
  { label: 'Text Documents (*.txt)', ext: ['txt'] },
  { label: 'All Files (*.*)', ext: [] },
];

const FONTS = ['Lucida Console', 'Consolas', 'Courier New', 'Segoe UI', 'Arial', 'Times New Roman', 'Georgia', 'Verdana', 'Tahoma', 'Comic Sans MS'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

function FontDialog({ value, done }) {
  const [f, setF] = useState(value);
  return (
    <div className="np-fontdlg">
      <div className="np-font-cols">
        <label>
          Font:
          <select className="w7-select np-list" size={7} value={f.family} onChange={(e) => setF({ ...f, family: e.target.value })}>
            {FONTS.map((x) => (
              <option key={x} value={x} style={{ fontFamily: x }}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          Font style:
          <select
            className="w7-select np-list"
            size={7}
            value={(f.bold ? 'b' : '') + (f.italic ? 'i' : '') || 'r'}
            onChange={(e) => setF({ ...f, bold: e.target.value.includes('b'), italic: e.target.value.includes('i') })}
          >
            <option value="r">Regular</option>
            <option value="i">Italic</option>
            <option value="b">Bold</option>
            <option value="bi">Bold Italic</option>
          </select>
        </label>
        <label>
          Size:
          <select className="w7-select np-list" size={7} value={f.size} onChange={(e) => setF({ ...f, size: +e.target.value })}>
            {SIZES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="w7-group">
        <legend>Sample</legend>
        <div className="np-sample" style={{ fontFamily: f.family, fontSize: f.size * 1.333, fontWeight: f.bold ? 700 : 400, fontStyle: f.italic ? 'italic' : 'normal' }}>
          AaBbYyZz
        </div>
      </fieldset>
      <div className="props-buttons">
        <button className="w7-btn default" onClick={() => done(f)}>
          OK
        </button>
        <button className="w7-btn" onClick={() => done(null)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Notepad({ win, active }) {
  const ta = useRef(null);
  const opts = useStore(settingsStore, (s) => s.notepad);
  const [fileId, setFileId] = useState(win.props.fileId || null);
  const nodes = useStore(fsStore, (s) => s.nodes);
  const file = fileId ? nodes[fileId] : null;
  const [text, setText] = useState(() => (file && typeof file.content === 'string' && !file.content.startsWith('data:') ? file.content : ''));
  const [saved, setSaved] = useState(text);
  const [caret, setCaret] = useState({ ln: 1, col: 1 });
  const lastFind = useRef({ q: '', caseSensitive: false, down: true });
  const dirty = text !== saved;
  const name = file ? file.name : 'Untitled';

  useEffect(() => {
    wm.setTitle(win.id, `${core.baseOf(name)} - Notepad`);
  }, [name, win.id]);

  useEffect(() => {
    if (active) ta.current?.focus({ preventScroll: true });
  }, [active]);

  const saveTo = useCallback(
    async (asNew = false) => {
      if (fileId && nodes[fileId] && !asNew) {
        fs.write(fileId, text);
        setSaved(text);
        return true;
      }
      const res = await fileDialog({ mode: 'save', title: 'Save As', filters: TXT_FILTERS, defaultName: file ? file.name : '*.txt'.replace('*', 'Untitled'), startIn: file?.parent || 'documents', owner: win.id });
      if (!res) return false;
      let id = res.id;
      if (id) fs.write(id, text);
      else id = fs.create({ parent: res.parent, name: res.name, content: text });
      setFileId(id);
      setSaved(text);
      addRecentFile(id, 'notepad');
      return true;
    },
    [fileId, nodes, text, file, win.id]
  );

  const confirmDiscard = useCallback(async () => {
    if (!dirty) return true;
    const ans = await messageBox({
      title: 'Notepad',
      text: `Do you want to save changes to ${file ? fs.path(file.id) : 'Untitled'}?`,
      icon: null,
      buttons: ['Save', "Don't Save", 'Cancel'],
      owner: win.id,
    });
    if (ans === 'Save') return saveTo();
    return ans === "Don't Save";
  }, [dirty, file, saveTo, win.id]);

  useEffect(() => {
    wm.setGuard(win.id, confirmDiscard);
    return () => wm.setGuard(win.id, null);
  }, [win.id, confirmDiscard]);

  const updateCaret = () => {
    const el = ta.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const lines = before.split('\n');
    setCaret({ ln: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  const exec = (cmd) => {
    ta.current?.focus();
    document.execCommand(cmd);
  };

  const insert = (str) => {
    ta.current?.focus();
    if (!document.execCommand('insertText', false, str)) {
      const el = ta.current;
      const s = el.selectionStart;
      setText(el.value.slice(0, s) + str + el.value.slice(el.selectionEnd));
    }
  };

  const doNew = async () => {
    if (!(await confirmDiscard())) return;
    setFileId(null);
    setText('');
    setSaved('');
  };

  const doOpen = async () => {
    if (!(await confirmDiscard())) return;
    const id = await fileDialog({ mode: 'open', filters: TXT_FILTERS, startIn: file?.parent || 'documents', owner: win.id });
    if (!id) return;
    const n = fs.get(id);
    if (typeof n.content !== 'string' || n.content.startsWith('data:') || n.content.startsWith('asset:')) {
      // Binary-ish file: show garbage like the real Notepad would, but keep it short.
      const junk = 'ÿØÿà JFIF  ` `  ÿÛ C ' + '\u0000'.repeat(4) + '...';
      setText(junk);
      setSaved(junk);
    } else {
      setText(n.content);
      setSaved(n.content);
    }
    setFileId(id);
    addRecentFile(id, 'notepad');
  };

  const findNext = (q = lastFind.current.q, { caseSensitive = lastFind.current.caseSensitive, down = lastFind.current.down } = {}) => {
    if (!q) return false;
    const el = ta.current;
    const hay = caseSensitive ? el.value : el.value.toLowerCase();
    const needle = caseSensitive ? q : q.toLowerCase();
    const idx = down ? hay.indexOf(needle, el.selectionEnd) : hay.lastIndexOf(needle, Math.max(0, el.selectionStart - 1));
    if (idx < 0) {
      messageBox({ title: 'Notepad', text: `Cannot find "${q}"`, icon: 'info', owner: win.id });
      return false;
    }
    el.focus();
    el.setSelectionRange(idx, idx + q.length);
    const lineH = parseFloat(getComputedStyle(el).lineHeight) || 16;
    el.scrollTop = Math.max(0, el.value.slice(0, idx).split('\n').length * lineH - el.clientHeight / 2);
    updateCaret();
    return true;
  };

  const openFind = (replace = false) =>
    openDialog({
      title: replace ? 'Replace' : 'Find',
      owner: win.id,
      render: (done) => <FindForm replace={replace} initial={lastFind.current} done={done} onFind={(q, o) => { lastFind.current = { q, ...o }; findNext(q, o); }} onReplace={(q, r, o, all) => {
        lastFind.current = { q, ...o };
        const el = ta.current;
        if (all) {
          const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.caseSensitive ? 'g' : 'gi');
          el.focus();
          el.select();
          insert(el.value.replace(re, r));
          return;
        }
        const sel = el.value.slice(el.selectionStart, el.selectionEnd);
        if (sel && (o.caseSensitive ? sel === q : sel.toLowerCase() === q.toLowerCase())) insert(r);
        findNext(q, o);
      }} />,
    });

  const goTo = () =>
    openDialog({
      title: 'Go To Line',
      owner: win.id,
      render: (done) => <GoToForm max={text.split('\n').length} done={(n) => {
        done(null);
        if (!n) return;
        const lines = ta.current.value.split('\n');
        if (n > lines.length) return messageBox({ title: 'Notepad - Goto Line', text: 'The line number is beyond the total number of lines', icon: null, owner: win.id });
        const pos = lines.slice(0, n - 1).join('\n').length + (n > 1 ? 1 : 0);
        ta.current.focus();
        ta.current.setSelectionRange(pos, pos);
        updateCaret();
      }} />,
    });

  const chooseFont = async () => {
    const f = await openDialog({ title: 'Font', owner: win.id, render: (done) => <FontDialog value={opts.font} done={done} /> });
    if (f) setNested('notepad', { font: f });
  };

  const timeDate = () => insert(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString());

  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === 's') {
        e.preventDefault();
        saveTo(e.shiftKey);
      } else if (k === 'o') {
        e.preventDefault();
        doOpen();
      } else if (k === 'n') {
        e.preventDefault();
        doNew();
      } else if (k === 'f') {
        e.preventDefault();
        openFind(false);
      } else if (k === 'h') {
        e.preventDefault();
        openFind(true);
      } else if (k === 'g') {
        e.preventDefault();
        goTo();
      }
    } else if (e.key === 'F3') {
      e.preventDefault();
      findNext();
    } else if (e.key === 'F5') {
      e.preventDefault();
      timeDate();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      insert('\t');
    }
  };

  const menus = [
    {
      label: 'File',
      items: [
        { label: 'New', hint: 'Ctrl+N', onClick: doNew },
        { label: 'Open...', hint: 'Ctrl+O', onClick: doOpen },
        { label: 'Save', hint: 'Ctrl+S', onClick: () => saveTo() },
        { label: 'Save As...', onClick: () => saveTo(true) },
        { separator: true },
        { label: 'Page Setup...', disabled: true },
        { label: 'Print...', hint: 'Ctrl+P', onClick: () => window.print() },
        { separator: true },
        { label: 'Exit', onClick: () => wm.close(win.id) },
      ],
    },
    {
      label: 'Edit',
      items: () => [
        { label: 'Undo', hint: 'Ctrl+Z', onClick: () => exec('undo') },
        { separator: true },
        { label: 'Cut', hint: 'Ctrl+X', onClick: () => exec('cut') },
        { label: 'Copy', hint: 'Ctrl+C', onClick: () => exec('copy') },
        {
          label: 'Paste',
          hint: 'Ctrl+V',
          onClick: async () => {
            try {
              insert(await navigator.clipboard.readText());
            } catch {
              messageBox({ title: 'Notepad', text: 'Your browser blocked clipboard access.\nUse Ctrl+V to paste instead.', icon: 'info', owner: win.id });
            }
          },
        },
        { label: 'Delete', hint: 'Del', onClick: () => exec('delete') },
        { separator: true },
        { label: 'Find...', hint: 'Ctrl+F', onClick: () => openFind(false) },
        { label: 'Find Next', hint: 'F3', onClick: () => findNext() },
        { label: 'Replace...', hint: 'Ctrl+H', onClick: () => openFind(true) },
        { label: 'Go To...', hint: 'Ctrl+G', disabled: opts.wordWrap, onClick: goTo },
        { separator: true },
        {
          label: 'Select All',
          hint: 'Ctrl+A',
          onClick: () => {
            ta.current.focus();
            ta.current.select();
          },
        },
        { label: 'Time/Date', hint: 'F5', onClick: timeDate },
      ],
    },
    {
      label: 'Format',
      items: () => [
        { label: 'Word Wrap', checked: opts.wordWrap, onClick: () => setNested('notepad', { wordWrap: !opts.wordWrap }) },
        { label: 'Font...', onClick: chooseFont },
      ],
    },
    {
      label: 'View',
      items: () => [{ label: 'Status Bar', checked: opts.statusBar && !opts.wordWrap, disabled: opts.wordWrap, onClick: () => setNested('notepad', { statusBar: !opts.statusBar }) }],
    },
    {
      label: 'Help',
      items: [
        { label: 'View Help', onClick: () => launch('help', { topic: 'notepad' }) },
        { separator: true },
        { label: 'About Notepad', onClick: () => launch('winver', { product: 'Notepad' }) },
      ],
    },
  ];

  const f = opts.font;
  return (
    <div className="notepad">
      <MenuBar menus={menus} />
      <textarea
        ref={ta}
        className={`np-text w7-scroll ${opts.wordWrap ? 'wrap' : ''}`}
        spellCheck={false}
        value={text}
        wrap={opts.wordWrap ? 'soft' : 'off'}
        style={{ fontFamily: `"${f.family}", var(--mono)`, fontSize: f.size * 1.333, fontWeight: f.bold ? 700 : 400, fontStyle: f.italic ? 'italic' : 'normal' }}
        onChange={(e) => {
          setText(e.target.value);
          updateCaret();
        }}
        onKeyUp={updateCaret}
        onClick={updateCaret}
        onKeyDown={onKeyDown}
        aria-label="Text editor"
      />
      {opts.statusBar && !opts.wordWrap && (
        <div className="np-status">
          <span />
          <span className="np-status-pos">
            Ln {caret.ln}, Col {caret.col}
          </span>
        </div>
      )}
    </div>
  );
}

function FindForm({ replace, initial, onFind, onReplace, done }) {
  const [q, setQ] = useState(initial.q || '');
  const [r, setR] = useState('');
  const [caseSensitive, setCase] = useState(initial.caseSensitive);
  const [down, setDown] = useState(initial.down !== false);
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const o = { caseSensitive, down };
  return (
    <div className="np-find">
      <div className="np-find-fields">
        <label>
          <span>Find what:</span>
          <input ref={ref} className="w7-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && q && onFind(q, o)} />
        </label>
        {replace && (
          <label>
            <span>Replace with:</span>
            <input className="w7-input" value={r} onChange={(e) => setR(e.target.value)} />
          </label>
        )}
        <div className="np-find-opts">
          <label className="w7-label">
            <input type="checkbox" className="w7-check" checked={caseSensitive} onChange={(e) => setCase(e.target.checked)} />
            Match case
          </label>
          {!replace && (
            <fieldset className="w7-group np-dir">
              <legend>Direction</legend>
              <label className="w7-label">
                <input type="radio" className="w7-radio" checked={!down} onChange={() => setDown(false)} />
                Up
              </label>
              <label className="w7-label">
                <input type="radio" className="w7-radio" checked={down} onChange={() => setDown(true)} />
                Down
              </label>
            </fieldset>
          )}
        </div>
      </div>
      <div className="np-find-buttons">
        <button className="w7-btn default" disabled={!q} onClick={() => onFind(q, o)}>
          Find Next
        </button>
        {replace && (
          <>
            <button className="w7-btn" disabled={!q} onClick={() => onReplace(q, r, o, false)}>
              Replace
            </button>
            <button className="w7-btn" disabled={!q} onClick={() => onReplace(q, r, o, true)}>
              Replace All
            </button>
          </>
        )}
        <button className="w7-btn" onClick={() => done(null)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function GoToForm({ max, done }) {
  const [n, setN] = useState('1');
  return (
    <div className="np-goto">
      <label>
        Line number:
        <input className="w7-input" autoFocus value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && done(+n)} />
      </label>
      <div className="props-buttons">
        <button className="w7-btn default" onClick={() => done(+n)}>
          Go To
        </button>
        <button className="w7-btn" onClick={() => done(0)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export { Icon };
