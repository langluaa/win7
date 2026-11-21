// Unified mouse/pen/touch helpers built on Pointer Events.

/** Track a drag from a pointerdown event until release. */
export function trackDrag(e, { onMove, onEnd, threshold = 0 }) {
  const startX = e.clientX;
  const startY = e.clientY;
  const pid = e.pointerId;
  let started = threshold === 0;
  let raf = 0;
  let last = null;

  const move = (ev) => {
    if (ev.pointerId !== pid) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!started) {
      if (Math.hypot(dx, dy) < threshold) return;
      started = true;
    }
    ev.preventDefault();
    last = { x: ev.clientX, y: ev.clientY, dx, dy, ev };
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (last) onMove?.(last);
      });
    }
  };
  const up = (ev) => {
    if (ev.pointerId !== pid) return;
    cleanup();
    if (raf) cancelAnimationFrame(raf);
    if (last && started) onMove?.(last);
    onEnd?.({ x: ev.clientX, y: ev.clientY, dx: ev.clientX - startX, dy: ev.clientY - startY, moved: started, cancelled: ev.type === 'pointercancel', ev });
  };
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  return cleanup;
}

/**
 * Returns pointer handlers that call `onDouble` for a double click/tap and
 * `onContext` for a long-press on touch (mirrors right-click).
 */
export function tapHandlers({ onDouble, onContext, onTap, delay = 420, longPress = 550 } = {}) {
  let lastTap = 0;
  let lastPos = null;
  let timer = null;
  let startPos = null;
  let longFired = false;

  return {
    onPointerDown(e) {
      longFired = false;
      startPos = { x: e.clientX, y: e.clientY };
      if (e.pointerType === 'touch' && onContext) {
        clearTimeout(timer);
        const currentTarget = e.currentTarget;
        const target = e.target;
        timer = setTimeout(() => {
          longFired = true;
          onContext({ clientX: startPos.x, clientY: startPos.y, preventDefault() {}, stopPropagation() {}, currentTarget, target, touchLong: true });
        }, longPress);
      }
    },
    onPointerMove(e) {
      if (timer && startPos && Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y) > 8) {
        clearTimeout(timer);
        timer = null;
      }
    },
    onPointerUp(e) {
      clearTimeout(timer);
      timer = null;
      if (longFired) return;
      const now = Date.now();
      const pos = { x: e.clientX, y: e.clientY };
      if (e.pointerType === 'mouse') {
        onTap?.(e);
        return;
      }
      if (onDouble && now - lastTap < delay && lastPos && Math.hypot(pos.x - lastPos.x, pos.y - lastPos.y) < 24) {
        lastTap = 0;
        onDouble(e);
        return;
      }
      lastTap = now;
      lastPos = pos;
      onTap?.(e);
    },
    onPointerCancel() {
      clearTimeout(timer);
      timer = null;
    },
    onContextMenu(e) {
      // Touch long-press already handled; suppress the native menu.
      e.preventDefault();
      if (longFired) return;
      if (onContext && e.nativeEvent?.pointerType !== 'touch') onContext(e);
    },
  };
}

export const isTouchDevice = () => window.matchMedia?.('(pointer: coarse)').matches;

import { useRef, useMemo } from 'react';

/** Stable version of tapHandlers whose callbacks always see the latest props. */
export function useTap(opts) {
  const ref = useRef(opts);
  ref.current = opts;
  return useMemo(
    () =>
      tapHandlers({
        onDouble: (e) => ref.current.onDouble?.(e),
        onContext: (e) => ref.current.onContext?.(e),
        onTap: (e) => ref.current.onTap?.(e),
      }),
    []
  );
}
