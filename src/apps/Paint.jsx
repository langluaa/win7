import React, { useCallback, useEffect, useRef, useState } from 'react';
import { wm, ui } from '../state/wm.js';
import { fs, core, resolveAsset } from '../state/fs.js';
import { setSettings, addRecentFile } from '../state/settings.js';
import { messageBox, fileDialog, openDialog } from '../system/dialogs.jsx';
import { launch } from '../system/shell.jsx';
import { Icon } from '../system/icons.jsx';
import { trackDrag } from '../lib/pointer.js';

const PALETTE = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
];
const SIZES = [1, 3, 5, 8];
const IMG_FILTERS = [
  { label: 'PNG (*.png)', ext: ['png'] },
  { label: 'JPEG (*.jpg;*.jpeg)', ext: ['jpg', 'jpeg'] },
  { label: 'All Picture Files', ext: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'svg', 'webp'] },
];

// Normalised polygon outlines for the Shapes gallery (0..1 box)
const POLY = {
  triangle: [[0.5, 0], [1, 1], [0, 1]],
  rtriangle: [[0, 0], [1, 1], [0, 1]],
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  pentagon: [[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]],
  hexagon: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  arrowR: [[0, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0, 0.75]],
  arrowL: [[1, 0.25], [0.4, 0.25], [0.4, 0], [0, 0.5], [0.4, 1], [0.4, 0.75], [1, 0.75]],
  arrowU: [[0.25, 1], [0.25, 0.4], [0, 0.4], [0.5, 0], [1, 0.4], [0.75, 0.4], [0.75, 1]],
  arrowD: [[0.25, 0], [0.25, 0.6], [0, 0.6], [0.5, 1], [1, 0.6], [0.75, 0.6], [0.75, 0]],
  lightning: [[0.38, 0], [0.7, 0.32], [0.55, 0.38], [0.88, 0.7], [0.72, 0.75], [1, 1], [0.45, 0.8], [0.6, 0.74], [0.15, 0.48], [0.32, 0.42], [0, 0.18]],
};
const star = (n, inner = 0.45) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? inner / 2 : 0.5;
    const a = (Math.PI * i) / n - Math.PI / 2;
    return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)];
  });
POLY.star4 = star(4, 0.38);
POLY.star5 = star(5, 0.4);
POLY.star6 = star(6, 0.55);

const SHAPES = ['line', 'oval', 'rect', 'roundrect', 'triangle', 'rtriangle', 'diamond', 'pentagon', 'hexagon', 'arrowR', 'arrowL', 'arrowU', 'arrowD', 'star4', 'star5', 'star6', 'callout', 'heart', 'lightning'];

function shapePath(shape, x, y, w, h) {
  const p = new Path2D();
  if (shape === 'rect') p.rect(x, y, w, h);
  else if (shape === 'roundrect') {
    const r = Math.min(Math.abs(w), Math.abs(h)) * 0.18;
    p.roundRect ? p.roundRect(x, y, w, h, r) : p.rect(x, y, w, h);
  } else if (shape === 'oval') p.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
  else if (shape === 'heart') {
    p.moveTo(x + w / 2, y + h * 0.25);
    p.bezierCurveTo(x + w / 2, y, x, y, x, y + h * 0.3);
    p.bezierCurveTo(x, y + h * 0.6, x + w / 2, y + h * 0.75, x + w / 2, y + h);
    p.bezierCurveTo(x + w / 2, y + h * 0.75, x + w, y + h * 0.6, x + w, y + h * 0.3);
    p.bezierCurveTo(x + w, y, x + w / 2, y, x + w / 2, y + h * 0.25);
  } else if (shape === 'callout') {
    const r = Math.min(Math.abs(w), Math.abs(h)) * 0.15;
    const bh = h * 0.75;
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);
    p.quadraticCurveTo(x + w, y, x + w, y + r);
    p.lineTo(x + w, y + bh - r);
    p.quadraticCurveTo(x + w, y + bh, x + w - r, y + bh);
    p.lineTo(x + w * 0.42, y + bh);
    p.lineTo(x + w * 0.2, y + h);
    p.lineTo(x + w * 0.26, y + bh);
    p.lineTo(x + r, y + bh);
    p.quadraticCurveTo(x, y + bh, x, y + bh - r);
    p.lineTo(x, y + r);
    p.quadraticCurveTo(x, y, x + r, y);
  } else if (POLY[shape]) {
    POLY[shape].forEach(([px, py], i) => (i ? p.lineTo(x + px * w, y + py * h) : p.moveTo(x + px * w, y + py * h)));
  }
  p.closePath();
  return p;
}

function ShapeGlyph({ shape }) {
  if (shape === 'line')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M2 14L14 2" stroke="#1e3287" strokeWidth="1.3" />
      </svg>
    );
  const d = (() => {
    if (shape === 'rect') return 'M2 3h12v10H2z';
    if (shape === 'roundrect') return 'M5 3h6a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z';
    if (shape === 'oval') return 'M8 3c3.3 0 6 2.2 6 5s-2.7 5-6 5-6-2.2-6-5 2.7-5 6-5z';
    if (shape === 'heart') return 'M8 5C8 2 2 2 2 6c0 3 6 6 6 8 0-2 6-5 6-8 0-4-6-4-6-1z';
    if (shape === 'callout') return 'M3 2h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7l-3 3v-3H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z';
    return POLY[shape].map(([x, y], i) => `${i ? 'L' : 'M'}${(2 + x * 12).toFixed(1)} ${(2 + y * 12).toFixed(1)}`).join('') + 'z';
  })();
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d={d} fill="none" stroke="#1e3287" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

// Tool glyphs (small original SVG icons for the ribbon)
const G = {
  pencil: <path d="M3 13l1-3 7-7 2 2-7 7zM3 13l3-1" fill="#f5c33b" stroke="#6d5512" strokeWidth=".8" />,
  fill: (
    <>
      <path d="M3 8l5-5 5 5-5 5z" fill="#d7dde3" stroke="#4a5a6c" strokeWidth=".9" />
      <path d="M13 9c1 1.5 1.5 2.5 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.7.5-1.7 1.5-3.2z" fill="#2b86e0" />
    </>
  ),
  text: <path d="M3 3h10v2.5h-1L11.5 4.5H9v8h1.5v1h-5v-1H7v-8H4.5L4 5.5H3z" fill="#1e3287" />,
  eraser: (
    <>
      <path d="M2 10l6-6 6 6-3 3H5z" fill="#ffaec9" stroke="#a5596f" strokeWidth=".8" />
      <path d="M5 13l-3-3 3-3 6 6z" fill="#fff" stroke="#a5596f" strokeWidth=".8" />
    </>
  ),
  picker: (
    <>
      <path d="M3 13l6-6 2 2-6 6H3z" fill="#e3eef8" stroke="#4a5a6c" strokeWidth=".8" />
      <path d="M9 5l2-2 2 2-2 2z" fill="#4a5a6c" />
    </>
  ),
  magnifier: (
    <>
      <circle cx="6.5" cy="6.5" r="4" fill="#dff2ff" stroke="#3d5a78" strokeWidth="1.4" />
      <path d="M9.5 9.5l4.5 4.5" stroke="#3d5a78" strokeWidth="2" />
    </>
  ),
  select: <path d="M2 2h12v12H2z" fill="none" stroke="#1e3287" strokeDasharray="2 1.5" />,
  crop: <path d="M4 1v11h11M1 4h11v11" fill="none" stroke="#1e3287" strokeWidth="1.4" />,
  resize: (
    <>
      <rect x="1.5" y="5.5" width="7" height="9" fill="#fff" stroke="#4a5a6c" />
      <rect x="5.5" y="1.5" width="9" height="11" fill="none" stroke="#1e3287" strokeDasharray="2 1" />
    </>
  ),
  rotate: (
    <>
      <path d="M3 9a5 5 0 1 0 2-5" fill="none" stroke="#1e3287" strokeWidth="1.5" />
      <path d="M3 1v4h4z" fill="#1e3287" />
    </>
  ),
  cut: (
    <>
      <circle cx="4.5" cy="12" r="2" fill="none" stroke="#4a5a6c" strokeWidth="1.2" />
      <circle cx="11.5" cy="12" r="2" fill="none" stroke="#4a5a6c" strokeWidth="1.2" />
      <path d="M5.5 10.5L11 2M10.5 10.5L5 2" stroke="#4a5a6c" strokeWidth="1.2" />
    </>
  ),
  copy: (
    <>
      <path d="M2.5 2.5h6l2 2v7h-8z" fill="#fff" stroke="#4a5a6c" />
      <path d="M5.5 5.5h6l2 2v7h-8z" fill="#fff" stroke="#4a5a6c" />
    </>
  ),
  brush: (
    <>
      <path d="M13 2L7 9" stroke="#a3713a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 9c-2 0-3 1.5-3.5 3.5C3 14 2 14.5 1.5 14.5 4 15 7.5 14 7.8 11.4z" fill="#2b86e0" />
    </>
  ),
  outline: <rect x="2" y="3" width="12" height="10" fill="none" stroke="#1e3287" strokeWidth="1.8" />,
  fillshape: <rect x="2" y="3" width="12" height="10" fill="#7092be" stroke="#1e3287" />,
  size: (
    <>
      <path d="M2 4h12" stroke="#000" strokeWidth="1" />
      <path d="M2 8h12" stroke="#000" strokeWidth="2" />
      <path d="M2 12.5h12" stroke="#000" strokeWidth="3" />
    </>
  ),
  zoomin: (
    <>
      <circle cx="6.5" cy="6.5" r="4.5" fill="#fff" stroke="#3d5a78" strokeWidth="1.3" />
      <path d="M10 10l4.5 4.5M4.5 6.5h4M6.5 4.5v4" stroke="#3d5a78" strokeWidth="1.5" />
    </>
  ),
  zoomout: (
    <>
      <circle cx="6.5" cy="6.5" r="4.5" fill="#fff" stroke="#3d5a78" strokeWidth="1.3" />
      <path d="M10 10l4.5 4.5M4.5 6.5h4" stroke="#3d5a78" strokeWidth="1.5" />
    </>
  ),
  grid: <path d="M1.5 1.5h13v13h-13zM6 1.5v13M10.5 1.5v13M1.5 6h13M1.5 10.5h13" fill="none" stroke="#4a5a6c" strokeWidth=".8" />,
  fullscreen: <path d="M1.5 5V1.5H5M11 1.5h3.5V5M14.5 11v3.5H11M5 14.5H1.5V11" fill="none" stroke="#1e3287" strokeWidth="1.5" />,
  undo: <path d="M5 3L1.5 6.5 5 10M2 6.5h7a4 4 0 0 1 0 8H7" fill="none" stroke="#1e3287" strokeWidth="1.6" />,
  redo: <path d="M11 3l3.5 3.5L11 10M14 6.5H7a4 4 0 0 0 0 8h2" fill="none" stroke="#1e3287" strokeWidth="1.6" />,
  save: (
    <>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" fill="#4a7ec0" stroke="#1e3287" />
      <rect x="4" y="2" width="8" height="5" fill="#fff" />
      <rect x="4.5" y="10" width="7" height="4.5" fill="#d7dde3" />
    </>
  ),
};
const Glyph = ({ g, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    {G[g]}
  </svg>
);

function RibbonBtn({ g, label, active, onClick, big, disabled, title, dropdown }) {
  return (
    <button className={`rb-btn ${big ? 'big' : ''} ${active ? 'active' : ''}`} onClick={onClick} disabled={disabled} title={title || label}>
      {big ? <Glyph g={g} size={32} /> : <Glyph g={g} />}
      {label && <span>{label}</span>}
      {dropdown && <span className="rb-dd">▾</span>}
    </button>
  );
}

function floodFill(ctx, x, y, rgba) {
  const { width: w, height: h } = ctx.canvas;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const img = ctx.getImageData(0, 0, w, h);
  const data = new Uint32Array(img.data.buffer);
  const target = data[y * w + x];
  const fill = (rgba[3] << 24) | (rgba[2] << 16) | (rgba[1] << 8) | rgba[0];
  if (target === fill >>> 0 || target === fill) return;
  const stack = [[x, y]];
  while (stack.length) {
    let [cx, cy] = stack.pop();
    let i = cy * w + cx;
    while (cx >= 0 && data[i] === target) {
      cx--;
      i--;
    }
    cx++;
    i++;
    let up = false;
    let down = false;
    while (cx < w && data[i] === target) {
      data[i] = fill;
      if (cy > 0) {
        if (data[i - w] === target) {
          if (!up) {
            stack.push([cx, cy - 1]);
            up = true;
          }
        } else up = false;
      }
      if (cy < h - 1) {
        if (data[i + w] === target) {
          if (!down) {
            stack.push([cx, cy + 1]);
            down = true;
          }
        } else down = false;
      }
      cx++;
      i++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const hexToRgba = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
};
const toHex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');

function ResizeDialog({ w, h, done }) {
  const [by, setBy] = useState('percent');
  const [keep, setKeep] = useState(true);
  const [hv, setHv] = useState(100);
  const [vv, setVv] = useState(100);
  const setH = (v) => {
    setHv(v);
    if (keep) setVv(by === 'percent' ? v : Math.round((v * h) / w));
  };
  const setV = (v) => {
    setVv(v);
    if (keep) setHv(by === 'percent' ? v : Math.round((v * w) / h));
  };
  return (
    <div className="pt-dialog">
      <fieldset className="w7-group">
        <legend>Resize</legend>
        <div className="cp-row">
          By:
          <label className="w7-label">
            <input
              type="radio"
              className="w7-radio"
              checked={by === 'percent'}
              onChange={() => {
                setBy('percent');
                setHv(100);
                setVv(100);
              }}
            />
            Percentage
          </label>
          <label className="w7-label">
            <input
              type="radio"
              className="w7-radio"
              checked={by === 'px'}
              onChange={() => {
                setBy('px');
                setHv(w);
                setVv(h);
              }}
            />
            Pixels
          </label>
        </div>
        <div className="cp-row">
          <label style={{ width: 70 }}>Horizontal:</label>
          <input className="w7-input" style={{ width: 70 }} value={hv} onChange={(e) => setH(+e.target.value.replace(/\D/g, '') || 0)} />
        </div>
        <div className="cp-row">
          <label style={{ width: 70 }}>Vertical:</label>
          <input className="w7-input" style={{ width: 70 }} value={vv} onChange={(e) => setV(+e.target.value.replace(/\D/g, '') || 0)} />
        </div>
        <label className="w7-label">
          <input type="checkbox" className="w7-check" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Maintain aspect ratio
        </label>
      </fieldset>
      <div className="props-buttons">
        <button className="w7-btn default" onClick={() => done(by === 'percent' ? { w: Math.round((w * hv) / 100), h: Math.round((h * vv) / 100) } : { w: hv, h: vv })}>
          OK
        </button>
        <button className="w7-btn" onClick={() => done(null)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Paint({ win, active }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const wrapRef = useRef(null);
  const [tab, setTab] = useState('home');
  const [tool, setTool] = useState('pencil');
  const [prevTool, setPrevTool] = useState('pencil');
  const [shape, setShape] = useState(null);
  const [brush, setBrush] = useState('brush');
  const [outline, setOutline] = useState(true);
  const [fillShape, setFillShape] = useState(false);
  const [size, setSize] = useState(1);
  const [colors, setColors] = useState(['#000000', '#ffffff']);
  const [activeColor, setActiveColor] = useState(0);
  const [custom, setCustom] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [dims, setDims] = useState({ w: 800, h: 560 });
  const [pos, setPos] = useState(null);
  const [sel, setSel] = useState(null); // {x,y,w,h,float?:canvas}
  const [text, setText] = useState(null); // {x,y,value}
  const [fileId, setFileId] = useState(win.props.fileId || null);
  const [dirty, setDirty] = useState(false);
  const [grid, setGrid] = useState(false);
  const [statusBar, setStatusBar] = useState(true);
  const [fileMenu, setFileMenu] = useState(false);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [, force] = useState(0);
  const clip = useRef(null);
  const fileName = fileId && fs.get(fileId) ? fs.get(fileId).name : 'Untitled';

  useEffect(() => wm.setTitle(win.id, `${core.baseOf(fileName)} - Paint`), [fileName, win.id]);

  const ctx = () => canvasRef.current.getContext('2d', { willReadFrequently: true });

  const snapshot = useCallback(() => {
    const c = canvasRef.current;
    undoStack.current.push({ data: ctx().getImageData(0, 0, c.width, c.height), w: c.width, h: c.height });
    if (undoStack.current.length > 40) undoStack.current.shift();
    redoStack.current = [];
    setDirty(true);
    force((x) => x + 1);
  }, []);

  const restore = (entry) => {
    const c = canvasRef.current;
    c.width = entry.w;
    c.height = entry.h;
    ctx().putImageData(entry.data, 0, 0);
    setDims({ w: entry.w, h: entry.h });
  };

  const undo = () => {
    commitSelection();
    const e = undoStack.current.pop();
    if (!e) return;
    const c = canvasRef.current;
    redoStack.current.push({ data: ctx().getImageData(0, 0, c.width, c.height), w: c.width, h: c.height });
    restore(e);
    force((x) => x + 1);
  };
  const redo = () => {
    const e = redoStack.current.pop();
    if (!e) return;
    const c = canvasRef.current;
    undoStack.current.push({ data: ctx().getImageData(0, 0, c.width, c.height), w: c.width, h: c.height });
    restore(e);
    force((x) => x + 1);
  };

  const loadImage = useCallback((src) => {
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = Math.max(1, Math.min(4000, img.naturalWidth || 800));
      c.height = Math.max(1, Math.min(4000, img.naturalHeight || 600));
      const g = ctx();
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      setDims({ w: c.width, h: c.height });
      undoStack.current = [];
      redoStack.current = [];
      setDirty(false);
    };
    img.onerror = () => messageBox({ title: 'Paint', text: 'Paint cannot read this file.\nThis is not a valid bitmap file, or its format is not currently supported.', icon: 'error', owner: win.id });
    img.src = src;
  }, [win.id]);

  // init
  useEffect(() => {
    const c = canvasRef.current;
    const vw = window.innerWidth;
    const w = vw < 700 ? Math.max(300, vw - 40) : 800;
    const h = vw < 700 ? 400 : 560;
    c.width = w;
    c.height = h;
    const g = ctx();
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    setDims({ w, h });
    if (win.props.fileId) {
      const n = fs.get(win.props.fileId);
      if (n?.content) loadImage(resolveAsset(n.content));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ selection helpers
  const commitSelection = useCallback(() => {
    setSel((s) => {
      if (s?.float) {
        ctx().drawImage(s.float, s.x, s.y);
        setDirty(true);
      }
      return null;
    });
  }, []);

  const liftSelection = (s) => {
    if (s.float) return s;
    snapshot();
    const f = document.createElement('canvas');
    f.width = s.w;
    f.height = s.h;
    f.getContext('2d').drawImage(canvasRef.current, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
    const g = ctx();
    g.fillStyle = colors[1];
    g.fillRect(s.x, s.y, s.w, s.h);
    return { ...s, float: f };
  };

  useEffect(() => {
    // Draw floating selection preview
    const o = overlayRef.current;
    if (!o) return;
    o.width = dims.w;
    o.height = dims.h;
    const g = o.getContext('2d');
    g.clearRect(0, 0, o.width, o.height);
    if (sel?.float) g.drawImage(sel.float, sel.x, sel.y);
  }, [sel, dims]);

  const deleteSelection = () => {
    if (!sel) return;
    if (sel.float) {
      setSel(null);
      return;
    }
    snapshot();
    const g = ctx();
    g.fillStyle = colors[1];
    g.fillRect(sel.x, sel.y, sel.w, sel.h);
    setSel(null);
  };

  const copySelection = (cut = false) => {
    if (!sel) return;
    const f = document.createElement('canvas');
    f.width = sel.w;
    f.height = sel.h;
    if (sel.float) f.getContext('2d').drawImage(sel.float, 0, 0);
    else f.getContext('2d').drawImage(canvasRef.current, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
    clip.current = f;
    try {
      f.toBlob((b) => b && navigator.clipboard?.write?.([new window.ClipboardItem({ 'image/png': b })]).catch(() => {}));
    } catch {
      /* ignore */
    }
    if (cut) deleteSelection();
    force((x) => x + 1);
  };

  const paste = () => {
    if (!clip.current) return;
    commitSelection();
    snapshot();
    const f = document.createElement('canvas');
    f.width = clip.current.width;
    f.height = clip.current.height;
    f.getContext('2d').drawImage(clip.current, 0, 0);
    if (f.width > dims.w || f.height > dims.h) {
      const c = canvasRef.current;
      const data = ctx().getImageData(0, 0, c.width, c.height);
      c.width = Math.max(c.width, f.width);
      c.height = Math.max(c.height, f.height);
      const g = ctx();
      g.fillStyle = colors[1];
      g.fillRect(0, 0, c.width, c.height);
      g.putImageData(data, 0, 0);
      setDims({ w: c.width, h: c.height });
    }
    setTool('select');
    setSel({ x: 0, y: 0, w: f.width, h: f.height, float: f });
  };

  const crop = () => {
    if (!sel) return;
    snapshot();
    const s = sel.float ? sel : { ...sel, float: null };
    const f = document.createElement('canvas');
    f.width = s.w;
    f.height = s.h;
    if (s.float) f.getContext('2d').drawImage(s.float, 0, 0);
    else f.getContext('2d').drawImage(canvasRef.current, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
    const c = canvasRef.current;
    c.width = s.w;
    c.height = s.h;
    ctx().drawImage(f, 0, 0);
    setDims({ w: s.w, h: s.h });
    setSel(null);
  };

  const transform = (kind) => {
    commitSelection();
    snapshot();
    const c = canvasRef.current;
    const src = document.createElement('canvas');
    src.width = c.width;
    src.height = c.height;
    src.getContext('2d').drawImage(c, 0, 0);
    const rotate90 = kind === 'right' || kind === 'left';
    if (rotate90) {
      c.width = src.height;
      c.height = src.width;
    }
    const g = ctx();
    g.save();
    if (kind === 'right') {
      g.translate(c.width, 0);
      g.rotate(Math.PI / 2);
    } else if (kind === 'left') {
      g.translate(0, c.height);
      g.rotate(-Math.PI / 2);
    } else if (kind === '180') {
      g.translate(c.width, c.height);
      g.rotate(Math.PI);
    } else if (kind === 'flipH') {
      g.translate(c.width, 0);
      g.scale(-1, 1);
    } else if (kind === 'flipV') {
      g.translate(0, c.height);
      g.scale(1, -1);
    }
    g.drawImage(src, 0, 0);
    g.restore();
    setDims({ w: c.width, h: c.height });
  };

  const resizeTo = (w, h, stretch = true) => {
    w = Math.max(1, Math.min(4000, Math.round(w)));
    h = Math.max(1, Math.min(4000, Math.round(h)));
    const c = canvasRef.current;
    const src = document.createElement('canvas');
    src.width = c.width;
    src.height = c.height;
    src.getContext('2d').drawImage(c, 0, 0);
    c.width = w;
    c.height = h;
    const g = ctx();
    g.fillStyle = colors[1];
    g.fillRect(0, 0, w, h);
    if (stretch) g.drawImage(src, 0, 0, w, h);
    else g.drawImage(src, 0, 0);
    setDims({ w, h });
  };

  // ------------------------------------------------------------ drawing
  const getXY = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  const onCanvasDown = (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const which = e.button === 2 ? 1 : 0;
    const color = colors[which];
    const other = colors[1 - which];
    const start = getXY(e);
    const g = ctx();

    if (text) {
      commitText();
      return;
    }

    if (tool === 'picker') {
      const d = g.getImageData(Math.floor(start.x), Math.floor(start.y), 1, 1).data;
      const hex = toHex(d[0], d[1], d[2]);
      setColors((cs) => (which ? [cs[0], hex] : [hex, cs[1]]));
      setTool(prevTool);
      return;
    }
    if (tool === 'magnifier') {
      setZoom((z) => (which ? Math.max(0.125, z / 2) : Math.min(8, z * 2)));
      return;
    }
    if (tool === 'fill') {
      snapshot();
      floodFill(g, start.x, start.y, hexToRgba(color));
      return;
    }
    if (tool === 'text') {
      setText({ x: start.x, y: start.y, value: '', color });
      return;
    }
    if (tool === 'select') {
      if (sel && start.x >= sel.x && start.x <= sel.x + sel.w && start.y >= sel.y && start.y <= sel.y + sel.h) {
        // Move the selection
        const lifted = liftSelection(sel);
        setSel(lifted);
        const ox = lifted.x;
        const oy = lifted.y;
        trackDrag(e, {
          onMove: ({ dx, dy }) => setSel((s) => s && { ...s, x: Math.round(ox + dx / zoom), y: Math.round(oy + dy / zoom) }),
        });
        return;
      }
      commitSelection();
      trackDrag(e, {
        onMove: ({ x, y }) => {
          const p = getXY({ clientX: x, clientY: y });
          const x0 = Math.max(0, Math.min(start.x, p.x));
          const y0 = Math.max(0, Math.min(start.y, p.y));
          const x1 = Math.min(dims.w, Math.max(start.x, p.x));
          const y1 = Math.min(dims.h, Math.max(start.y, p.y));
          setSel({ x: Math.round(x0), y: Math.round(y0), w: Math.max(1, Math.round(x1 - x0)), h: Math.max(1, Math.round(y1 - y0)) });
        },
        onEnd: ({ moved }) => !moved && setSel(null),
      });
      return;
    }

    snapshot();
    const o = overlayRef.current;
    const og = o.getContext('2d');

    if (tool === 'shape' && shape) {
      const lw = size;
      trackDrag(e, {
        onMove: ({ x, y, ev }) => {
          let p = getXY({ clientX: x, clientY: y });
          if (ev.shiftKey) {
            const d = Math.max(Math.abs(p.x - start.x), Math.abs(p.y - start.y));
            p = { x: start.x + Math.sign(p.x - start.x) * d, y: start.y + Math.sign(p.y - start.y) * d };
          }
          og.clearRect(0, 0, o.width, o.height);
          drawShape(og, start, p, color, other, lw);
        },
        onEnd: ({ x, y, ev }) => {
          og.clearRect(0, 0, o.width, o.height);
          let p = getXY({ clientX: x, clientY: y });
          if (ev.shiftKey) {
            const d = Math.max(Math.abs(p.x - start.x), Math.abs(p.y - start.y));
            p = { x: start.x + Math.sign(p.x - start.x) * d, y: start.y + Math.sign(p.y - start.y) * d };
          }
          drawShape(g, start, p, color, other, lw);
        },
      });
      return;
    }

    // Freehand tools
    let last = start;
    const stroke = (p) => {
      g.save();
      if (tool === 'eraser') {
        const s = size * 4;
        const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / 2));
        g.fillStyle = other === color ? colors[1] : colors[1];
        for (let i = 0; i <= steps; i++) {
          const ix = last.x + ((p.x - last.x) * i) / steps;
          const iy = last.y + ((p.y - last.y) * i) / steps;
          g.fillRect(Math.round(ix - s / 2), Math.round(iy - s / 2), s, s);
        }
      } else if (tool === 'pencil') {
        g.strokeStyle = color;
        g.lineWidth = size;
        g.lineCap = size === 1 ? 'square' : 'round';
        g.beginPath();
        const off = size % 2 ? 0.5 : 0;
        g.moveTo(Math.floor(last.x) + off, Math.floor(last.y) + off);
        g.lineTo(Math.floor(p.x) + off, Math.floor(p.y) + off);
        g.stroke();
      } else if (tool === 'brush') {
        if (brush === 'airbrush') {
          g.fillStyle = color;
          const r = size * 4 + 4;
          for (let i = 0; i < 18 + size * 3; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * r;
            g.fillRect(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1, 1);
          }
        } else if (brush === 'calligraphy') {
          g.strokeStyle = color;
          g.lineWidth = 1.5;
          const s = size * 2 + 3;
          const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y)));
          for (let i = 0; i <= steps; i++) {
            const ix = last.x + ((p.x - last.x) * i) / steps;
            const iy = last.y + ((p.y - last.y) * i) / steps;
            g.beginPath();
            g.moveTo(ix - s, iy + s);
            g.lineTo(ix + s, iy - s);
            g.stroke();
          }
        } else {
          g.strokeStyle = color;
          g.globalAlpha = brush === 'marker' ? 0.35 : 1;
          g.lineWidth = brush === 'marker' ? size * 4 + 6 : size * 2 + 2;
          g.lineCap = brush === 'marker' ? 'square' : 'round';
          g.lineJoin = 'round';
          g.beginPath();
          g.moveTo(last.x, last.y);
          g.lineTo(p.x, p.y);
          g.stroke();
        }
      }
      g.restore();
      last = p;
    };
    stroke({ x: start.x + 0.01, y: start.y + 0.01 });
    trackDrag(e, { onMove: ({ x, y }) => stroke(getXY({ clientX: x, clientY: y })) });
  };

  const drawShape = (g, a, b, color, other, lw) => {
    g.save();
    g.lineWidth = lw;
    g.strokeStyle = color;
    g.fillStyle = other;
    g.lineJoin = 'round';
    if (shape === 'line') {
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    } else {
      const p = shapePath(shape, a.x, a.y, b.x - a.x, b.y - a.y);
      if (fillShape) g.fill(p);
      if (outline) g.stroke(p);
    }
    g.restore();
  };

  const commitText = () => {
    if (!text) return;
    if (text.value.trim()) {
      snapshot();
      const g = ctx();
      const px = { 1: 15, 3: 20, 5: 28, 8: 40 }[size] || 15;
      g.fillStyle = text.color;
      g.font = `${px}px "Segoe UI", "Open Sans", sans-serif`;
      g.textBaseline = 'top';
      text.value.split('\n').forEach((line, i) => g.fillText(line, text.x + 2, text.y + 2 + i * px * 1.25));
    }
    setText(null);
  };

  // ------------------------------------------------------------ file ops
  const save = async (asNew = false) => {
    commitSelection();
    await new Promise((r) => setTimeout(r, 0));
    const url = canvasRef.current.toDataURL('image/png');
    if (fileId && fs.get(fileId) && !asNew && core.extOf(fs.get(fileId).name) === 'png') {
      fs.write(fileId, url);
      setDirty(false);
      return true;
    }
    const res = await fileDialog({ mode: 'save', title: 'Save As', filters: IMG_FILTERS, defaultName: `${core.baseOf(fileName)}.png`, startIn: 'pictures', owner: win.id });
    if (!res) return false;
    const jpg = ['jpg', 'jpeg'].includes(core.extOf(res.name));
    const data = jpg ? canvasRef.current.toDataURL('image/jpeg', 0.9) : url;
    let id = res.id;
    if (id) fs.write(id, data);
    else id = fs.create({ parent: res.parent, name: res.name, content: data });
    setFileId(id);
    setDirty(false);
    addRecentFile(id, 'mspaint');
    return true;
  };

  const confirmDiscard = useCallback(async () => {
    if (!dirty) return true;
    const ans = await messageBox({ title: 'Paint', text: `Do you want to save changes to ${fileName}?`, icon: null, buttons: ['Save', "Don't Save", 'Cancel'], owner: win.id });
    if (ans === 'Save') return save();
    return ans === "Don't Save";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, fileName, win.id, fileId]);

  useEffect(() => {
    wm.setGuard(win.id, confirmDiscard);
    return () => wm.setGuard(win.id, null);
  }, [confirmDiscard, win.id]);

  const newImage = async () => {
    if (!(await confirmDiscard())) return;
    setSel(null);
    const c = canvasRef.current;
    c.width = 800;
    c.height = 560;
    const g = ctx();
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 800, 560);
    setDims({ w: 800, h: 560 });
    setFileId(null);
    setDirty(false);
    undoStack.current = [];
  };

  const open = async () => {
    if (!(await confirmDiscard())) return;
    const id = await fileDialog({ mode: 'open', filters: [IMG_FILTERS[2], ...IMG_FILTERS.slice(0, 2)], startIn: 'pictures', owner: win.id });
    if (!id) return;
    setFileId(id);
    loadImage(resolveAsset(fs.get(id).content));
    addRecentFile(id, 'mspaint');
  };

  const setAsBackground = (position) => {
    commitSelection();
    setTimeout(() => setSettings({ wallpaper: 'custom', customWallpaper: canvasRef.current.toDataURL('image/png'), wallpaperPosition: position }), 0);
  };

  // ------------------------------------------------------------ keyboard
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        const map = { z: undo, y: redo, s: () => save(e.shiftKey), o: open, n: newImage, c: () => copySelection(false), x: () => copySelection(true), v: paste, a: () => {
          setTool('select');
          setSel({ x: 0, y: 0, w: dims.w, h: dims.h });
        } };
        if (map[k]) {
          e.preventDefault();
          map[k]();
        }
        if (k === '=' || k === '+') {
          e.preventDefault();
          setZoom((z) => Math.min(8, z * 2));
        }
        if (k === '-') {
          e.preventDefault();
          setZoom((z) => Math.max(0.125, z / 2));
        }
      } else if (e.key === 'Delete') deleteSelection();
      else if (e.key === 'Escape') {
        if (sel) commitSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pickTool = (t) => {
    if (t !== 'select') commitSelection();
    commitText();
    if (t === 'picker') setPrevTool(tool === 'picker' ? prevTool : tool);
    setTool(t);
  };

  const onResizeHandle = (axis) => (e) => {
    e.stopPropagation();
    commitSelection();
    const start = { ...dims };
    const ghost = wrapRef.current.querySelector('.pt-resize-ghost');
    trackDrag(e, {
      onMove: ({ dx, dy }) => {
        const w = axis.includes('x') ? Math.max(1, Math.round(start.w + dx / zoom)) : start.w;
        const h = axis.includes('y') ? Math.max(1, Math.round(start.h + dy / zoom)) : start.h;
        Object.assign(ghost.style, { display: 'block', width: w * zoom + 'px', height: h * zoom + 'px' });
        setPos({ x: w, y: h, resize: true });
      },
      onEnd: ({ dx, dy, moved }) => {
        ghost.style.display = 'none';
        setPos(null);
        if (!moved) return;
        snapshot();
        resizeTo(axis.includes('x') ? start.w + dx / zoom : start.w, axis.includes('y') ? start.h + dy / zoom : start.h, false);
      },
    });
  };

  const fileMenuItems = [
    ['New', 'Ctrl+N', newImage],
    ['Open', 'Ctrl+O', open],
    ['Save', 'Ctrl+S', () => save()],
    ['Save as', '', () => save(true)],
    null,
    ['Print', 'Ctrl+P', () => window.print()],
    ['Set as desktop background ▸ Fill', '', () => setAsBackground('fill')],
    ['Set as desktop background ▸ Tile', '', () => setAsBackground('tile')],
    ['Set as desktop background ▸ Center', '', () => setAsBackground('center')],
    null,
    ['Properties', '', () => openDialog({ title: 'Image Properties', owner: win.id, render: (done) => <div className="pt-dialog"><p>Width: {dims.w} pixels</p><p>Height: {dims.h} pixels</p><p>File: {fileName}</p><div className="props-buttons"><button className="w7-btn default" onClick={() => done(true)}>OK</button></div></div> })],
    ['About Paint', '', () => launch('winver', { product: 'Paint' })],
    null,
    ['Exit', '', () => wm.close(win.id)],
  ];

  const shapeGroup = (
    <div className="rb-group">
      <div className="rb-group-body">
        <div className="pt-shapes">
          {SHAPES.map((s) => (
            <button
              key={s}
              className={`pt-shape ${tool === 'shape' && shape === s ? 'active' : ''}`}
              title={s}
              onClick={() => {
                pickTool('shape');
                setShape(s);
              }}
            >
              <ShapeGlyph shape={s} />
            </button>
          ))}
        </div>
        <div className="rb-col">
          <button className={`rb-btn ${outline ? 'active' : ''}`} onClick={() => setOutline(!outline)} title="Outline">
            <Glyph g="outline" /> <span>Outline</span>
          </button>
          <button className={`rb-btn ${fillShape ? 'active' : ''}`} onClick={() => setFillShape(!fillShape)} title="Fill with Color 2">
            <Glyph g="fillshape" /> <span>Fill</span>
          </button>
        </div>
      </div>
      <div className="rb-group-label">Shapes</div>
    </div>
  );

  return (
    <div className="paint">
      <div className="pt-tabs">
        <button className={`pt-file ${fileMenu ? 'open' : ''}`} onClick={() => setFileMenu(!fileMenu)} aria-label="Paint menu">
          <span>▬</span> ▾
        </button>
        <button className={`pt-tab ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
          Home
        </button>
        <button className={`pt-tab ${tab === 'view' ? 'active' : ''}`} onClick={() => setTab('view')}>
          View
        </button>
        <span className="pt-qat">
          <button title="Save (Ctrl+S)" onClick={() => save()}>
            <Glyph g="save" />
          </button>
          <button title="Undo (Ctrl+Z)" disabled={!undoStack.current.length} onClick={undo}>
            <Glyph g="undo" />
          </button>
          <button title="Redo (Ctrl+Y)" disabled={!redoStack.current.length} onClick={redo}>
            <Glyph g="redo" />
          </button>
        </span>
      </div>
      {fileMenu && (
        <div className="pt-filemenu" onPointerLeave={() => setFileMenu(false)}>
          {fileMenuItems.map((it, i) =>
            it ? (
              <button
                key={it[0]}
                className="pt-filemenu-item"
                onClick={() => {
                  setFileMenu(false);
                  it[2]();
                }}
              >
                <span>{it[0]}</span>
                <span className="cp-muted">{it[1]}</span>
              </button>
            ) : (
              <div key={i} className="w7-menu-sep" />
            )
          )}
        </div>
      )}
      <div className="pt-ribbon">
        {tab === 'home' ? (
          <>
            <div className="rb-group">
              <div className="rb-group-body">
                <RibbonBtn big g="copy" label="Paste" onClick={paste} disabled={!clip.current} />
                <div className="rb-col">
                  <RibbonBtn g="cut" label="Cut" onClick={() => copySelection(true)} disabled={!sel} />
                  <RibbonBtn g="copy" label="Copy" onClick={() => copySelection(false)} disabled={!sel} />
                </div>
              </div>
              <div className="rb-group-label">Clipboard</div>
            </div>
            <div className="rb-group">
              <div className="rb-group-body">
                <RibbonBtn big g="select" label="Select" active={tool === 'select'} onClick={() => pickTool('select')} />
                <div className="rb-col">
                  <RibbonBtn g="crop" label="Crop" onClick={crop} disabled={!sel} />
                  <RibbonBtn
                    g="resize"
                    label="Resize"
                    onClick={async () => {
                      commitSelection();
                      const r = await openDialog({ title: 'Resize and Skew', owner: win.id, render: (done) => <ResizeDialog w={dims.w} h={dims.h} done={done} /> });
                      if (r) {
                        snapshot();
                        resizeTo(r.w, r.h, true);
                      }
                    }}
                  />
                  <RibbonBtn
                    g="rotate"
                    label="Rotate"
                    dropdown
                    onClick={(e) => {
                      const rc = e.currentTarget.getBoundingClientRect();
                      ui.menuAt(rc.left, rc.bottom, [
                        { label: 'Rotate right 90°', onClick: () => transform('right') },
                        { label: 'Rotate left 90°', onClick: () => transform('left') },
                        { label: 'Rotate 180°', onClick: () => transform('180') },
                        { label: 'Flip vertical', onClick: () => transform('flipV') },
                        { label: 'Flip horizontal', onClick: () => transform('flipH') },
                      ]);
                    }}
                  />
                </div>
              </div>
              <div className="rb-group-label">Image</div>
            </div>
            <div className="rb-group">
              <div className="rb-group-body pt-tools">
                {['pencil', 'fill', 'text', 'eraser', 'picker', 'magnifier'].map((t) => (
                  <RibbonBtn key={t} g={t} active={tool === t} onClick={() => pickTool(t)} title={{ pencil: 'Pencil', fill: 'Fill with color', text: 'Text', eraser: 'Eraser', picker: 'Color picker', magnifier: 'Magnifier' }[t]} />
                ))}
              </div>
              <div className="rb-group-label">Tools</div>
            </div>
            <div className="rb-group">
              <div className="rb-group-body">
                <button
                  className={`rb-btn big ${tool === 'brush' ? 'active' : ''}`}
                  onClick={(e) => {
                    pickTool('brush');
                    const rc = e.currentTarget.getBoundingClientRect();
                    if (e.clientY > rc.top + rc.height * 0.6)
                      ui.menuAt(rc.left, rc.bottom, [
                        ['brush', 'Brush'],
                        ['calligraphy', 'Calligraphy brush'],
                        ['airbrush', 'Airbrush'],
                        ['marker', 'Marker'],
                      ].map(([k, l]) => ({ label: l, radio: true, checked: brush === k, onClick: () => setBrush(k) })));
                  }}
                  title="Brushes"
                >
                  <Glyph g="brush" size={32} />
                  <span>Brushes ▾</span>
                </button>
              </div>
              <div className="rb-group-label">&nbsp;</div>
            </div>
            {shapeGroup}
            <div className="rb-group">
              <div className="rb-group-body">
                <button
                  className="rb-btn big"
                  title="Size"
                  onClick={(e) => {
                    const rc = e.currentTarget.getBoundingClientRect();
                    ui.menuAt(
                      rc.left,
                      rc.bottom,
                      SIZES.map((s) => ({ label: `${s}px`, icon: <span className="pt-size-line" style={{ height: Math.min(8, s) }} />, radio: true, checked: size === s, onClick: () => setSize(s) }))
                    );
                  }}
                >
                  <Glyph g="size" size={32} />
                  <span>Size ▾</span>
                </button>
              </div>
              <div className="rb-group-label">&nbsp;</div>
            </div>
            <div className="rb-group">
              <div className="rb-group-body">
                {[0, 1].map((i) => (
                  <button key={i} className={`pt-colorbox ${activeColor === i ? 'active' : ''} ${i ? 'small' : ''}`} onClick={() => setActiveColor(i)}>
                    <span style={{ background: colors[i] }} />
                    <span>
                      Color
                      <br />
                      {i + 1}
                    </span>
                  </button>
                ))}
                <div className="pt-palette">
                  {[...PALETTE, ...custom, ...Array(Math.max(0, 10 - custom.length)).fill(null)].slice(0, 30).map((c, i) => (
                    <button
                      key={i}
                      className="pt-swatch"
                      style={{ background: c || '#fff' }}
                      disabled={!c}
                      aria-label={c || 'empty'}
                      onClick={() => c && setColors((cs) => (activeColor ? [cs[0], c] : [c, cs[1]]))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (c) setColors((cs) => [cs[0], c]);
                      }}
                    />
                  ))}
                </div>
                <label className="rb-btn big pt-editcolors" title="Edit colors">
                  <span className="pt-rainbow" />
                  <span>Edit colors</span>
                  <input
                    type="color"
                    value={colors[activeColor]}
                    onChange={(e) => {
                      const c = e.target.value;
                      setColors((cs) => (activeColor ? [cs[0], c] : [c, cs[1]]));
                      setCustom((cu) => [c, ...cu.filter((x) => x !== c)].slice(0, 10));
                    }}
                  />
                </label>
              </div>
              <div className="rb-group-label">Colors</div>
            </div>
          </>
        ) : (
          <>
            <div className="rb-group">
              <div className="rb-group-body">
                <RibbonBtn big g="zoomin" label="Zoom in" onClick={() => setZoom((z) => Math.min(8, z * 2))} />
                <RibbonBtn big g="zoomout" label="Zoom out" onClick={() => setZoom((z) => Math.max(0.125, z / 2))} />
                <RibbonBtn big g="magnifier" label="100%" onClick={() => setZoom(1)} />
              </div>
              <div className="rb-group-label">Zoom</div>
            </div>
            <div className="rb-group">
              <div className="rb-group-body rb-col">
                <label className="w7-label">
                  <input type="checkbox" className="w7-check" checked={grid} onChange={(e) => setGrid(e.target.checked)} />
                  Gridlines
                </label>
                <label className="w7-label">
                  <input type="checkbox" className="w7-check" checked={statusBar} onChange={(e) => setStatusBar(e.target.checked)} />
                  Status bar
                </label>
              </div>
              <div className="rb-group-label">Show or hide</div>
            </div>
            <div className="rb-group">
              <div className="rb-group-body">
                <RibbonBtn big g="fullscreen" label="Full screen" onClick={() => wm.toggleMax(win.id)} />
              </div>
              <div className="rb-group-label">Display</div>
            </div>
          </>
        )}
      </div>
      <div className="pt-area w7-scroll" onPointerDown={(e) => e.target === e.currentTarget && (commitSelection(), commitText())}>
        <div className="pt-canvas-wrap" ref={wrapRef} style={{ width: dims.w * zoom, height: dims.h * zoom }}>
          <canvas
            ref={canvasRef}
            className={`pt-canvas tool-${tool}`}
            style={{ width: dims.w * zoom, height: dims.h * zoom }}
            onPointerDown={onCanvasDown}
            onPointerMove={(e) => {
              const p = getXY(e);
              setPos({ x: Math.floor(p.x), y: Math.floor(p.y) });
            }}
            onPointerLeave={() => setPos(null)}
            onContextMenu={(e) => e.preventDefault()}
          />
          <canvas ref={overlayRef} className="pt-overlay" style={{ width: dims.w * zoom, height: dims.h * zoom }} />
          {grid && zoom >= 2 && <div className="pt-grid" style={{ backgroundSize: `${zoom}px ${zoom}px` }} />}
          {sel && <div className="pt-sel" style={{ left: sel.x * zoom, top: sel.y * zoom, width: sel.w * zoom, height: sel.h * zoom }} onPointerDown={onCanvasDown} onContextMenu={(e) => {
            e.preventDefault();
            ui.menu(e, [
              { label: 'Cut', onClick: () => copySelection(true) },
              { label: 'Copy', onClick: () => copySelection(false) },
              { label: 'Paste', disabled: !clip.current, onClick: paste },
              { separator: true },
              { label: 'Crop', onClick: crop },
              { label: 'Delete', onClick: deleteSelection },
            ]);
          }} />}
          {text && (
            <textarea
              className="pt-text"
              autoFocus
              style={{ left: text.x * zoom, top: text.y * zoom, color: text.color, fontSize: ({ 1: 15, 3: 20, 5: 28, 8: 40 }[size] || 15) * zoom }}
              value={text.value}
              onChange={(e) => setText({ ...text, value: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') setText(null);
              }}
            />
          )}
          <span className="pt-handle x" onPointerDown={onResizeHandle('x')} />
          <span className="pt-handle y" onPointerDown={onResizeHandle('y')} />
          <span className="pt-handle xy" onPointerDown={onResizeHandle('xy')} />
          <div className="pt-resize-ghost" />
        </div>
      </div>
      {statusBar && (
        <div className="pt-status">
          <span className="pt-st">
            <Icon name="mspaint" size={14} /> {pos && !pos.resize ? `${pos.x}, ${pos.y}px` : ''}
          </span>
          <span className="pt-st">{sel ? `${sel.w} × ${sel.h}px` : ''}</span>
          <span className="pt-st">{pos?.resize ? `${pos.x} × ${pos.y}px` : `${dims.w} × ${dims.h}px`}</span>
          <span className="pt-zoom">
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.max(0.125, z / 2))} aria-label="Zoom out">
              −
            </button>
            <input type="range" className="w7-range" min="-3" max="3" step="1" value={Math.log2(zoom)} onChange={(e) => setZoom(Math.pow(2, +e.target.value))} aria-label="Zoom" />
            <button onClick={() => setZoom((z) => Math.min(8, z * 2))} aria-label="Zoom in">
              +
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
