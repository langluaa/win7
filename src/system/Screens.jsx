import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.js';
import { uiStore, ui } from '../state/wm.js';
import { settingsStore } from '../state/settings.js';
import { Flag, UserPicture } from './icons.jsx';
import { power } from './power.js';
import { sound } from '../lib/sound.js';

export function Spinner({ size = 24 }) {
  return <span className="w7-spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

function BigFlag({ size = 120 }) {
  return (
    <svg width={size} height={size} viewBox="-2 -1 22 22" className="boot-flag-svg" aria-hidden="true">
      <Flag />
    </svg>
  );
}

export function BootScreen() {
  const skip = !settingsStore.get().bootAnimation;
  useEffect(() => {
    const t = setTimeout(() => ui.phase('login'), skip ? 300 : 5600);
    return () => clearTimeout(t);
  }, [skip]);
  return (
    <div className="screen boot" onClick={() => ui.phase('login')} role="status" aria-label="Starting Windows">
      {!skip && (
        <>
          <div className="boot-logo">
            <span className="boot-orb o1" />
            <span className="boot-orb o2" />
            <span className="boot-orb o3" />
            <span className="boot-orb o4" />
            <div className="boot-flag">
              <BigFlag size={110} />
            </div>
          </div>
          <div className="boot-text">Starting Windows</div>
          <div className="boot-skip">Click anywhere to skip</div>
        </>
      )}
    </div>
  );
}

function Branding() {
  return (
    <div className="logon-brand">
      <svg width="26" height="26" viewBox="-2 -1 22 22" aria-hidden="true">
        <Flag />
      </svg>
      <span className="brand-win">Windows</span>
      <span className="brand-7">7</span>
      <span className="brand-ed">Ultimate</span>
    </div>
  );
}

function PowerCorner() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="logon-power">
      <button className="logon-shutdown" aria-label="Shut down" title="Shut down" onClick={() => power.shutdown()}>
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path d="M9 2v7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <path d="M5.2 4.6a6 6 0 1 0 7.6 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <button className="logon-shutdown-arrow" aria-label="Shut down options" onClick={() => setMenu(!menu)}>
        ▸
      </button>
      {menu && (
        <div className="w7-menu logon-power-menu">
          {[
            ['Sleep', () => power.sleep()],
            ['Restart', () => power.restart()],
            ['Shut down', () => power.shutdown()],
          ].map(([l, f]) => (
            <div key={l} className="w7-menu-item" onClick={f} onPointerEnter={(e) => e.currentTarget.classList.add('hot')} onPointerLeave={(e) => e.currentTarget.classList.remove('hot')}>
              <span className="mi-label">{l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LogonScreen({ locked }) {
  const s = useStore(settingsStore);
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef(null);
  const needsPw = !!s.password;

  useEffect(() => {
    if (needsPw) setTimeout(() => inputRef.current?.focus(), 100);
  }, [needsPw, error]);

  useEffect(() => {
    const onKey = (e) => {
      if (!needsPw && (e.key === 'Enter' || e.key === ' ')) submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const submit = () => {
    if (needsPw && pw !== s.password) {
      sound.play('error');
      setError(true);
      setPw('');
      return;
    }
    ui.phase(locked ? 'unlocking' : 'welcome');
  };

  return (
    <div className="screen logon">
      {error ? (
        <div className="logon-center">
          <div className="logon-error">The user name or password is incorrect.</div>
          <button className="w7-btn default" onClick={() => setError(false)} autoFocus>
            OK
          </button>
        </div>
      ) : (
        <div className="logon-center">
          <button className="logon-tile" onClick={() => !needsPw && submit()} aria-label={`Log on as ${s.username}`}>
            <span className="logon-frame">
              <UserPicture name={s.userPicture} size={126} />
            </span>
          </button>
          <div className="logon-name">{s.username}</div>
          {locked && <div className="logon-status">Locked</div>}
          {needsPw ? (
            <div className="logon-pw">
              <input
                ref={inputRef}
                type="password"
                className="w7-input logon-pw-input"
                placeholder="Password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                aria-label="Password"
              />
              <button className="logon-go" aria-label="Submit" onClick={submit}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M2 8h10M8 3.5L12.5 8 8 12.5" stroke="#fff" strokeWidth="2.2" fill="none" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="logon-hint">Click your picture to log on</div>
          )}
          {needsPw && s.passwordHint && <div className="logon-hint">Hint: {s.passwordHint}</div>}
        </div>
      )}
      <button className="logon-ease" aria-label="Ease of access" title="Ease of access">
        <svg width="22" height="22" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="21" fill="#1f6fc9" stroke="#bfe3ff" strokeWidth="2" />
          <circle cx="24" cy="13" r="3.6" fill="#fff" />
          <path d="M12 19l12 2.5 12-2.5M24 21v8l-6 9M24 29l6 9" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <PowerCorner />
      <Branding />
    </div>
  );
}

export function StatusScreen({ text, next, delay = 1800 }) {
  useEffect(() => {
    if (!next) return;
    const t = setTimeout(next, delay);
    return () => clearTimeout(t);
  }, [next, delay]);
  return (
    <div className="screen logon status">
      <div className="logon-center row">
        <Spinner size={26} />
        <span className="status-text">{text}</span>
      </div>
      <Branding />
    </div>
  );
}

export function OffScreen() {
  return (
    <div className="screen off">
      <button className="off-power" onClick={() => power.powerOn()} aria-label="Power on">
        <svg width="34" height="34" viewBox="0 0 18 18">
          <path d="M9 2v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M5.2 4.6a6 6 0 1 0 7.6 0" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <div className="off-text">Press the power button to start</div>
    </div>
  );
}

export function SleepScreen() {
  return <div className="screen off sleep" onClick={() => power.wake()} onKeyDown={() => power.wake()} tabIndex={0} aria-label="Sleeping. Click to wake." />;
}

export function usePhase() {
  return useStore(uiStore, (s) => s.phase);
}
