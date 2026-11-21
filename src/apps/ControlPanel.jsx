import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.js';
import { settingsStore, setSettings, setNested, GLASS_COLORS, WALLPAPERS, SOLID_COLORS, THEMES, USER_PICTURES, hexToRgb, resetSettings } from '../state/settings.js';
import { fs, fsStore } from '../state/fs.js';
import { wm, ui, getRegistry } from '../state/wm.js';
import { Icon, UserPicture, Flag } from '../system/icons.jsx';
import { messageBox } from '../system/dialogs.jsx';
import { launch } from '../system/shell.jsx';
import { sound } from '../lib/sound.js';
import { Screensaver } from '../system/Screensaver.jsx';
import { AnalogClock, Calendar } from '../system/TrayFlyouts.jsx';

const BASE = import.meta.env.BASE_URL;
const wpUrl = (id) => `${BASE}${(WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0]).file}`;

// ---------------------------------------------------------------------------
// Page catalogue

const CATEGORIES = [
  { id: 'cat-security', title: 'System and Security', icon: 'cp-system', links: [['Review your computer’s status', 'system'], ['Back up your computer', 'recovery'], ['Find and fix problems', 'system']] },
  { id: 'cat-users', title: 'User Accounts and Family Safety', icon: 'cp-users', links: [['Add or remove user accounts', 'users'], ['Set up parental controls for any user', 'users']] },
  { id: 'cat-network', title: 'Network and Internet', icon: 'cp-network', links: [['View network status and tasks', 'network'], ['Choose homegroup and sharing options', 'network']] },
  { id: 'cat-appearance', title: 'Appearance and Personalization', icon: 'cp-appearance', links: [['Change the theme', 'personalization'], ['Change desktop background', 'background'], ['Adjust screen resolution', 'display']] },
  { id: 'cat-hardware', title: 'Hardware and Sound', icon: 'cp-hardware', links: [['View devices and printers', 'devices'], ['Add a device', 'devices']] },
  { id: 'cat-clock', title: 'Clock, Language, and Region', icon: 'cp-clock', links: [['Change keyboards or other input methods', 'datetime'], ['Change display language', 'datetime']] },
  { id: 'cat-programs', title: 'Programs', icon: 'cp-programs', links: [['Uninstall a program', 'programs']] },
  { id: 'cat-ease', title: 'Ease of Access', icon: 'cp-ease', links: [['Let Windows suggest settings', 'ease'], ['Optimize visual display', 'ease']] },
];

const CAT_TASKS = {
  'cat-security': [
    ['System', 'cp-system', 'system', ['View amount of RAM and processor speed', 'See the name of this computer']],
    ['Backup and Restore', 'cp-recovery', 'recovery', ['Back up your computer', 'Restore files from backup']],
    ['Power Options', 'cp-power', 'power', ['Change what the power buttons do', 'Change when the computer sleeps']],
  ],
  'cat-users': [['User Accounts', 'cp-users', 'users', ['Change your account picture', 'Change your Windows password']]],
  'cat-network': [['Network and Sharing Center', 'cp-network', 'network', ['View network status and tasks', 'Connect to a network']]],
  'cat-appearance': [
    ['Personalization', 'cp-appearance', 'personalization', ['Change the theme', 'Change desktop background', 'Change window glass colors', 'Change screen saver']],
    ['Display', 'cp-display', 'display', ['Make text and other items larger or smaller', 'Adjust screen resolution']],
    ['Taskbar and Start Menu', 'cp-taskbar', 'taskbar', ['Customize the Start menu', 'Customize icons on the taskbar']],
    ['Desktop Gadgets', 'screensaver', 'desktopicons', ['Change desktop icons']],
  ],
  'cat-hardware': [
    ['Devices and Printers', 'printer', 'devices', ['Add a device', 'Mouse']],
    ['Sound', 'cp-sound', 'sound', ['Adjust system volume', 'Change system sounds']],
    ['Power Options', 'cp-power', 'power', ['Change battery settings']],
    ['Display', 'cp-display', 'display', ['Adjust screen resolution']],
  ],
  'cat-clock': [['Date and Time', 'clock', 'datetime', ['Set the time and date', 'Change the time zone']]],
  'cat-programs': [
    ['Programs and Features', 'cp-programs', 'programs', ['Uninstall a program', 'View installed updates']],
    ['Default Programs', 'defaultprograms', 'defaults', ['Make a file type always open in a specific program']],
  ],
  'cat-ease': [['Ease of Access Center', 'cp-ease', 'ease', ['Optimize visual display', 'Change how your mouse works']]],
};

const PAGES = {
  home: { title: 'Control Panel' },
  system: { title: 'System', parent: 'cat-security', icon: 'cp-system' },
  recovery: { title: 'Backup and Restore', parent: 'cat-security', icon: 'cp-recovery' },
  power: { title: 'Power Options', parent: 'cat-security', icon: 'cp-power' },
  users: { title: 'User Accounts', parent: 'cat-users', icon: 'cp-users' },
  network: { title: 'Network and Sharing Center', parent: 'cat-network', icon: 'cp-network' },
  personalization: { title: 'Personalization', parent: 'cat-appearance', icon: 'cp-appearance' },
  background: { title: 'Desktop Background', parent: 'personalization', icon: 'cp-appearance' },
  color: { title: 'Window Color and Appearance', parent: 'personalization', icon: 'cp-appearance' },
  screensaver: { title: 'Screen Saver Settings', parent: 'personalization', icon: 'screensaver' },
  desktopicons: { title: 'Desktop Icon Settings', parent: 'personalization', icon: 'computer' },
  display: { title: 'Display', parent: 'cat-appearance', icon: 'cp-display' },
  taskbar: { title: 'Taskbar and Start Menu', parent: 'cat-appearance', icon: 'cp-taskbar' },
  appearance: { title: 'Appearance and Personalization', parent: 'home', category: 'cat-appearance' },
  devices: { title: 'Devices and Printers', parent: 'cat-hardware', icon: 'printer' },
  sound: { title: 'Sound', parent: 'cat-hardware', icon: 'cp-sound' },
  datetime: { title: 'Date and Time', parent: 'cat-clock', icon: 'clock' },
  programs: { title: 'Programs and Features', parent: 'cat-programs', icon: 'cp-programs' },
  defaults: { title: 'Default Programs', parent: 'cat-programs', icon: 'defaultprograms' },
  ease: { title: 'Ease of Access Center', parent: 'cat-ease', icon: 'cp-ease' },
};
for (const c of CATEGORIES) PAGES[c.id] = { title: c.title, parent: 'home', category: c.id, icon: c.icon };

function trail(page) {
  const out = [];
  for (let p = page; p && p !== 'home'; p = PAGES[p]?.parent) out.unshift(p);
  return out;
}

// ---------------------------------------------------------------------------
// Shared bits

function Sidebar({ go, links = [], seeAlso = [] }) {
  return (
    <div className="cp-side">
      <a className="cp-side-home" onClick={() => go('home')}>
        Control Panel Home
      </a>
      {links.map(([label, page, icon]) => (
        <a key={label} className="cp-side-link" onClick={() => (typeof page === 'function' ? page() : go(page))}>
          {icon && <Icon name={icon} size={16} />}
          {label}
        </a>
      ))}
      {seeAlso.length > 0 && (
        <div className="cp-seealso">
          <div className="cp-seealso-head">See also</div>
          {seeAlso.map(([label, page]) => (
            <a key={label} className="cp-side-link" onClick={() => go(page)}>
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Page({ go, side, title, sub, children, footer }) {
  return (
    <div className="cp-page">
      {side !== false && (side || <Sidebar go={go} />)}
      <div className="cp-main-wrap">
        <div className="cp-main w7-scroll">
          {title && <h1 className="cp-h1">{title}</h1>}
          {sub && <p className="cp-sub">{sub}</p>}
          {children}
        </div>
        {footer && <div className="cp-footer">{footer}</div>}
      </div>
    </div>
  );
}

function SaveCancel({ onSave, onCancel, saveLabel = 'Save changes', disabled }) {
  return (
    <>
      <button className="w7-btn" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </button>
      <button className="w7-btn" onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}

/** Live-preview helper: apply changes immediately, revert on cancel/unmount unless saved. */
function usePreview(keys) {
  const original = useRef(null);
  const saved = useRef(false);
  if (!original.current) {
    const s = settingsStore.get();
    original.current = Object.fromEntries(keys.map((k) => [k, s[k]]));
  }
  useEffect(
    () => () => {
      if (!saved.current) setSettings(original.current);
    },
    []
  );
  return {
    save() {
      saved.current = true;
      original.current = Object.fromEntries(keys.map((k) => [k, settingsStore.get()[k]]));
    },
    cancel() {
      setSettings(original.current);
    },
  };
}

// ---------------------------------------------------------------------------
// Pages

function Home({ go }) {
  return (
    <div className="cp-home w7-scroll">
      <div className="cp-home-head">
        <h1 className="cp-h1">Adjust your computer&rsquo;s settings</h1>
        <div className="cp-viewby">
          View by: <a>Category ▾</a>
        </div>
      </div>
      <div className="cp-cats">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="cp-cat">
            <a className="cp-cat-icon" onClick={() => go(c.id)}>
              <Icon name={c.icon} size={48} />
            </a>
            <div>
              <a className="cp-cat-title" onClick={() => go(c.id)}>
                {c.title}
              </a>
              {c.links.map(([l, p]) => (
                <a key={l} className="cp-cat-link" onClick={() => go(p)}>
                  {l}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Category({ id, go }) {
  const tasks = CAT_TASKS[id] || [];
  return (
    <Page
      go={go}
      side={
        <div className="cp-side">
          <a className="cp-side-home" onClick={() => go('home')}>
            Control Panel Home
          </a>
          {CATEGORIES.map((c) => (
            <a key={c.id} className={`cp-side-link ${c.id === id ? 'current' : ''}`} onClick={() => go(c.id)}>
              {c.title}
            </a>
          ))}
        </div>
      }
    >
      <div className="cp-tasks">
        {tasks.map(([title, icon, page, links]) => (
          <div key={title} className="cp-task">
            <Icon name={icon} size={48} />
            <div>
              <a className="cp-task-title" onClick={() => go(page)}>
                {title}
              </a>
              <div className="cp-task-links">
                {links.map((l) => (
                  <a key={l} onClick={() => go(page)}>
                    {l}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

function ThemeThumb({ wallpaper, color, selected, onClick, label }) {
  const rgb = hexToRgb(color);
  return (
    <button className={`cp-theme ${selected ? 'sel' : ''}`} onClick={onClick}>
      <span className="cp-theme-img" style={{ backgroundImage: `url("${wallpaper}")` }}>
        <span className="cp-theme-win" style={{ background: `rgba(${rgb.join(',')},0.55)` }}>
          <span />
        </span>
        <span className="cp-theme-swatch" style={{ background: color }} />
      </span>
      <span className="cp-theme-label">{label}</span>
    </button>
  );
}

function Personalization({ go }) {
  const s = useStore(settingsStore);
  const colorName = GLASS_COLORS.find((c) => c.hex === s.glassColor)?.name || 'Custom';
  const current = THEMES.find((t) => t.wallpaper === s.wallpaper && GLASS_COLORS.find((c) => c.name === t.color)?.hex === s.glassColor);
  const wpName = s.wallpaper === 'solid' ? 'Solid color' : s.wallpaper === 'custom' ? 'Custom' : WALLPAPERS.find((w) => w.id === s.wallpaper)?.name;
  const ssName = { none: '(None)', mystify: 'Mystify', ribbons: 'Ribbons', bubbles: 'Bubbles', blank: 'Blank' }[s.screensaver.type];
  return (
    <Page
      go={go}
      title="Change the visuals and sounds on your computer"
      sub="Click a theme to change the desktop background, window color, sounds, and screen saver all at once."
      side={
        <Sidebar
          go={go}
          links={[
            ['Change desktop icons', 'desktopicons'],
            ['Change mouse pointers', 'ease'],
            ['Change your account picture', 'users'],
          ]}
          seeAlso={[
            ['Display', 'display'],
            ['Taskbar and Start Menu', 'taskbar'],
            ['Ease of Access Center', 'ease'],
          ]}
        />
      }
      footer={null}
    >
      <div className="cp-themes-box w7-scroll">
        <div className="cp-themes-group">My Themes (1)</div>
        <div className="cp-themes">
          <ThemeThumb label="Unsaved Theme" wallpaper={s.wallpaper === 'custom' && s.customWallpaper ? s.customWallpaper : s.wallpaper === 'solid' ? '' : wpUrl(s.wallpaper)} color={s.glassColor} selected={!current} onClick={() => {}} />
        </div>
        <div className="cp-themes-group">Aero Themes ({THEMES.length})</div>
        <div className="cp-themes">
          {THEMES.map((t) => {
            const c = GLASS_COLORS.find((g) => g.name === t.color);
            return (
              <ThemeThumb
                key={t.id}
                label={t.name}
                wallpaper={wpUrl(t.wallpaper)}
                color={c.hex}
                selected={current?.id === t.id}
                onClick={() => setSettings({ wallpaper: t.wallpaper, glassColor: c.hex, glassIntensity: c.a, transparency: true })}
              />
            );
          })}
        </div>
        <div className="cp-themes-group">Basic and High Contrast Themes (1)</div>
        <div className="cp-themes">
          <ThemeThumb label="Windows 7 Basic" wallpaper={wpUrl('harmony')} color="#9ab8d8" selected={false} onClick={() => setSettings({ wallpaper: 'harmony', glassColor: '#74b8fc', glassIntensity: 0.42, transparency: false })} />
        </div>
      </div>
      <div className="cp-perso-links">
        <button className="cp-perso-link" onClick={() => go('background')}>
          <span className="cp-perso-thumb" style={{ background: s.wallpaper === 'solid' ? s.solidColor : `center/cover url("${s.wallpaper === 'custom' && s.customWallpaper ? s.customWallpaper : wpUrl(s.wallpaper)}")` }} />
          <a>Desktop Background</a>
          <span>{wpName}</span>
        </button>
        <button className="cp-perso-link" onClick={() => go('color')}>
          <span className="cp-perso-thumb swatch" style={{ background: `linear-gradient(135deg, rgba(255,255,255,.6), rgba(255,255,255,0) 60%), ${s.glassColor}` }} />
          <a>Window Color</a>
          <span>{colorName}</span>
        </button>
        <button className="cp-perso-link" onClick={() => go('sound')}>
          <span className="cp-perso-thumb icon">
            <Icon name="cp-sound" size={40} />
          </span>
          <a>Sounds</a>
          <span>{s.sounds ? 'Windows Default' : 'No Sounds'}</span>
        </button>
        <button className="cp-perso-link" onClick={() => go('screensaver')}>
          <span className="cp-perso-thumb icon">
            <Icon name="screensaver" size={40} />
          </span>
          <a>Screen Saver</a>
          <span>{ssName}</span>
        </button>
      </div>
    </Page>
  );
}

function resizeImage(file, max = 1920) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function Background({ go, winId }) {
  const s = useStore(settingsStore);
  const preview = usePreview(['wallpaper', 'customWallpaper', 'solidColor', 'wallpaperPosition']);
  const [location, setLocation] = useState(s.wallpaper === 'solid' ? 'solid' : 'windows');
  const fileRef = useRef(null);
  const nodes = useStore(fsStore, (st) => st.nodes);
  const userPics = useMemo(() => Object.values(nodes).filter((n) => n.type === 'file' && typeof n.content === 'string' && n.content.startsWith('data:image') && n.parent !== 'recycle'), [nodes]);
  const groups = WALLPAPERS.reduce((acc, w) => ({ ...acc, [w.group]: [...(acc[w.group] || []), w] }), {});
  return (
    <Page
      go={go}
      title="Choose your desktop background"
      sub="Click a picture to make it your desktop background, or select more than one picture to create a slide show."
      footer={
        <SaveCancel
          onSave={() => {
            preview.save();
            go('personalization');
          }}
          onCancel={() => {
            preview.cancel();
            go('personalization');
          }}
        />
      }
    >
      <div className="cp-row">
        <label>Picture location:</label>
        <select className="w7-select cp-wide-select" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="windows">Windows Desktop Backgrounds</option>
          <option value="pictures">Pictures Library</option>
          <option value="solid">Solid Colors</option>
        </select>
        <button className="w7-btn" onClick={() => fileRef.current?.click()}>
          Browse...
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const url = await resizeImage(f);
              setSettings({ wallpaper: 'custom', customWallpaper: url });
            } catch {
              messageBox({ title: 'Desktop Background', text: 'That picture could not be opened.', icon: 'error', owner: winId });
            }
            e.target.value = '';
          }}
        />
      </div>
      <div className="cp-wp-grid w7-scroll">
        {location === 'solid' ? (
          <div className="cp-wp-row">
            {SOLID_COLORS.map((c) => (
              <button key={c} className={`cp-wp solid ${s.wallpaper === 'solid' && s.solidColor === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => setSettings({ wallpaper: 'solid', solidColor: c })} aria-label={c} />
            ))}
            <label className="cp-wp solid custom" title="More...">
              <input type="color" value={s.solidColor} onChange={(e) => setSettings({ wallpaper: 'solid', solidColor: e.target.value })} />
              More...
            </label>
          </div>
        ) : location === 'pictures' ? (
          <div className="cp-wp-row">
            {userPics.length === 0 && <p className="cp-muted">No pictures yet. Save a drawing from Paint to your Pictures folder, or drag images onto the desktop.</p>}
            {userPics.map((n) => (
              <button key={n.id} className={`cp-wp ${s.wallpaper === 'custom' && s.customWallpaper === n.content ? 'sel' : ''}`} style={{ backgroundImage: `url("${n.content}")` }} title={n.name} onClick={() => setSettings({ wallpaper: 'custom', customWallpaper: n.content })} />
            ))}
          </div>
        ) : (
          Object.entries(groups).map(([g, list]) => (
            <div key={g}>
              <div className="cp-themes-group">
                {g} ({list.length})
              </div>
              <div className="cp-wp-row">
                {list.map((w) => (
                  <button key={w.id} className={`cp-wp ${s.wallpaper === w.id ? 'sel' : ''}`} style={{ backgroundImage: `url("${BASE}${w.file}")` }} title={w.name} onClick={() => setSettings({ wallpaper: w.id })}>
                    <input type="checkbox" className="w7-check" checked={s.wallpaper === w.id} readOnly tabIndex={-1} />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
        {s.wallpaper === 'custom' && s.customWallpaper && location === 'windows' && (
          <>
            <div className="cp-themes-group">Custom (1)</div>
            <div className="cp-wp-row">
              <button className="cp-wp sel" style={{ backgroundImage: `url("${s.customWallpaper}")` }} />
            </div>
          </>
        )}
      </div>
      <div className="cp-row">
        <label>Picture position:</label>
        <select className="w7-select" value={s.wallpaperPosition} onChange={(e) => setSettings({ wallpaperPosition: e.target.value })}>
          <option value="fill">Fill</option>
          <option value="fit">Fit</option>
          <option value="stretch">Stretch</option>
          <option value="tile">Tile</option>
          <option value="center">Center</option>
        </select>
      </div>
    </Page>
  );
}

function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

function WindowColor({ go }) {
  const s = useStore(settingsStore);
  const preview = usePreview(['glassColor', 'glassIntensity', 'transparency']);
  const [mixer, setMixer] = useState(false);
  const preset = GLASS_COLORS.find((c) => c.hex === s.glassColor);
  const [h, sat, l] = rgbToHsl(hexToRgb(s.glassColor));
  return (
    <Page
      go={go}
      side={false}
      title="Change the color of your window borders, Start menu, and taskbar"
      footer={
        <SaveCancel
          onSave={() => {
            preview.save();
            go('personalization');
          }}
          onCancel={() => {
            preview.cancel();
            go('personalization');
          }}
        />
      }
    >
      <div className="cp-swatches">
        {GLASS_COLORS.map((c) => (
          <button key={c.name} className={`cp-swatch ${s.glassColor === c.hex ? 'sel' : ''}`} title={c.name} aria-label={c.name} onClick={() => setSettings({ glassColor: c.hex, glassIntensity: c.a })}>
            <span style={{ background: c.hex }} />
          </button>
        ))}
      </div>
      <p>Current color: {preset?.name || 'Custom'}</p>
      <label className="w7-label cp-check">
        <input type="checkbox" className="w7-check" checked={s.transparency} onChange={(e) => setSettings({ transparency: e.target.checked })} />
        Enable transparency
      </label>
      <div className="cp-slider-row">
        <label>Color intensity:</label>
        <input type="range" className="w7-range" min="0.1" max="0.9" step="0.01" value={s.glassIntensity} onChange={(e) => setSettings({ glassIntensity: +e.target.value })} />
      </div>
      <button className="cp-expander" onClick={() => setMixer(!mixer)}>
        <span className={`cp-exp-arrow ${mixer ? 'open' : ''}`} />
        {mixer ? 'Hide color mixer' : 'Show color mixer'}
      </button>
      {mixer && (
        <div className="cp-mixer">
          {[
            ['Hue', h, 0, 359, (v) => hslToHex(v, sat, l), 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)'],
            ['Saturation', sat, 0, 100, (v) => hslToHex(h, v, l), `linear-gradient(to right, ${hslToHex(h, 0, l)}, ${hslToHex(h, 100, l)})`],
            ['Brightness', l, 5, 95, (v) => hslToHex(h, sat, v), `linear-gradient(to right, #000, ${hslToHex(h, sat, 50)}, #fff)`],
          ].map(([label, val, min, max, toHex, bg]) => (
            <div key={label} className="cp-slider-row">
              <label>{label}:</label>
              <div className="cp-mixer-track" style={{ background: bg }}>
                <input type="range" className="w7-range" min={min} max={max} value={val} onChange={(e) => setSettings({ glassColor: toHex(+e.target.value) })} />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="cp-muted" style={{ marginTop: 18 }}>
        Tip: changes preview live on every window and the taskbar. Click <b>Save changes</b> to keep them.
      </p>
    </Page>
  );
}

function ScreenSaverPage({ go, winId }) {
  const s = useStore(settingsStore);
  const [type, setType] = useState(s.screensaver.type);
  const [wait, setWait] = useState(s.screensaver.wait);
  const [running, setRunning] = useState(false);
  return (
    <Page
      go={go}
      side={false}
      title="Screen Saver Settings"
      footer={
        <>
          <button
            className="w7-btn"
            onClick={() => {
              setNested('screensaver', { type, wait });
              go('personalization');
            }}
          >
            OK
          </button>
          <button className="w7-btn" onClick={() => go('personalization')}>
            Cancel
          </button>
          <button className="w7-btn" onClick={() => setNested('screensaver', { type, wait })}>
            Apply
          </button>
        </>
      }
    >
      <div className="cp-monitor">
        <div className="cp-monitor-screen">{type !== 'none' ? <Screensaver key={type} type={type} preview /> : <div className="cp-monitor-wp" style={{ backgroundImage: `url("${wpUrl(s.wallpaper === 'custom' || s.wallpaper === 'solid' ? 'harmony' : s.wallpaper)}")` }} />}</div>
        <div className="cp-monitor-stand" />
      </div>
      <fieldset className="w7-group">
        <legend>Screen saver</legend>
        <div className="cp-row">
          <select className="w7-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="none">(None)</option>
            <option value="blank">Blank</option>
            <option value="bubbles">Bubbles</option>
            <option value="mystify">Mystify</option>
            <option value="ribbons">Ribbons</option>
          </select>
          <button className="w7-btn" disabled={type === 'none'} onClick={() => setRunning(true)}>
            Preview
          </button>
        </div>
        <div className="cp-row">
          <label>Wait:</label>
          <input type="number" min="1" max="999" className="w7-input" style={{ width: 60 }} value={wait} onChange={(e) => setWait(Math.max(1, +e.target.value || 1))} />
          <span>minutes</span>
        </div>
      </fieldset>
      {running && <Screensaver type={type} onExit={() => setRunning(false)} />}
      <input type="hidden" value={winId} />
    </Page>
  );
}

function DesktopIcons({ go }) {
  const s = useStore(settingsStore);
  const list = [
    ['computer', 'Computer', 'computer'],
    ['user', "User's Files", 'folder-user'],
    ['network', 'Network', 'network'],
    ['recycle', 'Recycle Bin', 'recycle-empty'],
    ['controlpanel', 'Control Panel', 'controlpanel'],
  ];
  return (
    <Page go={go} title="Desktop Icon Settings" sub="Choose which icons appear on your desktop.">
      <fieldset className="w7-group">
        <legend>Desktop icons</legend>
        <div className="cp-iconchecks">
          {list.map(([k, label]) => (
            <label key={k} className="w7-label">
              <input type="checkbox" className="w7-check" checked={!!s.sysIcons[k]} onChange={(e) => setNested('sysIcons', { [k]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        <div className="cp-iconrow">
          {list.map(([k, label, icon]) => (
            <div key={k} className="cp-iconpreview">
              <Icon name={icon} size={48} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="cp-row">
        <button className="w7-btn" onClick={() => setSettings({ iconPositions: {} })}>
          Restore Default
        </button>
      </div>
    </Page>
  );
}

function SystemPage({ go }) {
  const s = useStore(settingsStore);
  const cores = navigator.hardwareConcurrency || 2;
  const mem = navigator.deviceMemory ? `${navigator.deviceMemory}.00 GB` : '4.00 GB';
  const touch = navigator.maxTouchPoints > 0 ? `Full Windows Touch Support with ${navigator.maxTouchPoints} Touch Points` : 'No Pen or Touch Input is available for this Display';
  let used = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) used += (localStorage.getItem(localStorage.key(i)) || '').length;
  } catch {
    /* ignore */
  }
  const rows = (pairs) =>
    pairs.map(([a, b]) => (
      <React.Fragment key={a}>
        <span className="cp-sys-k">{a}</span>
        <span>{b}</span>
      </React.Fragment>
    ));
  return (
    <Page
      go={go}
      side={
        <Sidebar
          go={go}
          links={[
            ['Device Manager', 'devices', 'shield'],
            ['Remote settings', 'network', 'shield'],
            ['System protection', 'recovery', 'shield'],
            ['Advanced system settings', 'recovery', 'shield'],
          ]}
          seeAlso={[
            ['Action Center', 'system'],
            ['Windows Update', 'system'],
            ['Performance Information and Tools', 'system'],
          ]}
        />
      }
      title="View basic information about your computer"
    >
      <div className="cp-sys-flag">
        <svg width="110" height="110" viewBox="-2 -1 22 22">
          <Flag />
        </svg>
      </div>
      <h2 className="cp-h2">Windows edition</h2>
      <div className="cp-sys-grid">
        <span className="cp-sys-k" />
        <span>
          Windows 7 Ultimate
          <br />
          Service Pack 1
          <br />
          Browser-based simulator &mdash; not affiliated with Microsoft.
        </span>
      </div>
      <h2 className="cp-h2">System</h2>
      <div className="cp-sys-grid">
        {rows([
          [
            'Rating:',
            <span key="r" className="cp-wei">
              <span className="cp-wei-badge">5.9</span> <a onClick={() => launch('taskmgr')}>Windows Experience Index</a>
            </span>,
          ],
          ['Processor:', `Virtual CPU (${cores} logical processor${cores > 1 ? 's' : ''})`],
          ['Installed memory (RAM):', mem],
          ['System type:', '64-bit Operating System'],
          ['Pen and Touch:', touch],
          ['Local storage used:', `${(used / 1024).toFixed(1)} KB`],
        ])}
      </div>
      <h2 className="cp-h2">Computer name, domain, and workgroup settings</h2>
      <div className="cp-sys-grid">
        {rows([
          ['Computer name:', `${s.username.toUpperCase().replace(/\s+/g, '')}-PC`],
          ['Full computer name:', `${s.username.toUpperCase().replace(/\s+/g, '')}-PC`],
          ['Workgroup:', 'WORKGROUP'],
        ])}
      </div>
      <h2 className="cp-h2">Windows activation</h2>
      <div className="cp-sys-grid">{rows([['', 'Windows is activated']])}</div>
    </Page>
  );
}

function Users({ go, winId }) {
  const s = useStore(settingsStore);
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(s.username);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [hint, setHint] = useState('');
  const [current, setCurrent] = useState('');
  const [pic, setPic] = useState(s.userPicture);

  const header = (
    <div className="cp-user-card">
      <span className="cp-user-pic">
        <UserPicture name={s.userPicture} size={64} />
      </span>
      <div>
        <div className="cp-user-name">{s.username}</div>
        <div className="cp-muted">Administrator</div>
        <div className="cp-muted">{s.password ? 'Password protected' : ''}</div>
      </div>
    </div>
  );

  if (mode === 'name')
    return (
      <Page go={go} title="Change your name" sub="Type a new account name">
        {header}
        <input className="w7-input" style={{ width: 260 }} value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={20} />
        <p className="cp-muted">This name will appear on the Welcome screen and on the Start menu.</p>
        <div className="cp-row">
          <button
            className="w7-btn"
            disabled={!name.trim()}
            onClick={() => {
              setSettings({ username: name.trim() });
              setMode(null);
            }}
          >
            Change Name
          </button>
          <button className="w7-btn" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      </Page>
    );

  if (mode === 'picture')
    return (
      <Page go={go} title="Choose a new picture for your account" sub="Your picture appears on the Welcome screen and on the Start menu.">
        {header}
        <div className="cp-pics">
          {USER_PICTURES.map((p) => (
            <button key={p} className={`cp-pic ${pic === p ? 'sel' : ''}`} onClick={() => setPic(p)} aria-label={p}>
              <UserPicture name={p} size={64} />
            </button>
          ))}
        </div>
        <div className="cp-row">
          <button
            className="w7-btn"
            onClick={() => {
              setSettings({ userPicture: pic });
              setMode(null);
            }}
          >
            Change Picture
          </button>
          <button className="w7-btn" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      </Page>
    );

  if (mode === 'password' || mode === 'removepw')
    return (
      <Page go={go} title={mode === 'removepw' ? 'Remove your password' : s.password ? 'Change your password' : 'Create a password for your account'}>
        {header}
        <div className="cp-pwform">
          {s.password && <input type="password" className="w7-input" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          {mode === 'password' && (
            <>
              <input type="password" className="w7-input" placeholder="New password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
              <input type="password" className="w7-input" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              <input className="w7-input" placeholder="Type a password hint" value={hint} onChange={(e) => setHint(e.target.value)} />
              <p className="cp-muted">The password hint will be visible to everyone who uses this computer. Passwords are stored only in this browser and are not secure&mdash;don&rsquo;t reuse a real one.</p>
            </>
          )}
        </div>
        <div className="cp-row">
          <button
            className="w7-btn"
            onClick={() => {
              if (s.password && current !== s.password) return messageBox({ title: 'User Accounts', text: 'The password is incorrect. Please retype your current password.', icon: 'error', owner: winId });
              if (mode === 'removepw') {
                setSettings({ password: '', passwordHint: '' });
                return setMode(null);
              }
              if (!pw1) return messageBox({ title: 'User Accounts', text: 'Type a new password.', icon: 'warning', owner: winId });
              if (pw1 !== pw2) return messageBox({ title: 'User Accounts', text: 'The passwords you typed do not match. Please retype the new password in both boxes.', icon: 'error', owner: winId });
              setSettings({ password: pw1, passwordHint: hint });
              setPw1('');
              setPw2('');
              setCurrent('');
              setMode(null);
            }}
          >
            {mode === 'removepw' ? 'Remove Password' : s.password ? 'Change password' : 'Create password'}
          </button>
          <button className="w7-btn" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      </Page>
    );

  return (
    <Page go={go} title="Make changes to your user account">
      <div className="cp-user-layout">
        <div className="cp-user-links">
          {s.password ? (
            <>
              <a onClick={() => setMode('password')}>Change your password</a>
              <a onClick={() => setMode('removepw')}>Remove your password</a>
            </>
          ) : (
            <a onClick={() => setMode('password')}>Create a password for your account</a>
          )}
          <a onClick={() => setMode('picture')}>Change your picture</a>
          <a onClick={() => setMode('name')}>Change your account name</a>
          <a onClick={() => setMode('name')}>Change your account type</a>
        </div>
        {header}
      </div>
    </Page>
  );
}

function DateTime({ go }) {
  const s = useStore(settingsStore);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const off = -now.getTimezoneOffset();
  const offStr = `UTC${off >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}:${String(Math.abs(off) % 60).padStart(2, '0')}`;
  return (
    <Page go={go} title="Date and Time">
      <div className="cp-dt">
        <AnalogClock date={now} size={140} />
        <div>
          <p>
            Date: <b>{now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</b>
          </p>
          <p>
            Time: <b>{now.toLocaleTimeString([], { hour12: !s.clock24 })}</b>
          </p>
          <button className="w7-btn" disabled title="The clock is synchronized with your device.">
            Change date and time...
          </button>
        </div>
        <Calendar value={now} />
      </div>
      <fieldset className="w7-group">
        <legend>Time zone</legend>
        <p>
          ({offStr}) {tz.replace(/_/g, ' ')}
        </p>
        <p className="cp-muted">This computer is set to automatically synchronize with your device&rsquo;s clock.</p>
      </fieldset>
      <fieldset className="w7-group">
        <legend>Formats</legend>
        <label className="w7-label">
          <input type="checkbox" className="w7-check" checked={s.clock24} onChange={(e) => setSettings({ clock24: e.target.checked })} />
          Use 24-hour clock
        </label>
      </fieldset>
    </Page>
  );
}

function TaskbarPage({ go }) {
  const s = useStore(settingsStore);
  const t = s.taskbar;
  return (
    <Page go={go} title="Taskbar and Start Menu Properties">
      <fieldset className="w7-group">
        <legend>Taskbar appearance</legend>
        <div className="cp-checks">
          <label className="w7-label">
            <input type="checkbox" className="w7-check" checked={t.locked} onChange={(e) => setNested('taskbar', { locked: e.target.checked })} />
            Lock the taskbar
          </label>
          <label className="w7-label">
            <input type="checkbox" className="w7-check" checked={t.autoHide} onChange={(e) => setNested('taskbar', { autoHide: e.target.checked })} />
            Auto-hide the taskbar
          </label>
          <label className="w7-label">
            <input type="checkbox" className="w7-check" checked={t.smallIcons} onChange={(e) => setNested('taskbar', { smallIcons: e.target.checked })} />
            Use small icons
          </label>
        </div>
        <div className="cp-row">
          <label>Taskbar location on screen:</label>
          <select className="w7-select" disabled>
            <option>Bottom</option>
          </select>
        </div>
        <div className="cp-row">
          <label>Taskbar buttons:</label>
          <select className="w7-select" disabled>
            <option>Always combine, hide labels</option>
          </select>
        </div>
      </fieldset>
      <fieldset className="w7-group">
        <legend>Preview desktop with Aero Peek</legend>
        <p className="cp-muted">Temporarily view the desktop when you move your mouse to the Show desktop button at end of the taskbar.</p>
        <label className="w7-label">
          <input type="checkbox" className="w7-check" checked={t.peek} onChange={(e) => setNested('taskbar', { peek: e.target.checked })} />
          Use Aero Peek to preview the desktop
        </label>
      </fieldset>
      <fieldset className="w7-group">
        <legend>Pinned programs</legend>
        <div className="cp-pinned">
          {Object.entries(getRegistry())
            .filter(([, a]) => !a.hidden && a.name !== 'Getting Started')
            .map(([id, a]) => (
              <label key={id} className="w7-label">
                <input
                  type="checkbox"
                  className="w7-check"
                  checked={t.pinned.includes(id)}
                  onChange={(e) => setNested('taskbar', { pinned: e.target.checked ? [...t.pinned, id] : t.pinned.filter((x) => x !== id) })}
                />
                <Icon name={a.icon} size={16} /> {a.name}
              </label>
            ))}
        </div>
      </fieldset>
      <fieldset className="w7-group">
        <legend>Startup</legend>
        <label className="w7-label">
          <input type="checkbox" className="w7-check" checked={s.bootAnimation} onChange={(e) => setSettings({ bootAnimation: e.target.checked })} />
          Show the &ldquo;Starting Windows&rdquo; animation
        </label>
      </fieldset>
    </Page>
  );
}

function Programs({ go, winId }) {
  const reg = getRegistry();
  const list = Object.entries(reg).filter(([, a]) => !a.hidden);
  return (
    <Page
      go={go}
      title="Uninstall or change a program"
      sub="To uninstall a program, select it from the list and then click Uninstall, Change, or Repair."
      side={<Sidebar go={go} links={[['View installed updates', 'programs'], ['Turn Windows features on or off', 'programs', 'shield']]} />}
    >
      <div className="cp-table">
        <div className="cp-thead">
          <span>Name</span>
          <span>Publisher</span>
          <span>Installed On</span>
          <span>Size</span>
        </div>
        {list.map(([id, a], i) => (
          <div
            key={id}
            className="cp-trow"
            onDoubleClick={() => messageBox({ title: 'Programs and Features', text: `${a.name} is part of Windows and can’t be uninstalled.`, icon: 'info', owner: winId })}
          >
            <span>
              <Icon name={a.icon} size={16} /> {a.name}
            </span>
            <span>Windows 7 Simulator</span>
            <span>10/22/2009</span>
            <span>{((i * 37) % 90) + 4} MB</span>
          </div>
        ))}
      </div>
    </Page>
  );
}

function NetworkPage({ go }) {
  const online = navigator.onLine;
  return (
    <Page go={go} title="View your basic network information and set up connections" side={<Sidebar go={go} links={[['Change adapter settings', 'network'], ['Change advanced sharing settings', 'network']]} />}>
      <div className="cp-netmap">
        <div className="cp-netnode">
          <Icon name="computer" size={48} />
          <span>{settingsStore.get().username.toUpperCase()}-PC</span>
          <span className="cp-muted">(This computer)</span>
        </div>
        <span className={`cp-netline ${online ? '' : 'broken'}`} />
        <div className="cp-netnode">
          <Icon name="network" size={48} />
          <span>Network</span>
        </div>
        <span className={`cp-netline ${online ? '' : 'broken'}`} />
        <div className="cp-netnode">
          <Icon name="cp-network" size={48} />
          <span>Internet</span>
        </div>
      </div>
      <h2 className="cp-h2">View your active networks</h2>
      <div className="cp-sys-grid">
        <span className="cp-sys-k">Access type:</span>
        <span>{online ? 'Internet' : 'No Internet access'}</span>
        <span className="cp-sys-k">Connections:</span>
        <span>Wireless Network Connection (HomeNetwork)</span>
      </div>
    </Page>
  );
}

function Devices({ go }) {
  const devs = [
    ['computer', `${settingsStore.get().username.toUpperCase()}-PC`],
    ['cp-display', 'Generic PnP Monitor'],
    ['cp-mouse', 'USB Input Device'],
    ['cp-sound', 'Speakers'],
    ['printer', 'XPS Document Writer'],
    ['printer', 'Fax'],
  ];
  return (
    <Page go={go} side={false}>
      <div className="ex-command cp-devcmd">
        <button className="tb-flat">Add a device</button>
        <button className="tb-flat">Add a printer</button>
      </div>
      <div className="ex-group-head">Devices ({devs.length - 2})</div>
      <div className="cp-devices">
        {devs.slice(0, 4).map(([i, n]) => (
          <div key={n} className="cp-device">
            <Icon name={i} size={48} />
            <span>{n}</span>
          </div>
        ))}
      </div>
      <div className="ex-group-head">Printers and Faxes (2)</div>
      <div className="cp-devices">
        {devs.slice(4).map(([i, n]) => (
          <div key={n} className="cp-device">
            <Icon name={i} size={48} />
            <span>{n}</span>
          </div>
        ))}
      </div>
    </Page>
  );
}

function SoundPage({ go }) {
  const s = useStore(settingsStore);
  return (
    <Page go={go} title="Sound">
      <fieldset className="w7-group">
        <legend>Playback</legend>
        <div className="cp-row">
          <Icon name="cp-sound" size={32} />
          <span>Speakers &mdash; Default Device</span>
        </div>
        <div className="cp-slider-row">
          <label>Volume:</label>
          <input type="range" className="w7-range" min="0" max="100" value={s.volume} onChange={(e) => setSettings({ volume: +e.target.value, muted: false })} />
          <span>{s.volume}</span>
        </div>
        <label className="w7-label">
          <input type="checkbox" className="w7-check" checked={s.muted} onChange={(e) => setSettings({ muted: e.target.checked })} />
          Mute
        </label>
      </fieldset>
      <fieldset className="w7-group">
        <legend>Sounds</legend>
        <div className="cp-row">
          <label>Sound Scheme:</label>
          <select className="w7-select" value={s.sounds ? 'default' : 'none'} onChange={(e) => setSettings({ sounds: e.target.value === 'default' })}>
            <option value="default">Windows Default</option>
            <option value="none">No Sounds</option>
          </select>
        </div>
        <div className="cp-sound-list">
          {[
            ['Windows Logon', 'startup'],
            ['Windows Logoff', 'logoff'],
            ['Critical Stop', 'error'],
            ['Question', 'question'],
            ['Notification', 'notify'],
            ['Empty Recycle Bin', 'recycle'],
          ].map(([l, k]) => (
            <div key={k} className="cp-sound-item">
              <span>{l}</span>
              <button className="w7-btn" onClick={() => sound.play(k)} disabled={!s.sounds}>
                ▶ Test
              </button>
            </div>
          ))}
        </div>
      </fieldset>
    </Page>
  );
}

function DisplayPage({ go }) {
  const s = useStore(settingsStore);
  return (
    <Page go={go} title="Change the appearance of your display">
      <div className="cp-monitor small">
        <div className="cp-monitor-screen">
          <div className="cp-monitor-num">1</div>
        </div>
        <div className="cp-monitor-stand" />
      </div>
      <div className="cp-sys-grid">
        <span className="cp-sys-k">Display:</span>
        <span>1. Generic PnP Monitor</span>
        <span className="cp-sys-k">Resolution:</span>
        <span>
          {Math.round(window.innerWidth * devicePixelRatio)} × {Math.round(window.innerHeight * devicePixelRatio)} {devicePixelRatio !== 1 ? `(scaled ${Math.round(devicePixelRatio * 100)}%)` : '(Recommended)'}
        </span>
        <span className="cp-sys-k">Orientation:</span>
        <span>{window.innerWidth >= window.innerHeight ? 'Landscape' : 'Portrait'}</span>
      </div>
      <fieldset className="w7-group" style={{ marginTop: 16 }}>
        <legend>Desktop icon size</legend>
        {[
          ['small', 'Small icons'],
          ['medium', 'Medium icons (default)'],
          ['large', 'Large icons'],
        ].map(([k, l]) => (
          <label key={k} className="w7-label cp-radio-line">
            <input type="radio" className="w7-radio" checked={s.iconSize === k} onChange={() => setSettings({ iconSize: k })} />
            {l}
          </label>
        ))}
      </fieldset>
    </Page>
  );
}

function Defaults({ go }) {
  const reg = getRegistry();
  const assoc = [
    ['.txt', 'Text Document', 'notepad'],
    ['.png / .jpg / .bmp', 'Image', 'photos'],
    ['.htm / .html', 'HTML Document', 'iexplore'],
    ['.url', 'Internet Shortcut', 'iexplore'],
  ];
  return (
    <Page go={go} title="Associate a file type or protocol with a program">
      <div className="cp-table">
        <div className="cp-thead three">
          <span>Name</span>
          <span>Description</span>
          <span>Current Default</span>
        </div>
        {assoc.map(([ext, d, app]) => (
          <div key={ext} className="cp-trow three">
            <span>{ext}</span>
            <span>{d}</span>
            <span>
              <Icon name={reg[app].icon} size={16} /> {reg[app].name}
            </span>
          </div>
        ))}
      </div>
    </Page>
  );
}

function PowerPage({ go }) {
  return (
    <Page go={go} title="Select a power plan">
      {['Balanced (recommended)', 'Power saver', 'High performance'].map((p, i) => (
        <label key={p} className="w7-label cp-radio-line">
          <input type="radio" name="plan" className="w7-radio" defaultChecked={i === 0} />
          <b>{p}</b>
        </label>
      ))}
    </Page>
  );
}

function Ease({ go }) {
  return (
    <Page go={go} title="Make your computer easier to use">
      <p>Quick access to common tools:</p>
      <div className="cp-tasks">
        {[
          ['Start Magnifier', 'Use your browser’s zoom (Ctrl + plus) to enlarge everything.'],
          ['Start Narrator', 'Use your operating system’s screen reader.'],
          ['Start On-Screen Keyboard', 'On touch devices, tapping a text box opens the keyboard.'],
        ].map(([t, d]) => (
          <div key={t} className="cp-task">
            <Icon name="cp-ease" size={32} />
            <div>
              <span className="cp-task-title">{t}</span>
              <div className="cp-muted">{d}</div>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

function Recovery({ go, winId }) {
  const fileRef = useRef(null);
  const exportAll = () => {
    const data = { app: 'win7-simulator', version: 1, settings: settingsStore.get(), fs: fs.nodes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `win7-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const importAll = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'win7-simulator') throw new Error('bad');
      localStorage.setItem('win7.settings.v1', JSON.stringify(data.settings));
      localStorage.setItem('win7.fs.v1', JSON.stringify({ nodes: data.fs }));
      await messageBox({ title: 'Backup and Restore', text: 'Your files and settings were restored. Windows will now restart.', icon: 'info', owner: winId });
      location.reload();
    } catch {
      messageBox({ title: 'Backup and Restore', text: 'That file is not a valid backup.', icon: 'error', owner: winId });
    }
  };
  return (
    <Page go={go} title="Back up or restore your files">
      <fieldset className="w7-group">
        <legend>Backup</legend>
        <p>Save all of your files, desktop layout and personalization to a file on this device.</p>
        <button className="w7-btn" onClick={exportAll}>
          Back up now
        </button>
      </fieldset>
      <fieldset className="w7-group">
        <legend>Restore</legend>
        <p>Restore everything from a backup file you saved earlier.</p>
        <button className="w7-btn" onClick={() => fileRef.current?.click()}>
          Restore my files
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
      </fieldset>
      <fieldset className="w7-group">
        <legend>Recovery</legend>
        <p>Return this computer to its factory state. All of your files and settings stored in this browser will be erased.</p>
        <button
          className="w7-btn"
          onClick={async () => {
            const ans = await messageBox({ title: 'Recovery', text: 'Are you sure you want to erase all files and settings?\nThis cannot be undone.', icon: 'warning', buttons: ['Yes', 'No'], defaultIndex: 1, owner: winId });
            if (ans !== 'Yes') return;
            try {
              localStorage.removeItem('win7.settings.v1');
              localStorage.removeItem('win7.fs.v1');
              localStorage.removeItem('win7.minesweeper.v1');
              localStorage.removeItem('win7.paint.v1');
            } catch {
              /* ignore */
            }
            resetSettings();
            location.reload();
          }}
        >
          Reset this computer...
        </button>
      </fieldset>
    </Page>
  );
}

// ---------------------------------------------------------------------------

const SEARCHABLE = Object.entries(PAGES)
  .filter(([id]) => id !== 'home')
  .map(([id, p]) => ({ id, title: p.title, icon: p.icon || 'controlpanel' }))
  .concat(
    Object.values(CAT_TASKS)
      .flat()
      .flatMap(([, icon, page, links]) => links.map((l) => ({ id: page, title: l, icon })))
  );

export default function ControlPanel({ win }) {
  const [page, setPage] = useState(win.props.page || 'home');
  const [hist, setHist] = useState({ back: [], fwd: [] });
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (win.props._t && win.props.page) go(win.props.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props._t]);

  const go = (p) => {
    if (p === page) return;
    if (!PAGES[p]) p = 'home';
    setHist((h) => ({ back: [...h.back, page], fwd: [] }));
    setPage(p);
    setQuery('');
  };

  const title = PAGES[page]?.title || 'Control Panel';
  useEffect(() => wm.setTitle(win.id, title), [title, win.id]);

  const crumbs = trail(page);
  let body;
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    const res = SEARCHABLE.filter((r) => r.title.toLowerCase().includes(q));
    body = (
      <Page go={go} side={false}>
        {res.length ? (
          <div className="cp-tasks">
            {res.slice(0, 30).map((r, i) => (
              <div key={i} className="cp-task">
                <Icon name={r.icon} size={32} />
                <a className="cp-task-title" onClick={() => go(r.id)}>
                  {r.title}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="cp-muted">No items match your search.</p>
        )}
      </Page>
    );
  } else if (page === 'home') body = <Home go={go} />;
  else if (PAGES[page]?.category) body = <Category id={PAGES[page].category} go={go} />;
  else {
    const P = {
      system: SystemPage,
      recovery: Recovery,
      power: PowerPage,
      users: Users,
      network: NetworkPage,
      personalization: Personalization,
      background: Background,
      color: WindowColor,
      screensaver: ScreenSaverPage,
      desktopicons: DesktopIcons,
      display: DisplayPage,
      taskbar: TaskbarPage,
      devices: Devices,
      sound: SoundPage,
      datetime: DateTime,
      programs: Programs,
      defaults: Defaults,
      ease: Ease,
    }[page];
    body = P ? <P go={go} winId={win.id} /> : <Home go={go} />;
  }

  return (
    <div className="explorer cp">
      <div className="ex-top">
        <div className="ex-navbtns">
          <button
            className="ex-round back"
            disabled={!hist.back.length}
            aria-label="Back"
            onClick={() => {
              const prev = hist.back[hist.back.length - 1];
              setHist({ back: hist.back.slice(0, -1), fwd: [page, ...hist.fwd] });
              setPage(prev);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M12 7H3M7 2.5L2.5 7 7 11.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            className="ex-round fwd"
            disabled={!hist.fwd.length}
            aria-label="Forward"
            onClick={() => {
              const next = hist.fwd[0];
              setHist({ back: [...hist.back, page], fwd: hist.fwd.slice(1) });
              setPage(next);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 7h9M7 2.5L11.5 7 7 11.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="ex-address">
          <span className="ex-addr-icon">
            <Icon name="controlpanel" size={16} />
          </span>
          <div className="ex-crumbs">
            <span className="ex-crumb-group">
              <button className="ex-crumb" onClick={() => go('home')}>
                Control Panel
              </button>
              <button
                className="ex-crumb-arrow"
                aria-label="Categories"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  ui.menuAt(
                    r.left,
                    r.bottom,
                    CATEGORIES.map((c) => ({ label: c.title, icon: c.icon, onClick: () => go(c.id) }))
                  );
                }}
              >
                <span />
              </button>
            </span>
            {crumbs.map((c) => (
              <span key={c} className="ex-crumb-group">
                <button className="ex-crumb" onClick={() => go(c)}>
                  {PAGES[c].title}
                </button>
                <button className="ex-crumb-arrow" tabIndex={-1}>
                  <span />
                </button>
              </span>
            ))}
            <span className="ex-crumb-fill" />
          </div>
        </div>
        <div className="ex-search">
          <input className="ex-search-input" placeholder="Search Control Panel" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search Control Panel" />
          {!query && (
            <svg className="ex-search-ico" width="14" height="14" viewBox="0 0 14 14">
              <circle cx="5.5" cy="5.5" r="4" fill="none" stroke="#5a7390" strokeWidth="1.5" />
              <path d="M8.5 8.5l4 4" stroke="#5a7390" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>
      <div className="ex-body cp-body">{body}</div>
    </div>
  );
}
