import { createStore } from '../lib/store.js';

// Joke "virus" effects. Everything here is a self-contained animation that lives
// only inside the simulator's own DOM: no network, no real files, no persistence.
// A single active effect at a time; Esc or the panic button stops it.
export const fxStore = createStore({ active: null, since: 0 });

export const fx = {
  start(name) {
    fxStore.set({ active: name, since: Date.now() });
  },
  stop() {
    fxStore.set((s) => (s.active ? { active: null, since: 0 } : s));
  },
  toggle(name) {
    fxStore.set((s) => (s.active === name ? { active: null, since: 0 } : { active: name, since: Date.now() }));
  },
};
