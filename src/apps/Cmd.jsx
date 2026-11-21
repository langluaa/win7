import React, { useEffect, useRef, useState } from 'react';
import { wm, getRegistry } from '../state/wm.js';
import { fs, core } from '../state/fs.js';
import { settingsStore } from '../state/settings.js';
import { launch, openNode } from '../system/shell.jsx';

const BANNER = ['Windows 7 Simulator [Version 6.1.7601]', 'Fan-made simulation. Type HELP for a list of commands.', ''];

const COLORS = ['#000000', '#000080', '#008000', '#008080', '#800000', '#800080', '#808000', '#c0c0c0', '#808080', '#0000ff', '#00ff00', '#00ffff', '#ff0000', '#ff00ff', '#ffff00', '#ffffff'];

const HELP = `For more information on a specific command, type HELP command-name
CD             Displays the name of or changes the current directory.
CLS            Clears the screen.
COLOR          Sets the default console foreground and background colors.
COPY           Copies one or more files to another location.
DATE           Displays the date.
DEL            Deletes one or more files.
DIR            Displays a list of files and subdirectories in a directory.
ECHO           Displays messages.
EXIT           Quits the CMD.EXE program (command interpreter).
HELP           Provides Help information for Windows commands.
HOSTNAME       Prints the name of the current host.
IPCONFIG       Displays network configuration (simulated).
MKDIR          Creates a directory.
MOVE           Moves one or more files from one directory to another directory.
PING           Sends test packets to a host (simulated).
RENAME         Renames a file or files.
RMDIR          Removes a directory.
START          Starts a program or opens a file.
SYSTEMINFO     Displays system configuration information.
TASKLIST       Displays all currently running tasks.
TIME           Displays the system time.
TITLE          Sets the window title for a CMD.EXE session.
TREE           Graphically displays the directory structure of a drive or path.
TYPE           Displays the contents of a text file.
VER            Displays the Windows version.
WHOAMI         Displays the current user name.
`;

const APP_ALIASES = { notepad: 'notepad', calc: 'calc', mspaint: 'mspaint', explorer: 'explorer', iexplore: 'iexplore', control: 'control', winmine: 'minesweeper', minesweeper: 'minesweeper', chaos: 'chaos', virus: 'chaos', winver: 'winver', taskmgr: 'taskmgr', cmd: 'cmd' };

function splitArgs(s) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2]);
  return out;
}

export default function Cmd({ win, active }) {
  const [lines, setLines] = useState(BANNER);
  const [cwd, setCwd] = useState(() => fs.get('user') ? 'user' : 'C');
  const [input, setInput] = useState('');
  const [hist, setHist] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const [color, setColor] = useState({ fg: '#c0c0c0', bg: '#000000' });
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    wm.setTitle(win.id, 'C:\\Windows\\system32\\cmd.exe');
  }, [win.id]);

  useEffect(() => {
    if (active) inputRef.current?.focus({ preventScroll: true });
  }, [active]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const prompt = `${fs.path(cwd)}>`;

  const resolve = (p) => {
    if (!p) return cwd;
    if (/^[a-z]:$/i.test(p)) return p.toUpperCase().startsWith('C') ? 'C' : null;
    if (/^[a-z]:\\/i.test(p) || p.startsWith('\\')) return fs.resolve(p.startsWith('\\') ? 'C:' + p : p);
    return fs.resolve(`${fs.path(cwd)}\\${p}`);
  };

  const run = (raw) => {
    const out = [];
    const print = (...l) => out.push(...l.join('\n').split('\n'));
    const line = raw.trim();
    const [cmdRaw, ...args] = splitArgs(line);
    const cmd = (cmdRaw || '').toLowerCase();
    const rest = line.slice((cmdRaw || '').length).trim();
    let newCwd = cwd;
    switch (cmd) {
      case '':
        break;
      case 'help':
        print(HELP);
        break;
      case 'cls':
        setLines([]);
        return;
      case 'ver':
        print('', 'Windows 7 Simulator [Version 6.1.7601]', '');
        break;
      case 'echo':
        print(rest || 'ECHO is on.');
        break;
      case 'whoami':
        print(`${settingsStore.get().username.toLowerCase().replace(/\s+/g, '')}-pc\\${settingsStore.get().username.toLowerCase()}`);
        break;
      case 'hostname':
        print(`${settingsStore.get().username.toUpperCase().replace(/\s+/g, '')}-PC`);
        break;
      case 'date':
        print(`The current date is: ${new Date().toLocaleDateString([], { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}`);
        break;
      case 'time':
        print(`The current time is: ${new Date().toLocaleTimeString([], { hour12: false })}`);
        break;
      case 'title':
        wm.setTitle(win.id, rest || 'C:\\Windows\\system32\\cmd.exe');
        break;
      case 'color': {
        const a = (args[0] || '07').padStart(2, '0');
        const bg = parseInt(a[0], 16);
        const fg = parseInt(a[1], 16);
        if (isNaN(bg) || isNaN(fg) || bg === fg) break;
        setColor({ fg: COLORS[fg], bg: COLORS[bg] });
        break;
      }
      case 'cd':
      case 'chdir': {
        if (!rest) {
          print(fs.path(cwd));
          break;
        }
        const id = resolve(rest);
        if (!id || !core.isContainer(fs.get(id))) print('The system cannot find the path specified.');
        else newCwd = id;
        break;
      }
      case 'c:':
        newCwd = 'C';
        break;
      case 'dir': {
        const id = resolve(args.find((a) => !a.startsWith('/')));
        if (!id || !fs.get(id)) {
          print('File Not Found');
          break;
        }
        const target = core.isContainer(fs.get(id)) ? id : fs.get(id).parent;
        const kids = fs.children(target);
        print(' Volume in drive C has no label.', ' Volume Serial Number is 7E1C-2009', '', ` Directory of ${fs.path(target)}`, '');
        let files = 0;
        let bytes = 0;
        const fmt = (t) => {
          const d = new Date(t);
          return `${d.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })}  ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        };
        if (fs.get(target).parent) {
          print(`${fmt(fs.get(target).mtime)}    <DIR>          .`, `${fmt(fs.get(target).mtime)}    <DIR>          ..`);
        }
        for (const k of kids) {
          if (core.isContainer(k)) print(`${fmt(k.mtime)}    <DIR>          ${k.name}`);
          else {
            const size = core.sizeOf(fs.nodes, k.id);
            files++;
            bytes += size;
            print(`${fmt(k.mtime)} ${size.toLocaleString().padStart(17)} ${k.name}${k.type === 'shortcut' ? '.lnk' : ''}`);
          }
        }
        const dirs = kids.filter(core.isContainer).length;
        print(`${String(files).padStart(16)} File(s) ${bytes.toLocaleString().padStart(14)} bytes`, `${String(dirs).padStart(16)} Dir(s)  92,615,483,392 bytes free`);
        break;
      }
      case 'type': {
        const id = resolve(rest);
        const n = id && fs.get(id);
        if (!n) print('The system cannot find the file specified.');
        else if (core.isContainer(n)) print('Access is denied.');
        else print(String(n.content || '').startsWith('data:') || String(n.content || '').startsWith('asset:') ? '\u00ff\u00d8\u00ff\u00e0 JFIF (binary data)' : String(n.content || ''));
        break;
      }
      case 'md':
      case 'mkdir': {
        if (!rest) {
          print('The syntax of the command is incorrect.');
          break;
        }
        if (fs.findChild(cwd, rest)) print(`A subdirectory or file ${rest} already exists.`);
        else {
          const err = core.validateName(rest);
          if (err) print('The filename, directory name, or volume label syntax is incorrect.');
          else fs.create({ parent: cwd, name: rest, type: 'folder' });
        }
        break;
      }
      case 'rd':
      case 'rmdir': {
        const id = resolve(args.find((a) => !a.startsWith('/')));
        const n = id && fs.get(id);
        if (!n || !core.isContainer(n)) print('The system cannot find the file specified.');
        else if (n.system) print('Access is denied.');
        else if (fs.children(id).length && !args.some((a) => a.toLowerCase() === '/s')) print('The directory is not empty.');
        else fs.purge(id);
        break;
      }
      case 'del':
      case 'erase': {
        const id = resolve(rest);
        const n = id && fs.get(id);
        if (!n) print(`Could Not Find ${fs.path(cwd)}\\${rest}`);
        else if (n.system) print('Access is denied.');
        else if (core.isContainer(n)) print(`${fs.path(id)}\\*, Are you sure (Y/N)? N`);
        else fs.purge(id);
        break;
      }
      case 'ren':
      case 'rename': {
        const id = resolve(args[0]);
        if (!id || !args[1]) print('The syntax of the command is incorrect.');
        else {
          const err = fs.rename(id, args[1]);
          if (err) print('A duplicate file name exists, or the file cannot be found.');
        }
        break;
      }
      case 'copy':
      case 'move': {
        const src = resolve(args[0]);
        let dst = resolve(args[1] || '.');
        if (!src) {
          print('The system cannot find the file specified.');
          break;
        }
        let newName = null;
        if (!dst && args[1]) {
          const parts = args[1].split('\\');
          newName = parts.pop();
          dst = parts.length ? resolve(parts.join('\\')) : cwd;
        }
        if (!dst || !core.isContainer(fs.get(dst))) {
          print('The system cannot find the path specified.');
          break;
        }
        if (cmd === 'copy') {
          const id = fs.copy(src, dst);
          if (newName && id) fs.rename(id, newName);
          print('        1 file(s) copied.');
        } else {
          const err = fs.move(src, dst);
          if (err) print('Access is denied.');
          else {
            if (newName) fs.rename(src, newName);
            print('        1 file(s) moved.');
          }
        }
        break;
      }
      case 'tree': {
        const root = resolve(rest) || cwd;
        print(`Folder PATH listing`, `Volume serial number is 7E1C-2009`, fs.path(root));
        const walk = (id, prefix, depth) => {
          const kids = fs.children(id).filter(core.isContainer);
          kids.forEach((k, i) => {
            const last = i === kids.length - 1;
            print(`${prefix}${last ? '\u2514\u2500\u2500\u2500' : '\u251c\u2500\u2500\u2500'}${k.name}`);
            if (depth < 6) walk(k.id, prefix + (last ? '    ' : '\u2502   '), depth + 1);
          });
        };
        walk(root, '', 0);
        break;
      }
      case 'start': {
        const target = args[0];
        if (!target) {
          launch('cmd');
          break;
        }
        const app = APP_ALIASES[target.toLowerCase().replace(/\.exe$/, '')];
        if (app) launch(app);
        else if (/^(https?:|www\.)/i.test(target)) launch('iexplore', { url: target });
        else {
          const id = resolve(target);
          if (id) openNode(id);
          else print(`Windows cannot find '${target}'. Make sure you typed the name correctly, and then try again.`);
        }
        break;
      }
      case 'tasklist': {
        print('', 'Image Name                     PID Session Name        Mem Usage', '========================= ======== ================ ============');
        print('System Idle Process              0 Services                 24 K', 'explorer.exe                  1764 Console              38,212 K');
        wm.windowsOf && Object.keys(getRegistry()).forEach((a) => wm.windowsOf(a).forEach((w, i) => print(`${(a + '.exe').padEnd(25)} ${String(2000 + i * 4 + a.length * 37).padStart(8)} Console          ${String(8000 + a.length * 913).replace(/\B(?=(\d{3})+(?!\d))/g, ',').padStart(10)} K`)));
        break;
      }
      case 'ipconfig':
        print('', 'Windows IP Configuration', '', '', 'Wireless LAN adapter Wireless Network Connection:', '', '   Connection-specific DNS Suffix  . : home', '   IPv4 Address. . . . . . . . . . . : 192.168.1.7', '   Subnet Mask . . . . . . . . . . . : 255.255.255.0', '   Default Gateway . . . . . . . . . : 192.168.1.1', '');
        break;
      case 'ping': {
        const host = args[0] || 'localhost';
        print('', `Pinging ${host} with 32 bytes of data:`);
        for (let i = 0; i < 4; i++) print(`Reply from ${host === 'localhost' ? '127.0.0.1' : '93.184.216.34'}: bytes=32 time=${10 + ((i * 7 + host.length) % 15)}ms TTL=54`);
        print('', `Ping statistics for ${host}:`, '    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),');
        break;
      }
      case 'systeminfo':
        print('', `Host Name:                 ${settingsStore.get().username.toUpperCase()}-PC`, 'OS Name:                   Windows 7 Ultimate (simulated)', 'OS Version:                6.1.7601 Service Pack 1 Build 7601', `Processor(s):              ${navigator.hardwareConcurrency || 2} logical processor(s)`, `Browser:                   ${navigator.userAgent.slice(0, 60)}...`);
        break;
      case 'exit':
        wm.close(win.id);
        return;
      default: {
        const app = APP_ALIASES[cmd.replace(/\.exe$/, '')];
        if (app) {
          launch(app);
          break;
        }
        const id = resolve(cmdRaw);
        if (id && !core.isContainer(fs.get(id))) {
          openNode(id);
          break;
        }
        print(`'${cmdRaw}' is not recognized as an internal or external command,`, 'operable program or batch file.');
      }
    }
    setCwd(newCwd);
    setLines((l) => [...l, `${prompt}${raw}`, ...out, ...(out.length && cmd !== 'cd' ? [''] : [])].slice(-800));
  };

  const complete = () => {
    const m = /(^|\s)("?)([^\s"]*)$/.exec(input);
    if (!m) return;
    const partial = m[3];
    const slash = partial.lastIndexOf('\\');
    const dirPart = slash >= 0 ? partial.slice(0, slash) : '';
    const base = slash >= 0 ? partial.slice(slash + 1) : partial;
    const dir = dirPart ? resolve(dirPart) : cwd;
    if (!dir) return;
    const match = fs.children(dir).find((c) => c.name.toLowerCase().startsWith(base.toLowerCase()));
    if (!match) return;
    const full = (dirPart ? dirPart + '\\' : '') + match.name;
    const quoted = /\s/.test(full) ? `"${full}"` : full;
    setInput(input.slice(0, input.length - m[2].length - partial.length) + quoted);
  };

  return (
    <div className="cmd w7-scroll" style={{ background: color.bg, color: color.fg }} ref={scrollRef} onPointerUp={() => !window.getSelection()?.toString() && inputRef.current?.focus()}>
      {lines.map((l, i) => (
        <div key={i} className="cmd-line">
          {l || '\u00a0'}
        </div>
      ))}
      <div className="cmd-line cmd-input-line">
        <span>{prompt}</span>
        <span className="cmd-typed">{input}</span>
        <span className="cmd-caret" style={{ background: color.fg }} />
        <input
          ref={inputRef}
          className="cmd-input"
          value={input}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Command input"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              run(input);
              if (input.trim()) setHist((h) => [...h, input]);
              setHIdx(-1);
              setInput('');
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (!hist.length) return;
              const i = hIdx < 0 ? hist.length - 1 : Math.max(0, hIdx - 1);
              setHIdx(i);
              setInput(hist[i]);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (hIdx < 0) return;
              const i = hIdx + 1;
              if (i >= hist.length) {
                setHIdx(-1);
                setInput('');
              } else {
                setHIdx(i);
                setInput(hist[i]);
              }
            } else if (e.key === 'Tab') {
              e.preventDefault();
              complete();
            } else if (e.key === 'Escape') setInput('');
            else if (e.ctrlKey && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
              setLines((l) => [...l, `${prompt}${input}^C`]);
              setInput('');
            }
          }}
        />
      </div>
    </div>
  );
}
