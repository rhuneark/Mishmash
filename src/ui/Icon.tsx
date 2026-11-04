// Ink icons for the field-journal look: simple strokes on a 24 grid, drawn in the text colour
// and roughened by one shared SVG filter (InkDefs, rendered once by App) so they look drawn
// by hand. Item pictures stay in hud/itemIcons.ts; these are the buttons and labels.

const PATHS = {
  bag: '<path d="M8.5 6.5V5a3.5 3.5 0 0 1 7 0v1.5"/><path d="M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8.5 13.5h7v4h-7z"/>',
  hammer:
    '<path d="M5 19.5l8.5-8.5"/><path d="M10.5 8l4.2-4.2 5.5 5.5-4.2 4.2z"/><path d="M14.7 3.8l1.6-1.3"/>',
  run: '<circle cx="15.5" cy="4.5" r="1.9"/><path d="M13.5 8.5l-3.2 4.6 4 2.4-1.4 5.5"/><path d="M7.5 10.5l3.4-2.4 4.2.8 2.2 3.1"/><path d="M10.3 13.1l-3.8 3.6-2.5-.6"/>',
  hand: '<path d="M8 13V6.2a1.4 1.4 0 0 1 2.8 0V11"/><path d="M10.8 11V4.6a1.4 1.4 0 0 1 2.8 0V11"/><path d="M13.6 11V5.6a1.4 1.4 0 0 1 2.8 0V12"/><path d="M16.4 12V8.8a1.4 1.4 0 0 1 2.8 0v5.4c0 3.9-2.9 6.8-6.8 6.8h-.9c-2.6 0-4.4-1.3-5.8-3.4l-2.2-3.4a1.4 1.4 0 0 1 2.3-1.6L8 14.4"/>',
  fist: '<path d="M7 11V8.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 10V7.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 10V8a1.5 1.5 0 0 1 3 0v2.5"/><path d="M16 10.5a1.5 1.5 0 0 1 3 0V14c0 3.9-2.9 7-6.8 7h-.7C8.6 21 6 18.6 6 15.6V12a1.5 1.5 0 0 1 3 0"/>',
  swords:
    '<path d="M4 4l10 10M4 4h3.5l9.5 9.5M4 4v3.5l9.5 9.5"/><path d="M13 17l4-4M15 19l4-4M17.5 16.5l3 3"/><path d="M20 4L10 14"/>',
  bomb: '<circle cx="10.5" cy="14" r="6.5"/><path d="M15 9.5l2-2M17.5 6.5c.6-1.6 2-2.4 3.5-2"/><path d="M8 12a3 3 0 0 1 2.5-1.5"/>',
  eat: '<path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/><path d="M8.5 11h.01M15.5 11h.01"/><path d="M8.5 15c1.8 1.6 5.2 1.6 7 0"/><path d="M14.5 16.5c.4 1.4 1.6 2 2.6 1.5"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7.5h8M8 11h6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.6 2.6 3-.6.6 3 2.6 1.6-1.6 2.6 1.6 2.6-2.6 1.6-.6 3-3-.6L12 21.2l-1.6-2.6-3 .6-.6-3-2.6-1.6 1.6-2.6-1.6-2.6 2.6-1.6.6-3 3 .6z"/>',
  chat: '<path d="M4 5.5h16v10H10l-4.5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  turn: '<path d="M19 8.5A7.5 7.5 0 0 0 5.5 7"/><path d="M5 3.5V7.5h4"/><path d="M5 15.5A7.5 7.5 0 0 0 18.5 17"/><path d="M19 20.5v-4h-4"/>',
  shirt:
    '<path d="M8.5 3.5L3.5 6.5l2 4.5 2.5-1v10.5h8V10l2.5 1 2-4.5-5-3c-.5 1.6-1.8 2.6-3.5 2.6S9 5.1 8.5 3.5z"/>',
  trophy:
    '<path d="M8 3.5h8V9a4 4 0 0 1-8 0z"/><path d="M8 5.5H4.8a3.3 3.3 0 0 0 3.6 4.4M16 5.5h3.2a3.3 3.3 0 0 1-3.6 4.4"/><path d="M12 13v4M8.5 20.5h7M9.8 17h4.4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.3a2.7 2.7 0 1 1 3.8 2.5c-.8.4-1.2 1-1.2 1.9v.6"/><path d="M12 17.2v.1"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.6.6.8 1.4.8 2.4h6c0-1 .2-1.8.8-2.4A6 6 0 0 0 12 3z"/>',
  news: '<path d="M4 5h12.5v14H6.3A2.3 2.3 0 0 1 4 16.7z"/><path d="M16.5 9H20v8.5a1.5 1.5 0 0 1-3 0"/><path d="M7 8.5h6.5M7 12h6.5M7 15.5h4"/>',
  people:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.6 14.3A5 5 0 0 1 21 19"/>',
  key: '<circle cx="8" cy="15" r="4.2"/><path d="M11 12l8.5-8.5M16.5 6.5l2.2 2.2M14 9l2 2"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.2 3.2 14.8 0 18M12 3c-3.2 3.2-3.2 14.8 0 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  stack:
    '<path d="M3.5 8.5L12 4l8.5 4.5L12 13z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  heart:
    '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  food: '<path d="M14.5 3.2a6.3 6.3 0 0 1 .6 12.6c-1 0-2-.3-2.9-.8l-3 3a2.1 2.1 0 1 1-2.5 2.5 2.1 2.1 0 1 1-2.5-2.5l3-3a6.3 6.3 0 0 1 7.3-11.8z"/>',
  drop: '<path d="M12 3s6.2 7 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 10 12 3 12 3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  cloud: '<path d="M7 18.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6-1.3A4.6 4.6 0 0 1 17.5 18.5z"/>',
  rain: '<path d="M7 14.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6-1.3 4.6 4.6 0 0 1 .5 9.3z"/><path d="M8 17.5l-1 3M12 17.5l-1 3M16 17.5l-1 3"/>',
  storm:
    '<path d="M7 14.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6-1.3 4.6 4.6 0 0 1 .5 9.3z"/><path d="M12.5 13l-2.5 4h3l-2 4"/>',
  fog: '<path d="M4 9h12M7 12.5h13M4 16h11M8 19.5h9"/>',
  star: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  flame:
    '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-5.5-3.5-9.5-2.2 1.5-3 3.6-3 5.2-1-.6-1.6-1.8-1.6-3C7.6 9.4 6 11.8 6 15a6 6 0 0 0 6 6z"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  island:
    '<path d="M3 19.5c2-1 4-1 6 0s4 1 6 0 4-1 6 0"/><path d="M6 16.5c2-2.5 10-2.5 12 0"/><path d="M12 15V7"/><path d="M12 7c-1.5-2-4-2.5-6-1.5M12 7c1.5-2 4-2.5 6-1.5M12 7c-2 0-3.5 1.5-4 3.5M12 7c2 0 3.5 1.5 4 3.5"/>',
  pumpkin:
    '<path d="M12 7.5c-5 0-8 2.6-8 6.5s3 6.5 8 6.5 8-2.6 8-6.5-3-6.5-8-6.5z"/><path d="M12 7.5c-2 2-2 11 0 13M12 7.5c2 2 2 11 0 13"/><path d="M12 7.5c0-2 .5-3.5 2-4.5"/>',
  wrench:
    '<path d="M14.5 4a5 5 0 0 0-4.7 6.7L3.5 17a1.8 1.8 0 0 0 2.5 2.5l6.3-6.3A5 5 0 0 0 19 8.5l-3 3-2.5-.5-.5-2.5 3-3A5 5 0 0 0 14.5 4z"/>',
  map: '<path d="M3.5 6l5-2 7 2.5 5-2v14l-5 2-7-2.5-5 2z"/><path d="M8.5 4v14M15.5 6.5v14"/>',
  door: '<path d="M6 21V4h10v17"/><path d="M4 21h16"/><path d="M13 12.5h.01"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
} as const;

export type IconName = keyof typeof PATHS;

/** An ink icon (decorative: give the button around it a label). */
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`ink-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <g filter="url(#ink-wobble)" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
    </svg>
  );
}

/** The filter that makes ink strokes waver a little. Rendered once (App). */
export function InkDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="ink-wobble" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" />
        <feDisplacementMap in="SourceGraphic" scale="1.5" />
      </filter>
    </svg>
  );
}

/** Emoji the game's texts use for HUD buttons, drawn as the same ink icons. */
const INLINE: Record<string, IconName> = {
  '✋': 'hand',
  '🎒': 'bag',
  '🔨': 'hammer',
  '📖': 'book',
  '⚙️': 'gear',
  '🏃': 'run',
};
const INLINE_RE = /(✋|🎒|🔨|📖|⚙️|🏃)/;

/** A text with the HUD buttons' emoji drawn as their ink icons, so it matches the buttons. */
export function InkText({ text }: { text: string }) {
  if (!INLINE_RE.test(text)) return <>{text}</>;
  return (
    <>
      {text.split(INLINE_RE).map((part, i) => {
        const icon = INLINE[part];
        return icon ? <Icon key={i} name={icon} className="inline" /> : part;
      })}
    </>
  );
}
