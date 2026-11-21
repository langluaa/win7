import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.js';
import { settingsStore, setNested } from '../state/settings.js';
import { wm, ui } from '../state/wm.js';
import { fs } from '../state/fs.js';
import { Icon } from '../system/icons.jsx';
import { launch } from '../system/shell.jsx';
import { newId } from '../lib/store.js';
import { normalizeUrl, SEARCH } from '../lib/url.js';

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function HomePage({ onGo, favorites }) {
  const [q, setQ] = useState('');
  const now = new Date();
  return (
    <div className="ie-home w7-scroll">
      <div className="ie-home-hero">
        <div className="ie-home-logo">
          <Icon name="iexplore" size={64} />
          <div>
            <div className="ie-home-title">Welcome to Internet Explorer</div>
            <div className="ie-home-date">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
        </div>
        <form
          className="ie-home-search"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) onGo(normalizeUrl(q));
          }}
        >
          <input className="w7-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the web or type a URL" aria-label="Search" />
          <button className="w7-btn default" type="submit">
            Search
          </button>
        </form>
      </div>
      <div className="ie-home-cols">
        <section>
          <h2>Your favorites</h2>
          <div className="ie-tiles">
            {favorites.map((f) => (
              <button key={f.url} className="ie-tile" onClick={() => onGo(f.url)}>
                <span className="ie-tile-icon">{(f.title || '?')[0]}</span>
                <span className="ie-tile-title">{f.title}</span>
                <span className="ie-tile-url">{hostOf(f.url)}</span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2>Tips</h2>
          <ul className="ie-tips">
            <li>Press <b>Ctrl+T</b> to open a new tab and <b>Ctrl+W</b> to close it.</li>
            <li>Click the star to add the current page to your Favorites bar.</li>
            <li>Some websites don&rsquo;t allow themselves to be shown inside other pages. If a page stays blank, use <b>Tools &gt; Open in real browser</b>.</li>
            <li>HTML files saved in your Documents folder open here too.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function ErrorPage({ url, onRetry }) {
  return (
    <div className="ie-error">
      <div className="ie-error-head">
        <Icon name="info" size={32} />
        <h1>Internet Explorer cannot display the webpage</h1>
      </div>
      <p>What you can try:</p>
      <ul>
        <li>Diagnose connection problems</li>
        <li>
          <a onClick={onRetry}>Retry</a>
        </li>
      </ul>
      <p className="cp-muted">{url}</p>
    </div>
  );
}

function newTab(url) {
  return { id: newId('t'), history: [url], index: 0, title: url === 'about:home' ? 'Welcome' : hostOf(url), loading: url.startsWith('http'), reloadKey: 0 };
}

export default function Browser({ win, active }) {
  const settings = useStore(settingsStore, (s) => s.browser);
  const initial = win.props.url ? normalizeUrl(win.props.url) : win.props.fileId ? `vfs:${win.props.fileId}` : settings.home;
  const [tabs, setTabs] = useState(() => [newTab(initial)]);
  const [activeTab, setActiveTab] = useState(() => tabs[0].id);
  const [address, setAddress] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [hint, setHint] = useState(true);
  const [favOpen, setFavOpen] = useState(false);
  const tab = tabs.find((t) => t.id === activeTab) || tabs[0];
  const url = tab.history[tab.index];

  useEffect(() => {
    if (!editing) setAddress(url === 'about:home' ? 'about:home' : url.startsWith('vfs:') ? fs.path(url.slice(4)) || url : url);
  }, [url, editing]);

  useEffect(() => {
    wm.setTitle(win.id, `${tab.title || hostOf(url)} - Windows Internet Explorer`);
  }, [tab.title, url, win.id]);

  // New url from outside (e.g. opening a .url file while running)
  useEffect(() => {
    if (win.props._t && win.props.url) navigate(normalizeUrl(win.props.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props._t]);

  const updateTab = (id, fn) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)));

  const navigate = (to) => {
    setEditing(false);
    setHint(true);
    updateTab(tab.id, (t) => ({
      history: [...t.history.slice(0, t.index + 1), to],
      index: t.index + 1,
      title: to === 'about:home' ? 'Welcome' : to.startsWith('vfs:') ? fs.get(to.slice(4))?.name : hostOf(to),
      loading: to.startsWith('http'),
    }));
  };

  const back = () => tab.index > 0 && updateTab(tab.id, (t) => ({ index: t.index - 1, title: hostOf(t.history[t.index - 1]) }));
  const fwd = () => tab.index < tab.history.length - 1 && updateTab(tab.id, (t) => ({ index: t.index + 1, title: hostOf(t.history[t.index + 1]) }));
  const refresh = () => updateTab(tab.id, (t) => ({ reloadKey: t.reloadKey + 1, loading: url.startsWith('http') }));
  const addTab = (to = 'about:home') => {
    const t = newTab(to);
    setTabs((ts) => [...ts, t]);
    setActiveTab(t.id);
  };
  const closeTab = (id) => {
    if (tabs.length === 1) return wm.close(win.id);
    const idx = tabs.findIndex((t) => t.id === id);
    const rest = tabs.filter((t) => t.id !== id);
    setTabs(rest);
    if (id === activeTab) setActiveTab(rest[Math.max(0, idx - 1)].id);
  };

  const isFav = settings.favorites.some((f) => f.url === url);
  const toggleFav = () => {
    if (!url.startsWith('http')) return;
    setNested('browser', { favorites: isFav ? settings.favorites.filter((f) => f.url !== url) : [...settings.favorites, { title: tab.title || hostOf(url), url }] });
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) {
        if (e.key === 'F5') {
          e.preventDefault();
          refresh();
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 't') {
        e.preventDefault();
        addTab();
      } else if (k === 'w') {
        e.preventDefault();
        closeTab(activeTab);
      } else if (k === 'l') {
        e.preventDefault();
        setEditing(true);
      } else if (k === 'd') {
        e.preventDefault();
        toggleFav();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const vfsHtml = useMemo(() => {
    if (!url.startsWith('vfs:')) return null;
    const n = fs.get(url.slice(4));
    if (!n) return '<h1>File not found</h1>';
    const c = String(n.content || '');
    if (/\.(txt|md|log|csv|json|js|css)$/i.test(n.name)) return `<pre style="font:13px Consolas,monospace;white-space:pre-wrap">${c.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m])}</pre>`;
    if (c.startsWith('data:image') || c.startsWith('asset:')) return `<img src="${c.startsWith('asset:') ? import.meta.env.BASE_URL + c.slice(6) : c}" style="max-width:100%">`;
    return c;
  }, [url]);

  const external = url.startsWith('http');
  const toolsMenu = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    ui.menuAt(r.left, r.bottom, [
      { label: 'Open in real browser', disabled: !external, onClick: () => window.open(url, '_blank', 'noopener') },
      { label: 'Delete browsing history...', onClick: () => updateTab(tab.id, () => ({ history: [url], index: 0 })) },
      { separator: true },
      { label: 'Zoom in', hint: 'Ctrl +', onClick: () => setZoom((z) => Math.min(3, z + 0.25)) },
      { label: 'Zoom out', hint: 'Ctrl -', onClick: () => setZoom((z) => Math.max(0.5, z - 0.25)) },
      { label: 'Reset zoom', onClick: () => setZoom(1) },
      { separator: true },
      { label: 'Internet Options', onClick: () => setNested('browser', { home: url }) },
      { label: `Set "${tab.title || hostOf(url)}" as home page`, onClick: () => setNested('browser', { home: url }) },
    ]);
  };

  return (
    <div className="ie">
      <div className="ie-top">
        <div className="ex-navbtns">
          <button className="ex-round back big" disabled={tab.index === 0} onClick={back} aria-label="Back">
            <svg width="16" height="16" viewBox="0 0 14 14">
              <path d="M12 7H3M7 2.5L2.5 7 7 11.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="ex-round fwd" disabled={tab.index >= tab.history.length - 1} onClick={fwd} aria-label="Forward">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 7h9M7 2.5L11.5 7 7 11.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <form
          className="ex-address ie-address"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(address.startsWith('C:\\') && fs.resolve(address) ? `vfs:${fs.resolve(address)}` : normalizeUrl(address));
            e.currentTarget.querySelector('input').blur();
          }}
        >
          <span className="ex-addr-icon">
            <Icon name={external ? 'file-html' : 'iexplore'} size={16} />
          </span>
          <input
            className="ex-addr-input"
            value={address}
            onFocus={(e) => {
              setEditing(true);
              e.target.select();
            }}
            onBlur={() => setEditing(false)}
            onChange={(e) => setAddress(e.target.value)}
            aria-label="Address"
            spellCheck={false}
          />
          <button type="button" className="ex-addr-refresh" onClick={refresh} aria-label="Refresh" title="Refresh (F5)">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M11.5 7A4.5 4.5 0 1 1 9.8 3.5" stroke="#3a6f2a" strokeWidth="1.8" fill="none" />
              <path d="M8 1.5h4v4z" fill="#3a6f2a" />
            </svg>
          </button>
          <button type="button" className="ex-addr-refresh" onClick={() => updateTab(tab.id, () => ({ loading: false }))} aria-label="Stop" title="Stop (Esc)">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 2l8 8M10 2l-8 8" stroke="#c4210f" strokeWidth="2" />
            </svg>
          </button>
        </form>
        <form
          className="ex-search ie-search"
          onSubmit={(e) => {
            e.preventDefault();
            if (search.trim()) navigate(SEARCH(search));
          }}
        >
          <input className="ex-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Wikipedia" aria-label="Search the web" />
          <svg className="ex-search-ico" width="14" height="14" viewBox="0 0 14 14">
            <circle cx="5.5" cy="5.5" r="4" fill="none" stroke="#5a7390" strokeWidth="1.5" />
            <path d="M8.5 8.5l4 4" stroke="#5a7390" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </form>
      </div>
      <div className="ie-bars">
        <div className="ie-favbar">
          <button className={`ie-favbtn ${favOpen ? 'open' : ''}`} onClick={() => setFavOpen(!favOpen)}>
            <Icon name="star" size={16} /> Favorites
          </button>
          <button className="ie-addfav" title={isFav ? 'Remove from Favorites bar' : 'Add to Favorites bar (Ctrl+D)'} onClick={toggleFav} disabled={!external}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M8 1l2 4.3 4.6.5-3.4 3.1 1 4.6L8 11.2 3.8 13.5l1-4.6L1.4 5.8 6 5.3z" fill={isFav ? '#f5c33b' : '#fff'} stroke="#b07a00" />
              {!isFav && <path d="M11 10h4M13 8v4" stroke="#2c8f22" strokeWidth="2" />}
            </svg>
          </button>
          <div className="ie-favlinks">
            {settings.favorites.map((f) => (
              <button
                key={f.url}
                className="ie-favlink"
                onClick={() => navigate(f.url)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  ui.menu(e, [
                    { label: 'Open', bold: true, onClick: () => navigate(f.url) },
                    { label: 'Open in new tab', onClick: () => addTab(f.url) },
                    { separator: true },
                    { label: 'Delete', onClick: () => setNested('browser', { favorites: settings.favorites.filter((x) => x.url !== f.url) }) },
                  ]);
                }}
                title={f.url}
              >
                <Icon name="file-html" size={16} /> {f.title}
              </button>
            ))}
          </div>
        </div>
        <div className="ie-tabrow">
          <div className="ie-tabs">
            {tabs.map((t) => (
              <div key={t.id} className={`ie-tab ${t.id === activeTab ? 'active' : ''}`} onClick={() => setActiveTab(t.id)} onAuxClick={(e) => e.button === 1 && closeTab(t.id)} title={t.title}>
                <Icon name={t.history[t.index].startsWith('http') ? 'file-html' : 'iexplore'} size={16} />
                <span className="ie-tab-title">{t.loading ? 'Connecting...' : t.title || 'Blank Page'}</span>
                <button
                  className="ie-tab-close"
                  aria-label="Close tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button className="ie-newtab" onClick={() => addTab()} aria-label="New tab" title="New Tab (Ctrl+T)">
              <span />
            </button>
          </div>
          <div className="ie-cmdbar">
            <button className="tb-flat" title="Home" onClick={() => navigate(settings.home)}>
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M1.5 8L8 2l6.5 6" stroke="#2b5a8a" strokeWidth="1.6" fill="none" />
                <path d="M3.5 7.5V14h3.5v-4h2v4h3.5V7.5L8 3.5z" fill="#f5c33b" stroke="#a67400" />
              </svg>
            </button>
            <button className="tb-flat" title="Print" onClick={() => window.print()}>
              <Icon name="printer" size={16} />
            </button>
            <button
              className="tb-flat"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                ui.menuAt(r.left, r.bottom, [
                  { label: 'New window', onClick: () => launch('iexplore') },
                  { label: 'New tab', onClick: () => addTab() },
                  { separator: true },
                  { label: 'Zoom', submenu: [100, 125, 150, 200].map((z) => ({ label: `${z}%`, radio: true, checked: Math.round(zoom * 100) === z, onClick: () => setZoom(z / 100) })) },
                ]);
              }}
            >
              Page ▾
            </button>
            <button className="tb-flat" onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              ui.menuAt(r.left, r.bottom, [{ label: 'InPrivate Browsing', disabled: true }, { label: 'SmartScreen Filter', disabled: true }]);
            }}>
              Safety ▾
            </button>
            <button className="tb-flat" onClick={toolsMenu}>
              Tools ▾
            </button>
            <button className="tb-flat" title="Help" onClick={() => launch('help', { topic: 'iexplore' })}>
              <Icon name="help" size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="ie-content">
        {favOpen && (
          <div className="ie-favcenter">
            <div className="ie-favcenter-head">Favorites</div>
            {settings.favorites.map((f) => (
              <button
                key={f.url}
                className="ie-favcenter-item"
                onClick={() => {
                  navigate(f.url);
                  setFavOpen(false);
                }}
              >
                <Icon name="file-html" size={16} /> {f.title}
              </button>
            ))}
            <div className="ie-favcenter-head">History</div>
            {[...new Set(tab.history.filter((h) => h.startsWith('http')))].slice(-8).reverse().map((h) => (
              <button
                key={h}
                className="ie-favcenter-item"
                onClick={() => {
                  navigate(h);
                  setFavOpen(false);
                }}
              >
                <Icon name="clock" size={16} /> {hostOf(h)}
              </button>
            ))}
          </div>
        )}
        {tabs.map((t) => {
          const u = t.history[t.index];
          const show = t.id === activeTab;
          return (
            <div key={t.id} className="ie-page" style={{ display: show ? 'flex' : 'none' }}>
              {u.startsWith('http') && hint && show && (
                <div className="ie-infobar">
                  <Icon name="info" size={16} />
                  <span>If this page stays blank, the website doesn&rsquo;t allow being displayed inside other pages.</span>
                  <a onClick={() => window.open(u, '_blank', 'noopener')}>Open it in a new browser tab</a>
                  <button className="ie-infobar-close" onClick={() => setHint(false)} aria-label="Dismiss">
                    ✕
                  </button>
                </div>
              )}
              {u === 'about:home' ? (
                <HomePage onGo={navigate} favorites={settings.favorites} />
              ) : u === 'about:blank' ? (
                <div className="ie-blank" />
              ) : u.startsWith('vfs:') ? (
                <iframe key={t.reloadKey} title="page" className="ie-frame" sandbox="allow-scripts" srcDoc={show ? vfsHtml : ''} style={{ zoom }} />
              ) : u.startsWith('http') ? (
                <iframe
                  key={`${u}-${t.reloadKey}`}
                  title={t.title}
                  className="ie-frame"
                  src={u}
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
                  onLoad={() => updateTab(t.id, () => ({ loading: false }))}
                />
              ) : (
                <ErrorPage url={u} onRetry={refresh} />
              )}
            </div>
          );
        })}
      </div>
      <div className="ie-status">
        <span className="ie-status-main">{tab.loading ? `Waiting for ${hostOf(url)}...` : 'Done'}</span>
        <span className="ie-status-zone">
          <Icon name={external ? 'cp-network' : 'computer'} size={16} /> {external ? 'Internet | Protected Mode: On' : 'Local intranet'}
        </span>
        <button className="ie-status-zoom" onClick={() => setZoom((z) => (z >= 1.5 ? 1 : z + 0.25))}>
          🔍 {Math.round(zoom * 100)}% ▾
        </button>
      </div>
    </div>
  );
}
