// Pure Minesweeper logic. Cells are stored in a flat array (index = r * cols + c).
// cell = { mine, adj, open, flag: 0|1|2 (none|flag|question) }

export const LEVELS = {
  beginner: { rows: 9, cols: 9, mines: 10, label: 'Beginner' },
  intermediate: { rows: 16, cols: 16, mines: 40, label: 'Intermediate' },
  advanced: { rows: 16, cols: 30, mines: 99, label: 'Advanced' },
};

export function neighbors(idx, rows, cols) {
  const r = Math.floor(idx / cols);
  const c = idx % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
    }
  return out;
}

export function emptyBoard(rows, cols) {
  return Array.from({ length: rows * cols }, () => ({ mine: false, adj: 0, open: false, flag: 0 }));
}

/** Place mines avoiding `safe` and (when possible) its neighbours. `rand` is injectable for tests. */
export function placeMines(board, rows, cols, mines, safe, rand = Math.random) {
  const total = rows * cols;
  mines = Math.min(mines, total - 1);
  const avoid = new Set([safe]);
  if (total - mines >= 9) neighbors(safe, rows, cols).forEach((n) => avoid.add(n));
  const candidates = [];
  for (let i = 0; i < total; i++) if (!avoid.has(i)) candidates.push(i);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const out = board.map((c) => ({ ...c, mine: false, adj: 0 }));
  candidates.slice(0, mines).forEach((i) => (out[i].mine = true));
  for (let i = 0; i < total; i++) out[i].adj = neighbors(i, rows, cols).filter((n) => out[n].mine).length;
  return out;
}

/** Reveal a cell (flood-filling zeros). Returns { board, exploded: idx|null, opened: [idx] }. */
export function reveal(board, rows, cols, idx) {
  const cell = board[idx];
  if (!cell || cell.open || cell.flag === 1) return { board, exploded: null, opened: [] };
  const out = board.slice();
  if (cell.mine) {
    out[idx] = { ...cell, open: true };
    return { board: out, exploded: idx, opened: [idx] };
  }
  const opened = [];
  const stack = [idx];
  const seen = new Set();
  while (stack.length) {
    const i = stack.pop();
    if (seen.has(i)) continue;
    seen.add(i);
    const c = out[i];
    if (c.open || c.flag === 1 || c.mine) continue;
    out[i] = { ...c, open: true, flag: 0 };
    opened.push(i);
    if (c.adj === 0) neighbors(i, rows, cols).forEach((n) => !seen.has(n) && stack.push(n));
  }
  return { board: out, exploded: null, opened };
}

/** Chord: if flags around a number equal the number, reveal remaining neighbours. */
export function chord(board, rows, cols, idx) {
  const cell = board[idx];
  if (!cell?.open || !cell.adj) return { board, exploded: null, opened: [] };
  const ns = neighbors(idx, rows, cols);
  const flags = ns.filter((n) => board[n].flag === 1).length;
  if (flags !== cell.adj) return { board, exploded: null, opened: [] };
  let b = board;
  let exploded = null;
  const opened = [];
  for (const n of ns) {
    if (b[n].open || b[n].flag === 1) continue;
    const res = reveal(b, rows, cols, n);
    b = res.board;
    opened.push(...res.opened);
    if (res.exploded !== null && exploded === null) exploded = res.exploded;
  }
  return { board: b, exploded, opened };
}

export function cycleFlag(board, idx, allowQuestion = false) {
  const c = board[idx];
  if (!c || c.open) return board;
  const next = c.flag === 0 ? 1 : c.flag === 1 && allowQuestion ? 2 : 0;
  const out = board.slice();
  out[idx] = { ...c, flag: next };
  return out;
}

export function isWon(board) {
  return board.every((c) => c.mine || c.open);
}

export function flagsUsed(board) {
  return board.reduce((n, c) => n + (c.flag === 1 ? 1 : 0), 0);
}
