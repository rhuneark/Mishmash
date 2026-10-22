// Notes found on the island. They tell the story and point the way out.
// `{digit}` and `{pos}` are filled in for luggage tags from the island's seed.

export interface NoteDef {
  id: string;
  title: string;
  text: string;
  /** Reading it reveals these landmarks on the map. */
  reveals?: string[];
}

const list: NoteDef[] = [
  {
    id: 'boarding',
    title: 'Boarding pass, Flight MX207',
    text:
      'MX207 · Gate 4 · Seat 23C. On the back, in your own handwriting: "Remember to call home when you land."\n\n' +
      'The plane is in pieces. Nobody else is moving. The cockpit tore away towards the jungle to the north-west.',
    reveals: ['cockpit'],
  },
  {
    id: 'tag',
    title: 'Torn luggage tag',
    text:
      'A cargo tag, ripped in half. Written in marker by a baggage handler:\n\n' +
      '"HOLD LOCK · DIGIT {pos} OF 4 = {digit}"',
  },
  {
    id: 'captain',
    title: "Captain's log",
    text:
      'Instruments died over the reef. Something in the water lit up green as we came down.\n\n' +
      'Radio is dead. To call for help we need three things: the spare BATTERY in the cargo hold (the tail ' +
      'came down on the west coast), an ANTENNA (there is a radio tower on the peak, north-east), and a ' +
      'TRANSMITTER board (the research station in the eastern marsh will have one).\n\n' +
      'Build the radio on a workbench, then use the beacon at the tower.\n\n' +
      'They took Ellis first. He was dead. He got up anyway.',
    reveals: ['tail', 'tower', 'station'],
  },
  {
    id: 'manifest',
    title: 'Cargo manifest',
    text:
      'Hold container 2: medical, rope, rations, 1× aircraft battery (spare).\n\n' +
      'The hold lock takes four digits. The handlers tag every bag with one digit each: "so nobody has the whole code". ' +
      'The bags burst open in the crash. The tags will be near the fuselage.',
  },
  {
    id: 'memo',
    title: 'Tower maintenance memo',
    text:
      'KESSLER STATION RELAY · Staff only.\n\n' +
      'Clear the vines from the tower base every week. They grow back faster each time. ' +
      'Do not use the relay at night. Whatever is in the marsh hears it.\n\n' +
      'If you are reading this, the beacon still works. Bring a radio.',
  },
  {
    id: 'kessler',
    title: "Dr. Kessler's journal",
    text:
      'Day 41. Specimen M ("Mother") has rooted through the courtyard. It does not need sun. It needs the dead.\n\n' +
      'Day 44. The roots reach into the bodies and the bodies stand up. We call them husks. They avoid fire, ' +
      'but not always. Every seventh night the whole island blooms, and then nothing keeps them away.\n\n' +
      'Day 46. The transmitter is in the lab. Mother grows over the lab door. Burn her. Please.',
  },
  {
    id: 'specimen',
    title: 'Specimen notes',
    text:
      'Snapjaws: rooted, ambush in tall grass. Puffers: burst into spores (poison), kill them at range. ' +
      'Thornbacks: appear after a few nights. Fast. Do not run, fight near walls.\n\n' +
      'All of them burn. Sap + cloth makes a crude fire bomb.',
  },
  {
    id: 'castaway1',
    title: 'Diary of a castaway',
    text:
      'Third week here. Rules I learned the hard way:\n' +
      '1. Keep a fire lit at night. They will not step into its light.\n' +
      '2. Walls. Then spikes in front of the walls.\n' +
      '3. Fresh water pools in the meadows are safe. The sea is not drinkable.\n' +
      '4. Count the nights. The seventh one is different.',
  },
  {
    id: 'castaway2',
    title: 'Lookout notes',
    text:
      'From here you can see the tower on the peak. The marsh to the east glows at night.\n\n' +
      'I made a machete from the wreck. Scrap, wood, rope and a rag on a workbench. ' +
      'It is the only thing that cuts the Bloom vines.',
  },
];

export const NOTES: Record<string, NoteDef> = Object.fromEntries(list.map((n) => [n.id, n]));

/** The cargo lock code for an island: 4 digits from its seed. */
export function cargoCode(seed: number): string {
  let s = (seed ^ 0x5eed5eed) >>> 0;
  let code = '';
  for (let i = 0; i < 4; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    code += String((s >>> 16) % 10);
  }
  return code;
}

/** The text of a note, with tag digits filled in. */
export function noteText(noteId: string, seed: number, digit?: number): string {
  const note = NOTES[noteId];
  if (!note) return '';
  if (digit === undefined) return note.text;
  const code = cargoCode(seed);
  return note.text.replace('{pos}', String(digit + 1)).replace('{digit}', code[digit] ?? '?');
}
