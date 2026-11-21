// Pure desktop icon grid layout.

/** Assign every desktop item a grid cell (column-major, like Windows). Pure, so it can be unit-tested. */
export function layoutIcons(keys, saved, rows, cols, autoArrange) {
  const out = {};
  const used = new Set();
  const free = () => {
    for (let c = 0; c < Math.max(cols, 1) + 50; c++)
      for (let r = 0; r < rows; r++) {
        if (!used.has(`${c},${r}`)) return { c, r };
      }
    return { c: 0, r: 0 };
  };
  if (!autoArrange) {
    for (const k of keys) {
      const p = saved[k];
      if (p && p.r < rows && p.c < cols && !used.has(`${p.c},${p.r}`)) {
        out[k] = { c: p.c, r: p.r };
        used.add(`${p.c},${p.r}`);
      }
    }
  }
  for (const k of keys) {
    if (out[k]) continue;
    const p = free();
    out[k] = p;
    used.add(`${p.c},${p.r}`);
  }
  return out;
}
