import { describe, it, expect } from 'vitest';
import { emptyBoard, placeMines, reveal, chord, cycleFlag, isWon, neighbors, flagsUsed } from '../../src/lib/minesweeper.js';

// Deterministic PRNG for reproducible boards.
function rng(seed = 42) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('minesweeper logic', () => {
  it('computes neighbours at edges and corners', () => {
    expect(neighbors(0, 9, 9).sort((a, b) => a - b)).toEqual([1, 9, 10]);
    expect(neighbors(40, 9, 9)).toHaveLength(8);
  });

  it('places exactly N mines and keeps the first click (and its neighbours) safe', () => {
    for (let seed = 1; seed < 30; seed++) {
      const b = placeMines(emptyBoard(9, 9), 9, 9, 10, 40, rng(seed));
      expect(b.filter((c) => c.mine)).toHaveLength(10);
      expect(b[40].mine).toBe(false);
      neighbors(40, 9, 9).forEach((n) => expect(b[n].mine).toBe(false));
      expect(b[40].adj).toBe(0);
    }
  });

  it('flood-reveals empty regions', () => {
    const b = placeMines(emptyBoard(16, 16), 16, 16, 40, 0, rng(7));
    const res = reveal(b, 16, 16, 0);
    expect(res.exploded).toBeNull();
    expect(res.opened.length).toBeGreaterThan(1);
    // every opened zero has all its neighbours opened too
    res.opened.forEach((i) => {
      if (res.board[i].adj === 0) neighbors(i, 16, 16).forEach((n) => expect(res.board[n].open).toBe(true));
    });
  });

  it('explodes on a mine and does not reveal flagged cells', () => {
    const b = placeMines(emptyBoard(9, 9), 9, 9, 10, 0, rng(3));
    const mine = b.findIndex((c) => c.mine);
    const flagged = cycleFlag(b, mine);
    expect(reveal(flagged, 9, 9, mine).opened).toHaveLength(0);
    expect(reveal(b, 9, 9, mine).exploded).toBe(mine);
  });

  it('cycles flags (with optional question marks)', () => {
    let b = emptyBoard(3, 3);
    b = cycleFlag(b, 0);
    expect(b[0].flag).toBe(1);
    expect(flagsUsed(b)).toBe(1);
    expect(cycleFlag(b, 0)[0].flag).toBe(0);
    expect(cycleFlag(b, 0, true)[0].flag).toBe(2);
  });

  it('chords when flags match the number', () => {
    // Hand-built 3x3: mine at index 0
    let b = emptyBoard(3, 3);
    b[0].mine = true;
    b = b.map((c, i) => ({ ...c, adj: neighbors(i, 3, 3).filter((n) => b[n].mine).length }));
    b = reveal(b, 3, 3, 4).board; // centre shows "1"
    expect(b[4].adj).toBe(1);
    expect(chord(b, 3, 3, 4).opened).toHaveLength(0); // no flag yet
    b = cycleFlag(b, 0);
    const res = chord(b, 3, 3, 4);
    expect(res.exploded).toBeNull();
    expect(isWon(res.board)).toBe(true);
  });
});
