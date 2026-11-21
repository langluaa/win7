import React, { useEffect, useReducer, useRef, useCallback } from 'react';
import { MenuBar } from '../system/MenuBar.jsx';
import { wm, wmStore } from '../state/wm.js';
import { calcReduce, initialCalc, exprLine } from '../lib/calcEngine.js';
import { launch } from '../system/shell.jsx';

const STD = [
  [['MC', 'mem', 'MC'], ['MR', 'mem', 'MR'], ['MS', 'mem', 'MS'], ['M+', 'mem', 'M+'], ['M-', 'mem', 'M-']],
  [['←', 'back'], ['CE', 'ce'], ['C', 'c'], ['±', 'neg'], ['√', 'unary', 'sqrt']],
  [['7', 'digit', '7'], ['8', 'digit', '8'], ['9', 'digit', '9'], ['/', 'op', '/'], ['%', 'pct']],
  [['4', 'digit', '4'], ['5', 'digit', '5'], ['6', 'digit', '6'], ['*', 'op', '*'], ['1/x', 'unary', 'recip']],
  [['1', 'digit', '1'], ['2', 'digit', '2'], ['3', 'digit', '3'], ['-', 'op', '-'], ['=', 'eq', null, 'tall']],
  [['0', 'digit', '0', 'wide'], ['.', 'dot'], ['+', 'op', '+']],
];

const SCI = [
  [['', null], ['Inv', 'inv'], ['ln', 'unary', 'ln'], ['(', 'paren', '('], [')', 'paren', ')']],
  [['Int', 'unary', 'int'], ['sinh', 'unary', 'sinh'], ['sin', 'unary', 'sin'], ['x²', 'unary', 'sqr'], ['n!', 'unary', 'fact']],
  [['dms', null], ['cosh', 'unary', 'cosh'], ['cos', 'unary', 'cos'], ['xʸ', 'op', '^'], ['ʸ√x', 'op', 'yroot']],
  [['π', 'const', 'pi'], ['tanh', 'unary', 'tanh'], ['tan', 'unary', 'tan'], ['x³', 'unary', 'cube'], ['∛x', 'unary', 'cuberoot']],
  [['F-E', null], ['Exp', 'const', 'e'], ['Mod', 'op', 'mod'], ['log', 'unary', 'log'], ['10ˣ', 'unary', 'exp10']],
];

const KEYMAP = {
  '+': ['op', '+'],
  '-': ['op', '-'],
  '*': ['op', '*'],
  '/': ['op', '/'],
  Enter: ['eq'],
  '=': ['eq'],
  Backspace: ['back'],
  Escape: ['c'],
  Delete: ['ce'],
  '.': ['dot'],
  ',': ['dot'],
  '%': ['pct'],
  r: ['unary', 'recip'],
  '@': ['unary', 'sqrt'],
  F9: ['neg'],
  '(': ['paren', '('],
  ')': ['paren', ')'],
  '^': ['op', '^'],
  '!': ['unary', 'fact'],
};

export default function Calculator({ win, active }) {
  const [s, dispatch] = useReducer(calcReduce, undefined, () => initialCalc(false));
  const flash = useRef({});
  const rootRef = useRef(null);

  const press = useCallback((type, value) => dispatch({ type, value }), []);

  const setMode = (mode) => {
    dispatch({ type: 'mode', value: mode });
    const w = wmStore.get().windows.find((x) => x.id === win.id);
    if (w) wm.setRect(win.id, { w: mode === 'scientific' ? 432 : 246, h: 352 });
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        navigator.clipboard?.writeText(s.entry).catch(() => {});
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        navigator.clipboard
          ?.readText()
          .then((t) => dispatch({ type: 'paste', value: t }))
          .catch(() => {});
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const mem = { l: 'MC', r: 'MR', m: 'MS', p: 'M+', q: 'M-' }[e.key.toLowerCase()];
        if (mem && e.ctrlKey) {
          e.preventDefault();
          press('mem', mem);
        }
        return;
      }
      let act = null;
      if (/^[0-9]$/.test(e.key)) act = ['digit', e.key];
      else act = KEYMAP[e.key];
      if (!act) return;
      e.preventDefault();
      press(act[0], act[1]);
      const btn = rootRef.current?.querySelector(`[data-key="${CSS.escape(act[0] + ':' + (act[1] ?? ''))}"]`);
      if (btn) {
        btn.classList.add('pressed');
        clearTimeout(flash.current[btn.dataset.key]);
        flash.current[btn.dataset.key] = setTimeout(() => btn.classList.remove('pressed'), 120);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, press, s.entry]);

  const menus = [
    {
      label: 'View',
      items: () => [
        { label: 'Standard', hint: 'Alt+1', radio: true, checked: !s.sci, onClick: () => setMode('standard') },
        { label: 'Scientific', hint: 'Alt+2', radio: true, checked: s.sci, onClick: () => setMode('scientific') },
        { label: 'Programmer', hint: 'Alt+3', disabled: true },
        { label: 'Statistics', hint: 'Alt+4', disabled: true },
        { separator: true },
        { label: 'History', disabled: true },
        { label: 'Digit grouping', disabled: true },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Copy', hint: 'Ctrl+C', onClick: () => navigator.clipboard?.writeText(s.entry).catch(() => {}) },
        {
          label: 'Paste',
          hint: 'Ctrl+V',
          onClick: () =>
            navigator.clipboard
              ?.readText()
              .then((t) => dispatch({ type: 'paste', value: t }))
              .catch(() => {}),
        },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'View Help', hint: 'F1', onClick: () => launch('help', { topic: 'calc' }) },
        { separator: true },
        { label: 'About Calculator', onClick: () => launch('winver', { product: 'Calculator' }) },
      ],
    },
  ];

  const renderBtn = ([label, type, value, cls], i) => {
    const key = `${type}:${value ?? ''}`;
    const isActiveInv = type === 'inv' && s.inv;
    return (
      <button
        key={i + label}
        data-key={key}
        className={`calc-btn ${cls || ''} ${type === 'digit' ? 'digit' : ''} ${isActiveInv ? 'on' : ''}`}
        disabled={!type}
        onClick={() => type && press(type, value)}
      >
        {label}
      </button>
    );
  };

  const len = s.entry.length;
  return (
    <div className="calc" ref={rootRef}>
      <MenuBar menus={menus} />
      <div className="calc-body">
        <div className="calc-display" aria-live="polite">
          <div className="calc-expr">{exprLine(s)}</div>
          <div className="calc-main" style={{ fontSize: len > 14 ? 15 : len > 11 ? 18 : 22 }}>
            {s.hasMemory && <span className="calc-m">M</span>}
            {s.entry}
          </div>
        </div>
        <div className="calc-pads">
          {s.sci && (
            <div className="calc-sci">
              <div className="calc-angle">
                {['deg', 'rad', 'grad'].map((a) => (
                  <label key={a} className="w7-label">
                    <input type="radio" className="w7-radio" checked={s.angle === a} onChange={() => press('angle', a)} />
                    {a === 'deg' ? 'Degrees' : a === 'rad' ? 'Radians' : 'Grads'}
                  </label>
                ))}
              </div>
              <div className="calc-grid sci">{SCI.flat().map(renderBtn)}</div>
            </div>
          )}
          <div className="calc-grid std">{STD.flat().map(renderBtn)}</div>
        </div>
      </div>
    </div>
  );
}
