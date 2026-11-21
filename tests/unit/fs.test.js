import { describe, it, expect } from 'vitest';
import * as core from '../../src/state/fsCore.js';

const base = () => ({
  C: { id: 'C', name: 'Local Disk', type: 'drive', letter: 'C', parent: null, system: true },
  users: { id: 'users', name: 'Users', type: 'folder', parent: 'C', system: true },
  user: { id: 'user', name: 'Alex', type: 'folder', parent: 'users', system: true },
  docs: { id: 'docs', name: 'Documents', type: 'folder', parent: 'user', system: true },
  desk: { id: 'desk', name: 'Desktop', type: 'folder', parent: 'user', system: true },
});

describe('virtual file system', () => {
  it('creates nodes with unique, Explorer-style names', () => {
    let n = base();
    let a, b, c;
    [n, a] = core.createNode(n, { parent: 'docs', name: 'New folder', type: 'folder' });
    [n, b] = core.createNode(n, { parent: 'docs', name: 'New folder', type: 'folder' });
    [n, c] = core.createNode(n, { parent: 'docs', name: 'notes.txt', content: 'hi' });
    expect(n[a].name).toBe('New folder');
    expect(n[b].name).toBe('New folder (2)');
    expect(core.uniqueName(n, 'docs', 'notes.txt')).toBe('notes (2).txt');
    expect(n[c].content).toBe('hi');
  });

  it('lists folders before files, sorted naturally', () => {
    let n = base();
    [n] = core.createNode(n, { parent: 'docs', name: 'file10.txt' });
    [n] = core.createNode(n, { parent: 'docs', name: 'file2.txt' });
    [n] = core.createNode(n, { parent: 'docs', name: 'Zeta', type: 'folder' });
    expect(core.children(n, 'docs').map((x) => x.name)).toEqual(['Zeta', 'file2.txt', 'file10.txt']);
  });

  it('validates and rejects bad or duplicate names on rename', () => {
    let n = base();
    let a;
    [n, a] = core.createNode(n, { parent: 'docs', name: 'a.txt' });
    [n] = core.createNode(n, { parent: 'docs', name: 'b.txt' });
    expect(core.renameNode(n, a, 'bad:name.txt')[1]).toMatch(/can't contain/);
    expect(core.renameNode(n, a, 'B.TXT')[1]).toMatch(/already a file/);
    const [n2, err] = core.renameNode(n, a, 'c.txt');
    expect(err).toBeNull();
    expect(n2[a].name).toBe('c.txt');
  });

  it('moves, but never into its own subfolder, and protects system items', () => {
    let n = base();
    let outer, inner;
    [n, outer] = core.createNode(n, { parent: 'docs', name: 'Outer', type: 'folder' });
    [n, inner] = core.createNode(n, { parent: outer, name: 'Inner', type: 'folder' });
    expect(core.moveNode(n, outer, inner)[1]).toMatch(/subfolder/);
    expect(core.moveNode(n, 'docs', 'desk')[1]).toMatch(/can't be moved/);
    const [n2, err] = core.moveNode(n, outer, 'desk');
    expect(err).toBeNull();
    expect(n2[outer].parent).toBe('desk');
  });

  it('deep-copies folders with "- Copy" suffix in the same folder', () => {
    let n = base();
    let f;
    [n, f] = core.createNode(n, { parent: 'docs', name: 'Pics', type: 'folder' });
    [n] = core.createNode(n, { parent: f, name: 'a.png', content: 'data:image/png;base64,AAAA' });
    const [n2, copy] = core.copyNode(n, f, 'docs');
    expect(n2[copy].name).toBe('Pics - Copy');
    expect(core.children(n2, copy).map((x) => x.name)).toEqual(['a.png']);
  });

  it('trashes, restores and empties the Recycle Bin', () => {
    let n = base();
    let a;
    [n, a] = core.createNode(n, { parent: 'docs', name: 'a.txt' });
    n = core.trashNode(n, a);
    expect(n[a].parent).toBe(core.RECYCLE);
    expect(n[a].origParent).toBe('docs');
    n = core.restoreNode(n, a);
    expect(n[a].parent).toBe('docs');
    n = core.trashNode(n, a);
    n = core.emptyRecycle(n);
    expect(n[a]).toBeUndefined();
    // system items can't be trashed
    expect(core.trashNode(n, 'docs')).toBe(n);
  });

  it('builds and resolves Windows paths case-insensitively', () => {
    const n = base();
    expect(core.pathOf(n, 'docs')).toBe('C:\\Users\\Alex\\Documents');
    expect(core.pathOf(n, 'C')).toBe('C:\\');
    expect(core.resolvePath(n, 'c:\\users\\ALEX\\documents\\')).toBe('docs');
    expect(core.resolvePath(n, 'C:\\Users\\Alex\\Documents\\..\\Desktop')).toBe('desk');
    expect(core.resolvePath(n, 'C:\\Nope')).toBeNull();
  });

  it('formats sizes like Explorer', () => {
    expect(core.formatSize(512)).toBe('512 bytes');
    expect(core.formatSize(2048)).toBe('2 KB');
    expect(core.formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
