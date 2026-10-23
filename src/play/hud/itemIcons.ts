// Item pictures as small SVGs (48×48), so every item looks the same on every
// device. Emoji icons vary by platform and newer ones (wood, rock, rope…) show
// up as empty boxes on older phones and PCs.

const O = 'stroke="#1b1a2b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const T = 'stroke="#1b1a2b" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';

const handle = (x1: number, y1: number, x2: number, y2: number, color = '#8a5f3a') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1b1a2b" stroke-width="7" stroke-linecap="round"/>` +
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;

const flame = (cx: number, cy: number, s = 1) =>
  `<path d="M${cx} ${cy - 13 * s} C${cx + 7 * s} ${cy - 5 * s} ${cx + 8 * s} ${cy + 1 * s} ${cx} ${cy + 5 * s} C${cx - 8 * s} ${cy + 1 * s} ${cx - 7 * s} ${cy - 5 * s} ${cx} ${cy - 13 * s} Z" fill="#ff7a2a" ${O}/>` +
  `<path d="M${cx} ${cy - 5 * s} C${cx + 4 * s} ${cy - 1 * s} ${cx + 4 * s} ${cy + 2 * s} ${cx} ${cy + 4 * s} C${cx - 4 * s} ${cy + 2 * s} ${cx - 4 * s} ${cy - 1 * s} ${cx} ${cy - 5 * s} Z" fill="#ffe07a"/>`;

const axeHead = (metal: boolean) =>
  `<path d="M24 9 L36 7 C40 12 40 20 36 24 L25 21 Z" fill="${metal ? '#c9d0d8' : '#8f9196'}" ${O}/>` +
  (metal
    ? `<path d="M35 9 C38 13 38 19 35 22" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>`
    : '') +
  `<path d="M23 12 L27 18" stroke="#c9a46a" stroke-width="3" stroke-linecap="round"/>`;

const pickHead = (metal: boolean) =>
  `<path d="M4 22 C10 8 38 8 44 22 L41 24 C34 15 14 15 7 24 Z" fill="${metal ? '#c9d0d8' : '#8f9196'}" ${O}/>` +
  `<rect x="20" y="9" width="8" height="9" rx="1.5" fill="#c9a46a" ${T}/>`;

export const ITEM_ICONS: Record<string, string> = {
  // Materials
  wood:
    `<rect x="6" y="24" width="34" height="12" rx="6" fill="#8a5f3a" ${O}/>` +
    `<ellipse cx="38" cy="30" rx="5" ry="6" fill="#d9b07a" ${O}/>` +
    `<ellipse cx="38" cy="30" rx="2" ry="2.5" fill="none" stroke="#8a5f3a" stroke-width="1.2"/>` +
    `<rect x="10" y="12" width="30" height="12" rx="6" fill="#a0703f" ${O}/>` +
    `<ellipse cx="38" cy="18" rx="5" ry="6" fill="#e3bf8a" ${O}/>` +
    `<ellipse cx="38" cy="18" rx="2" ry="2.5" fill="none" stroke="#8a5f3a" stroke-width="1.2"/>`,
  stone:
    `<path d="M7 33 L12 17 L24 10 L37 14 L42 28 L35 39 L15 40 Z" fill="#8f9196" ${O}/>` +
    `<path d="M12 17 L24 10 L27 22 L16 26 Z" fill="#b4b6bb"/>` +
    `<path d="M27 22 L37 14 L42 28 Z" fill="#a3a5aa"/>` +
    `<path d="M16 26 L27 22 L35 39 L15 40 Z" fill="#777a80"/>` +
    `<path d="M7 33 L12 17 L24 10 L37 14 L42 28 L35 39 L15 40 Z" fill="none" ${O}/>`,
  fiber:
    `<path d="M24 40 C20 30 12 22 8 10 M24 40 C22 28 20 18 20 6 M24 40 C26 28 28 18 30 6 M24 40 C28 30 36 22 40 10" fill="none" stroke="#1b1a2b" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M24 40 C20 30 12 22 8 10 M24 40 C22 28 20 18 20 6 M24 40 C26 28 28 18 30 6 M24 40 C28 30 36 22 40 10" fill="none" stroke="#8fcf4a" stroke-width="2.5" stroke-linecap="round"/>` +
    `<rect x="17" y="28" width="14" height="6" rx="2" fill="#c9a46a" ${O}/>`,
  rope:
    `<ellipse cx="24" cy="26" rx="16" ry="13" fill="#c9a46a" ${O}/>` +
    `<ellipse cx="24" cy="26" rx="10" ry="8" fill="none" ${O}/>` +
    `<ellipse cx="24" cy="26" rx="4" ry="3" fill="#8a6a3a" ${O}/>` +
    `<path d="M10 30 C6 36 8 42 14 42" fill="none" stroke="#1b1a2b" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M10 30 C6 36 8 42 14 42" fill="none" stroke="#c9a46a" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M16 17 L19 21 M28 15 L30 19 M35 21 L36 25 M33 33 L31 36 M20 36 L18 33" stroke="#8a6a3a" stroke-width="1.5" stroke-linecap="round"/>`,
  scrap:
    `<path d="M6 30 L14 12 L30 8 L36 16 L42 14 L40 34 L22 40 L18 34 Z" fill="#b0b6bd" ${O}/>` +
    `<path d="M14 12 L30 8 L28 20 L16 24 Z" fill="#d7dadf"/>` +
    `<path d="M6 30 L14 12 L30 8 L36 16 L42 14 L40 34 L22 40 L18 34 Z" fill="none" ${O}/>` +
    `<circle cx="20" cy="18" r="2" fill="#6d737a"/><circle cx="34" cy="28" r="2" fill="#6d737a"/>` +
    `<path d="M24 30 L32 30" stroke="#6d737a" stroke-width="2" stroke-linecap="round"/>`,
  cloth:
    `<path d="M8 14 L40 10 L42 34 L10 38 Z" fill="#4a7ab5" ${O}/>` +
    `<path d="M8 14 L24 22 L40 10" fill="none" stroke="#2f5a8a" stroke-width="2"/>` +
    `<path d="M12 33 L38 30" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3 3"/>` +
    `<path d="M24 22 L26 36" stroke="#2f5a8a" stroke-width="1.5"/>`,
  sap:
    `<rect x="18" y="5" width="12" height="6" rx="2" fill="#8a5f3a" ${O}/>` +
    `<path d="M19 11 L19 18 L11 34 C9 40 13 43 18 43 L30 43 C35 43 39 40 37 34 L29 18 L29 11 Z" fill="#e8f4ff" fill-opacity="0.7" ${O}/>` +
    `<path d="M14 30 L34 30 L37 35 C38 40 35 42 30 42 L18 42 C13 42 10 40 11 35 Z" fill="#b6ff5a"/>` +
    `<circle cx="20" cy="36" r="2" fill="#f0ffd0"/><circle cx="27" cy="33" r="1.5" fill="#f0ffd0"/>` +
    `<path d="M19 11 L19 18 L11 34 C9 40 13 43 18 43 L30 43 C35 43 39 40 37 34 L29 18 L29 11 Z" fill="none" ${O}/>`,
  // Food and drink
  berries:
    `<path d="M24 14 C28 6 36 6 40 8 C36 14 30 15 24 14 Z" fill="#5fae3c" ${O}/>` +
    `<circle cx="17" cy="24" r="8" fill="#5a4ad8" ${O}/>` +
    `<circle cx="31" cy="26" r="8" fill="#4a3ab8" ${O}/>` +
    `<circle cx="23" cy="36" r="8" fill="#6a5ae8" ${O}/>` +
    `<circle cx="15" cy="21" r="2" fill="#c8c0ff"/><circle cx="29" cy="23" r="2" fill="#c8c0ff"/><circle cx="21" cy="33" r="2" fill="#c8c0ff"/>`,
  coconut:
    `<circle cx="24" cy="26" r="16" fill="#7a5232" ${O}/>` +
    `<path d="M12 18 L18 22 M14 30 L20 28 M26 13 L28 19" stroke="#5b3a22" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="30" cy="22" r="2.2" fill="#3a2414"/><circle cx="35" cy="26" r="2.2" fill="#3a2414"/><circle cx="31" cy="29" r="2.2" fill="#3a2414"/>`,
  mushroom:
    `<path d="M18 26 L16 41 L30 41 L28 26 Z" fill="#eee3cf" ${O}/>` +
    `<path d="M5 27 C5 12 43 12 43 27 Z" fill="#d0453b" ${O}/>` +
    `<circle cx="15" cy="20" r="2.5" fill="#fff"/><circle cx="26" cy="16" r="3" fill="#fff"/><circle cx="35" cy="22" r="2.5" fill="#fff"/>`,
  crab_raw:
    `<path d="M10 30 L4 34 M10 34 L5 40 M38 30 L44 34 M38 34 L43 40" stroke="#1b1a2b" stroke-width="2.5" stroke-linecap="round"/>` +
    `<ellipse cx="24" cy="30" rx="15" ry="10" fill="#e0703a" ${O}/>` +
    `<path d="M12 22 L6 14 C4 10 10 7 12 11 L10 13 L14 16 Z" fill="#e0703a" ${O}/>` +
    `<path d="M36 22 L42 14 C44 10 38 7 36 11 L38 13 L34 16 Z" fill="#e0703a" ${O}/>` +
    `<circle cx="20" cy="24" r="2" fill="#1b1a2b"/><circle cx="28" cy="24" r="2" fill="#1b1a2b"/>`,
  crab_cooked:
    `<ellipse cx="24" cy="36" rx="20" ry="7" fill="#f2ecd8" ${O}/>` +
    `<path d="M12 33 C10 22 20 14 28 16 C36 18 38 26 34 32 Z" fill="#ff5a2a" ${O}/>` +
    `<path d="M28 16 L34 8 L38 12 L32 18" fill="#ff5a2a" ${O}/>` +
    `<path d="M18 24 C22 21 27 21 30 24" fill="none" stroke="#ffd0a0" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M10 14 C10 10 13 10 13 6 M18 12 C18 8 21 8 21 4" fill="none" stroke="#c0c4c8" stroke-width="1.5" stroke-linecap="round"/>`,
  skewer:
    `<line x1="6" y1="42" x2="42" y2="6" stroke="#1b1a2b" stroke-width="5" stroke-linecap="round"/>` +
    `<line x1="6" y1="42" x2="42" y2="6" stroke="#c9a46a" stroke-width="2.5" stroke-linecap="round"/>` +
    `<ellipse cx="16" cy="32" rx="6" ry="5" fill="#a0603a" ${O}/>` +
    `<ellipse cx="24" cy="24" rx="6" ry="5" fill="#b8703f" ${O}/>` +
    `<ellipse cx="32" cy="16" rx="6" ry="5" fill="#a0603a" ${O}/>` +
    `<path d="M14 30 L18 32 M22 22 L26 24 M30 14 L34 16" stroke="#5b3a22" stroke-width="1.5" stroke-linecap="round"/>`,
  ration:
    `<path d="M5 18 L10 14 L10 34 L5 30 Z M43 18 L38 14 L38 34 L43 30 Z" fill="#d0453b" ${O}/>` +
    `<rect x="10" y="13" width="28" height="22" rx="3" fill="#6b3a1f" ${O}/>` +
    `<rect x="16" y="13" width="16" height="22" fill="#d0453b" ${O}/>` +
    `<text x="24" y="28" font-family="Arial, sans-serif" font-size="9" font-weight="900" fill="#fff" text-anchor="middle">MX</text>`,
  water_bottle:
    `<rect x="19" y="4" width="10" height="6" rx="1.5" fill="#2f6fb5" ${O}/>` +
    `<path d="M19 10 L19 13 C14 16 13 19 13 22 L13 40 C13 43 15 44 18 44 L30 44 C33 44 35 43 35 40 L35 22 C35 19 34 16 29 13 L29 10 Z" fill="#bfe6ff" fill-opacity="0.85" ${O}/>` +
    `<path d="M14 26 L34 26 L34 40 C34 42 33 43 30 43 L18 43 C15 43 14 42 14 40 Z" fill="#4cc9f0"/>` +
    `<rect x="13" y="28" width="22" height="8" fill="#ffffff" ${T}/>` +
    `<path d="M19 10 L19 13 C14 16 13 19 13 22 L13 40 C13 43 15 44 18 44 L30 44 C33 44 35 43 35 40 L35 22 C35 19 34 16 29 13 L29 10 Z" fill="none" ${O}/>`,
  // Healing
  bandage:
    `<rect x="6" y="16" width="36" height="16" rx="8" fill="#f2d8b0" ${O}/>` +
    `<rect x="17" y="16" width="14" height="16" fill="#fff4e0" ${O}/>` +
    `<circle cx="10" cy="22" r="1" fill="#c9a46a"/><circle cx="12" cy="27" r="1" fill="#c9a46a"/><circle cx="36" cy="22" r="1" fill="#c9a46a"/><circle cx="38" cy="27" r="1" fill="#c9a46a"/>` +
    `<path d="M24 20 L24 28 M20 24 L28 24" stroke="#d0453b" stroke-width="2.5" stroke-linecap="round"/>`,
  medkit:
    `<rect x="12" y="8" width="24" height="7" rx="2" fill="#e85fa8" ${O}/>` +
    `<path d="M10 15 L38 15 L36 42 L12 42 Z" fill="#d6ff6a" fill-opacity="0.9" ${O}/>` +
    `<rect x="15" y="22" width="18" height="14" rx="2" fill="#ffffff" ${T}/>` +
    `<path d="M24 25 L24 33 M20 29 L28 29" stroke="#3ddc97" stroke-width="3" stroke-linecap="round"/>`,
  // Tools and weapons
  axe_stone: handle(12, 42, 26, 10) + axeHead(false),
  pick_stone: handle(24, 44, 24, 12) + pickHead(false),
  axe_scrap: handle(12, 42, 26, 10) + axeHead(true),
  pick_scrap: handle(24, 44, 24, 12) + pickHead(true),
  machete:
    handle(8, 42, 15, 35, '#2a2420') +
    `<path d="M14 34 L36 8 C42 6 44 10 41 14 L18 38 Z" fill="#d7dadf" ${O}/>` +
    `<path d="M17 33 L38 10" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>` +
    `<rect x="11" y="31" width="9" height="4" rx="1" transform="rotate(-45 15.5 33)" fill="#5b3a22" ${T}/>`,
  club:
    `<path d="M10 42 L14 38 L36 8 C40 4 46 10 42 14 L18 42 Z" fill="#8a5f3a" ${O}/>` +
    `<path d="M33 12 L38 17 M28 18 L32 22" stroke="#5b3a22" stroke-width="2" stroke-linecap="round"/>`,
  spear:
    handle(6, 44, 34, 14) +
    `<path d="M32 16 L42 4 L40 18 Z" fill="#c9d0d8" ${O}/>` +
    `<path d="M30 15 L35 20" stroke="#c9a46a" stroke-width="3" stroke-linecap="round"/>`,
  torch:
    handle(20, 44, 28, 20) +
    `<path d="M24 22 L33 19 L31 24 Z" fill="#5b3a22" ${O}/>` +
    flame(30, 16, 0.9),
  firebomb:
    `<path d="M20 10 L20 18 C12 21 10 26 10 31 C10 39 16 44 24 44 C32 44 38 39 38 31 C38 26 36 21 28 18 L28 10 Z" fill="#4a7a3a" ${O}/>` +
    `<path d="M13 32 C13 38 18 42 24 42 C30 42 35 38 35 32 Z" fill="#b6ff5a"/>` +
    `<path d="M20 10 L20 18 C12 21 10 26 10 31 C10 39 16 44 24 44 C32 44 38 39 38 31 C38 26 36 21 28 18 L28 10 Z" fill="none" ${O}/>` +
    `<path d="M21 10 C20 6 24 4 26 2" fill="none" stroke="#e8d8b0" stroke-width="4" stroke-linecap="round"/>` +
    flame(27, 6, 0.45),
  // Buildings
  campfire:
    `<ellipse cx="24" cy="40" rx="18" ry="5" fill="#77757a" ${O}/>` +
    `<path d="M8 40 L38 30" stroke="#1b1a2b" stroke-width="7" stroke-linecap="round"/><path d="M8 40 L38 30" stroke="#8a5f3a" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M10 30 L40 40" stroke="#1b1a2b" stroke-width="7" stroke-linecap="round"/><path d="M10 30 L40 40" stroke="#a0703f" stroke-width="4" stroke-linecap="round"/>` +
    flame(24, 26, 1.3),
  workbench:
    `<rect x="5" y="18" width="38" height="7" rx="1.5" fill="#a0703f" ${O}/>` +
    `<path d="M9 25 L9 42 M39 25 L39 42 M14 25 L14 38 M34 25 L34 38" stroke="#1b1a2b" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M9 25 L9 42 M39 25 L39 42 M14 25 L14 38 M34 25 L34 38" stroke="#7a5232" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M9 34 L39 34" stroke="#7a5232" stroke-width="2" />` +
    `<rect x="12" y="9" width="12" height="7" rx="1" fill="#b0b6bd" ${T}/>` +
    `<path d="M28 15 L36 7" stroke="#1b1a2b" stroke-width="4" stroke-linecap="round"/><path d="M28 15 L36 7" stroke="#8a5f3a" stroke-width="2" stroke-linecap="round"/>` +
    `<rect x="33" y="5" width="8" height="5" rx="1" transform="rotate(-45 37 7.5)" fill="#8f9196" ${T}/>`,
  wall_wood:
    [6, 15, 24, 33]
      .map(
        (x, k) =>
          `<path d="M${x} 42 L${x} ${10 + (k % 2) * 3} L${x + 4.5} ${5 + (k % 2) * 3} L${x + 9} ${10 + (k % 2) * 3} L${x + 9} 42 Z" fill="${k % 2 ? '#8a5f3a' : '#a0703f'}" ${O}/>`,
      )
      .join('') +
    `<rect x="4" y="17" width="40" height="4" rx="1" fill="#5b3a22" ${T}/><rect x="4" y="32" width="40" height="4" rx="1" fill="#5b3a22" ${T}/>`,
  door_wood:
    `<rect x="8" y="4" width="32" height="40" rx="2" fill="#5b3a22" ${O}/>` +
    `<rect x="12" y="8" width="24" height="36" fill="#a0703f" ${O}/>` +
    `<path d="M20 8 L20 44 M28 8 L28 44" stroke="#8a5f3a" stroke-width="1.5"/>` +
    `<path d="M12 16 L36 16 M12 34 L36 34" stroke="#5b3a22" stroke-width="3"/>` +
    `<circle cx="32" cy="26" r="2.2" fill="#f2c14e" ${T}/>`,
  wall_stone:
    `<rect x="4" y="8" width="40" height="34" rx="2" fill="#8f9196" ${O}/>` +
    `<path d="M4 19 L44 19 M4 30 L44 30 M17 8 L17 19 M31 8 L31 19 M10 19 L10 30 M24 19 L24 30 M38 19 L38 30 M17 30 L17 42 M31 30 L31 42" stroke="#1b1a2b" stroke-width="1.6"/>` +
    `<path d="M6 10 L15 10 M19 21 L22 21 M33 32 L40 32" stroke="#b4b6bb" stroke-width="1.6" stroke-linecap="round"/>`,
  wall_half:
    [13, 24]
      .map(
        (x, k) =>
          `<path d="M${x} 42 L${x} ${12 + (k % 2) * 3} L${x + 5.5} ${7 + (k % 2) * 3} L${x + 11} ${12 + (k % 2) * 3} L${x + 11} 42 Z" fill="${k % 2 ? '#8a5f3a' : '#a0703f'}" ${O}/>`,
      )
      .join('') +
    `<rect x="11" y="19" width="26" height="4" rx="1" fill="#5b3a22" ${T}/><rect x="11" y="33" width="26" height="4" rx="1" fill="#5b3a22" ${T}/>`,
  wall_window:
    `<rect x="4" y="6" width="40" height="36" rx="2" fill="#a0703f" ${O}/>` +
    `<path d="M14 6 L14 42 M24 6 L24 15 M24 33 L24 42 M34 6 L34 42" stroke="#8a5f3a" stroke-width="1.5"/>` +
    `<rect x="13" y="15" width="22" height="18" rx="1" fill="#2a3a52" ${O}/>` +
    `<path d="M24 15 L24 33 M13 24 L35 24" stroke="#5b3a22" stroke-width="2.5"/>` +
    `<path d="M16 18 L20 18" stroke="#9fd3ea" stroke-width="1.6" stroke-linecap="round"/>`,
  post_wood:
    `<rect x="17" y="10" width="14" height="34" rx="1.5" fill="#8a5f3a" ${O}/>` +
    `<path d="M15 10 L24 4 L33 10 Z" fill="#a0703f" ${O}/>` +
    `<rect x="15" y="19" width="18" height="4" rx="1" fill="#5b3a22" ${T}/><rect x="15" y="33" width="18" height="4" rx="1" fill="#5b3a22" ${T}/>` +
    `<path d="M21 12 L21 42" stroke="#a0703f" stroke-width="1.5"/>`,
  gate_wood:
    `<rect x="3" y="6" width="6" height="38" rx="1" fill="#5b3a22" ${O}/><rect x="39" y="6" width="6" height="38" rx="1" fill="#5b3a22" ${O}/>` +
    `<rect x="10" y="12" width="13" height="30" fill="#a0703f" ${O}/><rect x="25" y="12" width="13" height="30" fill="#8a5f3a" ${O}/>` +
    `<path d="M10 18 L23 18 M10 34 L23 34 M25 18 L38 18 M25 34 L38 34" stroke="#5b3a22" stroke-width="2.5"/>` +
    `<path d="M11 33 L22 19 M37 33 L26 19" stroke="#5b3a22" stroke-width="2"/>` +
    `<rect x="3" y="4" width="42" height="5" rx="1" fill="#5b3a22" ${O}/>`,
  wall_stone_half:
    `<rect x="11" y="10" width="26" height="32" rx="2" fill="#8f9196" ${O}/>` +
    `<path d="M11 21 L37 21 M11 32 L37 32 M24 10 L24 21 M18 21 L18 32 M30 21 L30 32 M24 32 L24 42" stroke="#1b1a2b" stroke-width="1.6"/>` +
    `<path d="M13 12 L21 12 M26 23 L28 23" stroke="#b4b6bb" stroke-width="1.6" stroke-linecap="round"/>`,
  pillar_stone:
    `<rect x="14" y="36" width="20" height="7" rx="1" fill="#7f8186" ${O}/>` +
    `<rect x="17" y="12" width="14" height="25" fill="#8f9196" ${O}/>` +
    `<rect x="13" y="6" width="22" height="7" rx="1" fill="#7f8186" ${O}/>` +
    `<path d="M21 14 L21 34 M27 14 L27 34" stroke="#6e7075" stroke-width="1.4"/>` +
    `<path d="M15 8 L22 8" stroke="#b4b6bb" stroke-width="1.6" stroke-linecap="round"/>`,
  spikes:
    `<rect x="4" y="34" width="40" height="5" rx="1" fill="#5b3a22" ${O}/>` +
    [8, 18, 28, 38]
      .map(
        (x, k) =>
          `<path d="M${x - 3} 40 L${x + (k % 2 ? 4 : -4)} 8 L${x + 4} 40 Z" fill="#c9a46a" ${O}/><path d="M${x + (k % 2 ? 4 : -4)} 8 L${x + (k % 2 ? 2 : -2)} 18" stroke="#ffffff" stroke-width="1.2"/>`,
      )
      .join(''),
  torch_post:
    `<rect x="21" y="18" width="6" height="26" rx="1" fill="#7a5232" ${O}/>` +
    `<rect x="16" y="14" width="16" height="6" rx="2" fill="#3a3a3a" ${O}/>` +
    `<path d="M14 44 L34 44" stroke="#1b1a2b" stroke-width="3" stroke-linecap="round"/>` +
    flame(24, 10, 0.75),
  storage:
    `<rect x="5" y="14" width="38" height="28" rx="2" fill="#a0703f" ${O}/>` +
    `<rect x="5" y="10" width="38" height="8" rx="2" fill="#8a5f3a" ${O}/>` +
    `<path d="M5 28 L43 28" stroke="#8a5f3a" stroke-width="2"/>` +
    `<rect x="11" y="10" width="4" height="32" fill="#6d737a" ${T}/><rect x="33" y="10" width="4" height="32" fill="#6d737a" ${T}/>` +
    `<rect x="21" y="16" width="6" height="6" rx="1" fill="#f2c14e" ${T}/>`,
  bedroll:
    `<rect x="6" y="22" width="36" height="14" rx="3" fill="#4a6a8a" ${O}/>` +
    `<path d="M6 30 L42 30" stroke="#3a5a7a" stroke-width="2"/>` +
    `<ellipse cx="38" cy="29" rx="6" ry="8" fill="#3a5a7a" ${O}/>` +
    `<ellipse cx="38" cy="29" rx="3" ry="4" fill="none" stroke="#6a8aaa" stroke-width="1.5"/>` +
    `<rect x="8" y="14" width="14" height="9" rx="4" fill="#f2ecd8" ${O}/>`,
  rain_collector:
    `<path d="M4 12 L44 12 L28 24 L20 24 Z" fill="#e8e0d0" ${O}/>` +
    `<path d="M12 26 L36 26 L34 44 L14 44 Z" fill="#8a6a4a" ${O}/>` +
    `<path d="M14 32 L34 32 L33 43 L15 43 Z" fill="#4cc9f0"/>` +
    `<path d="M12 26 L36 26 L34 44 L14 44 Z" fill="none" ${O}/>` +
    `<path d="M24 2 C27 6 28 8 28 9 C28 11 26 12 24 12 C22 12 20 11 20 9 C20 8 21 6 24 2 Z" fill="#4cc9f0" ${T}/>`,
  // Monster parts and Mashbench gear
  bloom_tendril:
    `<path d="M8 40 C14 30 10 22 18 14 C22 10 26 12 24 18 C22 24 30 26 34 18 C37 12 42 12 40 20" fill="none" stroke="#1b1a2b" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M8 40 C14 30 10 22 18 14 C22 10 26 12 24 18 C22 24 30 26 34 18 C37 12 42 12 40 20" fill="none" stroke="#3f8a35" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M14 30 L10 26 M28 22 L30 28 M36 15 L40 12" stroke="#2c4f2a" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="40" cy="21" r="3" fill="#d6ff6a" ${T}/>`,
  snap_tooth:
    `<path d="M14 8 C26 10 36 22 34 42 C28 32 20 24 10 20 C8 14 10 9 14 8 Z" fill="#f2efe0" ${O}/>` +
    `<path d="M15 12 C24 15 30 24 31 34" fill="none" stroke="#c9c3a8" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M10 20 C9 15 11 10 14 8" fill="none" stroke="#7a2a3a" stroke-width="3" stroke-linecap="round"/>`,
  spore_sac:
    `<path d="M24 6 C34 6 40 16 40 26 C40 36 33 42 24 42 C15 42 8 36 8 26 C8 16 14 6 24 6 Z" fill="#9a6ac8" ${O}/>` +
    `<circle cx="17" cy="22" r="3" fill="#d6ff6a"/><circle cx="29" cy="17" r="2.5" fill="#d6ff6a"/><circle cx="30" cy="31" r="3.5" fill="#d6ff6a"/><circle cx="19" cy="34" r="2" fill="#d6ff6a"/>` +
    `<path d="M22 6 C22 3 26 3 26 6" fill="none" stroke="#2c4f2a" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M14 14 C16 11 19 10 22 10" fill="none" stroke="#e0c8ff" stroke-width="2" stroke-linecap="round"/>`,
  thorn_plate:
    `<path d="M8 30 C8 18 16 10 24 10 C32 10 40 18 40 30 L34 38 L14 38 Z" fill="#5a6a3a" ${O}/>` +
    `<path d="M14 18 L10 10 L18 14 M24 12 L24 3 L28 11 M34 18 L40 10 L36 20" fill="#d8c8a0" ${T}/>` +
    `<path d="M14 28 C20 24 28 24 34 28" fill="none" stroke="#3a4a24" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M16 34 C21 31 27 31 32 34" fill="none" stroke="#3a4a24" stroke-width="2" stroke-linecap="round"/>`,
  bloom_heart:
    `<path d="M24 42 C14 34 6 28 6 18 C6 11 11 7 16 7 C20 7 23 10 24 13 C25 10 28 7 32 7 C37 7 42 11 42 18 C42 28 34 34 24 42 Z" fill="#ff5a9a" ${O}/>` +
    `<path d="M24 16 L24 34 M18 22 L24 28 L31 20" fill="none" stroke="#2c4f2a" stroke-width="2.5" stroke-linecap="round"/>` +
    `<circle cx="16" cy="15" r="3" fill="#ffd0e4"/>` +
    `<circle cx="34" cy="28" r="2" fill="#d6ff6a"/>`,
  mashbench:
    `<rect x="4" y="22" width="40" height="7" rx="1.5" fill="#6d737a" ${O}/>` +
    `<path d="M9 29 L9 43 M39 29 L39 43" stroke="#1b1a2b" stroke-width="5" stroke-linecap="round"/><path d="M9 29 L9 43 M39 29 L39 43" stroke="#7a5232" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M14 22 C12 14 16 8 22 10 C20 14 22 18 20 22 Z" fill="#3f8a35" ${T}/>` +
    `<path d="M26 22 L29 10 L32 22 Z" fill="#f2efe0" ${T}/>` +
    `<circle cx="38" cy="16" r="5" fill="#9a6ac8" ${T}/><circle cx="37" cy="15" r="1.5" fill="#d6ff6a"/>` +
    `<path d="M14 34 C20 32 28 32 34 34" stroke="#d6ff6a" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  jawblade:
    handle(8, 42, 15, 35, '#2a2420') +
    `<path d="M14 34 L36 8 C42 6 44 10 41 14 L18 38 Z" fill="#c9d0d8" ${O}/>` +
    `<path d="M20 30 L17 26 M25 24 L22 20 M30 18 L27 14 M35 12 L33 9" stroke="#1b1a2b" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M20 30 L17 26 M25 24 L22 20 M30 18 L27 14 M35 12 L33 9" stroke="#f2efe0" stroke-width="2" stroke-linecap="round"/>` +
    `<rect x="11" y="31" width="9" height="4" rx="1" transform="rotate(-45 15.5 33)" fill="#3f8a35" ${T}/>`,
  thornmaul:
    handle(10, 44, 26, 20) +
    `<rect x="19" y="4" width="22" height="18" rx="3" transform="rotate(35 30 13)" fill="#5a6a3a" ${O}/>` +
    `<path d="M22 6 L18 2 M32 3 L34 -1 M41 12 L46 11 M38 22 L41 26" stroke="#1b1a2b" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M22 6 L18 2 M32 3 L34 -1 M41 12 L46 11 M38 22 L41 26" stroke="#d8c8a0" stroke-width="2" stroke-linecap="round"/>`,
  spore_bomb:
    `<path d="M24 12 C34 12 40 20 40 28 C40 37 33 43 24 43 C15 43 8 37 8 28 C8 20 14 12 24 12 Z" fill="#9a6ac8" ${O}/>` +
    `<circle cx="18" cy="26" r="3" fill="#d6ff6a"/><circle cx="29" cy="22" r="2.5" fill="#d6ff6a"/><circle cx="28" cy="34" r="3.5" fill="#d6ff6a"/>` +
    `<path d="M20 12 L20 7 L28 7 L28 12" fill="#e8d8b0" ${T}/>` +
    `<path d="M30 6 C34 2 38 4 40 2 M32 9 C36 8 39 10 42 8" fill="none" stroke="#b6ff5a" stroke-width="2" stroke-linecap="round"/>`,
  petal_mask:
    `<path d="M24 6 C30 10 36 6 40 12 C42 22 38 34 24 42 C10 34 6 22 8 12 C12 6 18 10 24 6 Z" fill="#e85fa8" ${O}/>` +
    `<path d="M24 6 C26 18 26 30 24 42 M8 12 C16 18 20 26 24 42 M40 12 C32 18 28 26 24 42" fill="none" stroke="#c03f84" stroke-width="1.5"/>` +
    `<ellipse cx="17" cy="20" rx="4" ry="2.5" fill="#1b1a2b"/><ellipse cx="31" cy="20" rx="4" ry="2.5" fill="#1b1a2b"/>` +
    `<circle cx="17" cy="20" r="1" fill="#d6ff6a"/><circle cx="31" cy="20" r="1" fill="#d6ff6a"/>`,
  bloom_tonic:
    `<rect x="19" y="5" width="10" height="6" rx="2" fill="#8a5f3a" ${O}/>` +
    `<path d="M19 11 L19 16 C12 19 10 24 10 30 C10 38 16 43 24 43 C32 43 38 38 38 30 C38 24 36 19 29 16 L29 11 Z" fill="#e8f4ff" fill-opacity="0.7" ${O}/>` +
    `<path d="M12 29 L36 29 C36 37 31 42 24 42 C17 42 12 37 12 29 Z" fill="#ff7ab8"/>` +
    `<path d="M24 32 L24 39 M20.5 35.5 L27.5 35.5" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M19 11 L19 16 C12 19 10 24 10 30 C10 38 16 43 24 43 C32 43 38 38 38 30 C38 24 36 19 29 16 L29 11 Z" fill="none" ${O}/>`,
  thorn_wall:
    `<rect x="4" y="12" width="40" height="30" rx="3" fill="#5a6a3a" ${O}/>` +
    `<path d="M4 22 L44 22 M4 32 L44 32" stroke="#3a4a24" stroke-width="2"/>` +
    [8, 16, 24, 32, 40]
      .map((x) => `<path d="M${x - 3} 12 L${x} 3 L${x + 3} 12 Z" fill="#d8c8a0" ${T}/>`)
      .join('') +
    `<path d="M12 27 L8 27 M24 17 L20 17 M36 27 L32 27 M28 37 L24 37" stroke="#d8c8a0" stroke-width="2" stroke-linecap="round"/>`,
  snap_trap:
    `<ellipse cx="24" cy="36" rx="19" ry="7" fill="#6d737a" ${O}/>` +
    `<path d="M7 34 C10 18 38 18 41 34" fill="#7a2a3a" ${O}/>` +
    [12, 18, 24, 30, 36]
      .map(
        (x) =>
          `<path d="M${x - 2.5} ${x === 24 ? 22 : 25} L${x} ${x === 24 ? 32 : 33} L${x + 2.5} ${x === 24 ? 22 : 25} Z" fill="#f2efe0" ${T}/>`,
      )
      .join('') +
    `<circle cx="24" cy="38" r="2" fill="#f2c14e" ${T}/>`,
  heart_lantern:
    `<rect x="14" y="4" width="20" height="5" rx="2" fill="#3a3a3a" ${O}/>` +
    `<path d="M24 4 L24 1" stroke="#1b1a2b" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="12" y="9" width="24" height="30" rx="4" fill="#ffd0e4" fill-opacity="0.55" ${O}/>` +
    `<path d="M24 34 C18 29 15 26 15 21 C15 18 17 16 19.5 16 C21.5 16 23 17.5 24 19 C25 17.5 26.5 16 28.5 16 C31 16 33 18 33 21 C33 26 30 29 24 34 Z" fill="#ff5a9a" ${T}/>` +
    `<path d="M16 9 L16 39 M24 9 L24 14 M32 9 L32 39" stroke="#3a3a3a" stroke-width="2"/>` +
    `<rect x="14" y="39" width="20" height="5" rx="2" fill="#3a3a3a" ${O}/>`,
  // Escape
  battery:
    `<rect x="12" y="7" width="7" height="6" fill="#d0453b" ${O}/><rect x="29" y="7" width="7" height="6" fill="#3a3a3a" ${O}/>` +
    `<rect x="6" y="12" width="36" height="30" rx="3" fill="#3a3f48" ${O}/>` +
    `<rect x="6" y="22" width="36" height="9" fill="#f2c14e" ${T}/>` +
    `<path d="M22 24 L18 28 L24 28 L21 31" fill="none" stroke="#1b1a2b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M13 17 L17 17 M15 15 L15 19 M31 17 L35 17" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>`,
  antenna:
    `<path d="M24 44 L24 10" stroke="#1b1a2b" stroke-width="5" stroke-linecap="round"/><path d="M24 44 L24 10" stroke="#c9d0d8" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M14 18 L34 18 M17 26 L31 26 M19 34 L29 34" stroke="#1b1a2b" stroke-width="4" stroke-linecap="round"/><path d="M14 18 L34 18 M17 26 L31 26 M19 34 L29 34" stroke="#9a9ea4" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="24" cy="8" r="3" fill="#ff3030" ${T}/>` +
    `<path d="M33 4 C37 6 38 10 37 13 M38 1 C43 5 44 11 42 16" fill="none" stroke="#4cc9f0" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M15 4 C11 6 10 10 11 13 M10 1 C5 5 4 11 6 16" fill="none" stroke="#4cc9f0" stroke-width="2" stroke-linecap="round"/>`,
  transmitter:
    `<rect x="5" y="10" width="38" height="28" rx="2" fill="#2f8a4a" ${O}/>` +
    `<rect x="13" y="16" width="12" height="12" fill="#1b1a2b"/>` +
    `<path d="M13 19 L10 19 M13 25 L10 25 M25 19 L28 19 M25 25 L28 25" stroke="#e8d070" stroke-width="1.5"/>` +
    `<rect x="31" y="15" width="7" height="5" fill="#d7dadf" ${T}/><rect x="31" y="24" width="7" height="8" fill="#1b1a2b"/>` +
    `<path d="M8 33 L22 33 L26 29 M28 34 L40 34" fill="none" stroke="#e8d070" stroke-width="1.5"/>` +
    `<circle cx="10" cy="14" r="1.5" fill="#e8d070"/><circle cx="40" cy="14" r="1.5" fill="#e8d070"/>` +
    `<circle cx="9" cy="28" r="2" fill="#ff5a5a"/>`,
  radio:
    `<path d="M34 16 L38 3" stroke="#1b1a2b" stroke-width="4" stroke-linecap="round"/><path d="M34 16 L38 3" stroke="#c9d0d8" stroke-width="2" stroke-linecap="round"/>` +
    `<rect x="6" y="15" width="36" height="27" rx="4" fill="#d0453b" ${O}/>` +
    `<rect x="10" y="20" width="16" height="17" rx="2" fill="#3a3a3a" ${T}/>` +
    `<path d="M12 24 L24 24 M12 28 L24 28 M12 32 L24 32" stroke="#777a80" stroke-width="1.5"/>` +
    `<circle cx="34" cy="24" r="4" fill="#f2c14e" ${T}/>` +
    `<rect x="30" y="31" width="8" height="5" rx="1" fill="#3ddc97" ${T}/>`,
};

/** A picture for an item; unknown ids get a plain crate with a question mark. */
export function itemIconSvg(id: string): string {
  const body =
    ITEM_ICONS[id] ??
    `<rect x="8" y="10" width="32" height="30" rx="3" fill="#a0703f" ${O}/>` +
      `<text x="24" y="32" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#fff" text-anchor="middle">?</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${body}</svg>`;
}

const urls = new Map<string, string>();

/** The icon as a data URL for an <img>. */
export function itemIconUrl(id: string): string {
  let url = urls.get(id);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(itemIconSvg(id))}`;
    urls.set(id, url);
  }
  return url;
}
