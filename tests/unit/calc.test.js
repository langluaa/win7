import { describe, it, expect } from 'vitest';
import { calcReduce, initialCalc, format, exprLine } from '../../src/lib/calcEngine.js';

function press(keys, sci = false) {
  let s = initialCalc(sci);
  for (const k of keys) {
    let a;
    if (/^[0-9]$/.test(k)) a = { type: 'digit', value: k };
    else if (k === '.') a = { type: 'dot' };
    else if (['+', '-', '*', '/', '^'].includes(k)) a = { type: 'op', value: k };
    else if (k === '=') a = { type: 'eq' };
    else if (k === '(' || k === ')') a = { type: 'paren', value: k };
    else a = k; // raw action
    s = calcReduce(s, a);
  }
  return s;
}

describe('calculator engine', () => {
  it('evaluates left-to-right in Standard view (like Windows 7)', () => {
    expect(press('12+30*2='.split('')).entry).toBe('84');
  });

  it('honours precedence and parentheses in Scientific view', () => {
    expect(press('12+30*2='.split(''), true).entry).toBe('72');
    expect(press('(2+3)*4='.split(''), true).entry).toBe('20');
    expect(press('2^3^2='.split(''), true).entry).toBe('512');
  });

  it('shows the running result when chaining operators', () => {
    const s = press('5+3+'.split(''));
    expect(s.entry).toBe('8');
    expect(exprLine(s)).toBe('5 + 3 +');
  });

  it('repeats the last operation on repeated equals', () => {
    expect(press('2+3==='.split('')).entry).toBe('11');
  });

  it('replaces an operator when two are pressed in a row', () => {
    expect(press('9+-4='.split('')).entry).toBe('5');
  });

  it('handles percent, sqrt, reciprocal and negate', () => {
    expect(press(['2', '0', '0', '+', '1', '0', { type: 'pct' }, '=']).entry).toBe('220');
    expect(press(['8', '1', { type: 'unary', value: 'sqrt' }]).entry).toBe('9');
    expect(press(['4', { type: 'unary', value: 'recip' }]).entry).toBe('0.25');
    expect(press(['7', { type: 'neg' }]).entry).toBe('-7');
  });

  it('reports divide-by-zero and recovers on the next digit', () => {
    const s = press('5/0='.split(''));
    expect(s.error).toBe('Cannot divide by zero');
    expect(calcReduce(s, { type: 'digit', value: '3' }).entry).toBe('3');
  });

  it('avoids floating point noise', () => {
    expect(press('0.1+0.2='.split('')).entry).toBe('0.3');
    expect(format(1 / 3)).toBe('0.3333333333333333');
  });

  it('supports memory keys', () => {
    let s = press(['4', '2', { type: 'mem', value: 'MS' }, { type: 'c' }]);
    expect(s.hasMemory).toBe(true);
    s = calcReduce(s, { type: 'mem', value: 'MR' });
    expect(s.entry).toBe('42');
    s = calcReduce(calcReduce(s, { type: 'digit', value: '8' }), { type: 'mem', value: 'M+' });
    expect(s.memory).toBe(50);
  });

  it('computes trig in degrees by default', () => {
    expect(press(['3', '0', { type: 'unary', value: 'sin' }], true).entry).toBe('0.5');
    expect(press(['5', { type: 'unary', value: 'fact' }], true).entry).toBe('120');
    expect(press(['0', '.', '5', { type: 'inv' }, { type: 'unary', value: 'sin' }], true).entry).toBe('30');
    expect(press(['9', '0', { type: 'unary', value: 'cos' }], true).entry).toBe('0');
  });

  it('limits entry to 16 digits and handles backspace', () => {
    const s = press('12345678901234567890'.split(''));
    expect(s.entry.length).toBe(16);
    expect(calcReduce(press('123'.split('')), { type: 'back' }).entry).toBe('12');
  });
});
