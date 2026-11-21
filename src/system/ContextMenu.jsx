import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { uiStore, ui } from '../state/wm.js';
import { useStore } from '../lib/store.js';
import { Icon } from './icons.jsx';

export function MenuList({ items, x, y, onClose, depth = 0, className = '', alignBottom = false, anchorLeft }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x, y, ready: false });
  const [hot, setHot] = useState(-1);
  const [sub, setSub] = useState(null); // { index, x, y }
  const subTimer = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x;
    let ny = alignBottom ? y - r.height : y;
    if (nx + r.width > window.innerWidth - 2) nx = depth > 0 && anchorLeft !== undefined ? anchorLeft - r.width : window.innerWidth - r.width - 2;
    if (ny + r.height > window.innerHeight - 2) ny = Math.max(2, window.innerHeight - r.height - 2);
    setPos({ x: Math.max(2, nx), y: Math.max(2, ny), ready: true });
  }, [x, y, depth, alignBottom, anchorLeft]);

  useEffect(() => {
    if (depth > 0) return;
    const onKey = (e) => {
      const enabled = items.map((it, i) => (!it.separator && !it.disabled ? i : -1)).filter((i) => i >= 0);
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHot((h) => enabled[(enabled.indexOf(h) + 1) % enabled.length]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHot((h) => enabled[(enabled.indexOf(h) - 1 + enabled.length) % enabled.length]);
      } else if (e.key === 'Enter' && hot >= 0) {
        e.preventDefault();
        activate(items[hot], hot);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const openSub = (i, el) => {
    const r = el.getBoundingClientRect();
    setSub({ index: i, x: r.right - 3, y: r.top - 3, left: r.left + 3 });
  };

  const activate = (item, i, el) => {
    if (item.disabled || item.separator) return;
    if (item.submenu) {
      if (el) openSub(i, el);
      return;
    }
    onClose();
    item.onClick?.();
  };

  return (
    <>
      <div
        ref={ref}
        className={`w7-menu ${className}`}
        style={{ left: pos.x, top: pos.y, visibility: pos.ready ? 'visible' : 'hidden' }}
        role="menu"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {items.map((item, i) => {
          if (!item || item.hidden) return null;
          if (item.separator) return <div key={i} className="w7-menu-sep" />;
          return (
            <div
              key={i}
              role="menuitem"
              aria-disabled={item.disabled || undefined}
              className={`w7-menu-item ${hot === i ? 'hot' : ''} ${item.disabled ? 'disabled' : ''} ${item.bold ? 'bold' : ''}`}
              onPointerEnter={(e) => {
                setHot(i);
                clearTimeout(subTimer.current);
                const el = e.currentTarget;
                if (item.submenu && !item.disabled) subTimer.current = setTimeout(() => openSub(i, el), e.pointerType === 'mouse' ? 250 : 0);
                else subTimer.current = setTimeout(() => setSub(null), 250);
              }}
              onClick={(e) => activate(item, i, e.currentTarget)}
            >
              {item.checked !== undefined && item.checked && <span className={`mi-check ${item.radio ? 'radio' : 'check'}`} />}
              {item.icon && <span className="mi-icon">{typeof item.icon === 'string' ? <Icon name={item.icon} size={16} /> : item.icon}</span>}
              <span className="mi-label">{item.label}</span>
              {item.hint && <span className="mi-hint">{item.hint}</span>}
              {item.submenu && <span className="mi-arrow" />}
            </div>
          );
        })}
      </div>
      {sub && items[sub.index]?.submenu && (
        <MenuList key={sub.index} items={items[sub.index].submenu} x={sub.x} y={sub.y} anchorLeft={sub.left} depth={depth + 1} onClose={onClose} />
      )}
    </>
  );
}

export function ContextMenuLayer() {
  const menu = useStore(uiStore, (s) => s.menu);
  useEffect(() => {
    if (!menu) return;
    const close = () => ui.closeMenu();
    const t = setTimeout(() => {
      window.addEventListener('pointerdown', close);
      window.addEventListener('blur', close);
      window.addEventListener('resize', close);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [menu]);
  if (!menu) return null;
  return <MenuList key={menu.key} items={menu.items} x={menu.x} y={menu.y} alignBottom={menu.alignBottom} className={menu.className} onClose={() => ui.closeMenu()} />;
}
