// PC controls: which keys (and mouse buttons) do what. Players can rebind
// them in the menu; the table is saved in appStorage under KEYS_KEY.

export const KEYS_KEY = 'mishmash_keys';
export const MAX_BINDS = 3;

export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'sprint'
  | 'use'
  | 'eat'
  | 'drop'
  | 'turn'
  | 'quick'
  | 'bag'
  | 'craft'
  | 'journal'
  | 'map'
  | 'build'
  | 'snap'
  | 'hud'
  | 'chat'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4'
  | 'slot5'
  | 'slot6'
  | 'next'
  | 'prev'
  | 'zoomIn'
  | 'zoomOut';

export interface ActionDef {
  id: Action;
  label: string;
  group: 'Move' | 'Act' | 'Build' | 'Screens' | 'Hotbar' | 'Camera';
  def: string[];
}

export const ACTIONS: ActionDef[] = [
  { id: 'up', label: 'Move up', group: 'Move', def: ['KeyW', 'ArrowUp'] },
  { id: 'down', label: 'Move down', group: 'Move', def: ['KeyS', 'ArrowDown'] },
  { id: 'left', label: 'Move left', group: 'Move', def: ['KeyA', 'ArrowLeft'] },
  { id: 'right', label: 'Move right', group: 'Move', def: ['KeyD', 'ArrowRight'] },
  { id: 'sprint', label: 'Sprint (hold)', group: 'Move', def: ['ShiftLeft', 'ShiftRight'] },
  {
    id: 'use',
    label: 'Action: use, attack, place',
    group: 'Act',
    def: ['Space', 'KeyE', 'Mouse0'],
  },
  { id: 'eat', label: 'Eat or use what you hold', group: 'Act', def: ['KeyF'] },
  { id: 'drop', label: 'Drop what you hold', group: 'Act', def: ['KeyQ'] },
  { id: 'turn', label: 'Turn a building', group: 'Build', def: ['KeyR'] },
  { id: 'build', label: 'Build mode on/off', group: 'Build', def: ['KeyV'] },
  { id: 'snap', label: 'Snap to the grid on/off', group: 'Build', def: ['KeyG'] },
  { id: 'quick', label: 'Quick bag and craft', group: 'Screens', def: ['Tab'] },
  { id: 'bag', label: 'Bag', group: 'Screens', def: ['KeyI', 'KeyB'] },
  { id: 'craft', label: 'Crafting', group: 'Screens', def: ['KeyC'] },
  { id: 'journal', label: 'Journal', group: 'Screens', def: ['KeyJ'] },
  { id: 'map', label: 'Map', group: 'Screens', def: ['KeyM'] },
  { id: 'hud', label: 'Hide or show the HUD', group: 'Screens', def: ['KeyH'] },
  { id: 'chat', label: 'Chat (with friends)', group: 'Screens', def: ['Enter', 'NumpadEnter'] },
  { id: 'slot1', label: 'Hotbar 1', group: 'Hotbar', def: ['Digit1', 'Numpad1'] },
  { id: 'slot2', label: 'Hotbar 2', group: 'Hotbar', def: ['Digit2', 'Numpad2'] },
  { id: 'slot3', label: 'Hotbar 3', group: 'Hotbar', def: ['Digit3', 'Numpad3'] },
  { id: 'slot4', label: 'Hotbar 4', group: 'Hotbar', def: ['Digit4', 'Numpad4'] },
  { id: 'slot5', label: 'Hotbar 5', group: 'Hotbar', def: ['Digit5', 'Numpad5'] },
  { id: 'slot6', label: 'Hotbar 6', group: 'Hotbar', def: ['Digit6', 'Numpad6'] },
  { id: 'next', label: 'Next hotbar slot', group: 'Hotbar', def: ['WheelDown'] },
  { id: 'prev', label: 'Previous hotbar slot', group: 'Hotbar', def: ['WheelUp'] },
  { id: 'zoomIn', label: 'Camera closer', group: 'Camera', def: ['Equal', 'NumpadAdd'] },
  { id: 'zoomOut', label: 'Camera further', group: 'Camera', def: ['Minus', 'NumpadSubtract'] },
];

export const ACTION_IDS = ACTIONS.map((a) => a.id);

/** Keys the game keeps for itself: Escape closes screens and cancels rebinding. */
const RESERVED = new Set(['Escape']);

export type Bindings = Record<Action, string[]>;

export function defaultBindings(): Bindings {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, [...a.def]])) as Bindings;
}

const CODE =
  /^(Key[A-Z]|Digit[0-9]|Numpad\w+|Arrow(Up|Down|Left|Right)|F([1-9]|1[0-9]|2[0-4])|Mouse[0-4]|Wheel(Up|Down)|(Shift|Control|Alt|Meta)(Left|Right)|Space|Tab|Enter|Backspace|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|CapsLock|Insert|Delete|Home|End|PageUp|PageDown|IntlBackslash)$/;

/** Can this event code be bound to an action? */
export function bindable(code: string): boolean {
  return CODE.test(code) && !RESERVED.has(code);
}

/**
 * Bindings from saved (untrusted) data. Missing actions get their defaults, unknown codes
 * are dropped, and a key never does two things (the first action listed keeps it).
 */
export function parseBindings(raw: unknown): Bindings {
  const out = defaultBindings();
  if (!raw || typeof raw !== 'object') return out;
  const data = raw as Record<string, unknown>;
  for (const a of ACTIONS) {
    const list = data[a.id];
    if (!Array.isArray(list)) continue;
    out[a.id] = list
      .filter((c): c is string => typeof c === 'string' && bindable(c))
      .slice(0, MAX_BINDS);
  }
  const used = new Set<string>();
  for (const a of ACTIONS) {
    out[a.id] = out[a.id].filter((c) => {
      if (used.has(c)) return false;
      used.add(c);
      return true;
    });
  }
  return out;
}

/**
 * Puts `code` in slot `index` of an action. The key leaves whatever action had it, so one
 * key never does two things. Returns the new table and the action that lost the key.
 */
export function bind(
  b: Bindings,
  action: Action,
  index: number,
  code: string,
): { bindings: Bindings; took: Action | null } {
  if (!bindable(code) || index < 0 || index >= MAX_BINDS) return { bindings: b, took: null };
  const next = Object.fromEntries(ACTION_IDS.map((id) => [id, [...b[id]]])) as Bindings;
  let took: Action | null = null;
  for (const id of ACTION_IDS) {
    if (id === action) continue;
    const i = next[id].indexOf(code);
    if (i >= 0) {
      next[id].splice(i, 1);
      took = id;
    }
  }
  const list = next[action].filter((c) => c !== code);
  if (index >= list.length) list.push(code);
  else list[index] = code;
  next[action] = list.slice(0, MAX_BINDS);
  return { bindings: next, took };
}

/** Removes slot `index` of an action. */
export function unbind(b: Bindings, action: Action, index: number): Bindings {
  const next = { ...b, [action]: b[action].filter((_, i) => i !== index) };
  return next;
}

/** code → actions, for the input handler. */
export function reverse(b: Bindings): Map<string, Action[]> {
  const map = new Map<string, Action[]>();
  for (const id of ACTION_IDS) {
    for (const c of b[id]) {
      const list = map.get(c) ?? [];
      list.push(id);
      map.set(c, list);
    }
  }
  return map;
}

const NAMES: Record<string, string> = {
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  MetaLeft: 'Left Meta',
  MetaRight: 'Right Meta',
  Mouse0: 'Left click',
  Mouse1: 'Middle click',
  Mouse2: 'Right click',
  Mouse3: 'Mouse back',
  Mouse4: 'Mouse forward',
  WheelUp: 'Wheel up',
  WheelDown: 'Wheel down',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  CapsLock: 'Caps Lock',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadEnter: 'Num Enter',
  NumpadDecimal: 'Num .',
  IntlBackslash: '\\',
};

/** A short, readable name for a key code ('KeyW' → 'W', 'Mouse0' → 'Left click'). */
export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** The first keyboard key of an action, for hints ('' when it only has mouse binds). */
export function keyHint(b: Bindings, action: Action): string {
  const code = b[action].find((c) => !c.startsWith('Mouse') && !c.startsWith('Wheel'));
  return code ? keyLabel(code) : '';
}
