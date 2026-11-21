import { MessageBoxApp, FileDialogApp, CustomDialogApp } from '../system/dialogs.jsx';
import Explorer from './Explorer.jsx';
import ControlPanel from './ControlPanel.jsx';
import Notepad from './Notepad.jsx';
import Paint from './Paint.jsx';
import Calculator from './Calculator.jsx';
import Browser from './Browser.jsx';
import Minesweeper from './Minesweeper.jsx';
import Cmd from './Cmd.jsx';
import PhotoViewer from './PhotoViewer.jsx';
import ChaosLab from './ChaosLab.jsx';
import { RunDialog, Winver, TaskManager, Help } from './Misc.jsx';

// id -> app definition. `hot` is the taskbar hot-track glow colour.
export const APPS = {
  explorer: { name: 'Windows Explorer', icon: 'library', component: Explorer, size: { w: 820, h: 540 }, minSize: { w: 360, h: 260 }, glassTop: true, hideTitle: true, hot: '#f3c03f', keywords: ['files', 'folders'] },
  iexplore: { name: 'Internet Explorer', icon: 'iexplore', component: Browser, size: { w: 960, h: 640 }, minSize: { w: 400, h: 280 }, glassTop: true, hot: '#3aa6ff', keywords: ['browser', 'web', 'internet'] },
  notepad: { name: 'Notepad', icon: 'notepad', component: Notepad, size: { w: 640, h: 440 }, minSize: { w: 250, h: 160 }, hot: '#6aa9ef', keywords: ['text', 'editor'] },
  mspaint: { name: 'Paint', icon: 'mspaint', component: Paint, size: { w: 1000, h: 640 }, minSize: { w: 420, h: 340 }, hot: '#f2a33a', keywords: ['draw', 'image', 'mspaint'] },
  calc: { name: 'Calculator', icon: 'calc', component: Calculator, size: { w: 246, h: 352 }, resizable: false, maximizable: false, hot: '#8fb3dc', keywords: ['math'] },
  minesweeper: { name: 'Minesweeper', icon: 'minesweeper', component: Minesweeper, size: { w: 310, h: 390 }, minSize: { w: 220, h: 260 }, single: true, hot: '#3f7ee0', keywords: ['game', 'mines'] },
  cmd: { name: 'Command Prompt', icon: 'cmd', component: Cmd, size: { w: 680, h: 400 }, minSize: { w: 300, h: 150 }, hot: '#9aa5b0', keywords: ['terminal', 'console', 'dos'] },
  control: { name: 'Control Panel', icon: 'controlpanel', component: ControlPanel, size: { w: 860, h: 580 }, minSize: { w: 420, h: 300 }, glassTop: true, hideTitle: true, single: true, hot: '#4fae3f', keywords: ['settings', 'personalize', 'wallpaper'] },
  photos: { name: 'Windows Photo Viewer', icon: 'photos', component: PhotoViewer, size: { w: 780, h: 560 }, minSize: { w: 320, h: 260 }, hot: '#59b3e8', keywords: ['pictures', 'images'] },
  run: { name: 'Run', icon: 'run', component: RunDialog, size: { w: 410, h: 212 }, resizable: false, maximizable: false, minimizable: false, hot: '#6aa9ef', position: (vp, w, h, tb) => ({ x: 8, y: vp.h - tb - h - 8 }) },
  winver: { name: 'About Windows', icon: 'winver', component: Winver, size: { w: 470, h: 430 }, resizable: false, maximizable: false, minimizable: false, center: true, hot: '#3aa6ff', keywords: ['version'] },
  taskmgr: { name: 'Windows Task Manager', icon: 'cp-display', component: TaskManager, size: { w: 420, h: 470 }, minSize: { w: 320, h: 300 }, hot: '#5fbf4f', keywords: ['processes', 'kill'] },
  help: { name: 'Windows Help and Support', icon: 'help', component: Help, size: { w: 720, h: 560 }, minSize: { w: 360, h: 300 }, hot: '#3aa6ff', keywords: ['help', 'support'] },
  getstarted: { name: 'Getting Started', icon: 'getting-started', component: Help, size: { w: 720, h: 560 }, minSize: { w: 360, h: 300 }, hot: '#3aa6ff', defaultProps: { topic: 'start' } },
  chaos: { name: 'Chaos Lab', icon: 'chaos', component: ChaosLab, size: { w: 560, h: 520 }, minSize: { w: 360, h: 320 }, single: true, hot: '#b36aff', keywords: ['virus', 'prank', 'joke', 'matrix', 'bsod', 'fun', 'effects', 'chaos'] },
  msgbox: { name: 'Message', icon: 'info', component: MessageBoxApp, hidden: true, resizable: false, maximizable: false },
  filedlg: { name: 'Open', icon: 'folder', component: FileDialogApp, hidden: true, minSize: { w: 420, h: 300 } },
  customdlg: { name: 'Dialog', icon: 'info', component: CustomDialogApp, hidden: true, resizable: false, maximizable: false },
};
