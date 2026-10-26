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

/** A thick outlined stroke along a path (limbs, stems, bones, rails). */
const rod = (d: string, color: string, w = 4) =>
  `<path d="${d}" fill="none" stroke="#1b1a2b" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

const steam = (xs: number[], top = 5) =>
  `<path d="${xs.map((x) => `M${x} ${top + 9} C${x} ${top + 5} ${x + 3} ${top + 5} ${x + 3} ${top + 1}`).join(' ')}" fill="none" stroke="#b8bcc4" stroke-width="1.6" stroke-linecap="round"/>`;

/** A seed packet with the crop pictured on its label. */
const packet = (paper: string, band: string, crop: string) =>
  `<path d="M10 9 L38 9 L38 42 C38 43.5 37 44 36 44 L12 44 C11 44 10 43.5 10 42 Z" fill="${paper}" ${O}/>` +
  `<path d="M10 11 L10 5 L13.5 3 L17 5 L20.5 3 L24 5 L27.5 3 L31 5 L34.5 3 L38 5 L38 11 Z" fill="${band}" ${O}/>` +
  `<rect x="14" y="14" width="20" height="20" rx="3" fill="#fff8e8" ${T}/>` +
  crop +
  [18, 24, 30]
    .map(
      (x) =>
        `<ellipse cx="${x}" cy="39" rx="2.6" ry="1.7" transform="rotate(-25 ${x} 39)" fill="#f2ecd8" stroke="#1b1a2b" stroke-width="1"/>`,
    )
    .join('');

/** A bowl of something hot: body, rim, surface, then what floats in it. */
const bowl = (body: string, rim: string, soup: string, top: string, extra = '') =>
  steam([13, 22, 31], 3) +
  `<path d="M4 24 C4 37 13 44 24 44 C35 44 44 37 44 24 Z" fill="${body}" ${O}/>` +
  extra +
  `<ellipse cx="24" cy="24" rx="20" ry="6.5" fill="${rim}" ${O}/>` +
  `<ellipse cx="24" cy="24.5" rx="16" ry="4.3" fill="${soup}" ${T}/>` +
  top;

/** An arrow from the tail (bottom left) to the head (top right). */
const arrowShaft = (feathers: [string, string]) =>
  rod('M9 39 L36 12', '#c9a46a', 2) +
  `<path d="M8 40 L15 33 L10 30 L5 34 Z" fill="${feathers[0]}" ${T}/>` +
  `<path d="M8 40 L15 33 L18 38 L14 43 Z" fill="${feathers[1]}" ${T}/>`;

/** An isometric floor tile: top face plus two side faces. */
const tile = (top: string, left: string, right: string, deco = '') =>
  `<path d="M4 20 L24 31 L24 38 L4 27 Z" fill="${left}" ${O}/>` +
  `<path d="M24 31 L44 20 L44 27 L24 38 Z" fill="${right}" ${O}/>` +
  `<path d="M4 20 L24 9 L44 20 L24 31 Z" fill="${top}" ${O}/>` +
  deco;

const sprout = (x: number, y: number) =>
  `<path d="M${x} ${y} L${x} ${y - 4}" stroke="#1b1a2b" stroke-width="2.4" stroke-linecap="round"/>` +
  `<path d="M${x} ${y - 4} C${x - 1} ${y - 8} ${x - 5} ${y - 9} ${x - 7} ${y - 8} C${x - 6} ${y - 5} ${x - 3} ${y - 4} ${x} ${y - 4} Z M${x} ${y - 4} C${x + 1} ${y - 8} ${x + 5} ${y - 9} ${x + 7} ${y - 8} C${x + 6} ${y - 5} ${x + 3} ${y - 4} ${x} ${y - 4} Z" fill="#8fdf5a" ${T}/>`;

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
  // Farming: seed packets, crops and the watering can
  seed_corn: packet(
    '#f2c14e',
    '#c9952a',
    `<path d="M24 16 C27.5 17 28.5 21 28 28 L20 28 C19.5 21 20.5 17 24 16 Z" fill="#ffd84a" ${T}/>` +
      `<path d="M21 20.5 L27 20.5 M20.5 24.5 L27.5 24.5 M24 17 L24 28" stroke="#c9952a" stroke-width="1"/>` +
      `<path d="M24 32 C19 31 17 27 18 21 C20 26 22 28 25 29 Z" fill="#6cbf45" ${T}/>` +
      `<path d="M24 32 C29 31 31 27 30 21 C28 26 26 28 23 29 Z" fill="#4f9a34" ${T}/>`,
  ),
  seed_potato: packet(
    '#a0703f',
    '#6b4a2a',
    `<path d="M16 25 C15 20 19 17.5 24 18 C30 18.5 33 21 32 26 C31 30 27 31.5 23 31 C19 30.5 16.5 28.5 16 25 Z" fill="#d6a066" ${T}/>` +
      `<path d="M20 23 l1.6 0.8 M27 21 l1.6 -0.8 M28 27 l1.6 0.8 M22 28 l1.6 0" stroke="#7a5232" stroke-width="1.4" stroke-linecap="round"/>`,
  ),
  seed_tomato: packet(
    '#d0453b',
    '#9a2a24',
    `<circle cx="24" cy="25.5" r="7" fill="#e0402f" ${T}/>` +
      `<path d="M24 19 L21 16.5 L22.2 19.6 L18.5 19.5 L21.6 21.2 L20 23.5 L24 21.6 L28 23.5 L26.4 21.2 L29.5 19.5 L25.8 19.6 L27 16.5 Z" fill="#5fae3c" stroke="#2c4f2a" stroke-width="0.8" stroke-linejoin="round"/>` +
      `<path d="M19.5 25 C19.8 23.5 20.5 22.8 21.5 22.5" fill="none" stroke="#ff9a88" stroke-width="1.4" stroke-linecap="round"/>`,
  ),
  seed_pumpkin: packet(
    '#f08a24',
    '#b85a1a',
    `<ellipse cx="19.5" cy="26" rx="4.5" ry="5.5" fill="#e0782a" ${T}/><ellipse cx="28.5" cy="26" rx="4.5" ry="5.5" fill="#e0782a" ${T}/>` +
      `<ellipse cx="24" cy="26" rx="4.5" ry="6" fill="#f59a34" ${T}/>` +
      `<path d="M23 20.5 L23 17 L26 16 L25.6 20.5 Z" fill="#5a7a2a" ${T}/>`,
  ),
  seed_berry: packet(
    '#7a5ad8',
    '#4a3ab8',
    `<path d="M24 20 C26 16 30 16 32 17 C30 20 27 20.5 24 20 Z" fill="#5fae3c" ${T}/>` +
      `<circle cx="20.5" cy="23.5" r="3.8" fill="#5a4ad8" ${T}/><circle cx="27.5" cy="24.5" r="3.8" fill="#4a3ab8" ${T}/><circle cx="23.5" cy="29.5" r="3.8" fill="#6a5ae8" ${T}/>` +
      `<circle cx="19.6" cy="22.4" r="1" fill="#c8c0ff"/><circle cx="26.6" cy="23.4" r="1" fill="#c8c0ff"/><circle cx="22.6" cy="28.4" r="1" fill="#c8c0ff"/>`,
  ),
  corn:
    `<g transform="rotate(25 24 25)">` +
    `<path d="M24 5 C30 6 32 15 31.5 27 L16.5 27 C16 15 18 6 24 5 Z" fill="#ffd84a" ${O}/>` +
    `<path d="M19 11 L29 11 M17.5 16 L30.5 16 M17 21 L31 21 M24 6 L24 27 M20 7.5 L19.5 27 M28 7.5 L28.5 27" stroke="#d09a2a" stroke-width="1.3" fill="none"/>` +
    `<path d="M24 44 C14 41 9 31 11 17 C15 26 19 31 26 34 Z" fill="#6cbf45" ${O}/>` +
    `<path d="M24 44 C34 41 39 31 37 17 C33 26 29 31 22 34 Z" fill="#4f9a34" ${O}/>` +
    `<path d="M14 25 C15 31 18 36 22 39" fill="none" stroke="#a8e070" stroke-width="1.5" stroke-linecap="round"/>` +
    `</g>`,
  potato:
    `<path d="M7 27 C6 17 15 11 26 12 C37 13 42 20 41 28 C40 37 31 41 22 40 C13 39 8 34 7 27 Z" fill="#c9915a" ${O}/>` +
    `<path d="M13 20 C16 16 21 15 25 15" fill="none" stroke="#e6bd8a" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M16 27 l2.5 1.2 M28 19 l2.5 -1.2 M32 30 l2.5 1 M22 34 l2.5 0" stroke="#7a5232" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="35" cy="24" r="1.2" fill="#a0703f"/><circle cx="19" cy="22" r="1" fill="#a0703f"/><circle cx="28" cy="35" r="1.1" fill="#a0703f"/>`,
  tomato:
    `<path d="M24 13 C36 13 42 20 42 28 C42 37 34 43 24 43 C14 43 6 37 6 28 C6 20 12 13 24 13 Z" fill="#e0402f" ${O}/>` +
    `<path d="M12 26 C12.5 22 15 19 19 17.5" fill="none" stroke="#ff9a88" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M24 15 L18 10 L21.5 16 L12 16.5 L19 19.5 L16 24 L24 20.5 L32 24 L29 19.5 L36 16.5 L26.5 16 L30 10 Z" fill="#5fae3c" ${T}/>` +
    rod('M24 15 L25.5 8', '#4f9a34', 2),
  pumpkin:
    `<ellipse cx="15" cy="29" rx="10" ry="12" fill="#e0782a" ${O}/>` +
    `<ellipse cx="33" cy="29" rx="10" ry="12" fill="#e0782a" ${O}/>` +
    `<ellipse cx="24" cy="29" rx="10" ry="13" fill="#f59a34" ${O}/>` +
    `<path d="M19 22 C19.5 20 20.5 19 22 18.5" fill="none" stroke="#ffc880" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M22 17 C22 12 24 8 28 6 L31 9 C28 10 27 13 27 17 Z" fill="#6a7a2a" ${O}/>` +
    `<path d="M29 9 C33 5 39 7 40 12" fill="none" stroke="#3f8a35" stroke-width="2" stroke-linecap="round"/>`,
  watering_can:
    rod('M27 35 L40 17', '#5aa86a', 4) +
    `<rect x="35.5" y="12.5" width="10" height="4.5" rx="1.5" transform="rotate(36 40.5 14.75)" fill="#5aa86a" ${O}/>` +
    rod('M9 21 C8 8 25 7 25 19', '#5aa86a', 3.5) +
    `<path d="M6 20 L30 20 L30 42 C30 43 29 44 28 44 L8 44 C7 44 6 43 6 42 Z" fill="#5aa86a" ${O}/>` +
    `<ellipse cx="18" cy="20" rx="12" ry="3" fill="#7cc88a" ${O}/>` +
    `<path d="M6 31 L30 31" stroke="#3f7a4a" stroke-width="2"/>` +
    `<path d="M10 25 L10 39" stroke="#a8e8b0" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M43 21 C44 23 44.5 24 44.5 24.6 C44.5 25.6 43.8 26 43 26 C42.2 26 41.5 25.6 41.5 24.6 C41.5 24 42 23 43 21 Z" fill="#4cc9f0" ${T}/>`,
  // Meat, eggs, milk and cooked meals
  meat_raw:
    `<path d="M7 24 C6 13 17 7 28 8 C39 9 44 18 42 27 C40 37 30 42 20 40 C11 38 8 32 7 24 Z" fill="#f4d4cc" ${O}/>` +
    `<path d="M11 24 C10 15 19 11.5 28 12 C36 12.5 40 19 38.5 26 C37 33 29 37 21 36 C14 35 11.5 30 11 24 Z" fill="#d8404f"/>` +
    `<path d="M15 20 C19 22 21 17 25 19 M16 29 C20 27 24 32 29 29 M30 15 C32 17 34 16 35 19" fill="none" stroke="#f08a96" stroke-width="1.6" stroke-linecap="round"/>` +
    `<circle cx="31" cy="25" r="3.5" fill="#f2ecd8" ${T}/>`,
  meat_cooked:
    rod('M28 20 L38 10', '#f2ecd8', 5) +
    `<circle cx="37" cy="6.5" r="3.6" fill="#f2ecd8" ${O}/><circle cx="41.5" cy="11" r="3.6" fill="#f2ecd8" ${O}/>` +
    `<path d="M32 16 L38.5 9.5" stroke="#f2ecd8" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M7 31 C5 21 13 12 23 12 C31 12 36 17 34 25 C32 35 22 43 14 41 C9 40 7 36 7 31 Z" fill="#a85a30" ${O}/>` +
    `<path d="M11 25 C13 19 17 16 22 16" fill="none" stroke="#d8905a" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M14 35 L23 26 M20 37 L29 28" stroke="#6b3a1f" stroke-width="2.2" stroke-linecap="round"/>`,
  egg:
    `<path d="M24 5 C33 5 39 19 39 29 C39 38 32 44 24 44 C16 44 9 38 9 29 C9 19 15 5 24 5 Z" fill="#f2dfbf" ${O}/>` +
    `<path d="M12 31 C13 37 17 41 23 41.5" fill="none" stroke="#dcc49c" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M16 17 C17.5 12.5 20 10 22.5 9.5" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>` +
    `<circle cx="28" cy="17" r="1.2" fill="#b8925a"/><circle cx="33" cy="28" r="1.4" fill="#b8925a"/><circle cx="20" cy="30" r="1.2" fill="#b8925a"/><circle cx="27" cy="37" r="1.1" fill="#b8925a"/><circle cx="17" cy="22" r="0.9" fill="#b8925a"/><circle cx="30" cy="23" r="0.9" fill="#b8925a"/>`,
  milk:
    rod('M31 16 C47 14 47 34 32 36', '#e8eaf2', 4) +
    `<path d="M10 9 L32 9 L31 15 C34 21 35 30 33 38 C32 42 29 44 25 44 L16 44 C12 44 9.5 42 8.5 38 C7 30 8 21 11 15 Z" fill="#f6f6f0" ${O}/>` +
    `<path d="M13 9 L5 7 L11 15 Z" fill="#f6f6f0" ${O}/>` +
    `<ellipse cx="21" cy="9.5" rx="11" ry="3" fill="#ffffff" ${O}/>` +
    `<path d="M8.6 23 L33.5 23 M7.9 30 L34 30" stroke="#4a7ab5" stroke-width="3"/>` +
    `<path d="M28 17 C30.5 22 31 30 29.5 37" fill="none" stroke="#d6dae6" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M12.5 34 L12.5 39" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M10 9 L32 9 L31 15 C34 21 35 30 33 38 C32 42 29 44 25 44 L16 44 C12 44 9.5 42 8.5 38 C7 30 8 21 11 15 Z" fill="none" ${O}/>`,
  corn_roast:
    steam([7, 13], 2) +
    `<g transform="rotate(35 24 26)">` +
    `<path d="M24 46 C15 44 11 37 12 29 C16 34 20 36 25 37 Z" fill="#d9b07a" ${O}/>` +
    `<path d="M24 46 C33 44 37 37 36 29 C32 34 28 36 23 37 Z" fill="#c9a46a" ${O}/>` +
    `<path d="M24 6 C30 7 32 16 31.5 30 C31 34 28 37 24 37 C20 37 17 34 16.5 30 C16 16 18 7 24 6 Z" fill="#eaa83a" ${O}/>` +
    `<path d="M19 12 L29 12 M17.5 17 L30.5 17 M17 22 L31 22 M17 27 L31 27 M24 7 L24 36 M20 8.5 L19.5 35 M28 8.5 L28.5 35" stroke="#b8782a" stroke-width="1.3" fill="none"/>` +
    `<path d="M21 13 L23 15 M26 19 L28 17.5 M20 25 L22 26 M26.5 30 L28 32 M22 33 L23.5 34" stroke="#5b3a1a" stroke-width="2.6" stroke-linecap="round"/>` +
    `</g>`,
  potato_baked:
    steam([16, 26], 1) +
    `<path d="M6 30 C5 21 13 16 24 16 C35 16 43 21 42 30 C41 38 33 42 24 42 C15 42 7 38 6 30 Z" fill="#9a6034" ${O}/>` +
    `<path d="M11 26 C14 19.5 34 19.5 37 26 C34 32.5 14 32.5 11 26 Z" fill="#fff2c8" ${O}/>` +
    `<path d="M15 27 C17 25 19 26.5 21 24.5 M28 25 C30 27 32 25 34 27" fill="none" stroke="#e8d090" stroke-width="1.5" stroke-linecap="round"/>` +
    `<rect x="19.5" y="20.5" width="9" height="7" rx="1.5" transform="rotate(-10 24 24)" fill="#ffd84a" ${T}/>` +
    `<path d="M21 22.5 L24 22" stroke="#fff4b0" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="14" cy="35" r="1.1" fill="#6b3a1f"/><circle cx="30" cy="38" r="1.1" fill="#6b3a1f"/><circle cx="37" cy="32" r="1" fill="#6b3a1f"/><circle cx="22" cy="38" r="0.9" fill="#6b3a1f"/>`,
  egg_fried:
    rod('M6 42 L14 34', '#5b3a22', 4.5) +
    `<circle cx="27" cy="23" r="17" fill="#3a3d45" ${O}/>` +
    `<circle cx="27" cy="23" r="13.5" fill="#55585f"/>` +
    `<path d="M16 22 C15 15 22 12 27 13 C33 12 39 16 38 23 C39 30 33 34 27 33 C20 35 15 29 16 22 Z" fill="#ffffff" ${T}/>` +
    `<circle cx="28" cy="22.5" r="5.2" fill="#ffb81a" ${T}/>` +
    `<circle cx="26.5" cy="21" r="1.6" fill="#fff0b0"/>` +
    `<path d="M14 13 C16 10.5 18.5 9 21 8.5" fill="none" stroke="#7a7e88" stroke-width="1.6" stroke-linecap="round"/>`,
  veg_stew: bowl(
    '#4f9a5a',
    '#74bb7c',
    '#d8503a',
    `<rect x="12" y="19.5" width="6" height="5.5" rx="1" transform="rotate(-12 15 22)" fill="#f2dca0" ${T}/>` +
      `<rect x="27.5" y="19" width="6" height="5.5" rx="1" transform="rotate(10 30.5 21.7)" fill="#f2dca0" ${T}/>` +
      `<path d="M20 21 C22 16.5 26 16.5 28 17.5 C26 21 23 22 20 21 Z" fill="#5fae3c" ${T}/>` +
      `<circle cx="22" cy="25.5" r="1.8" fill="#ffd84a" ${T}/><circle cx="35.5" cy="25" r="1.8" fill="#ffd84a" ${T}/><circle cx="27" cy="26.5" r="1.6" fill="#ffd84a" ${T}/>`,
    `<path d="M5.5 31 C12 35 36 35 42.5 31" fill="none" stroke="#3a7a46" stroke-width="2"/>`,
  ),
  meat_stew: bowl(
    '#5a5f6a',
    '#7a808a',
    '#7a3f22',
    rod('M30 22 L37 11', '#f2ecd8', 3.5) +
      `<circle cx="36" cy="8.5" r="2.6" fill="#f2ecd8" ${T}/><circle cx="39.5" cy="11" r="2.6" fill="#f2ecd8" ${T}/>` +
      `<path d="M34 14 L37.5 9.5" stroke="#f2ecd8" stroke-width="3.5" stroke-linecap="round"/>` +
      `<path d="M12 23 C12 19 16 18 19 19 C21 20 21 24 18 25 C15 26 12 25.5 12 23 Z" fill="#a85a30" ${T}/>` +
      `<path d="M21 26 C21 22.5 25 21.5 27.5 22.5 C29.5 23.5 29 27 26 27.5 C23 28 21 27.5 21 26 Z" fill="#a85a30" ${T}/>` +
      `<rect x="22" y="18" width="5" height="4.5" rx="1" fill="#f2dca0" ${T}/>` +
      `<circle cx="33" cy="26.5" r="1.6" fill="#ffd84a" ${T}/>`,
    `<path d="M5.5 31 C12 35 36 35 42.5 31" fill="none" stroke="#8a909a" stroke-width="2"/>`,
  ),
  pumpkin_soup: bowl(
    '#4a7ab5',
    '#6a9ad5',
    '#f08a24',
    `<path d="M15 24 C15 21 23 20.5 25 23 C27 25.5 20 27 20 24.5 C20 23 23 22.8 24 24" fill="none" stroke="#fff4e0" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M29 23 C31 19 35 19 37 20 C35 23 32 23.5 29 23 Z" fill="#5fae3c" ${T}/>` +
      `<ellipse cx="31" cy="26" rx="1.8" ry="1.1" fill="#f2ecd8" ${T}/><ellipse cx="11.5" cy="24.5" rx="1.8" ry="1.1" fill="#f2ecd8" ${T}/>`,
    `<path d="M9 32 C15 37 33 37 39 32" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="2 3"/>`,
  ),
  omelette:
    `<ellipse cx="24" cy="32" rx="20" ry="10" fill="#f2ecd8" ${O}/>` +
    `<ellipse cx="24" cy="33" rx="14" ry="6" fill="none" stroke="#d8d0b8" stroke-width="1.5"/>` +
    `<path d="M8 32 C7 19 22 13 33 15 C40 17 42 24 40 30 C34 34 16 35 8 32 Z" fill="#ffcc3a" ${O}/>` +
    `<path d="M13 25 C16 20 23 17 30 18" fill="none" stroke="#ffe58a" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="15" cy="32" r="2.4" fill="#e0402f" ${T}/><circle cx="31" cy="32" r="2.4" fill="#e0402f" ${T}/>` +
    `<path d="M20 33 C20 29.5 26 29.5 26 33 Z" fill="#b87a4a" ${T}/>` +
    `<circle cx="21" cy="22" r="1.2" fill="#3f8a35"/><circle cx="30" cy="24" r="1.2" fill="#3f8a35"/><circle cx="25" cy="27" r="1" fill="#3f8a35"/>`,
  coconut_curry: bowl(
    '#7a5232',
    '#f2ecd8',
    '#f2b02a',
    `<path d="M13 23 C13 19.5 17 18.5 20 19.5 C22 20.5 21.5 24 18.5 25 C15.5 26 13 25.5 13 23 Z" fill="#a85a30" ${T}/>` +
      `<path d="M27 21 C30 17 35 18 36 21" fill="none" stroke="#1b1a2b" stroke-width="3.6" stroke-linecap="round"/><path d="M27 21 C30 17 35 18 36 21" fill="none" stroke="#e0302a" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M21 26 C23 22.5 27 22.5 29 23.5 C27 26.5 24 27 21 26 Z" fill="#5fae3c" ${T}/>` +
      `<circle cx="32" cy="25.5" r="1.7" fill="#ffe07a" ${T}/>`,
    `<path d="M10 33 L14 30 M17 38 L20 34 M26 39 L28 35 M34 37 L35 33 M39 31 L40 28" stroke="#5b3a22" stroke-width="1.8" stroke-linecap="round"/>`,
  ),
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
  // Ranged weapons and what they shoot
  slingshot:
    rod('M24 44 L24 28 M24 28 L13 11 M24 28 L35 11', '#8a5f3a', 5) +
    `<rect x="20.5" y="33" width="7" height="9" rx="1.5" fill="#5b3a22" ${T}/>` +
    `<path d="M22 35.5 L26 35.5 M22 39 L26 39" stroke="#8a6a4a" stroke-width="1.2"/>` +
    `<path d="M13 12 L20 22 M35 12 L28 22" stroke="#1b1a2b" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M13 12 L20 22 M35 12 L28 22" stroke="#c0503a" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M18 21 C18 26 30 26 30 21 C30 19.5 18 19.5 18 21 Z" fill="#8a6a4a" ${T}/>` +
    `<circle cx="24" cy="21" r="3.2" fill="#8f9196" ${T}/>` +
    `<circle cx="23" cy="20" r="1" fill="#c4c6ca"/>`,
  bow:
    `<g transform="rotate(40 24 24)">` +
    `<path d="M24 5 L24 43" stroke="#1b1a2b" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M24 5 L24 43" stroke="#f2ecd8" stroke-width="1.3" stroke-linecap="round"/>` +
    rod('M24 4 C17 6 13 10 12 16 C11 21 11 27 12 32 C13 38 17 42 24 44', '#a0703f', 4) +
    `<rect x="9" y="19.5" width="6" height="9" rx="1.5" fill="#5b3a22" ${T}/>` +
    `<path d="M14 9 C13 11 12.5 13 12.5 15" fill="none" stroke="#d9b07a" stroke-width="1.5" stroke-linecap="round"/>` +
    `</g>`,
  crossbow:
    `<g transform="rotate(40 24 24)">` +
    `<path d="M21 9 L27 9 L27 30 L30 41 C30.5 43.5 29 45 27 45 L21 45 C19 45 17.5 43.5 18 41 L21 30 Z" fill="#8a5f3a" ${O}/>` +
    `<path d="M23 11 L23 29" stroke="#a87a4a" stroke-width="1.5" stroke-linecap="round"/>` +
    rod('M6 21 C12 12 36 12 42 21', '#6d737a', 3.5) +
    `<path d="M6 21 L24 28 L42 21" fill="none" stroke="#1b1a2b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<path d="M6 21 L24 28 L42 21" fill="none" stroke="#f2ecd8" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>` +
    rod('M24 27 L24 9', '#5b3a22', 2) +
    `<path d="M21.3 9.5 L24 2.5 L26.7 9.5 Z" fill="#c9d0d8" ${T}/>` +
    `<rect x="21.5" y="13.5" width="5" height="4" rx="1" fill="#6d737a" ${T}/>` +
    rod('M27 33 L29.5 36.5', '#3a3a3a', 1.5) +
    `</g>`,
  arrow:
    arrowShaft(['#d0453b', '#f2ecd8']) +
    `<path d="M43 5 L32.5 9.5 L35.5 12.5 L38.5 15.5 Z" fill="#8f9196" ${O}/>` +
    `<path d="M41 7 L35 10" stroke="#c4c6ca" stroke-width="1.3" stroke-linecap="round"/>`,
  fire_arrow:
    arrowShaft(['#f2c14e', '#d0453b']) +
    `<rect x="27" y="15.5" width="8" height="5" rx="2" transform="rotate(-45 31 18)" fill="#d9b07a" ${T}/>` +
    flame(33, 15, 0.75) +
    `<path d="M43 5 L32.5 9.5 L35.5 12.5 L38.5 15.5 Z" fill="#8f9196" ${O}/>`,
  bolt:
    rod('M12 37 L33 16', '#8a5f3a', 3.5) +
    `<path d="M10 39 L17 32 L12.5 28 L7.5 33.5 Z" fill="#5b6a7a" ${T}/>` +
    `<path d="M10 39 L17 32 L21 36.5 L15.5 41.5 Z" fill="#7a8a9a" ${T}/>` +
    `<rect x="29" y="15" width="7" height="5" rx="1" transform="rotate(-45 32.5 17.5)" fill="#6d737a" ${T}/>` +
    `<path d="M43 5 L30 10.5 L37.5 18 Z" fill="#c9d0d8" ${O}/>` +
    `<path d="M41 7 L33 11" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>`,
  // From animals
  hide:
    `<path d="M17 6 C20 9 28 9 31 6 C34 9 34 13 33 16 C37 15 42 16 43 20 C40 22 36 22 34 23 C35 28 35 31 34 33 C38 35 41 39 40 43 C35 43 31 40 29 38 C26 40 22 40 19 38 C17 40 13 43 8 43 C7 39 10 35 14 33 C13 31 13 28 14 23 C12 22 8 22 5 20 C6 16 11 15 15 16 C14 13 14 9 17 6 Z" fill="#a0703f" ${O}/>` +
    `<path d="M24 12 C30 12 31 18 30.5 24 C30 31 28 35 24 35 C20 35 18 31 17.5 24 C17 18 18 12 24 12 Z" fill="#c9915a"/>` +
    `<circle cx="20" cy="14" r="1.6" fill="#7a5232"/><circle cx="29" cy="31" r="1.8" fill="#7a5232"/><circle cx="12" cy="19" r="1.3" fill="#7a5232"/><circle cx="36" cy="38" r="1.3" fill="#7a5232"/>` +
    `<path d="M21 18 C23 17 25 17 27 18" fill="none" stroke="#e3bf8a" stroke-width="1.6" stroke-linecap="round"/>`,
  feather:
    `<path d="M14 35 C20 35 30 30 34 24 C38 18 40 13 39 8 C34 8 28 10 23 14 C18 19 14 26 14 35 Z" fill="#e0884a" ${O}/>` +
    `<path d="M18.5 22 L26.5 30.5 M23.5 16 L31.5 24 M29.5 11 L36 17.5" stroke="#8a4a2a" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M33 9.5 C29 11 25 13.5 22 17" fill="none" stroke="#ffc890" stroke-width="1.5" stroke-linecap="round"/>` +
    rod('M7 42 L37 10', '#f2ecd8', 1.6),
  // Secrets
  shovel:
    `<g transform="rotate(35 24 24)">` +
    rod('M24 8 L24 27', '#8a5f3a', 4) +
    rod('M18 5 L30 5', '#8a5f3a', 4) +
    `<path d="M15 26 L33 26 L33 34 C33 40 28 43 24 45 C20 43 15 40 15 34 Z" fill="#c9d0d8" ${O}/>` +
    `<rect x="20.5" y="22" width="7" height="7" rx="1" fill="#8f9196" ${T}/>` +
    `<path d="M18.5 30 L18.5 36" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>` +
    `</g>`,
  bottle:
    `<g transform="rotate(40 24 24)">` +
    `<rect x="20.5" y="5" width="7" height="6" rx="1.5" fill="#c9915a" ${O}/>` +
    `<path d="M20.5 10 L20.5 15 C17 16.5 16 19 16 22 L16 39 C16 41 17 42 19 42 L29 42 C31 42 32 41 32 39 L32 22 C32 19 31 16.5 27.5 15 L27.5 10 Z" fill="#8fd8b0" fill-opacity="0.6" ${O}/>` +
    `<rect x="19.5" y="20" width="9" height="18" rx="1.5" fill="#f2ecd8" ${T}/>` +
    `<path d="M19.5 22.5 L28.5 22.5 M19.5 35.5 L28.5 35.5" stroke="#c9b48a" stroke-width="1.2"/>` +
    `<rect x="19.5" y="27.5" width="9" height="3" fill="#d0453b"/>` +
    `<path d="M18.2 22 L18.2 36" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>` +
    `<path d="M20.5 10 L20.5 15 C17 16.5 16 19 16 22 L16 39 C16 41 17 42 19 42 L29 42 C31 42 32 41 32 39 L32 22 C32 19 31 16.5 27.5 15 L27.5 10 Z" fill="none" ${O}/>` +
    `</g>`,
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

/** The shaded space under a roof piece. */
const gable = `<path d="M24 19 L35 32 L35 42 L13 42 L13 32 Z" fill="#3a2a1e" ${O}/>`;

/** Pictures for building pieces that are put down in build mode without an item. */
export const PIECE_ICONS: Record<string, string> = {
  // Walls and fences
  wall_scrap:
    `<path d="M8 9 L26 7 L26 41 L8 42 Z" fill="#b0b6bd" ${O}/>` +
    `<path d="M24 8 L40 10 L40 42 L24 40 Z" fill="#c9ced4" ${O}/>` +
    `<path d="M8 30 L26 29 M24 29.5 L40 31" stroke="#d0453b" stroke-width="3.5"/>` +
    `<rect x="12" y="15" width="8" height="7" rx="1" fill="#d7dadf" ${T}/>` +
    `<path d="M28 15 L36 16" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>` +
    [
      [11, 11],
      [22, 10],
      [11, 38],
      [22, 37],
      [28, 12],
      [37, 13],
      [28, 37],
      [37, 38],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#5f656c"/>`)
      .join('') +
    `<rect x="3" y="5" width="6" height="39" rx="1" fill="#7a5232" ${O}/><rect x="39" y="5" width="6" height="39" rx="1" fill="#7a5232" ${O}/>`,
  fence_wood:
    `<rect x="3" y="20" width="42" height="4" rx="1" fill="#8a5f3a" ${T}/><rect x="3" y="32" width="42" height="4" rx="1" fill="#8a5f3a" ${T}/>` +
    [6, 16, 26, 36]
      .map(
        (x) =>
          `<path d="M${x} 41 L${x} 16 L${x + 3} 12 L${x + 6} 16 L${x + 6} 41 Z" fill="#b8844a" ${O}/>` +
          `<path d="M${x + 2} 18 L${x + 2} 38" stroke="#d9a868" stroke-width="1.3" stroke-linecap="round"/>`,
      )
      .join('') +
    `<path d="M4 43 L6 38 L8 43 M20 43 L22.5 37 L24 43 M38 43 L41 38 L42 43" fill="#5fae3c" stroke="#2c4f2a" stroke-width="1.2" stroke-linejoin="round"/>`,
  fence_gate:
    `<rect x="4" y="10" width="7" height="33" rx="1" fill="#7a5232" ${O}/><rect x="37" y="10" width="7" height="33" rx="1" fill="#7a5232" ${O}/>` +
    `<path d="M3.5 10 L7.5 6 L11.5 10 Z M36.5 10 L40.5 6 L44.5 10 Z" fill="#5b3a22" ${T}/>` +
    [13, 20, 27]
      .map((x) => `<rect x="${x}" y="15" width="7" height="25" fill="#b8844a" ${O}/>`)
      .join('') +
    `<rect x="12" y="17" width="23" height="4" rx="1" fill="#8a5f3a" ${T}/><rect x="12" y="33" width="23" height="4" rx="1" fill="#8a5f3a" ${T}/>` +
    rod('M15 33 L32 21', '#8a5f3a', 2.5) +
    `<rect x="10" y="17.5" width="4" height="3" fill="#3a3a3a"/><rect x="10" y="33.5" width="4" height="3" fill="#3a3a3a"/>` +
    `<circle cx="33" cy="27" r="2.2" fill="none" stroke="#1b1a2b" stroke-width="2.6"/><circle cx="33" cy="27" r="2.2" fill="none" stroke="#c9d0d8" stroke-width="1.2"/>`,
  // Floors and roofs
  floor_wood: tile(
    '#a0703f',
    '#7a5232',
    '#5b3a22',
    `<path d="M9 17.25 L29 28.25 M14 14.5 L34 25.5 M19 11.75 L39 22.75" stroke="#7a5232" stroke-width="1.6"/>` +
      `<path d="M15.5 21 L18 19.6 M28 22.5 L30.5 21.1 M21 15 L23.5 13.6" stroke="#7a5232" stroke-width="1.4"/>` +
      `<path d="M8 19 L22 11.5" stroke="#c08a50" stroke-width="1.5" stroke-linecap="round"/>` +
      `<circle cx="12" cy="21" r="0.9" fill="#4a2e1a"/><circle cx="35" cy="21" r="0.9" fill="#4a2e1a"/><circle cx="24" cy="27" r="0.9" fill="#4a2e1a"/>`,
  ),
  floor_stone: tile(
    '#9a9ca1',
    '#7f8186',
    '#6e7075',
    `<path d="M10 16.7 L14 19 L12.5 22.5 M14 19 L22 16.5 L19 12 M22 16.5 L26 21 L33 18 L30 12.5 M26 21 L23 26 L28 28.5 M23 26 L16 25.5 M33 18 L37 22 L35 24" fill="none" stroke="#5f6268" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M17 21 L20 20 M27 15.5 L28.5 14.5" stroke="#c4c6ca" stroke-width="1.5" stroke-linecap="round"/>`,
  ),
  rug:
    `<path d="M7 13 L3 13 M7 17 L3 17 M7 21 L3 21 M7 25 L3 25 M7 29 L3 29 M7 33 L3 33 M41 13 L45 13 M41 17 L45 17 M41 21 L45 21 M41 25 L45 25 M41 29 L45 29 M41 33 L45 33" stroke="#1b1a2b" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M7 13 L3.5 13 M7 17 L3.5 17 M7 21 L3.5 21 M7 25 L3.5 25 M7 29 L3.5 29 M7 33 L3.5 33 M41 13 L44.5 13 M41 17 L44.5 17 M41 21 L44.5 21 M41 25 L44.5 25 M41 29 L44.5 29 M41 33 L44.5 33" stroke="#f2ecd8" stroke-width="1.4" stroke-linecap="round"/>` +
    `<rect x="6" y="10" width="36" height="26" rx="1.5" fill="#b8403a" ${O}/>` +
    `<rect x="10" y="14" width="28" height="18" fill="none" stroke="#f2c14e" stroke-width="2"/>` +
    `<path d="M24 16 L33 23 L24 30 L15 23 Z" fill="#3a6aa5" ${T}/>` +
    `<path d="M24 19.5 L28.5 23 L24 26.5 L19.5 23 Z" fill="#f2c14e"/>` +
    `<circle cx="12.5" cy="16.5" r="1" fill="#f2ecd8"/><circle cx="35.5" cy="16.5" r="1" fill="#f2ecd8"/><circle cx="12.5" cy="29.5" r="1" fill="#f2ecd8"/><circle cx="35.5" cy="29.5" r="1" fill="#f2ecd8"/>`,
  roof_thatch:
    gable +
    `<path d="M24 5 L46 32 L44 37 L41 34.5 L38 37.5 L35 35 L33.5 33 L24 22.5 L14.5 33 L13 35 L10 37.5 L7 34.5 L4 37 L2 32 Z" fill="#d9b04a" ${O}/>` +
    `<path d="M10 21.5 L12.5 23 L15 21.5 L17.5 23 L20 21.5 L22.5 23 L25 21.5 L27.5 23 L30 21.5 L32.5 23 L35 21.5 L37.5 23 M5 28.5 L7.5 30 L10 28.5 L12.5 30 L15 28.5 L17.5 30 M30.5 30 L33 28.5 L35.5 30 L38 28.5 L40.5 30 L43 28.5" fill="none" stroke="#a8842a" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<path d="M15 17 L16 15 M33 17 L32 15 M9 33 L10 31 M39 33 L38 31 M21 28 L22 26 M27 28 L26 26" stroke="#f2d488" stroke-width="1.4" stroke-linecap="round"/>` +
    rod('M16.5 14 L24 5 L31.5 14', '#a8842a', 2.5),
  roof_wood:
    gable +
    `<path d="M24 5 L46 32 L44 36 L34.5 36 L24 23.5 L13.5 36 L4 36 L2 32 Z" fill="#8a5f3a" ${O}/>` +
    `<path d="M10 22.5 L38 22.5 M4.3 29.5 L18.5 29.5 M29.5 29.5 L43.7 29.5" stroke="#5b3a22" stroke-width="1.8"/>` +
    `<path d="M15 22.5 L14 29.5 M20.5 15 L19.5 22.5 M33 22.5 L34 29.5 M27.5 15 L28.5 22.5 M24 22.5 L24 23.5 M9 29.5 L8 35 M39 29.5 L40 35" stroke="#5b3a22" stroke-width="1.5"/>` +
    `<path d="M8 27.5 L12.5 22 M17.5 19 L21 14.5" stroke="#b08050" stroke-width="1.6" stroke-linecap="round"/>` +
    rod('M16.5 14 L24 5 L31.5 14', '#6b4a2a', 2.5),
  // Furniture
  table:
    rod('M14 24 L14 37 M34 24 L34 37', '#6b4a2a', 2.5) +
    rod('M9 22 L9 42 M39 22 L39 42', '#8a5f3a', 3.5) +
    `<rect x="7" y="21" width="34" height="4" fill="#7a5232" ${T}/>` +
    `<rect x="4" y="16" width="40" height="6" rx="1.5" fill="#a0703f" ${O}/>` +
    `<path d="M7 18 L22 18" stroke="#c08a50" stroke-width="1.5" stroke-linecap="round"/>` +
    `<ellipse cx="16" cy="14.5" rx="7" ry="2.3" fill="#f2ecd8" ${T}/>` +
    `<path d="M28 7 L36 7 L35.5 15.5 L28.5 15.5 Z" fill="#4a7ab5" ${T}/>` +
    `<path d="M35.8 9 C39 9 39 13.5 35.6 13.5" fill="none" stroke="#1b1a2b" stroke-width="1.5"/>`,
  chair:
    rod('M15 32 L15 40 M31 32 L31 40', '#6b4a2a', 2.5) +
    rod('M13 6 L13 27 M33 6 L33 27', '#8a5f3a', 3.5) +
    rod('M20 11 L20 25 M26 11 L26 25', '#a0703f', 2.5) +
    `<rect x="10" y="5" width="26" height="6" rx="1.5" fill="#a0703f" ${O}/>` +
    `<path d="M12 25 L34 25 L38 31 L8 31 Z" fill="#a0703f" ${O}/>` +
    `<rect x="8" y="31" width="30" height="4" fill="#7a5232" ${T}/>` +
    rod('M10 35 L10 44 M36 35 L36 44', '#8a5f3a', 3.5),
  bed:
    rod('M8 38 L8 43 M40 38 L40 43', '#5b3a22', 2.5) +
    `<rect x="7" y="30" width="34" height="8" rx="1" fill="#7a5232" ${O}/>` +
    `<rect x="9" y="23" width="31" height="8" rx="2.5" fill="#f2ecd8" ${O}/>` +
    `<path d="M21 21 L40 21 L40 31 L21 31 Z" fill="#c0504a" ${O}/>` +
    `<path d="M21 24 L40 24" stroke="#e8807a" stroke-width="2"/>` +
    `<rect x="11" y="16.5" width="10" height="7" rx="3" fill="#ffffff" ${O}/>` +
    `<path d="M4 41 L4 12 C4 7 12 7 12 12 L12 41 Z" fill="#8a5f3a" ${O}/>` +
    `<path d="M7 13 L7 36" stroke="#a0703f" stroke-width="1.6" stroke-linecap="round"/>` +
    `<rect x="39" y="19" width="6" height="23" rx="2" fill="#8a5f3a" ${O}/>`,
  shelf:
    `<rect x="7" y="4" width="34" height="40" rx="1.5" fill="#7a5232" ${O}/>` +
    `<rect x="11" y="8" width="26" height="32" fill="#4a2e1a"/>` +
    `<rect x="14" y="10" width="7" height="8" rx="1.5" fill="#4cc9f0" ${T}/><rect x="13.5" y="9" width="8" height="2.5" rx="1" fill="#c9a46a" ${T}/>` +
    `<path d="M26 18 L26 13 L28 11 L28 9 L30 9 L30 11 L32 13 L32 18 Z" fill="#5fae3c" ${T}/>` +
    `<rect x="13" y="22" width="4" height="7" fill="#d0453b" ${T}/><rect x="17" y="21" width="4" height="8" fill="#f2c14e" ${T}/><rect x="21" y="23" width="4" height="6" fill="#4a7ab5" ${T}/>` +
    `<ellipse cx="31" cy="25.5" rx="4.5" ry="3.5" fill="#d0703a" ${T}/>` +
    `<rect x="14" y="33" width="10" height="7" fill="#c9a46a" ${T}/><path d="M14 36.5 L24 36.5" stroke="#8a6a3a" stroke-width="1.2"/>` +
    `<rect x="9" y="18" width="30" height="3" fill="#a0703f" ${T}/><rect x="9" y="29" width="30" height="3" fill="#a0703f" ${T}/>`,
  chest_big:
    `<rect x="4" y="22" width="40" height="21" rx="2" fill="#a0703f" ${O}/>` +
    `<path d="M4 22 L4 16 C4 9 12 7 24 7 C36 7 44 9 44 16 L44 22 Z" fill="#8a5f3a" ${O}/>` +
    `<path d="M8 14 C12 11 18 10 24 10" fill="none" stroke="#a87a4a" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M10 9.3 L10 43 M15 8.3 L15 43 M33 8.3 L33 43 M38 9.3 L38 43" stroke="#1b1a2b" stroke-width="1.5"/>` +
    `<path d="M10 9.3 L15 8.3 L15 43 L10 43 Z M33 8.3 L38 9.3 L38 43 L33 43 Z" fill="#6d737a"/>` +
    `<path d="M10 9.3 L10 43 M15 8.3 L15 43 M33 8.3 L33 43 M38 9.3 L38 43" stroke="#1b1a2b" stroke-width="1.5"/>` +
    `<path d="M4 22 L44 22" ${O}/>` +
    `<rect x="19.5" y="18" width="9" height="10" rx="1.5" fill="#f2c14e" ${T}/>` +
    `<circle cx="24" cy="22" r="1.4" fill="#1b1a2b"/><path d="M24 22 L24 25.5" stroke="#1b1a2b" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="12.5" cy="26" r="1" fill="#c9d0d8"/><circle cx="12.5" cy="39" r="1" fill="#c9d0d8"/><circle cx="35.5" cy="26" r="1" fill="#c9d0d8"/><circle cx="35.5" cy="39" r="1" fill="#c9d0d8"/>`,
  lamp:
    rod('M18 10 C18 2 30 2 30 10', '#6d737a', 2.5) +
    `<circle cx="24" cy="25" r="14" fill="#d6ff6a" fill-opacity="0.22"/>` +
    `<path d="M17 13 C11 19 11 31 17 37 L31 37 C37 31 37 19 31 13 Z" fill="#effccf" fill-opacity="0.6" ${O}/>` +
    `<path d="M24 17 C29 22 30 27 24 33 C18 27 19 22 24 17 Z" fill="#b6ff5a" ${T}/>` +
    `<path d="M24 23 C26.5 25.5 26.5 28 24 31 C21.5 28 21.5 25.5 24 23 Z" fill="#f0ffd0"/>` +
    `<path d="M16.5 20 C15.5 23 15.5 27 16.5 30" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M15 13 L33 13 L30 8.5 L18 8.5 Z" fill="#6d737a" ${O}/>` +
    `<path d="M12 37 L36 37 L38 43 L10 43 Z" fill="#6d737a" ${O}/>` +
    `<path d="M14 40 L34 40" stroke="#9a9ea4" stroke-width="1.4"/>`,
  seat_screen:
    `<path d="M21 34 L27 34 L27 41 L21 41 Z" fill="#6d737a" ${O}/>` +
    `<path d="M14 41 L34 41 L36 44 L12 44 Z" fill="#3a3a3a" ${O}/>` +
    `<rect x="5" y="7" width="38" height="28" rx="3" fill="#2b2f38" ${O}/>` +
    `<rect x="9" y="11" width="30" height="20" rx="1.5" fill="#5ab4ff" ${T}/>` +
    `<path d="M9 25 L17 19 L23 24 L29 18 L39 26 L39 31 L9 31 Z" fill="#3f8fd6"/>` +
    `<path d="M15 15 L33 15" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M21 19.5 L21 25.5 L26.5 22.5 Z" fill="#ffffff" ${T}/>` +
    `<circle cx="39.5" cy="32.5" r="1" fill="#7dff8a"/>`,
  // Farm and kitchen
  garden_plot: tile(
    '#a0703f',
    '#8a5f3a',
    '#6b4a2a',
    `<path d="M9 20 L24 11.8 L39 20 L24 28.2 Z" fill="#6b4a2a" ${T}/>` +
      `<path d="M13.5 17.6 L28.5 25.8 M19 14.6 L34 22.8" stroke="#4a2e1a" stroke-width="1.6"/>` +
      sprout(18, 22) +
      sprout(30, 21) +
      sprout(24, 26),
  ),
  cooking_pot:
    steam([16, 26], 1) +
    rod('M14 38 L12 44 M34 38 L36 44', '#3a3a3a', 2.5) +
    rod('M9 20 C3 20 3 27 9 27 M39 20 C45 20 45 27 39 27', '#4a4d55', 2.5) +
    `<path d="M7 18 L41 18 C42 32 36 41 24 41 C12 41 6 32 7 18 Z" fill="#4a4d55" ${O}/>` +
    `<ellipse cx="24" cy="18" rx="17" ry="5" fill="#6d737a" ${O}/>` +
    `<ellipse cx="24" cy="18.5" rx="13.5" ry="3.3" fill="#d8803a"/>` +
    `<circle cx="19" cy="18" r="1.6" fill="#f0b070" ${T}/><circle cx="28" cy="19" r="1.2" fill="#f0b070" ${T}/>` +
    `<path d="M11 24 C11 30 13 34 17 37" fill="none" stroke="#7a7e88" stroke-width="2" stroke-linecap="round"/>`,
  // Defense
  spike_pit:
    `<path d="M3 25 L24 14 L45 25 L24 36 Z" fill="#8a6a4a" ${O}/>` +
    `<path d="M9 25 L24 17.5 L39 25 L24 32.5 Z" fill="#2e2318" ${T}/>` +
    (
      [
        [24, 21, 14],
        [17, 25, 15],
        [31, 25, 15],
        [21, 29, 15],
        [28, 29, 15],
      ] as [number, number, number][]
    )
      .map(
        ([x, y, h]) =>
          `<path d="M${x - 2.3} ${y} L${x} ${y - h} L${x + 2.3} ${y} Z" fill="#c9a46a" ${T}/>` +
          `<path d="M${x - 0.6} ${y - 1} L${x} ${y - h + 3}" stroke="#ecd6a8" stroke-width="1" stroke-linecap="round"/>`,
      )
      .join('') +
    `<path d="M6 27.5 L12 30.5 M36 30.5 L42 27.5" stroke="#a8885a" stroke-width="1.5" stroke-linecap="round"/>`,
};

/** A picture for an item or a building piece; unknown ids get a plain crate with a question mark. */
export function itemIconSvg(id: string): string {
  const body =
    ITEM_ICONS[id] ??
    PIECE_ICONS[id] ??
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

/** A gold star: XP popups and the level badge. */
export const STAR_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M24 4 L29.5 17.5 L44 18.5 L33 28 L36.5 42.5 L24 34.5 L11.5 42.5 L15 28 L4 18.5 L18.5 17.5 Z" fill="#ffd34a" ${O}/><path d="M24 11 L27.5 20 L20.5 20 Z" fill="#fff3b0"/></svg>`,
)}`;
