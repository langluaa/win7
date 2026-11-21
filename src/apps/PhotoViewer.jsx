import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store.js';
import { fsStore, fs, core, resolveAsset, IMAGE_EXT } from '../state/fs.js';
import { wm, ui } from '../state/wm.js';
import { setSettings, WALLPAPERS } from '../state/settings.js';
import { openNode, deleteItems, launch } from '../system/shell.jsx';
import { Icon } from '../system/icons.jsx';

const RoundBtn = ({ children, onClick, title, big, disabled, className = '' }) => (
  <button className={`pv-btn ${big ? 'big' : ''} ${className}`} onClick={onClick} title={title} aria-label={title} disabled={disabled}>
    {children}
  </button>
);

export default function PhotoViewer({ win, active }) {
  const nodes = useStore(fsStore, (s) => s.nodes);
  const [id, setId] = useState(win.props.fileId || null);
  const [zoom, setZoom] = useState(0); // 0 = fit
  const [rot, setRot] = useState(0);
  const [show, setShow] = useState(false);
  const node = id ? nodes[id] : null;

  useEffect(() => {
    if (win.props._t && win.props.fileId) setId(win.props.fileId);
  }, [win.props._t, win.props.fileId]);

  const siblings = useMemo(() => {
    if (!node) return [];
    return core.children(nodes, node.parent).filter((n) => n.type === 'file' && IMAGE_EXT.includes(core.extOf(n.name)));
  }, [nodes, node]);
  const idx = siblings.findIndex((n) => n.id === id);
  const go = (d) => {
    if (!siblings.length) return;
    setId(siblings[(idx + d + siblings.length) % siblings.length].id);
    setRot(0);
    setZoom(0);
  };

  useEffect(() => {
    wm.setTitle(win.id, node ? `${node.name} - Windows Photo Viewer` : 'Windows Photo Viewer');
  }, [node, win.id]);

  useEffect(() => {
    if (!show) return;
    const t = setInterval(() => go(1), 3500);
    const stop = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      setShow(false);
    };
    window.addEventListener('keydown', stop);
    window.addEventListener('pointerdown', stop);
    return () => {
      clearInterval(t);
      window.removeEventListener('keydown', stop);
      window.removeEventListener('pointerdown', stop);
    };
  });

  useEffect(() => {
    if (!active) return;
    const k = (e) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'F11') {
        e.preventDefault();
        setShow(true);
      } else if (e.key === 'Delete' && node) deleteItems([node.id], { owner: win.id });
      else if ((e.ctrlKey || e.metaKey) && e.key === '.') setRot((r) => r + 90);
      else if ((e.ctrlKey || e.metaKey) && e.key === ',') setRot((r) => r - 90);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const src = node ? resolveAsset(node.content) : '';
  const asWallpaper = () => {
    if (!node) return;
    if (node.content.startsWith('asset:')) {
      const w = WALLPAPERS.find((x) => node.content.includes(x.file));
      if (w) return setSettings({ wallpaper: w.id });
    }
    setSettings({ wallpaper: 'custom', customWallpaper: node.content });
  };

  return (
    <div className="pv">
      <div className="pv-cmd">
        <button
          className="pv-cmd-btn"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            ui.menuAt(r.left, r.bottom, [
              { label: 'Make a copy...', disabled: !node, onClick: () => node && fs.copy(node.id, node.parent) },
              { label: 'Set as desktop background', disabled: !node, onClick: asWallpaper },
              { separator: true },
              { label: 'Properties', disabled: !node, onClick: () => node && import('../system/shell.jsx').then((m) => m.showProperties(node.id, win.id)) },
              { separator: true },
              { label: 'Exit', onClick: () => wm.close(win.id) },
            ]);
          }}
        >
          File ▾
        </button>
        <button className="pv-cmd-btn" onClick={() => window.print()}>
          Print ▾
        </button>
        <button className="pv-cmd-btn" disabled>
          E-mail
        </button>
        <button className="pv-cmd-btn" disabled>
          Burn ▾
        </button>
        <button
          className="pv-cmd-btn"
          disabled={!node}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            ui.menuAt(r.left, r.bottom, [
              { label: 'Paint', icon: 'mspaint', onClick: () => openNode(node.id, 'mspaint') },
              { label: 'Internet Explorer', icon: 'iexplore', onClick: () => openNode(node.id, 'iexplore') },
            ]);
          }}
        >
          Open ▾
        </button>
        <span style={{ flex: 1 }} />
        <button className="pv-cmd-btn" title="Help" onClick={() => launch('help')}>
          <Icon name="help" size={16} />
        </button>
      </div>
      <div className="pv-stage" onWheel={(e) => e.ctrlKey && setZoom((z) => Math.max(0, Math.min(4, (z || 1) - Math.sign(e.deltaY) * 0.25)))}>
        {node ? (
          <img
            key={id}
            src={src}
            alt={node.name}
            draggable={false}
            className={`pv-img ${zoom ? 'zoomed' : ''}`}
            style={{ transform: `rotate(${rot}deg) scale(${zoom || 1})` }}
            onDoubleClick={() => setZoom(zoom ? 0 : 1.5)}
          />
        ) : (
          <div className="pv-empty">No picture selected. Open a picture from Explorer.</div>
        )}
      </div>
      <div className="pv-bar">
        <div className="pv-bar-group">
          <RoundBtn title="Change the display size" onClick={() => setZoom((z) => (z >= 3 ? 0 : (z || 1) + 0.5))}>
            <svg width="18" height="18" viewBox="0 0 16 16">
              <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="#fff" strokeWidth="1.6" />
              <path d="M10 10l4.5 4.5" stroke="#fff" strokeWidth="2" />
            </svg>
          </RoundBtn>
          <RoundBtn title="Actual size" onClick={() => setZoom(zoom ? 0 : 1)}>
            <svg width="18" height="18" viewBox="0 0 16 16">
              <rect x="2" y="3" width="12" height="10" fill="none" stroke="#fff" strokeWidth="1.5" />
              <path d="M5 6v4M10 6v4M7.5 7v.1M7.5 9v.1" stroke="#fff" strokeWidth="1.5" />
            </svg>
          </RoundBtn>
        </div>
        <div className="pv-bar-group center">
          <RoundBtn title="Previous (Left Arrow)" onClick={() => go(-1)} disabled={siblings.length < 2}>
            <svg width="18" height="18" viewBox="0 0 16 16">
              <path d="M10 2L4 8l6 6" fill="none" stroke="#fff" strokeWidth="2.4" />
            </svg>
          </RoundBtn>
          <RoundBtn big title="Play slide show (F11)" onClick={() => setShow(true)} disabled={!node}>
            <svg width="22" height="22" viewBox="0 0 16 16">
              <rect x="2.5" y="4" width="11" height="8" fill="none" stroke="#fff" strokeWidth="1.4" />
              <path d="M6.5 6v4l3.5-2z" fill="#fff" />
            </svg>
          </RoundBtn>
          <RoundBtn title="Next (Right Arrow)" onClick={() => go(1)} disabled={siblings.length < 2}>
            <svg width="18" height="18" viewBox="0 0 16 16">
              <path d="M6 2l6 6-6 6" fill="none" stroke="#fff" strokeWidth="2.4" />
            </svg>
          </RoundBtn>
        </div>
        <div className="pv-bar-group">
          <RoundBtn title="Rotate counterclockwise (Ctrl+,)" onClick={() => setRot((r) => r - 90)}>
            <svg width="18" height="18" viewBox="0 0 16 16">
              <path d="M4 8a5 5 0 1 0 2-4" fill="none" stroke="#fff" strokeWidth="1.6" />
              <path d="M2.5 1.5v4h4z" fill="#fff" />
            </svg>
          </RoundBtn>
          <RoundBtn title="Rotate clockwise (Ctrl+.)" onClick={() => setRot((r) => r + 90)}>
            <svg width="18" height="18" viewBox="0 0 16 16">
              <path d="M12 8a5 5 0 1 1-2-4" fill="none" stroke="#fff" strokeWidth="1.6" />
              <path d="M13.5 1.5v4h-4z" fill="#fff" />
            </svg>
          </RoundBtn>
          <RoundBtn title="Delete (Del)" className="del" disabled={!node} onClick={() => node && deleteItems([node.id], { owner: win.id })}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 3l10 10M13 3L3 13" stroke="#fff" strokeWidth="2.6" />
            </svg>
          </RoundBtn>
        </div>
      </div>
      {show && node && (
        <div className="pv-slideshow">
          <img key={id} src={src} alt="" />
        </div>
      )}
    </div>
  );
}
