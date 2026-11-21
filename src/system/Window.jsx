import React, { memo, useRef, useCallback, useEffect, useState } from 'react';
import { wm, ui, uiStore, getRegistry, taskbarHeight } from '../state/wm.js';
import { useStore } from '../lib/store.js';
import { trackDrag, useTap } from '../lib/pointer.js';
import { Icon } from './icons.jsx';

export const taskbarButtonRects = {}; // appId -> DOMRect (filled by Taskbar)

const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

function Glyph({ kind }) {
  // White glyphs with a dark outline, like the Aero caption buttons.
  const common = { fill: '#fff', stroke: '#2b3a4a', strokeWidth: 1, strokeLinejoin: 'round', paintOrder: 'stroke' };
  if (kind === 'min') return <svg width="12" height="10" viewBox="0 0 12 10"><rect x="1.5" y="5.5" width="9" height="3" {...common} /></svg>;
  if (kind === 'max')
    return (
      <svg width="12" height="10" viewBox="0 0 12 10">
        <path d="M1.5 .5h9v9h-9zM3.5 3.5v4h5v-4z" fillRule="evenodd" {...common} />
      </svg>
    );
  if (kind === 'restore')
    return (
      <svg width="12" height="10" viewBox="0 0 12 10">
        <path d="M3.5 .5h8v6.5h-2V3H3.5z" {...common} />
        <path d="M.5 3.5h8v6h-8zM2.5 5.8v1.9h4V5.8z" fillRule="evenodd" {...common} />
      </svg>
    );
  return (
    <svg width="12" height="11" viewBox="0 0 12 11">
      <path d="M1 1.5L2.5 0 6 3.4 9.5 0 11 1.5 7.5 5 11 8.5 9.5 10 6 6.6 2.5 10 1 8.5 4.5 5z" {...common} />
    </svg>
  );
}

function CaptionButtons({ win }) {
  const stop = (e) => e.stopPropagation();
  return (
    <div className="wf-buttons" onPointerDown={stop} onDoubleClick={stop}>
      {(win.minimizable || win.maximizable) && (
        <>
          <button className="wf-btn wf-min" aria-label="Minimize" disabled={!win.minimizable} onClick={() => wm.minimize(win.id)}>
            <Glyph kind="min" />
          </button>
          <button className="wf-btn wf-max" aria-label={win.maximized ? 'Restore Down' : 'Maximize'} disabled={!win.maximizable} onClick={() => wm.toggleMax(win.id)}>
            <Glyph kind={win.maximized ? 'restore' : 'max'} />
          </button>
        </>
      )}
      <button className={`wf-btn wf-close ${!win.minimizable && !win.maximizable ? 'solo' : ''}`} aria-label="Close" onClick={() => wm.close(win.id)}>
        <Glyph kind="close" />
      </button>
    </div>
  );
}

function systemMenu(win) {
  return [
    { label: 'Restore', icon: <Glyph kind="restore" />, disabled: !win.maximized, onClick: () => wm.unmaximize(win.id) },
    { label: 'Move', disabled: win.maximized },
    { label: 'Size', disabled: win.maximized || !win.resizable },
    { label: 'Minimize', icon: <Glyph kind="min" />, disabled: !win.minimizable, onClick: () => wm.minimize(win.id) },
    { label: 'Maximize', icon: <Glyph kind="max" />, disabled: win.maximized || !win.maximizable, onClick: () => wm.maximize(win.id) },
    { separator: true },
    { label: 'Close', hint: 'Alt+F4', bold: true, icon: <Glyph kind="close" />, onClick: () => wm.close(win.id) },
  ];
}

export const Window = memo(function Window({ win, active, peeked }) {
  const ref = useRef(null);
  const app = getRegistry()[win.app];
  const App = app?.component;
  const [minTarget, setMinTarget] = useState(null);
  const tbH = useStore(uiStore, () => taskbarHeight());

  // Compute where the minimize animation should fly to (the taskbar button).
  useEffect(() => {
    if (!win.minimized || !ref.current) return;
    const r = taskbarButtonRects[win.app];
    const el = ref.current.getBoundingClientRect();
    if (r) {
      const dx = r.left + r.width / 2 - (el.left + el.width / 2);
      const dy = r.top + r.height / 2 - (el.top + el.height / 2);
      setMinTarget({ dx, dy, s: Math.max(0.08, Math.min(0.3, r.width / el.width)) });
    } else setMinTarget({ dx: 0, dy: window.innerHeight, s: 0.2 });
  }, [win.minimized, win.app]);

  const onTitleDown = useCallback(
    (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      wm.focus(win.id);
      const el = ref.current;
      const start = { x: win.x, y: win.y, w: win.w, h: win.h };
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let mode = win.maximized ? 'max' : win.snapped ? 'snapped' : 'normal';
      let pos = { ...start };
      let snap = null;
      let grabRatio = (e.clientX - (win.maximized ? 0 : win.x)) / (win.maximized ? vw : win.w);
      const grabY = e.clientY - (win.maximized ? 0 : win.y);
      trackDrag(e, {
        threshold: 4,
        onMove: ({ x, y, dx, dy }) => {
          if (mode !== 'normal') {
            // Dragging a maximized/snapped window restores it under the cursor (Aero behaviour).
            const restoreW = mode === 'snapped' && win.restore ? win.restore.w : start.w;
            const restoreH = mode === 'snapped' && win.restore ? win.restore.h : start.h;
            if (mode === 'max') wm.unmaximize(win.id);
            else wm.unsnap(win.id);
            start.w = restoreW;
            start.h = restoreH;
            start.x = x - restoreW * grabRatio;
            start.y = Math.max(0, y - Math.min(grabY, 14));
            start.ox = x;
            start.oy = y;
            mode = 'normal';
          }
          const baseX = start.ox !== undefined ? start.x + (x - start.ox) : start.x + dx;
          const baseY = start.oy !== undefined ? start.y + (y - start.oy) : start.y + dy;
          pos = { x: Math.round(baseX), y: Math.round(Math.max(-2, Math.min(vh - tbH - 24, baseY))) };
          el.style.left = pos.x + 'px';
          el.style.top = pos.y + 'px';
          el.style.width = start.w + 'px';
          el.style.height = start.h + 'px';
          // Aero Snap preview
          let next = null;
          if (win.resizable) {
            if (y <= 1 && win.maximizable) next = { x: 0, y: 0, w: vw, h: vh - tbH, side: 'max' };
            else if (x <= 1) next = { x: 0, y: 0, w: vw / 2, h: vh - tbH, side: 'left' };
            else if (x >= vw - 2) next = { x: vw / 2, y: 0, w: vw / 2, h: vh - tbH, side: 'right' };
          }
          if ((next && next.side) !== (snap && snap.side)) {
            snap = next;
            uiStore.set((s) => ({ ...s, snapPreview: next ? { ...next, from: { x, y } } : null }));
          }
        },
        onEnd: ({ moved }) => {
          uiStore.set((s) => (s.snapPreview ? { ...s, snapPreview: null } : s));
          if (!moved) return;
          if (snap) {
            wm.setRect(win.id, { x: pos.x, y: Math.max(0, pos.y), w: start.w, h: start.h });
            if (snap.side === 'max') wm.maximize(win.id);
            else wm.snap(win.id, snap.side);
          } else if (mode === 'normal') {
            wm.setRect(win.id, { x: pos.x ?? start.x, y: Math.max(0, pos.y ?? start.y), w: start.w, h: start.h });
          }
        },
      });
    },
    [win, tbH]
  );

  const onResizeDown = useCallback(
    (edge) => (e) => {
      e.stopPropagation();
      wm.focus(win.id);
      const el = ref.current;
      const start = { x: win.x, y: win.y, w: win.w, h: win.h };
      const min = app?.minSize || { w: 200, h: 120 };
      let rect = { ...start };
      if (win.snapped) wm.setRect(win.id, { snapped: null });
      trackDrag(e, {
        onMove: ({ dx, dy }) => {
          rect = { ...start };
          if (edge.includes('e')) rect.w = Math.max(min.w, start.w + dx);
          if (edge.includes('s')) rect.h = Math.max(min.h, start.h + dy);
          if (edge.includes('w')) {
            rect.w = Math.max(min.w, start.w - dx);
            rect.x = start.x + start.w - rect.w;
          }
          if (edge.includes('n')) {
            rect.h = Math.max(min.h, start.h - dy);
            rect.y = Math.max(0, start.y + start.h - rect.h);
            rect.h = start.y + start.h - rect.y;
          }
          Object.assign(el.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
        },
        onEnd: () => wm.setRect(win.id, rect),
      });
    },
    [win, app]
  );

  const { onPointerDown: tapDown, ...titleTaps } = useTap({
    onDouble: (e) => {
      if (e.pointerType !== 'mouse') wm.toggleMax(win.id);
    },
    onContext: (e) => ui.menu(e, systemMenu(win)),
  });

  if (!App) return null;

  const style = win.maximized
    ? { left: 0, top: 0, width: '100%', height: `calc(100% - ${tbH}px)`, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };
  if (win.minimized && minTarget) {
    style.transform = `translate(${minTarget.dx}px, ${minTarget.dy}px) scale(${minTarget.s})`;
  }

  const cls = [
    'win7-window',
    active && 'active',
    win.maximized && 'maximized',
    win.dialog && 'dialog',
    win.minimized && 'minimized',
    win.closing && 'closing',
    peeked && 'peeked',
    app.glassTop && 'glass-top',
    app.className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={cls}
      style={style}
      data-app={win.app}
      data-win={win.id}
      role="dialog"
      aria-label={win.title}
      onPointerDownCapture={() => wm.focus(win.id)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="wf-titlebar"
        {...titleTaps}
        onPointerDown={(e) => {
          tapDown(e);
          onTitleDown(e);
        }}
        onDoubleClick={() => wm.toggleMax(win.id)}
      >
        {!win.dialog && !app.hideTitle && (
          <span
            className="wf-icon"
            onPointerDown={(e) => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              ui.menuAt(r.left, r.bottom + 2, systemMenu(win));
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              wm.close(win.id);
            }}
          >
            <Icon name={win.icon} size={16} />
          </span>
        )}
        {!app.hideTitle && <span className="wf-title">{win.title}</span>}
      </div>
      <CaptionButtons win={win} />
      <div className="wf-client">
        <App win={win} active={active} />
      </div>
      {win.resizable && !win.maximized && EDGES.map((edge) => <div key={edge} className={`wf-resize wf-${edge}`} onPointerDown={onResizeDown(edge)} />)}
    </div>
  );
});
