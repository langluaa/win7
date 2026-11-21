import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MenuBar } from '../system/MenuBar.jsx';
import { wm } from '../state/wm.js';
import { load, save } from '../lib/store.js';
import { openDialog, messageBox } from '../system/dialogs.jsx';
import { launch } from '../system/shell.jsx';
import { sound } from '../lib/sound.js';
import { LEVELS, emptyBoard, placeMines, reveal, chord, cycleFlag, isWon, flagsUsed, neighbors } from '../lib/minesweeper.js';

const KEY = 'win7.minesweeper.v1';
const defaults = {
  level: 'beginner',
  custom: { rows: 9, cols: 9, mines: 10 },
  animations: true,
  sounds: true,
  question: false,
  theme: 'blue',
  stats: {},
};

function loadPrefs() {
  const p = load(KEY, null);
  return { ...defaults, ...(p || {}), custom: { ...defaults.custom, ...(p?.custom || {}) }, stats: p?.stats || {} };
}

function dims(prefs) {
  if (prefs.level === 'custom') return { ...prefs.custom };
  return { ...LEVELS[prefs.level] };
}

const emptyStats = () => ({ played: 0, won: 0, streak: 0, bestStreak: 0, worstStreak: 0, lossStreak: 0, best: [] });

function MineGlyph({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="ms-mine" cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#8c99a8" />
          <stop offset="0.4" stopColor="#2b333c" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
      </defs>
      <g stroke="#111" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3L5.3 18.7" />
      </g>
      <circle cx="12" cy="12" r="6.8" fill="url(#ms-mine)" />
      <circle cx="9.6" cy="9.4" r="1.7" fill="#fff" opacity="0.85" />
    </svg>
  );
}

function FlagGlyph({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5v17" stroke="#3a3a3a" strokeWidth="1.8" />
      <path d="M7.8 4c3 -1 5 1.4 9.5 0.2v7.4c-4.5 1.2-6.5-1.2-9.5-0.2z" fill="#e8251b" stroke="#8c0f08" strokeWidth="0.8" />
      <path d="M4 20.5h8" stroke="#3a3a3a" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function StatsView({ stats, levelKey, setLevelKey, onReset, done }) {
  const s = stats[levelKey] || emptyStats();
  const pct = s.played ? Math.round((s.won / s.played) * 100) : 0;
  return (
    <div className="ms-stats">
      <div className="ms-stats-body">
        <div className="ms-stats-levels">
          {['beginner', 'intermediate', 'advanced'].map((k) => (
            <button key={k} className={`ms-stats-level ${k === levelKey ? 'sel' : ''}`} onClick={() => setLevelKey(k)}>
              {LEVELS[k].label}
            </button>
          ))}
        </div>
        <div className="ms-stats-data">
          <b>Best times:</b>
          <ol>
            {s.best.length ? (
              s.best.slice(0, 5).map((b, i) => (
                <li key={i}>
                  <span>{new Date(b.date).toLocaleDateString()}</span>
                  <span>{b.time}</span>
                </li>
              ))
            ) : (
              <li className="cp-muted">No times yet</li>
            )}
          </ol>
          <div className="ms-stats-grid">
            <span>Games played:</span>
            <span>{s.played}</span>
            <span>Games won:</span>
            <span>{s.won}</span>
            <span>Win percentage:</span>
            <span>{pct}%</span>
            <span>Longest winning streak:</span>
            <span>{s.bestStreak}</span>
            <span>Longest losing streak:</span>
            <span>{s.worstStreak}</span>
            <span>Current streak:</span>
            <span>{s.streak >= 0 ? s.streak : s.streak}</span>
          </div>
        </div>
      </div>
      <div className="props-buttons">
        <button className="w7-btn default" onClick={() => done(null)}>
          Close
        </button>
        <button className="w7-btn" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}

function OptionsView({ prefs, done }) {
  const [p, setP] = useState(prefs);
  return (
    <div className="ms-options">
      <fieldset className="w7-group">
        <legend>Difficulty</legend>
        <div className="ms-opt-levels">
          {Object.entries(LEVELS).map(([k, l]) => (
            <label key={k} className="w7-label ms-opt-level">
              <input type="radio" className="w7-radio" checked={p.level === k} onChange={() => setP({ ...p, level: k })} />
              <span>
                <b>{l.label}</b>
                <br />
                {l.mines} mines
                <br />
                {l.rows} x {l.cols} tile grid
              </span>
            </label>
          ))}
          <label className="w7-label ms-opt-level">
            <input type="radio" className="w7-radio" checked={p.level === 'custom'} onChange={() => setP({ ...p, level: 'custom' })} />
            <span>
              <b>Custom</b>
              {[
                ['Height (9-24):', 'rows', 9, 24],
                ['Width (9-30):', 'cols', 9, 30],
                ['Mines (10-668):', 'mines', 10, 668],
              ].map(([label, key, min, max]) => (
                <span key={key} className="ms-opt-row">
                  {label}
                  <input
                    className="w7-input"
                    type="number"
                    min={min}
                    max={max}
                    disabled={p.level !== 'custom'}
                    value={p.custom[key]}
                    onChange={(e) => setP({ ...p, custom: { ...p.custom, [key]: Math.max(min, Math.min(max, +e.target.value || min)) } })}
                  />
                </span>
              ))}
            </span>
          </label>
        </div>
      </fieldset>
      <div className="ms-opt-checks">
        {[
          ['animations', 'Display animations'],
          ['sounds', 'Play sounds'],
          ['question', 'Allow question marks (on double right-click)'],
        ].map(([k, l]) => (
          <label key={k} className="w7-label">
            <input type="checkbox" className="w7-check" checked={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.checked })} />
            {l}
          </label>
        ))}
      </div>
      <div className="props-buttons">
        <button
          className="w7-btn default"
          onClick={() => {
            const c = p.custom;
            const custom = { ...c, mines: Math.min(c.mines, Math.floor(c.rows * c.cols * 0.85)) };
            done({ ...p, custom });
          }}
        >
          OK
        </button>
        <button className="w7-btn" onClick={() => done(null)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Minesweeper({ win, active }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const { rows, cols, mines } = dims(prefs);
  const [board, setBoard] = useState(() => emptyBoard(rows, cols));
  const [state, setState] = useState('ready'); // ready | playing | won | lost
  const [time, setTime] = useState(0);
  const [boom, setBoom] = useState(null);
  const [revealedMines, setRevealedMines] = useState(new Set());
  const [pressed, setPressed] = useState(null); // idx list while chording/pressing
  const [hover, setHover] = useState(null);
  const startRef = useRef(0);
  const areaRef = useRef(null);
  const [tile, setTile] = useState(30);
  const buttons = useRef(0);
  const longPress = useRef(null);

  useEffect(() => {
    save(KEY, prefs);
  }, [prefs]);

  // Size the window to the board when difficulty changes.
  const fitWindow = useCallback((r, c) => {
    const t = Math.max(18, Math.min(34, Math.floor((window.innerWidth - 80) / c), Math.floor((window.innerHeight - 200) / r)));
    const w = c * (t + 1) + 26 + 18 + 2;
    const h = r * (t + 1) + 26 + 48 + 20 + 40;
    wm.setRect(win.id, { w: Math.min(window.innerWidth, w), h: Math.min(window.innerHeight - 40, h) });
  }, [win.id]);

  const newGame = useCallback(
    (p = prefs) => {
      const d = dims(p);
      setBoard(emptyBoard(d.rows, d.cols));
      setState('ready');
      setTime(0);
      setBoom(null);
      setRevealedMines(new Set());
    },
    [prefs]
  );

  useEffect(() => {
    if (!win.maximized) fitWindow(rows, cols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols]);

  // Scale tiles to the available area (Windows 7 Minesweeper is resizable).
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 24;
      const h = el.clientHeight - 24;
      setTile(Math.max(10, Math.min(Math.floor(w / cols) - 1, Math.floor(h / rows) - 1, 60)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows, cols]);

  // Timer
  useEffect(() => {
    if (state !== 'playing') return;
    const t = setInterval(() => setTime(Math.min(999, Math.floor((Date.now() - startRef.current) / 1000))), 250);
    return () => clearInterval(t);
  }, [state]);

  const recordResult = useCallback(
    (won, seconds) => {
      if (prefs.level === 'custom') return;
      setPrefs((p) => {
        const s = { ...emptyStats(), ...(p.stats[p.level] || {}) };
        s.played++;
        if (won) {
          s.won++;
          s.streak = s.streak > 0 ? s.streak + 1 : 1;
          s.bestStreak = Math.max(s.bestStreak, s.streak);
          s.best = [...s.best, { time: seconds, date: Date.now() }].sort((a, b) => a.time - b.time).slice(0, 5);
        } else {
          s.streak = s.streak < 0 ? s.streak - 1 : -1;
          s.worstStreak = Math.max(s.worstStreak, -s.streak);
        }
        return { ...p, stats: { ...p.stats, [p.level]: s } };
      });
    },
    [prefs.level]
  );

  const finish = useCallback(
    async (won, b, explodedIdx) => {
      const seconds = Math.max(1, Math.min(999, Math.ceil((Date.now() - startRef.current) / 1000)));
      setTime(seconds);
      setState(won ? 'won' : 'lost');
      recordResult(won, seconds);
      if (won) {
        setBoard(b.map((c) => (c.mine ? { ...c, flag: 1 } : c)));
        if (prefs.sounds) sound.play('win');
      } else {
        setBoom(explodedIdx);
        if (prefs.sounds) sound.play('boom');
        // Cascade-reveal the remaining mines.
        const mineIdx = b.map((c, i) => (c.mine && i !== explodedIdx && c.flag !== 1 ? i : -1)).filter((i) => i >= 0);
        if (prefs.animations) {
          const order = mineIdx.sort((a, z) => dist(a, explodedIdx) - dist(z, explodedIdx));
          for (let i = 0; i < order.length; i++) {
            await new Promise((r) => setTimeout(r, Math.max(15, 120 - i * 3)));
            setRevealedMines((s) => new Set([...s, order[i]]));
          }
        } else setRevealedMines(new Set(mineIdx));
      }
      await new Promise((r) => setTimeout(r, won ? 450 : 300));
      const st = prefs.level !== 'custom' ? loadPrefs().stats[prefs.level] : null;
      const ans = await messageBox({
        title: won ? 'Game Won' : 'Game Lost',
        text: won
          ? `Congratulations, you won the game!\n\nTime: ${seconds} seconds\n${st ? `Best time: ${st.best[0]?.time ?? seconds} seconds\nGames played: ${st.played}\nGames won: ${st.won}\nPercentage: ${Math.round((st.won / st.played) * 100)}%` : ''}`
          : `Sorry, you lost this game. Better luck next time!\n\nTime: ${seconds} seconds\n${st ? `Games played: ${st.played}\nGames won: ${st.won}\nPercentage: ${Math.round((st.won / st.played) * 100)}%` : ''}`,
        icon: won ? 'info' : null,
        buttons: won ? ['Play again', 'Exit'] : ['Play again', 'Restart this game', 'Exit'],
        owner: win.id,
      });
      if (ans === 'Exit') wm.close(win.id);
      else if (ans === 'Restart this game') {
        setBoard(b.map((c) => ({ ...c, open: false, flag: 0 })));
        setState('playing');
        startRef.current = Date.now();
        setTime(0);
        setBoom(null);
        setRevealedMines(new Set());
      } else if (ans === 'Play again') newGame();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs, recordResult, win.id, newGame]
  );

  const dist = (a, b) => {
    const ar = Math.floor(a / cols);
    const br = Math.floor(b / cols);
    return Math.hypot(ar - br, (a % cols) - (b % cols));
  };

  const doReveal = (idx) => {
    if (state === 'won' || state === 'lost') return;
    let b = board;
    if (state === 'ready') {
      b = placeMines(board, rows, cols, mines, idx);
      setState('playing');
      startRef.current = Date.now();
    }
    if (b[idx].flag === 1) return;
    const res = b[idx].open ? chord(b, rows, cols, idx) : reveal(b, rows, cols, idx);
    setBoard(res.board);
    if (res.exploded !== null) finish(false, res.board, res.exploded);
    else if (isWon(res.board)) finish(true, res.board);
  };

  const doFlag = (idx) => {
    if (state === 'won' || state === 'lost' || board[idx].open) return;
    setBoard(cycleFlag(board, idx, prefs.question));
  };

  const doChord = (idx) => {
    if (state !== 'playing') return;
    const res = chord(board, rows, cols, idx);
    setBoard(res.board);
    if (res.exploded !== null) finish(false, res.board, res.exploded);
    else if (isWon(res.board)) finish(true, res.board);
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        newGame();
      } else if (e.key === 'F4') {
        e.preventDefault();
        showStats();
      } else if (e.key === 'F5') {
        e.preventDefault();
        showOptions();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const showStats = () => {
    let level = prefs.level === 'custom' ? 'beginner' : prefs.level;
    const render = (done) => <StatsHost initial={level} done={done} />;
    openDialog({ title: 'Minesweeper Statistics', owner: win.id, render });
  };

  const showOptions = async () => {
    const p = await openDialog({ title: 'Options', owner: win.id, render: (done) => <OptionsView prefs={prefs} done={done} /> });
    if (!p) return;
    setPrefs((old) => ({ ...p, stats: old.stats }));
    const d = dims(p);
    setBoard(emptyBoard(d.rows, d.cols));
    setState('ready');
    setTime(0);
    setBoom(null);
    setRevealedMines(new Set());
  };

  const menus = [
    {
      label: 'Game',
      items: () => [
        { label: 'New Game', hint: 'F2', onClick: () => newGame() },
        { separator: true },
        { label: 'Statistics', hint: 'F4', onClick: showStats },
        { label: 'Options', hint: 'F5', onClick: showOptions },
        {
          label: 'Change Appearance',
          hint: 'F7',
          submenu: [
            { label: 'Blue tiles', radio: true, checked: prefs.theme === 'blue', onClick: () => setPrefs({ ...prefs, theme: 'blue' }) },
            { label: 'Green tiles', radio: true, checked: prefs.theme === 'green', onClick: () => setPrefs({ ...prefs, theme: 'green' }) },
          ],
        },
        { separator: true },
        { label: 'Exit', onClick: () => wm.close(win.id) },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'View Help', hint: 'F1', onClick: () => launch('help', { topic: 'minesweeper' }) },
        { separator: true },
        { label: 'About Minesweeper', onClick: () => launch('winver', { product: 'Minesweeper' }) },
      ],
    },
  ];

  const onCellDown = (idx, e) => {
    e.preventDefault();
    if (e.pointerType === 'touch') {
      clearTimeout(longPress.current);
      longPress.current = setTimeout(() => {
        longPress.current = 'fired';
        doFlag(idx);
        navigator.vibrate?.(20);
      }, 380);
      setPressed([idx]);
      return;
    }
    buttons.current = e.buttons;
    if (e.buttons === 3 || e.button === 1) {
      setPressed([idx, ...neighbors(idx, rows, cols)]);
      return;
    }
    if (e.button === 2) {
      doFlag(idx);
      return;
    }
    setPressed(board[idx].open ? neighbors(idx, rows, cols) : [idx]);
  };

  const onCellUp = (idx, e) => {
    const wasChord = buttons.current === 3 || e.button === 1;
    setPressed(null);
    if (e.pointerType === 'touch') {
      if (longPress.current === 'fired') {
        longPress.current = null;
        return;
      }
      clearTimeout(longPress.current);
      longPress.current = null;
      doReveal(idx);
      return;
    }
    if (wasChord) {
      buttons.current = 0;
      doChord(idx);
      return;
    }
    if (e.button === 0) doReveal(idx);
    buttons.current = 0;
  };

  const remaining = mines - flagsUsed(board);
  const pressedSet = useMemo(() => new Set(pressed || []), [pressed]);

  return (
    <div className={`minesweeper theme-${prefs.theme}`} onContextMenu={(e) => e.preventDefault()}>
      <MenuBar menus={menus} />
      <div className="ms-area" ref={areaRef} onPointerLeave={() => setPressed(null)}>
        <div className="ms-board" style={{ gridTemplateColumns: `repeat(${cols}, ${tile}px)`, gridAutoRows: `${tile}px` }}>
          {board.map((c, i) => {
            const showMine = (c.mine && (state === 'lost' && (i === boom || revealedMines.has(i)))) || (c.open && c.mine);
            const wrongFlag = state === 'lost' && c.flag === 1 && !c.mine;
            const open = c.open || showMine;
            const cls = ['ms-cell', open ? 'open' : 'closed', i === boom ? 'boom' : '', pressedSet.has(i) && !c.open && c.flag !== 1 ? 'pressed' : '', hover === i && !open ? 'hot' : '', open && c.adj && !c.mine ? `n${c.adj}` : '', open && prefs.animations ? 'anim' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <div
                key={i}
                className={cls}
                onPointerDown={(e) => onCellDown(i, e)}
                onPointerUp={(e) => onCellUp(i, e)}
                onPointerEnter={(e) => {
                  setHover(i);
                  if (pressed && e.buttons) setPressed(buttons.current === 3 ? [i, ...neighbors(i, rows, cols)] : board[i].open ? neighbors(i, rows, cols) : [i]);
                }}
                onPointerLeave={() => {
                  setHover(null);
                  if (longPress.current && longPress.current !== 'fired') clearTimeout(longPress.current);
                }}
                style={{ fontSize: Math.round(tile * 0.62) }}
              >
                {open && c.mine ? <MineGlyph size={Math.round(tile * 0.78)} /> : open && c.adj ? c.adj : null}
                {!open && c.flag === 1 && <FlagGlyph size={Math.round(tile * 0.75)} />}
                {!open && c.flag === 2 && <span className="ms-q">?</span>}
                {wrongFlag && <span className="ms-x">✕</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ms-bottom">
        <span className="ms-counter" title="Time">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="13" r="8.5" fill="#fff" stroke="#2b3a4a" strokeWidth="1.6" />
            <path d="M12 13V8M12 13l3 2" stroke="#2b3a4a" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M9.5 2.5h5M12 2.5v2" stroke="#2b3a4a" strokeWidth="1.6" />
          </svg>
          <span className="ms-num">{time}</span>
        </span>
        <span className="ms-counter" title="Mines remaining">
          <span className="ms-num">{remaining}</span>
          <MineGlyph size={22} />
        </span>
      </div>
    </div>
  );

  function StatsHost({ initial, done }) {
    const [lvl, setLvl] = useState(initial);
    const [stats, setStats] = useState(loadPrefs().stats);
    return (
      <StatsView
        stats={stats}
        levelKey={lvl}
        setLevelKey={setLvl}
        done={done}
        onReset={async () => {
          const ans = await messageBox({ title: 'Reset Statistics', text: 'Are you sure you want to reset your statistics?', icon: 'warning', buttons: ['Reset', 'Do not reset'], owner: win.id });
          if (ans !== 'Reset') return;
          setPrefs((p) => ({ ...p, stats: {} }));
          setStats({});
        }}
      />
    );
  }
}
