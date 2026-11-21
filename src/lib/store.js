import { useSyncExternalStore, useRef, useCallback } from 'react';

/**
 * Minimal external store. `useStore(store, selector)` re-renders only when the
 * selected value changes (Object.is), so windows don't re-render on every clock tick.
 */
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(update) {
      const next = typeof update === 'function' ? update(state) : update;
      if (next === state) return;
      state = next;
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore(store, selector = (s) => s) {
  const selRef = useRef(selector);
  selRef.current = selector;
  const getSnapshot = useCallback(() => selRef.current(store.get()), [store]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** localStorage helpers that never throw (private mode, quota, disabled storage). */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

let uid = 0;
export const newId = (prefix = 'n') =>
  `${prefix}${Date.now().toString(36)}${(uid++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
