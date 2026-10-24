// Notes found on the island. They tell the story and point the way out.
// `{digit}` and `{pos}` are filled in for luggage tags from the island's seed.
//
// The story: under the island's marsh lives one root colony, "Specimen M",
// older than its trees. Verdance Biotech built Kessler Station to study it
// (Project Perennial): its sap heals, and it makes the dead walk. It took the
// staff, their dogs, the marsh. Verdance ordered the island kept dark, so the
// relay on the peak jams every signal for miles: that is what brought Flight
// MX207 down. Every seventh night the colony blooms and nothing scares it.

import { turnDirections, type IslandParts } from '../islands';
import { bloomOrdinal } from '../rules';
import { bunkerCode, hullNumber } from './secrets';

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
      'All of them burn. Sap + cloth makes a crude fire bomb.\n\n' +
      'Field kit, page 2: their parts are better than anything we brought. Snapjaw teeth, Husk ' +
      'tendrils, Thornback plates, unburst spore sacs. Bolt a workbench to a rack of them and you have ' +
      'what the techs called a mashbench.',
  },
  {
    id: 'diary31a',
    title: 'Passenger diary, seat 31A',
    text:
      'The man in 31B has a Verdance Biotech badge and has not stopped sweating since we took off. ' +
      '"They never fly this route," he keeps saying. "Not over the island."\n\n' +
      'The screens just went dark. The sea under us is glowing green.',
  },
  {
    id: 'transcript',
    title: 'Last radio transcript',
    text:
      'MX207: Mayday, mayday, all frequencies static, instruments failing.\n' +
      'MX207: We have a carrier on every band. It is coming from the island. Somebody is jamming us.\n' +
      'MX207: Only 121.5 is clear. No answer on 121.5.\n\n' +
      '(The recording ends in a long scrape of metal.)',
  },
  {
    id: 'briefing',
    title: 'Project Perennial: staff briefing',
    text:
      'VERDANCE BIOTECH · KESSLER STATION · CONFIDENTIAL\n\n' +
      'Specimen M is a single regenerative root colony under the marsh. Its sap heals tissue in minutes. ' +
      'It also reanimates dead tissue it reaches.\n\n' +
      'Rules: do not bury the dead. Report every bite. Torches are mandatory after dusk. Every seventh ' +
      'night the station goes into lockdown: no exceptions.',
  },
  {
    id: 'directive',
    title: 'Verdance directive 7',
    text:
      'Effective immediately: the site relay runs continuous broadband suppression. No signal leaves ' +
      'the island, no aircraft or vessel is to locate it. Emergency band 121.5 stays open for station ' +
      'use only.\n\nStaff evacuation request: DENIED. Project Perennial continues.',
  },
  {
    id: 'relaylog',
    title: 'Relay log',
    text:
      'KESSLER RELAY · solar\n' +
      'Jammer: ACTIVE · uptime 2,413 days\n' +
      'Emergency band 121.5: OPEN\n' +
      'Beacon: STANDBY (no handset fitted. Needs a radio: battery, antenna, transmitter)',
  },
  // Dr. Kessler's research journal, page by page: the Husks still carry the pages.
  {
    id: 'page_1',
    title: "Dr. Kessler's research, page 1",
    text:
      'Verdance sent us here for one reason. Under the marsh lies a single root organism the size of ' +
      'the island, older than its trees. The survey team called it Specimen M.\n\n' +
      'Its sap closes a wound in minutes. The board calls it Project Perennial: a plant that does not ' +
      'die, and maybe a cure for everything that does.',
  },
  {
    id: 'page_2',
    title: "Dr. Kessler's research, page 2",
    text:
      'We gave a dead lab rat to a root sample. Six hours later the rat walked. Threads through every ' +
      'vein, a small white flower in each eye. It does not eat. It does not sleep. It walks towards ' +
      'warmth and noise.\n\nThe board sent champagne. I did not drink it.',
  },
  {
    id: 'page_3',
    title: "Dr. Kessler's research, page 3",
    text:
      'The colony has a rhythm. Every seventh night its sap rises, every root wakes and the whole ' +
      'marsh glows. The instruments call it a bloom.\n\nOn those nights it is not afraid of anything. ' +
      'We sleep in the bunker with the doors bolted.',
  },
  {
    id: 'page_4',
    title: "Dr. Kessler's research, page 4",
    text:
      'Fire is the only thing it respects. The sap burns hot and fast, and the roots remember. The ' +
      'growths will not cross a lit fire line, so we carry torches everywhere now.\n\nExcept on the ' +
      'seventh night. Then fire only makes it angry.',
  },
  {
    id: 'page_5',
    title: "Dr. Kessler's research, page 5",
    text:
      'Marco fell from the relay tower. We buried him at the edge of the marsh, like idiots. Three ' +
      'days later he knocked on the bunker door. Flowers in his eyes. He still wore his badge.\n\n' +
      'We call them husks now, so we do not have to say their names.',
  },
  {
    id: 'page_6',
    title: "Dr. Kessler's research, page 6",
    text:
      'The guard dogs went into the marsh after Marco and came back plated and thorned, twice the ' +
      'size. The roots grow armour on what they keep. The puffers are its seed pods. The snapjaws ' +
      'grow where the dead lay down.\n\nEverything here is one thing. Everything here is Mother.',
  },
  {
    id: 'page_7',
    title: "Dr. Kessler's research, page 7",
    text:
      "Verdance's last message: keep the island dark. The relay on the peak now jams every radio and " +
      'radar for sixty miles, so no ship or plane ever finds us. Only the emergency band gets ' +
      'through, and only from the beacon.\n\nThey are not coming. They never meant to.',
  },
  {
    id: 'page_8',
    title: "Dr. Kessler's research, page 8",
    text:
      'Mother has grown over the lab, the transmitter, all of it. If you are reading this, a plane ' +
      'came down because of our jammer, and I am sorry.\n\nBattery from your cargo, antenna from the ' +
      'relay, transmitter from her roots. Build a radio. Burn her. Use what she grows against her: ' +
      'her parts make better tools than anything we had.\n\n— Ilse Kessler',
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

// Secrets (secrets.ts): the bunker, the survey markers, the shipwreck, treasure maps.
list.push(
  {
    id: 'bunkersign',
    title: 'Verdance shelter sign',
    text:
      'VERDANCE BIOTECH · EMERGENCY SHELTER B\n\n' +
      'Door power from the generator. Diesel, or anything that burns hot. (Field note in marker: ' +
      '"three jars of the green sap run it for a week.")\n\n' +
      'Access code: one digit on each survey marker, A to D, around the island. Staff, memorise ' +
      'your marker.',
    reveals: ['marker_a', 'marker_b', 'marker_c', 'marker_d'],
  },
  {
    id: 'marker',
    title: 'Survey marker',
    text:
      'A concrete post with a brass plate, green with age:\n\n' +
      '"VERDANCE BIOTECH · SURVEY POINT {letter}\nSHELTER B ACCESS · DIGIT {pos} OF 4 = {digit}"',
  },
  {
    id: 'shelterlog',
    title: 'Shelter terminal',
    text:
      'SHELTER B · LAST ENTRY\n\n' +
      'The roots came in through the air vents on the ninth night. Ravi went up to seal them and ' +
      'did not come back down. We are leaving for the station at dawn.\n\n' +
      'The seed vault stays sealed for whoever comes next. Plant it. Fence it. The Bloom eats ' +
      'everything else on this island, but it leaves a watered field alone.\n\n' +
      'Supply cache coordinates are on the survey map in the locker.',
  },
  {
    id: 'wrecklog',
    title: 'Log of the Marisol',
    text:
      'MV Marisol, freighter. Ran aground on the reef with every instrument dead. The radio only ' +
      'hisses. Crew is going ashore to find whoever runs that relay on the peak.\n\n' +
      'The hold floods at high water. Low water from four to eight, morning and evening; the hold ' +
      'is dry then.\n\n' +
      "The owners' idea of security: the safe opens to the hull number, backwards. — Capt. Ferrer",
  },
  {
    id: 'hullplate',
    title: "The Marisol's bow",
    text: 'Painted on the bow in tall white letters, flaking in the salt:\n\n"MARISOL · HULL No. {hull}"',
  },
  {
    id: 'treasure_1',
    title: "Captain Ferrer's map",
    text:
      'A chart of the island in pencil, with an X and a note: "The crew\'s wages. Buried where ' +
      'the owners will never look."\n\nThe X is marked on your map. Bring a shovel.',
  },
  {
    id: 'treasure_2',
    title: 'Verdance survey map',
    text:
      'A survey map from the shelter locker. One spot is circled in red: "SUPPLY CACHE (BURIED)".' +
      '\n\nThe X is marked on your map. Bring a shovel.',
  },
  {
    id: 'treasure_3',
    title: 'Message in a bottle',
    text:
      '"If you find this, we didn\'t make it off. We buried what we had left. Use it."\n\n' +
      'A little map is drawn on the back. The X is marked on your map. Bring a shovel.',
  },
  {
    id: 'treasure_4',
    title: 'Message in a bottle',
    text:
      '"Day 60. Hid the good stuff from the others. Sorry, Jules." A map, drawn with charcoal.' +
      '\n\nThe X is marked on your map. Bring a shovel.',
  },
  {
    id: 'treasure_5',
    title: 'Message in a bottle',
    text:
      'A child\'s drawing of the island: a tree, a rock, a big X. "Pirate treasure!!" it says ' +
      'in crayon.\n\nThe X is marked on your map. Bring a shovel.',
  },
  {
    id: 'bottle_letter',
    title: 'Message in a bottle',
    text:
      '"To whoever is out there: the lights in the marsh are not fireflies. Keep a fire lit. ' +
      'Count the nights. And if you see a plane, wave."',
  },
);

export const NOTES: Record<string, NoteDef> = Object.fromEntries(list.map((n) => [n.id, n]));

/** Research pages Husks drop, in order (their ids are also what the journal stores). */
export const PAGES = list.filter((n) => n.id.startsWith('page_')).map((n) => n.id);

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

/** How the island differs from the classic one (layout and how often the Bloom comes). */
export interface NoteWorld {
  parts: IslandParts;
  bloomEvery: number;
}

/**
 * The text of a note, with tag digits filled in, directions turned with the island's
 * layout and the Bloom night ("every seventh night") as the island's rules have it.
 */
export function noteText(noteId: string, seed: number, digit?: number, world?: NoteWorld): string {
  const note = NOTES[noteId];
  if (!note) return '';
  let text = note.text;
  if (digit !== undefined) {
    const code = noteId === 'marker' ? bunkerCode(seed) : cargoCode(seed);
    text = text
      .replace('{pos}', String(digit + 1))
      .replace('{digit}', code[digit] ?? '?')
      .replace('{letter}', 'ABCD'[digit] ?? '?');
  }
  if (noteId === 'hullplate') text = text.replace('{hull}', hullNumber(seed));
  if (!world) return text;
  const nth = bloomOrdinal(world.bloomEvery);
  return turnDirections(text, world.parts)
    .replace(/\bseventh\b/g, nth)
    .replace(/\bSeventh\b/g, nth[0]?.toUpperCase() + nth.slice(1));
}
