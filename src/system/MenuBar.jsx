import React, { useEffect, useRef, useState } from 'react';
import { MenuList } from './ContextMenu.jsx';

/** Classic menu bar (File, Edit, ...). menus: [{ label, items: [...] | () => [...] }] */
export function MenuBar({ menus, className = '' }) {
  const [open, setOpen] = useState(null); // index
  const [pos, setPos] = useState(null);
  const refs = useRef([]);

  useEffect(() => {
    if (open === null) return;
    const close = (e) => {
      if (refs.current.some((r) => r?.contains(e.target))) return;
      if (e.target.closest?.('.w7-menu')) return;
      setOpen(null);
    };
    const t = setTimeout(() => window.addEventListener('pointerdown', close), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', close);
    };
  }, [open]);

  const show = (i) => {
    const r = refs.current[i].getBoundingClientRect();
    setPos({ x: r.left, y: r.bottom });
    setOpen(i);
  };

  const items = open !== null ? (typeof menus[open].items === 'function' ? menus[open].items() : menus[open].items) : null;

  return (
    <div className={`w7-menubar ${className}`} role="menubar">
      {menus.map((m, i) => (
        <div
          key={m.label}
          ref={(r) => (refs.current[i] = r)}
          role="menuitem"
          className={`w7-menubar-item ${open === i ? 'open' : ''}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            open === i ? setOpen(null) : show(i);
          }}
          onPointerEnter={(e) => {
            if (open !== null && open !== i) show(i);
            else if (open === null) e.currentTarget.classList.add('hot');
          }}
          onPointerLeave={(e) => e.currentTarget.classList.remove('hot')}
        >
          {m.label}
        </div>
      ))}
      {items && pos && <MenuList key={open} items={items} x={pos.x} y={pos.y} onClose={() => setOpen(null)} />}
    </div>
  );
}
