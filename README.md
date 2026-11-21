# Windows 7 Ultimate — web simulator

A Windows 7 desktop that runs entirely in the browser. It's built with React and Vite, and it deploys as a static site to GitHub Pages.

> This is a fan-made tribute. It is **not affiliated with, endorsed by, or connected to Microsoft**. All icons, wallpapers, the logo-style flag and the sounds are original artwork drawn in SVG or synthesized with WebAudio. No Microsoft assets are included.

## What's inside

**Shell**
- Boot animation, logon screen (with optional password), Welcome, Lock, Log off, Restart, Sleep and Shut down
- Aero glass windows with a blurred, tinted backdrop and reflection streaks. Each window can be dragged, resized from all 8 edges, minimized (it animates into its taskbar button), maximized and closed. It also has a system menu.
- Aero Snap: drag a window to the top edge to maximize it, or to the left or right edge to fill half the screen. Win+Arrow keys do the same.
- Superbar taskbar: pinned and running buttons, a hot-track glow that follows the pointer, live thumbnails, Aero Peek, jump lists, a notification area, a clock with a calendar flyout, and Show Desktop
- Start menu with most-used programs, an All Programs tree, live search over programs, files and Control Panel, and a shut-down split button
- Desktop icons on a grid. You can drag them (positions persist), select several with a rubber band, rename them inline, and drop items onto folders or the Recycle Bin. The desktop has its full right-click menu. You can also drag real files from your computer onto the desktop to import them.
- Screensavers (Bubbles, Mystify, Ribbons, Blank) that start after a set idle time

**Programs**
| Program | Highlights |
|---|---|
| Windows Explorer | Breadcrumb address bar with dropdowns, navigation tree, 8 view modes, sorting, recursive search, cut/copy/paste, drag-to-move, Libraries, Computer view with capacity bars, Recycle Bin restore/empty, details pane, properties |
| Control Panel | Category home, Personalization themes, Desktop Background (with upload), Window Color (live preview + color mixer), Screen Saver, Sound, User Accounts (name/picture/password), Date & Time, System, Taskbar, Programs, Network, Devices, Backup/Restore/Reset |
| Notepad | Open/Save/Save As, unsaved-changes prompt, Find/Replace/Go To, Word Wrap, Font dialog, Status bar, Time/Date |
| Paint | Ribbon UI with pencil, brushes (brush/calligraphy/airbrush/marker), fill, text, eraser, color picker, magnifier and 19 shapes; select/move/crop/delete, resize, rotate/flip, canvas resize handles, zoom, undo/redo; saves PNG/JPEG |
| Calculator | Standard (left-to-right like Win7) and Scientific (precedence, parentheses, trig, Inv); memory; keyboard; copy/paste |
| Internet Explorer | Tabs, history, favorites bar and center, a built-in home page, and opening local HTML/text files. Sites that refuse to be framed get an infobar with a link that opens them in a real tab. |
| Minesweeper | Beginner/Intermediate/Advanced/Custom, safe first click, chording, flags and question marks, resizable board, statistics, two tile themes, long-press to flag on touch |
| Command Prompt | `dir cd type mkdir rmdir del ren copy move tree start color title cls ver tasklist ipconfig ping systeminfo …` over the virtual disk, with history and Tab completion |
| Photo Viewer, Task Manager, Run, Help and Support, About Windows | |

**Persistence.** Files, folders, desktop layout and every setting are saved in `localStorage`. Use *Control Panel → Backup and Restore* to export or import everything as a JSON file, or to reset the simulator.

**Touch.** Tap to select, double-tap to open, and press and hold to right-click. On small screens, windows open maximized.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main` (or `master`). It can also be run manually from the Actions tab.

1. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Merge to `main`, or run the *Deploy to GitHub Pages* workflow.

The build uses a relative base path (`base: './'`), so it works at `https://<user>.github.io/<repo>/` without any further configuration.

## Tests

```bash
npm test                       # unit tests (file system, calculator, minesweeper, layout, URLs)
npm run build && npm run test:e2e   # end-to-end tests in Chromium (needs the `playwright` package)
```

The end-to-end suite boots the production build and checks the following: logon, Start search, saving a file, window drag/resize/minimize/maximize, desktop icon drag persistence, Calculator, Minesweeper, wallpaper changes, the Recycle Bin, persistence across reload, shutdown, and touch double-tap and long-press.

## Project layout

```
src/
  App.jsx               phases (boot, logon, desktop...), theming, global shortcuts
  state/                stores: virtual file system, settings, window manager
  system/               Window frame, Desktop, Taskbar, Start menu, dialogs, icons, screens
  apps/                 Explorer, ControlPanel, Notepad, Paint, Calculator, Browser, Minesweeper, Cmd...
  lib/                  pure logic (calculator, minesweeper, layout) + helpers
  styles/               base widgets, Aero window frame, shell, apps
public/wallpapers/      original SVG wallpapers
tests/                  unit + e2e tests
```
