import React, { memo } from 'react';

// Original SVG icon artwork drawn in the glossy Windows 7 style.
// All icons use a 48x48 viewBox; shared gradients live in <IconDefs/> (rendered once).

const L = (id, stops, x2 = 0, y2 = 1) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2} key={id}>
    {stops.map(([o, c, op = 1]) => (
      <stop key={o} offset={o} stopColor={c} stopOpacity={op} />
    ))}
  </linearGradient>
);
const R = (id, stops, cx = 0.35, cy = 0.3, r = 0.75) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r} key={id}>
    {stops.map(([o, c, op = 1]) => (
      <stop key={o} offset={o} stopColor={c} stopOpacity={op} />
    ))}
  </radialGradient>
);

export function IconDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {L('i-fback', [[0, '#e8b955'], [1, '#c48a22']])}
        {L('i-ffront', [[0, '#fff1bd'], [0.45, '#f8d77a'], [1, '#e9ab38']])}
        {L('i-paper', [[0, '#ffffff'], [1, '#e3e9f1']])}
        {L('i-paper2', [[0, '#f9fbfd'], [1, '#d5dde8']], 1, 1)}
        {L('i-screen', [[0, '#5cb6f5'], [0.5, '#1f78d1'], [1, '#0b3f8c']])}
        {L('i-bezel', [[0, '#5d6670'], [0.5, '#2a3037'], [1, '#14181c']])}
        {L('i-metal', [[0, '#fbfcfd'], [0.5, '#d7dde3'], [1, '#a6b0ba']])}
        {L('i-metalh', [[0, '#e9edf1'], [1, '#9aa5b0']], 1, 0)}
        {L('i-shine', [[0, '#fff', 0.55], [1, '#fff', 0]])}
        {L('i-glass', [[0, '#e9f4fb', 0.9], [0.5, '#bcd8ec', 0.75], [1, '#8fb6d6', 0.85]], 1, 0)}
        {L('i-green', [[0, '#a5e98a'], [1, '#2c8f22']])}
        {L('i-red', [[0, '#ff9b88'], [0.5, '#e23d22'], [1, '#a5170a']])}
        {L('i-gold', [[0, '#fff0a8'], [0.5, '#f5c33b'], [1, '#c98a0c']])}
        {L('i-blue', [[0, '#8fd0ff'], [0.5, '#2b86e0'], [1, '#0f4ea8']])}
        {L('i-dark', [[0, '#4a525b'], [1, '#0d0f12']])}
        {L('i-calc', [[0, '#f1f4f8'], [1, '#a9b5c3']])}
        {L('i-lcd', [[0, '#d9ecd0'], [1, '#a9c79b']])}
        {L('i-wood', [[0, '#f6e5c2'], [1, '#d6b27a']])}
        {L('i-sky', [[0, '#3d8de0'], [1, '#bfe3ff']])}
        {L('i-grass', [[0, '#7fcf4a'], [1, '#2f7d1b']])}
        {L('i-yellowtri', [[0, '#fff3a0'], [0.6, '#f7c614'], [1, '#d99a00']])}
        {R('i-orb', [[0, '#bfe6ff'], [0.45, '#2f8ae6'], [1, '#0a3a8c']])}
        {R('i-globe', [[0, '#c8f0ff'], [0.5, '#3aa0e8'], [1, '#0b4b9a']])}
        {R('i-mine', [[0, '#9aa7b6'], [0.35, '#3a434d'], [1, '#050607']])}
        {R('i-redorb', [[0, '#ffc2b5'], [0.45, '#e2391d'], [1, '#8a0f04']])}
        {R('i-greenorb', [[0, '#d9ffb8'], [0.45, '#4cb82c'], [1, '#1b6510']])}
      </defs>
    </svg>
  );
}

/** Four-pane waving flag (original drawing, evokes the Windows flag). */
export function Flag({ x = 0, y = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M1 3.2c3-1.6 5.8-1.7 8.6-.4l-1.5 7.4C5.4 9 2.6 9.1-.3 10.6z" fill="#f2502b" />
      <path d="M10.7 3.3c2.8 1.3 5.6 1.4 8.6-.2l-1.4 7.4c-3 1.5-5.8 1.5-8.6.2z" fill="#7cbb00" />
      <path d="M-.5 11.7c2.9-1.5 5.7-1.6 8.4-.3l-1.5 7.4c-2.7-1.3-5.5-1.2-8.4.4z" fill="#00a1f1" />
      <path d="M9.1 11.6c2.8 1.3 5.6 1.4 8.6-.2l-1.4 7.4c-3 1.6-5.8 1.6-8.6.3z" fill="#ffbb00" />
    </g>
  );
}

const Page = ({ children, fold = true }) => (
  <>
    <path d="M10 3h20l9 9v32H10z" fill="url(#i-paper)" stroke="#8a98a8" strokeWidth="1" />
    {fold && <path d="M30 3v9h9" fill="#e9eef4" stroke="#8a98a8" strokeWidth="1" strokeLinejoin="round" />}
    {children}
  </>
);

const FolderBase = ({ children, papers = true }) => (
  <>
    <path d="M3 9.5a1.5 1.5 0 0 1 1.5-1.5H17l3 3.2h23a1.5 1.5 0 0 1 1.5 1.5V41H3z" fill="url(#i-fback)" stroke="#a56f12" strokeWidth="0.9" />
    {papers && (
      <>
        <rect x="7" y="13" width="33" height="22" fill="#fff" stroke="#c9c9c9" strokeWidth="0.6" transform="rotate(-3 23 24)" />
        <rect x="8" y="15" width="32" height="20" fill="#f4f7fb" stroke="#c9c9c9" strokeWidth="0.6" transform="rotate(2 23 24)" />
      </>
    )}
    <path d="M2 19.5a1.5 1.5 0 0 1 1.5-1.5h41a1.5 1.5 0 0 1 1.5 1.7l-2.4 21.2a1.5 1.5 0 0 1-1.5 1.1H5.4a1.5 1.5 0 0 1-1.5-1.3z" fill="url(#i-ffront)" stroke="#b97f17" strokeWidth="0.9" />
    <path d="M3.4 19.4h41.2" stroke="#fffbe8" strokeWidth="1" opacity="0.9" />
    {children}
  </>
);

const Person = ({ x, y, s = 1, c1 = '#5a9be0', c2 = '#1f5fa8' }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle cx="8" cy="5" r="4.6" fill="#f6cfa6" stroke="#b9875a" strokeWidth="0.6" />
    <path d="M7.9 1.2c-3 0-4.6 1.8-4.4 4 1-1.6 3-2.5 5.4-2.3 1.6.1 2.8.9 3.6 2.2.2-2.4-1.6-3.9-4.6-3.9z" fill="#6b4421" />
    <path d="M0 18c0-5 3.5-7.6 8-7.6S16 13 16 18z" fill={c1} stroke={c2} strokeWidth="0.8" />
  </g>
);

const Monitor = ({ screen = 'url(#i-screen)', children }) => (
  <>
    <rect x="3.5" y="5" width="41" height="29" rx="2.2" fill="url(#i-bezel)" stroke="#0c0e10" strokeWidth="0.8" />
    <rect x="6.5" y="8" width="35" height="23" fill={screen} />
    {children}
    <path d="M6.5 8h35v9C30 13 18 20 6.5 22z" fill="url(#i-shine)" opacity="0.6" />
    <path d="M20 34h8l1.5 5h-11z" fill="url(#i-metalh)" stroke="#6d7782" strokeWidth="0.6" />
    <path d="M12 39.5h24a2 2 0 0 1 2 2V43H10v-1.5a2 2 0 0 1 2-2z" fill="url(#i-metal)" stroke="#6d7782" strokeWidth="0.7" />
  </>
);

const Globe = ({ cx = 24, cy = 24, r = 18 }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="url(#i-globe)" stroke="#0a3d7d" strokeWidth="0.8" />
    <path
      transform={`translate(${cx - 24 * (r / 18)} ${cy - 24 * (r / 18)}) scale(${r / 18})`}
      d="M14 12c3 1 4 3 7 3s2 4-1 5-6 0-6 4 4 4 3 8-4 2-6-1-3-8-1-12zm14-4c3 0 7 2 9 5-2 1-3 0-5 2s1 4-2 5-3-2-5-1-2-4 0-6-1-5 3-5zm2 16c3-1 5 1 7 0 1 3-1 7-4 9-2-1-1-3-3-5s-2-3 0-4z"
      fill="#5cc23c"
      opacity="0.9"
    />
    <ellipse cx={cx - r * 0.25} cy={cy - r * 0.45} rx={r * 0.55} ry={r * 0.32} fill="#fff" opacity="0.35" />
  </g>
);

const Bin = ({ full }) => (
  <>
    <path d="M9 11h30l-3.6 32.2a2 2 0 0 1-2 1.8H14.6a2 2 0 0 1-2-1.8z" fill="url(#i-glass)" stroke="#5f84a6" strokeWidth="0.9" />
    {[16, 21, 26, 31].map((x) => (
      <path key={x} d={`M${x + 0.5} 14l${(x - 24) * 0.1} 28`} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.2" />
    ))}
    {full && (
      <>
        <path d="M12 12c2-6 7-8 11-5 3-4 9-3 12 1 2 1 3 3 2 5z" fill="#fdfdfd" stroke="#9aa7b4" strokeWidth="0.7" />
        <path d="M15 11c3-2 6-2 8 1M26 10c2-2 6-2 8 1" stroke="#b8c3ce" strokeWidth="0.8" fill="none" />
        <path d="M30 4l6 3-3 5-5-2z" fill="#f4e7b8" stroke="#b6a46b" strokeWidth="0.6" />
      </>
    )}
    <ellipse cx="24" cy="11" rx="15.5" ry="3" fill="none" stroke="#5f84a6" strokeWidth="1.1" />
    <ellipse cx="24" cy="11" rx="14.5" ry="2.2" fill={full ? 'none' : '#d9ecf8'} fillOpacity="0.7" />
    <path d="M18.5 30.5l2.6-4.4 2.6 4.4zM27.5 24.7l2.5 4.5h-5zM21 34.6l5.2.1-2.6 4.3z" fill="#42a83a" opacity="0.75" />
    <path d="M10 13l2.6 30" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.3" />
  </>
);

const Drive = ({ children }) => (
  <>
    <path d="M6 26l4-8h28l4 8z" fill="url(#i-metal)" stroke="#6d7782" strokeWidth="0.8" />
    <rect x="5.5" y="26" width="37" height="11" rx="1.5" fill="url(#i-metalh)" stroke="#5d6772" strokeWidth="0.8" />
    <rect x="9" y="30.5" width="20" height="2" rx="1" fill="#5a646e" opacity="0.6" />
    <circle cx="37" cy="31.5" r="1.6" fill="#5cf23c" stroke="#1d7a0e" strokeWidth="0.5" />
    {children}
  </>
);

const Doc = ({ color = '#7b8fa6' }) => (
  <g stroke={color} strokeWidth="1.4" opacity="0.8">
    {[18, 22, 26, 30, 34, 38].map((y) => (
      <path key={y} d={`M15 ${y}h${y === 38 ? 12 : 19}`} />
    ))}
  </g>
);

const Emblem = ({ children, x = 24, y = 30 }) => <g transform={`translate(${x - 9} ${y - 9})`}>{children}</g>;

const TinyPicture = () => (
  <>
    <rect x="1" y="2" width="16" height="13" fill="url(#i-sky)" stroke="#fff" strokeWidth="1.3" />
    <path d="M1 12l5-5 4 4 3-2 4 4v2H1z" fill="url(#i-grass)" />
    <circle cx="13" cy="5.5" r="1.6" fill="#fff8b0" />
    <rect x="1" y="2" width="16" height="13" fill="none" stroke="#6d7782" strokeWidth="0.5" />
  </>
);

const Note = ({ fill = '#2a6fd0' }) => (
  <path d="M7 2v10.2A3 3 0 1 0 9 15V6l7-2v7.2A3 3 0 1 0 18 14V0z" fill={fill} transform="scale(0.9) translate(0 1)" />
);

const Film = () => (
  <>
    <rect x="1" y="3" width="16" height="12" rx="1" fill="#2b3239" />
    {[2.5, 6, 9.5, 13].map((x) => (
      <g key={x}>
        <rect x={x} y="4" width="2" height="1.6" fill="#e9eef3" />
        <rect x={x} y="12.4" width="2" height="1.6" fill="#e9eef3" />
      </g>
    ))}
    <rect x="3" y="6.3" width="12" height="5.4" fill="url(#i-screen)" />
  </>
);

const DownArrow = () => <path d="M6 1h6v7h4l-7 8-7-8h4z" fill="url(#i-green)" stroke="#1d6a14" strokeWidth="0.8" />;
const Star = ({ fill = 'url(#i-gold)' }) => (
  <path d="M9 0.5l2.6 5.5 6 .7-4.5 4.1 1.2 6L9 13.8 3.7 16.8l1.2-6L.4 6.7l6-.7z" fill={fill} stroke="#b07a00" strokeWidth="0.7" />
);
const Magnifier = () => (
  <>
    <circle cx="7" cy="7" r="5" fill="#dff2ff" fillOpacity="0.7" stroke="#3d5a78" strokeWidth="2" />
    <path d="M10.5 10.5l6 6" stroke="#3d5a78" strokeWidth="3" strokeLinecap="round" />
  </>
);

const ICONS = {
  computer: (
    <Monitor>
      <Flag x={17} y={12} s={0.75} />
    </Monitor>
  ),
  'recycle-empty': <Bin />,
  'recycle-full': <Bin full />,
  folder: <FolderBase />,
  'folder-open': <FolderBase />,
  'folder-documents': (
    <FolderBase>
      <Emblem>
        <path d="M3 0h9l4 4v14H3z" fill="#fff" stroke="#7a8796" strokeWidth="0.8" />
        <path d="M5 7h9M5 10h9M5 13h7" stroke="#5f84a6" strokeWidth="1" />
      </Emblem>
    </FolderBase>
  ),
  'folder-pictures': (
    <FolderBase>
      <Emblem>
        <TinyPicture />
      </Emblem>
    </FolderBase>
  ),
  'folder-music': (
    <FolderBase>
      <Emblem>
        <Note />
      </Emblem>
    </FolderBase>
  ),
  'folder-videos': (
    <FolderBase>
      <Emblem>
        <Film />
      </Emblem>
    </FolderBase>
  ),
  'folder-downloads': (
    <FolderBase>
      <Emblem>
        <DownArrow />
      </Emblem>
    </FolderBase>
  ),
  'folder-desktop': (
    <FolderBase>
      <Emblem>
        <rect x="1" y="2" width="16" height="11" rx="1" fill="url(#i-screen)" stroke="#1f3550" strokeWidth="0.8" />
        <path d="M6 13h6v3H6z" fill="#7d8894" />
      </Emblem>
    </FolderBase>
  ),
  'folder-favorites': (
    <FolderBase>
      <Emblem>
        <Star />
      </Emblem>
    </FolderBase>
  ),
  'folder-games': (
    <FolderBase>
      <Emblem>
        <path d="M2 6c0-2 1.5-3 4-3h6c2.5 0 4 1 4 3l1 7c.2 2-2 3-3.5 1L11 11H7l-2.5 3C3 16 .8 15 1 13z" fill="url(#i-dark)" />
        <circle cx="12.5" cy="7" r="1.2" fill="#e23d22" />
        <path d="M5 5.5v3M3.5 7h3" stroke="#fff" strokeWidth="1" />
      </Emblem>
    </FolderBase>
  ),
  'folder-contacts': (
    <FolderBase>
      <Emblem>
        <Person x={1} y={0} s={1} />
      </Emblem>
    </FolderBase>
  ),
  'folder-search': (
    <FolderBase>
      <Emblem>
        <Magnifier />
      </Emblem>
    </FolderBase>
  ),
  'folder-user': (
    <FolderBase>
      <Emblem>
        <Person x={1} y={0} s={1} />
      </Emblem>
    </FolderBase>
  ),
  library: (
    <>
      <rect x="6" y="10" width="36" height="32" rx="2" fill="url(#i-fback)" stroke="#a56f12" strokeWidth="0.9" />
      <rect x="10" y="5" width="8" height="34" fill="#4b8fdb" stroke="#1f5fa8" strokeWidth="0.7" />
      <rect x="19" y="8" width="7" height="31" fill="#6dbb4a" stroke="#2f7d1b" strokeWidth="0.7" />
      <rect x="27" y="6" width="9" height="33" fill="#e8574a" stroke="#a5170a" strokeWidth="0.7" transform="rotate(8 31 22)" />
      <rect x="4" y="30" width="40" height="13" rx="1.5" fill="url(#i-ffront)" stroke="#b97f17" strokeWidth="0.9" />
    </>
  ),
  'drive-c': (
    <Drive>
      <Flag x={9} y={7} s={0.62} />
    </Drive>
  ),
  'drive-dvd': (
    <Drive>
      <circle cx="24" cy="15" r="11" fill="#e5ecf2" stroke="#8a98a8" />
      <circle cx="24" cy="15" r="11" fill="url(#i-shine)" />
      <path d="M15 11a11 11 0 0 1 9-7v7z" fill="#f2c3ff" opacity="0.6" />
      <path d="M33 19a11 11 0 0 1-9 7v-7z" fill="#bfffe6" opacity="0.6" />
      <circle cx="24" cy="15" r="2.5" fill="#fff" stroke="#8a98a8" />
    </Drive>
  ),
  network: (
    <>
      <Globe cx={28} cy={18} r={15} />
      <rect x="3" y="22" width="22" height="16" rx="1.5" fill="url(#i-bezel)" />
      <rect x="5" y="24" width="18" height="11" fill="url(#i-screen)" />
      <path d="M11 38h6v3h-6zM8 41h12v2H8z" fill="url(#i-metal)" stroke="#6d7782" strokeWidth="0.5" />
    </>
  ),
  controlpanel: (
    <Monitor screen="#eef4fb">
      <rect x="10" y="21" width="5" height="8" fill="#3c9b2e" />
      <rect x="17" y="15" width="5" height="14" fill="#2b7fd6" />
      <rect x="24" y="18" width="5" height="11" fill="#f1b31c" />
      <rect x="31" y="12" width="5" height="17" fill="#e2452b" />
    </Monitor>
  ),
  notepad: (
    <>
      <rect x="9" y="6" width="30" height="38" rx="1.5" fill="url(#i-paper)" stroke="#6d8bb0" />
      <rect x="9" y="6" width="30" height="7" rx="1.5" fill="url(#i-blue)" stroke="#1d4f95" strokeWidth="0.8" />
      {[13, 18, 23, 28, 33].map((x) => (
        <rect key={x} x={x - 1} y="3" width="2.4" height="7" rx="1.2" fill="url(#i-metalh)" stroke="#5d6772" strokeWidth="0.5" />
      ))}
      <g stroke="#8db4e2" strokeWidth="1">
        {[19, 24, 29, 34, 39].map((y) => (
          <path key={y} d={`M12 ${y}h24`} />
        ))}
      </g>
      <path d="M14 18.5h16M14 23.5h19M14 28.5h12" stroke="#3a4b5e" strokeWidth="1.2" />
    </>
  ),
  mspaint: (
    <>
      <path d="M24 6C12 6 4 13 4 22s7 16 15 15c4-.4 3-4 6-5 4-1 6 3 11 1 5-2 8-6 8-12C44 12 36 6 24 6z" fill="url(#i-wood)" stroke="#9b7a46" />
      <ellipse cx="24" cy="31" rx="3.5" ry="3" fill="#fff" stroke="#9b7a46" strokeWidth="0.6" />
      <circle cx="13" cy="20" r="3.6" fill="#e2391d" />
      <circle cx="20" cy="13" r="3.6" fill="#f5c33b" />
      <circle cx="29" cy="12" r="3.6" fill="#4cb82c" />
      <circle cx="36" cy="18" r="3.6" fill="#2b86e0" />
      <circle cx="35" cy="26" r="3.2" fill="#9b45c8" />
      <path d="M41 30L27 44" stroke="#a3713a" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M26 45l-4 1 1-4 3-2 2 2z" fill="#203040" />
      <path d="M39.5 31.5l3-3" stroke="#d7dde3" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  calc: (
    <>
      <rect x="9" y="3" width="30" height="42" rx="3" fill="url(#i-calc)" stroke="#5d6a78" />
      <rect x="12.5" y="6.5" width="23" height="9" rx="1" fill="url(#i-lcd)" stroke="#6f8a62" strokeWidth="0.8" />
      <path d="M26 9h2v4M30 9h3v2h-3v2h3" stroke="#2c3a22" strokeWidth="1" fill="none" />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect
            key={`${r}${c}`}
            x={12.5 + c * 6}
            y={19 + r * 6.3}
            width="5"
            height="5"
            rx="1"
            fill={c === 3 ? (r === 3 ? 'url(#i-gold)' : '#d1dae5') : '#fdfefe'}
            stroke="#7b8796"
            strokeWidth="0.5"
          />
        ))
      )}
    </>
  ),
  iexplore: (
    <>
      <path
        d="M24 9.5c-8.6 0-15 6.4-15 14.8C9 32.7 15.4 39 24 39c6.3 0 11.4-3.3 13.6-8.6h-8.4C27.9 32.4 26.2 33.3 24 33.3c-3.9 0-6.9-2.7-7.3-6.6h21.8c.1-.8.2-1.6.2-2.5 0-8.4-6.3-14.7-14.7-14.7zm-7.1 12c.7-3.4 3.4-5.7 7.1-5.7s6.3 2.3 7 5.7z"
        fill="url(#i-blue)"
        stroke="#0a3d8a"
        strokeWidth="0.8"
      />
      <path d="M8 34C2 42 6 46 14 41c7-4 17-13 24-23 6-9 2-13-7-9" fill="none" stroke="url(#i-gold)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M9.5 12.5c3-2.5 6.5-3.6 10-3.6" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" fill="none" />
    </>
  ),
  minesweeper: (
    <>
      <rect x="3" y="3" width="42" height="42" rx="4" fill="url(#i-blue)" stroke="#0f3d7d" />
      <rect x="4" y="4" width="40" height="18" rx="3" fill="#fff" opacity="0.25" />
      <g stroke="#0b0d10" strokeWidth="2.6" strokeLinecap="round">
        <path d="M24 9v30M9 24h30M13.5 13.5l21 21M34.5 13.5l-21 21" />
      </g>
      <circle cx="24" cy="24" r="10" fill="url(#i-mine)" />
      <circle cx="20.5" cy="20.5" r="2.4" fill="#fff" opacity="0.85" />
    </>
  ),
  cmd: (
    <>
      <rect x="3" y="7" width="42" height="34" rx="2" fill="#1b1f24" stroke="#9aa5b0" />
      <rect x="3" y="7" width="42" height="6" rx="2" fill="url(#i-metal)" />
      <path d="M8 19l6 4-6 4" stroke="#d9d9d9" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 28h9" stroke="#d9d9d9" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  photos: (
    <>
      <rect x="4" y="8" width="40" height="32" rx="1" fill="#fbfbfb" stroke="#8a98a8" />
      <rect x="7.5" y="11.5" width="33" height="25" fill="url(#i-sky)" />
      <path d="M7.5 30l9-9 7 7 5-4 12 9v3.5h-33z" fill="url(#i-grass)" />
      <circle cx="33" cy="17" r="3" fill="#fff8b0" />
      <path d="M7.5 11.5h33v7c-11-4-22 1-33 5z" fill="url(#i-shine)" opacity="0.5" />
    </>
  ),
  'file-text': (
    <Page>
      <Doc />
    </Page>
  ),
  'file-image': (
    <Page>
      <g transform="translate(14 16) scale(1.15)">
        <TinyPicture />
      </g>
    </Page>
  ),
  'file-html': (
    <Page>
      <g transform="translate(13 15) scale(0.48)">
        <path
          d="M24 9.5c-8.6 0-15 6.4-15 14.8C9 32.7 15.4 39 24 39c6.3 0 11.4-3.3 13.6-8.6h-8.4C27.9 32.4 26.2 33.3 24 33.3c-3.9 0-6.9-2.7-7.3-6.6h21.8c.1-.8.2-1.6.2-2.5 0-8.4-6.3-14.7-14.7-14.7zm-7.1 12c.7-3.4 3.4-5.7 7.1-5.7s6.3 2.3 7 5.7z"
          fill="url(#i-blue)"
        />
      </g>
    </Page>
  ),
  'file-audio': (
    <Page>
      <g transform="translate(15 18) scale(1.1)">
        <Note />
      </g>
    </Page>
  ),
  'file-video': (
    <Page>
      <g transform="translate(15 18)">
        <Film />
      </g>
    </Page>
  ),
  'file-zip': (
    <FolderBase papers={false}>
      <path d="M22 18h4v24h-4z" fill="#7d8894" />
      {[20, 24, 28, 32, 36].map((y) => (
        <path key={y} d={`M22 ${y}h4`} stroke="#d7dde3" strokeWidth="1.3" />
      ))}
    </FolderBase>
  ),
  chaos: (
    <>
      <circle cx="24" cy="24" r="20" fill="url(#i-mine)" stroke="#2a1150" strokeWidth="1" />
      <circle cx="24" cy="24" r="20" fill="#4a1d8a" opacity="0.55" />
      <circle cx="17" cy="20" r="6.5" fill="#fff" stroke="#222" strokeWidth="1.2" />
      <circle cx="31" cy="20" r="6.5" fill="#fff" stroke="#222" strokeWidth="1.2" />
      <circle cx="18.6" cy="21.5" r="2.8" fill="#111" />
      <circle cx="29.4" cy="21.5" r="2.8" fill="#111" />
      <circle cx="17.7" cy="20.6" r="0.9" fill="#fff" />
      <circle cx="28.5" cy="20.6" r="0.9" fill="#fff" />
      <path d="M16 31q8 7 16 0" fill="none" stroke="#ff5bd0" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 12l3 5 5-2-3 6 5 2-6 1M40 12l-3 5-5-2 3 6-5 2 6 1" fill="none" stroke="#9b5bff" strokeWidth="1.4" opacity="0.8" />
    </>
  ),
  'file-exe': (
    <>
      <rect x="5" y="9" width="38" height="30" rx="1.5" fill="#fff" stroke="#6d8bb0" />
      <rect x="5" y="9" width="38" height="6" rx="1.5" fill="url(#i-blue)" />
      <rect x="9" y="19" width="12" height="16" fill="#e3eaf3" />
    </>
  ),
  file: <Page />,
  help: (
    <>
      <circle cx="24" cy="24" r="19" fill="url(#i-orb)" stroke="#0a3a8c" />
      <path d="M17.5 18.5c0-4 3-6.5 6.8-6.5 4 0 6.7 2.4 6.7 5.8 0 4.7-5.5 5-5.5 9.2v1.2" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="25.5" cy="34.5" r="2.6" fill="#fff" />
      <ellipse cx="20" cy="13" rx="11" ry="6" fill="#fff" opacity="0.25" />
    </>
  ),
  info: (
    <>
      <circle cx="24" cy="24" r="20" fill="url(#i-orb)" stroke="#0a3a8c" />
      <circle cx="24" cy="14" r="3" fill="#fff" />
      <path d="M24 21v15" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="20" cy="12" rx="12" ry="6" fill="#fff" opacity="0.25" />
    </>
  ),
  warning: (
    <>
      <path d="M24 3L46 43H2z" fill="url(#i-yellowtri)" stroke="#a67400" strokeLinejoin="round" />
      <path d="M24 16v14" stroke="#1d1d1d" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="24" cy="37" r="2.6" fill="#1d1d1d" />
    </>
  ),
  error: (
    <>
      <circle cx="24" cy="24" r="20" fill="url(#i-redorb)" stroke="#7a0d03" />
      <path d="M16 16l16 16M32 16L16 32" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="20" cy="12" rx="12" ry="6" fill="#fff" opacity="0.25" />
    </>
  ),
  question: (
    <>
      <circle cx="24" cy="24" r="20" fill="url(#i-orb)" stroke="#0a3a8c" />
      <path d="M17.5 18.5c0-4 3-6.5 6.8-6.5 4 0 6.7 2.4 6.7 5.8 0 4.7-5.5 5-5.5 9.2v1.2" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="25.5" cy="34.5" r="2.6" fill="#fff" />
    </>
  ),
  games: (
    <>
      <path d="M6 18c0-5 4-8 10-8h16c6 0 10 3 10 8l3 16c.6 5-5 7-8.5 3L31 31H17l-5.5 6C8 41 2.4 39 3 34z" fill="url(#i-dark)" stroke="#000" />
      <path d="M8 15c2-2 5-3 8-3h16c3 0 6 1 8 3" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" fill="none" />
      <path d="M14 18v8M10 22h8" stroke="#e8edf2" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="33" cy="19" r="2.2" fill="#e23d22" />
      <circle cx="37" cy="23" r="2.2" fill="#4cb82c" />
      <circle cx="29" cy="23" r="2.2" fill="#2b86e0" />
      <circle cx="33" cy="27" r="2.2" fill="#f5c33b" />
    </>
  ),
  printer: (
    <>
      <rect x="13" y="4" width="22" height="14" fill="url(#i-paper)" stroke="#8a98a8" />
      <path d="M4 18a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v15H4z" fill="url(#i-metal)" stroke="#5d6772" />
      <rect x="4" y="27" width="40" height="7" fill="url(#i-dark)" />
      <path d="M12 31h24v13H12z" fill="#fff" stroke="#8a98a8" />
      <path d="M15 35h18M15 38h14" stroke="#9aaabb" />
      <circle cx="39" cy="21" r="1.6" fill="#5cf23c" />
    </>
  ),
  defaultprograms: (
    <>
      <rect x="5" y="8" width="36" height="30" rx="1.5" fill="#fff" stroke="#6d8bb0" />
      <rect x="5" y="8" width="36" height="6" rx="1.5" fill="url(#i-blue)" />
      <circle cx="33" cy="34" r="10" fill="url(#i-greenorb)" stroke="#1b6510" />
      <path d="M28 34l4 4 6-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  users: (
    <>
      <Person x={18} y={8} s={1.55} c1="#6cc04a" c2="#2f7d1b" />
      <Person x={3} y={14} s={1.6} />
    </>
  ),
  user: <Person x={8} y={6} s={2} />,
  run: (
    <>
      <rect x="4" y="10" width="34" height="28" rx="1.5" fill="#fff" stroke="#6d8bb0" />
      <rect x="4" y="10" width="34" height="6" rx="1.5" fill="url(#i-blue)" />
      <path d="M24 26h12v-6l10 10-10 10v-6H24z" fill="url(#i-green)" stroke="#1d6a14" />
    </>
  ),
  clock: (
    <>
      <circle cx="24" cy="24" r="20" fill="url(#i-metal)" stroke="#5d6772" />
      <circle cx="24" cy="24" r="16.5" fill="#fff" stroke="#9aa5b0" />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M24 9v3" stroke="#3a4450" strokeWidth={i % 3 ? 1 : 2} transform={`rotate(${i * 30} 24 24)`} />
      ))}
      <path d="M24 24V14M24 24l7 4" stroke="#1d232a" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="1.6" fill="#c4210f" />
    </>
  ),
  shield: (
    <>
      <path d="M24 3c7 4 13 5 18 5 0 16-5 28-18 37C11 36 6 24 6 8c5 0 11-1 18-5z" fill="#fff" stroke="#55606c" />
      <path d="M24 5.5V24H8.6C8.2 19 8.1 14 8.3 10c5-.3 10.3-1.6 15.7-4.5z" fill="#2b78d6" />
      <path d="M24 5.5c5.4 2.9 10.7 4.2 15.7 4.5.2 4 .1 9-.3 14H24z" fill="#f5c33b" />
      <path d="M24 24h15.4c-1.5 8-5.6 14.4-15.4 18z" fill="#2b78d6" />
      <path d="M24 24v18C14.2 38.4 10.1 32 8.6 24z" fill="#f5c33b" />
    </>
  ),
  // Control Panel category icons
  'cp-system': (
    <>
      <Monitor screen="url(#i-screen)" />
      <g transform="translate(22 14) scale(0.55)">
        <path d="M24 3c7 4 13 5 18 5 0 16-5 28-18 37C11 36 6 24 6 8c5 0 11-1 18-5z" fill="#fff" stroke="#55606c" />
        <path d="M24 5.5V24H8.6C8.2 19 8.1 14 8.3 10c5-.3 10.3-1.6 15.7-4.5z" fill="#2b78d6" />
        <path d="M24 5.5c5.4 2.9 10.7 4.2 15.7 4.5.2 4 .1 9-.3 14H24z" fill="#f5c33b" />
        <path d="M24 24h15.4c-1.5 8-5.6 14.4-15.4 18z" fill="#2b78d6" />
        <path d="M24 24v18C14.2 38.4 10.1 32 8.6 24z" fill="#f5c33b" />
      </g>
    </>
  ),
  'cp-network': (
    <>
      <Globe cx={24} cy={21} r={17} />
      <path d="M10 42h28M16 38v4M32 38v4M24 38v4" stroke="#3a4450" strokeWidth="2" />
    </>
  ),
  'cp-hardware': (
    <>
      <g transform="translate(-2 4) scale(0.75)">
        <rect x="13" y="4" width="22" height="14" fill="url(#i-paper)" stroke="#8a98a8" />
        <path d="M4 18a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v15H4z" fill="url(#i-metal)" stroke="#5d6772" />
        <rect x="4" y="27" width="40" height="7" fill="url(#i-dark)" />
        <path d="M12 31h24v13H12z" fill="#fff" stroke="#8a98a8" />
      </g>
      <rect x="30" y="14" width="14" height="30" rx="2" fill="url(#i-dark)" stroke="#000" />
      <circle cx="37" cy="34" r="5" fill="#3a434d" stroke="#8a98a8" />
      <circle cx="37" cy="21" r="2.6" fill="#3a434d" stroke="#8a98a8" />
    </>
  ),
  'cp-programs': (
    <>
      <path d="M6 18l18-8 18 8v18l-18 9-18-9z" fill="url(#i-wood)" stroke="#9b7a46" />
      <path d="M6 18l18 9 18-9M24 27v18" stroke="#9b7a46" fill="none" />
      <circle cx="31" cy="15" r="11" fill="#e5ecf2" stroke="#8a98a8" />
      <path d="M22 11a11 11 0 0 1 9-7v7z" fill="#f2c3ff" opacity="0.7" />
      <path d="M40 19a11 11 0 0 1-9 7v-7z" fill="#bfffe6" opacity="0.7" />
      <circle cx="31" cy="15" r="2.6" fill="#fff" stroke="#8a98a8" />
    </>
  ),
  'cp-users': (
    <>
      <Person x={18} y={8} s={1.55} c1="#6cc04a" c2="#2f7d1b" />
      <Person x={3} y={14} s={1.6} />
    </>
  ),
  'cp-appearance': (
    <Monitor screen="url(#i-sky)">
      <path d="M6.5 25l9-7 7 5 6-4 12.5 7v5h-34.5z" fill="url(#i-grass)" />
      <circle cx="33" cy="14" r="3" fill="#fff8b0" />
    </Monitor>
  ),
  'cp-clock': (
    <>
      <Globe cx={30} cy={30} r={14} />
      <g transform="translate(0 0) scale(0.66)">
        <circle cx="24" cy="24" r="20" fill="url(#i-metal)" stroke="#5d6772" />
        <circle cx="24" cy="24" r="16.5" fill="#fff" stroke="#9aa5b0" />
        <path d="M24 24V12M24 24l8 5" stroke="#1d232a" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </>
  ),
  'cp-ease': (
    <>
      <circle cx="24" cy="24" r="20" fill="url(#i-orb)" stroke="#0a3a8c" />
      <circle cx="24" cy="12.5" r="3.4" fill="#fff" />
      <path d="M12 18.5l12 2.5 12-2.5M24 21v8l-6 9M24 29l6 9" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  'cp-display': (
    <Monitor>
      <path d="M12 26l8-10 8 10M22 22l5-6 6 10" stroke="#fff" strokeWidth="2" fill="none" />
    </Monitor>
  ),
  'cp-mouse': (
    <>
      <path d="M24 6c8 0 13 6 13 15v9c0 8-6 13-13 13s-13-5-13-13v-9c0-9 5-15 13-15z" fill="url(#i-metal)" stroke="#5d6772" />
      <path d="M24 6v14M11.5 20h25" stroke="#5d6772" />
      <rect x="22.5" y="10" width="3" height="6" rx="1.5" fill="#5d6772" />
    </>
  ),
  'cp-sound': (
    <>
      <path d="M6 18h8l11-9v30l-11-9H6z" fill="url(#i-metal)" stroke="#5d6772" />
      <path d="M30 17c3 4 3 10 0 14M35 12c6 7 6 17 0 24" stroke="#2b86e0" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </>
  ),
  'cp-taskbar': (
    <>
      <rect x="4" y="8" width="40" height="32" rx="1.5" fill="url(#i-sky)" stroke="#5d6772" />
      <rect x="4" y="33" width="40" height="7" fill="url(#i-dark)" />
      <circle cx="9" cy="36.5" r="3.4" fill="url(#i-orb)" stroke="#9ad0ff" strokeWidth="0.6" />
      <rect x="15" y="34.3" width="6" height="4.4" rx="0.8" fill="#fff" opacity="0.4" />
      <rect x="23" y="34.3" width="6" height="4.4" rx="0.8" fill="#fff" opacity="0.25" />
    </>
  ),
  'cp-recovery': (
    <>
      <Monitor />
      <path d="M17 21a7 7 0 1 1 2 5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M14 18l3 4 4-3" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </>
  ),
  'cp-region': (
    <>
      <Globe />
    </>
  ),
  'cp-power': (
    <>
      <rect x="10" y="10" width="28" height="32" rx="3" fill="url(#i-metal)" stroke="#5d6772" />
      <rect x="18" y="5" width="12" height="6" rx="1" fill="url(#i-dark)" />
      <path d="M26 15l-7 12h6l-3 10 8-13h-6z" fill="#f5c33b" stroke="#a67400" strokeWidth="0.8" />
    </>
  ),
  star: <g transform="translate(6 6) scale(2)"><Star /></g>,
  'recent-places': (
    <FolderBase>
      <Emblem>
        <circle cx="9" cy="9" r="8" fill="#fff" stroke="#5d6772" />
        <path d="M9 4v5l3 2" stroke="#2b3239" strokeWidth="1.6" fill="none" />
      </Emblem>
    </FolderBase>
  ),
  'getting-started': (
    <>
      <rect x="6" y="6" width="36" height="36" rx="4" fill="url(#i-orb)" stroke="#0a3a8c" />
      <Flag x={13} y={13} s={1.1} />
    </>
  ),
  stickynotes: (
    <>
      <path d="M8 6h32v28l-8 8H8z" fill="#fdf39b" stroke="#c9b53a" />
      <path d="M32 42v-8h8" fill="#e8d86a" stroke="#c9b53a" />
    </>
  ),
  winver: (
    <>
      <rect x="6" y="6" width="36" height="36" rx="4" fill="url(#i-orb)" stroke="#0a3a8c" />
      <Flag x={13} y={13} s={1.1} />
    </>
  ),
  screensaver: (
    <Monitor screen="#05080f">
      <path d="M10 25c6-12 14 6 20-6s8 0 10-2" stroke="#56d3ff" strokeWidth="1.5" fill="none" />
      <path d="M10 18c8 8 12-10 20 2s6 0 10 4" stroke="#ff6ad5" strokeWidth="1.5" fill="none" />
    </Monitor>
  ),
};

// --- User account pictures (original art) -------------------------------------------
const PICTURES = {
  flower: (
    <>
      <rect width="48" height="48" fill="url(#i-sky)" />
      <path d="M24 48V28" stroke="#2f7d1b" strokeWidth="2.5" />
      <path d="M24 38c-6-1-9-5-9-8 5 0 8 3 9 8z" fill="#4cb82c" />
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <ellipse key={r} cx="24" cy="15" rx="5" ry="8" fill="#ff7ab8" stroke="#d63f88" strokeWidth="0.5" transform={`rotate(${r} 24 22)`} />
      ))}
      <circle cx="24" cy="22" r="4.5" fill="#ffd23b" stroke="#c98a0c" strokeWidth="0.6" />
    </>
  ),
  sunset: (
    <>
      <rect width="48" height="48" fill="#ffb36b" />
      <rect width="48" height="30" fill="#ff8a4c" />
      <circle cx="24" cy="30" r="10" fill="#fff2a8" />
      <rect y="30" width="48" height="18" fill="#3a5f8f" />
      <path d="M8 35h32M14 39h20M18 43h12" stroke="#ffd59a" strokeWidth="1.3" opacity="0.8" />
    </>
  ),
  ocean: (
    <>
      <rect width="48" height="48" fill="#0c5aa6" />
      <path d="M0 30c8-6 16 6 24 0s16 6 24 0v18H0z" fill="#2ea6e0" />
      <path d="M0 37c8-6 16 6 24 0s16 6 24 0v11H0z" fill="#7fd4f5" />
      <circle cx="35" cy="12" r="5" fill="#fff" opacity="0.85" />
    </>
  ),
  leaf: (
    <>
      <rect width="48" height="48" fill="#cdeeb0" />
      <path d="M8 40C8 18 22 8 42 8c0 20-12 34-34 32z" fill="url(#i-grass)" />
      <path d="M8 40L38 12M18 30h9M24 24h10M14 34l-1-8M21 27l-1-9" stroke="#c8f0a8" strokeWidth="1.3" />
    </>
  ),
  ball: (
    <>
      <rect width="48" height="48" fill="#5bb2f0" />
      <rect y="34" width="48" height="14" fill="#f4dc9a" />
      <circle cx="24" cy="27" r="13" fill="#fff" stroke="#c9d2dc" />
      <path d="M11 27h26M24 14v26" stroke="#e23d22" strokeWidth="3" />
      <path d="M14 18c6 4 14 4 20 0" stroke="#2b86e0" strokeWidth="3" fill="none" />
    </>
  ),
  guitar: (
    <>
      <rect width="48" height="48" fill="#3a2a5f" />
      <path d="M33 6l6 6-12 12" stroke="#6b4421" strokeWidth="4" />
      <path d="M22 20c4-4 9 0 7 5 4 0 6 5 3 9-4 6-15 8-20 3s-3-16 3-20c3-2 6-1 7 3z" fill="#d9822b" stroke="#6b4421" />
      <circle cx="21" cy="30" r="3" fill="#3a2a10" />
    </>
  ),
  robot: (
    <>
      <rect width="48" height="48" fill="#9be0d3" />
      <rect x="12" y="14" width="24" height="20" rx="4" fill="url(#i-metal)" stroke="#5d6772" />
      <circle cx="19" cy="23" r="3.4" fill="#2b86e0" />
      <circle cx="29" cy="23" r="3.4" fill="#2b86e0" />
      <path d="M19 30h10" stroke="#5d6772" strokeWidth="2" />
      <path d="M24 14V8" stroke="#5d6772" strokeWidth="2" />
      <circle cx="24" cy="7" r="2.4" fill="#e23d22" />
      <rect x="14" y="36" width="20" height="12" rx="2" fill="url(#i-metal)" stroke="#5d6772" />
    </>
  ),
  kitten: (
    <>
      <rect width="48" height="48" fill="#f7d6e0" />
      <path d="M11 20l2-12 8 7h6l8-7 2 12c2 3 3 6 3 9 0 9-7 13-15 13s-15-4-15-13c0-3 1-6 3-9z" fill="#e8a25a" stroke="#9b5f25" />
      <circle cx="19" cy="26" r="2.4" fill="#2b3239" />
      <circle cx="29" cy="26" r="2.4" fill="#2b3239" />
      <path d="M22 31l2 2 2-2" stroke="#9b5f25" strokeWidth="1.4" fill="#ff9bb3" />
      <path d="M9 30h8M9 33l8-1M39 30h-8M39 33l-8-1" stroke="#9b5f25" strokeWidth="0.8" />
    </>
  ),
};

export const Icon = memo(function Icon({ name, size = 16, className, style, title }) {
  const art = ICONS[name] || ICONS.file;
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 48 48" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {art}
    </svg>
  );
});

export const UserPicture = memo(function UserPicture({ name, size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block' }}>
      {PICTURES[name] || PICTURES.flower}
    </svg>
  );
});

/** Small shortcut-arrow overlay drawn in the bottom-left corner of shortcut icons. */
export function ShortcutArrow({ size }) {
  const s = Math.max(10, Math.round(size * 0.36));
  return (
    <svg className="shortcut-arrow" width={s} height={s} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0.5" y="0.5" width="15" height="15" rx="1.5" fill="#fff" stroke="#7b8796" />
      <path d="M4 12c0-4 2-6 6-6V3.5L13.5 7 10 10.5V8c-3 0-4.5 1.3-6 4z" fill="#1a62c5" />
    </svg>
  );
}

export const iconNames = Object.keys(ICONS);
