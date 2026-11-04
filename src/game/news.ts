// What's new: a short note per update, shown once on the title screen after an update
// (players who just arrived don't get one) and kept under 📰 What's new. Newest first; the
// version is RUN's (each deploy counts up).

export interface News {
  version: string;
  title: string;
  items: string[];
}

export const NEWS: News[] = [
  {
    version: '1.31',
    title: 'The survivor’s journal',
    items: [
      'A new look for every menu: your survivor’s field journal, in ink and pencil on taped-in pages.',
      'Hand-drawn buttons in place of the old emoji, and a tidier title page.',
    ],
  },
  {
    version: '1.30',
    title: 'A new look for the island',
    items: [
      'Painted ground: meadow grass, rippled sand, leaf litter, pine needles, weathered rock and marsh mud, blending from one place to the next.',
      'The sea has turquoise shallows, foam on the shore and the sun glinting on it; lily pads float on the marsh pools.',
      'Rain soaks the ground, splashes and rings the water; storms bend the trees and cloud shadows drift over the island.',
      'Moonlit blue nights (purple on a Bloom night), survivors that stand out, and a wreck that smoulders for the first days.',
    ],
  },
  {
    version: '1.29',
    title: 'A faster start',
    items: [
      'The title screen comes up in about half the time: the island itself loads while you look at the menu.',
    ],
  },
  {
    version: '1.28',
    title: 'Strangers and outfits',
    items: [
      '🌍 Play with strangers: land on a public island with up to 3 other survivors. When its host leaves, the island goes on.',
      '👕 Wardrobe: hats and coats for your survivor. Some free, some earned with your records, three sets in the shop.',
      'Outfits are looks only: everyone on your island sees them, and they never change how you play.',
    ],
  },
  {
    version: '1.27',
    title: 'Daily goals and records',
    items: [
      'A daily goal for everyone, every day: do it for a care package and keep your 🔥 streak.',
      '🏆 Records: your best across every island, and leaderboards for days survived, Bloom slain and escapes.',
      'Daily reminders (turn them off in Settings › Gameplay). Never at night.',
    ],
  },
  {
    version: '1.26',
    title: 'Three islands, a quicker start',
    items: [
      'Keep up to three islands side by side: 🗂️ Your islands on the title screen.',
      'First time here? Start surviving drops you straight onto an island.',
      'Graphics step down by themselves on phones that struggle (Graphics: Auto).',
      'This What’s new card, so you never miss an update.',
    ],
  },
  {
    version: '1.25',
    title: 'Better starts',
    items: [
      'Every new island has twigs, loose stones and bushes right by the crash site.',
      'Survival basics: a step-by-step tracker with a pointer at the button to press.',
      'Click and drag to scroll every menu on PC; the menu button is a ⚙️ gear.',
    ],
  },
];

export const LATEST = NEWS[0] as News;

/** The note to show now, or null (seen already, or nothing new). */
export function unseenNews(seen: string): News | null {
  return seen === LATEST.version ? null : LATEST;
}
