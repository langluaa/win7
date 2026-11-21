import { ui, wm, uiStore } from '../state/wm.js';
import { sound } from '../lib/sound.js';

const later = (ms, fn) => setTimeout(fn, ms);

export const power = {
  async shutdown() {
    if (!(await wm.confirmCloseAll())) return;
    sound.play('logoff');
    ui.phase('shuttingdown');
    later(2600, () => ui.phase('off'));
  },
  async restart() {
    if (!(await wm.confirmCloseAll())) return;
    sound.play('logoff');
    ui.set({ powerLabel: 'Shutting down...' });
    ui.phase('shuttingdown');
    later(2400, () => {
      ui.phase('restarting');
      later(900, () => ui.phase('boot'));
    });
  },
  async logoff() {
    if (!(await wm.confirmCloseAll())) return;
    sound.play('logoff');
    ui.phase('loggingoff');
    later(2000, () => ui.phase('login'));
  },
  lock() {
    ui.phase('locked');
  },
  switchUser() {
    ui.phase('locked');
  },
  sleep() {
    ui.phase('sleep');
  },
  wake() {
    if (uiStore.get().phase === 'sleep') ui.phase('locked');
  },
  powerOn() {
    ui.phase('boot');
  },
};
