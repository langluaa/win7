import { describe, it, expect } from 'vitest';
import { layoutIcons } from '../../src/lib/layout.js';
import { normalizeUrl as normalizeUrlForTest } from '../../src/lib/url.js';

describe('desktop icon layout', () => {
  it('fills columns top-to-bottom like Windows', () => {
    const l = layoutIcons(['a', 'b', 'c', 'd'], {}, 3, 10, false);
    expect(l).toEqual({ a: { c: 0, r: 0 }, b: { c: 0, r: 1 }, c: { c: 0, r: 2 }, d: { c: 1, r: 0 } });
  });

  it('keeps saved positions and resolves collisions', () => {
    const l = layoutIcons(['a', 'b', 'c'], { a: { c: 4, r: 2 }, b: { c: 4, r: 2 } }, 5, 10, false);
    expect(l.a).toEqual({ c: 4, r: 2 });
    expect(l.b).toEqual({ c: 0, r: 0 });
    expect(l.c).toEqual({ c: 0, r: 1 });
  });

  it('re-flows icons whose saved cell no longer fits the screen', () => {
    const l = layoutIcons(['a'], { a: { c: 20, r: 20 } }, 5, 5, false);
    expect(l.a).toEqual({ c: 0, r: 0 });
  });

  it('ignores saved positions when auto-arrange is on', () => {
    const l = layoutIcons(['a', 'b'], { a: { c: 3, r: 3 } }, 5, 5, true);
    expect(l.a).toEqual({ c: 0, r: 0 });
  });

  it('turns typed text into URLs or searches', () => {
    expect(normalizeUrlForTest('example.com')).toBe('https://example.com');
    expect(normalizeUrlForTest('http://a.b/c')).toBe('http://a.b/c');
    expect(normalizeUrlForTest('windows 7 aero')).toMatch(/search=windows%207%20aero/);
  });
});
