// Neon çizgi ikonlar (SocialCPU oyun kartlarındaki stil). currentColor ile boyanır.

const svg = (body, extra = '') =>
  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

const spark = (x, y) =>
  `<path d="M${x} ${y}l4-5M${x + 5} ${y + 4}l6-2" stroke="#fbbf24" stroke-width="2.5"/>`;

export const icons = {
  coin: svg(
    `<ellipse cx="30" cy="34" rx="20" ry="20"/><ellipse cx="30" cy="34" rx="13" ry="13" stroke-dasharray="3 4" opacity=".7"/>
     <path d="M30 25l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="currentColor" stroke-width="1.5"/>${spark(48, 14)}`,
  ),
  dice: svg(
    `<rect x="12" y="16" width="34" height="34" rx="8" transform="rotate(-10 29 33)"/>
     <circle cx="22" cy="26" r="2.8" fill="currentColor" stroke="none"/><circle cx="36" cy="24" r="2.8" fill="currentColor" stroke="none"/>
     <circle cx="29" cy="33" r="3" fill="#f472b6" stroke="none"/><circle cx="22" cy="42" r="2.8" fill="currentColor" stroke="none"/>
     <circle cx="37" cy="40" r="2.8" fill="currentColor" stroke="none"/>${spark(48, 12)}`,
  ),
  sticks: svg(
    `<path d="M22 10v30M32 10v30M42 22v18" stroke-width="4"/><circle cx="42" cy="22" r="3" fill="#f472b6" stroke="none"/>
     <path d="M14 36h36l-4 18H18z"/>`,
  ),
  wheel: svg(
    `<circle cx="32" cy="35" r="20"/><path d="M32 15v40M12 35h40M18 21l28 28M46 21L18 49" opacity=".55" stroke-width="2"/>
     <circle cx="32" cy="35" r="4" fill="currentColor" stroke="none"/><path d="M27 6h10l-5 8z" fill="#f472b6" stroke="#f472b6" stroke-width="2"/>`,
  ),
  home: svg(`<path d="M10 30L32 12l22 18"/><path d="M16 26v24h32V26"/><path d="M27 50V38h10v12"/>`),
  history: svg(`<circle cx="33" cy="33" r="20"/><path d="M33 21v12l8 6"/><path d="M8 20l5 7 7-4"/>`),
  settings: svg(
    `<circle cx="32" cy="32" r="8"/><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M15 49l6-6M43 21l6-6"/>`,
  ),
  info: svg(`<circle cx="32" cy="32" r="22"/><path d="M32 29v15"/><circle cx="32" cy="21" r="2.5" fill="currentColor" stroke="none"/>`),
  bolt: svg(`<path d="M36 6L16 36h14l-4 22 22-32H34z"/>`),
  finger: svg(`<path d="M26 34V14a4 4 0 018 0v16"/><path d="M34 28a4 4 0 018 0v6a4 4 0 018 0v6c0 10-7 16-16 16h-2c-6 0-10-3-13-8l-6-10a4 4 0 017-4l4 6"/>`),
  team: svg(`<circle cx="22" cy="22" r="7"/><circle cx="44" cy="22" r="7"/><path d="M8 50c0-8 6-14 14-14s14 6 14 14M30 50c0-8 6-14 14-14s14 6 14 14"/>`),
  letter: svg(`<rect x="12" y="12" width="40" height="40" rx="8"/><path d="M24 44l8-24 8 24M27 36h10"/>`),
  bottle: svg(`<path d="M27 6h10v12l6 8v30H21V26l6-8z"/><path d="M21 36h22"/>`),
  bingo: svg(`<rect x="10" y="10" width="44" height="44" rx="6"/><path d="M10 25h44M10 39h44M25 10v44M39 10v44"/><circle cx="32" cy="32" r="3" fill="#f472b6" stroke="none"/>`),
  gift: svg(`<rect x="12" y="26" width="40" height="28" rx="3"/><path d="M8 18h48v8H8zM32 18v36"/><path d="M32 18c-4-10-14-10-14-3 0 3 6 3 14 3 8 0 14 0 14-3 0-7-10-7-14 3"/>`),
  share: svg(`<circle cx="46" cy="14" r="6"/><circle cx="18" cy="32" r="6"/><circle cx="46" cy="50" r="6"/><path d="M23 29l18-12M23 35l18 12"/>`),
  again: svg(`<path d="M50 30a18 18 0 10-5 14"/><path d="M52 14v16H36"/>`),
  back: svg(`<path d="M40 14L22 32l18 18"/>`),
  star: svg(`<path d="M32 8l7 15 16 2-12 11 3 16-14-8-14 8 3-16L9 25l16-2z"/>`),
  plus: svg(`<path d="M32 14v36M14 32h36"/>`),
  play: svg(`<path d="M22 14l26 18-26 18z" fill="currentColor"/>`),
};
