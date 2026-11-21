// Turn whatever the user typed in the address bar into a URL (or a search).

export const SEARCH = (q) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`;

export function normalizeUrl(input) {
  const t = (input || '').trim();
  if (!t) return 'about:blank';
  if (/^(about|file|vfs):/i.test(t)) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(t) && !/\s/.test(t)) return `https://${t}`;
  if (/^localhost(:\d+)?(\/.*)?$/.test(t)) return `http://${t}`;
  return SEARCH(t);
}
