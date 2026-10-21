// Playwright playthrough of the local preview at phone sizes. Start `npm run dev`
// first (or set PLAYTHROUGH_URL). Prints "clean" when every check passes.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.PLAYTHROUGH_URL ?? 'http://localhost:5173/';
const SHOTS = 'playthrough-shots';
const VIEWPORTS = [
  [375, 667],
  [390, 844],
];

mkdirSync(SHOTS, { recursive: true });
const failures = [];
const check = (ok, what) => {
  if (!ok) failures.push(what);
};

const browser = await chromium.launch();
for (const [width, height] of VIEWPORTS) {
  const tag = `${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${tag}-${name}.png` });
  const noSideScroll = async (where) =>
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${tag} ${where}: sideways scroll`,
    );
  const totalVotes = async () =>
    Number((await page.getByText(/votes? so far/).textContent()).match(/\d+/)[0]);

  // Intro on first launch.
  await page.goto(URL);
  await page.getByText("This game doesn't exist yet.").waitFor();
  await noSideScroll('intro');
  await shot('1-intro');
  const voteButton = page.getByRole('button', { name: 'Vote on the base' });
  const box = await voteButton.boundingBox();
  check(box && box.y + box.height <= height, `${tag} intro: vote button below the fold`);
  await voteButton.click();

  // One vote per person: the local stand-in seeds 14 vote entries from 13 voters
  // (one voted twice), so 13 count. Voting adds one; moving it adds none.
  await page.getByText(/votes? so far/).waitFor();
  const before = await totalVotes();
  check(before === 13, `${tag} vote: a second vote by one person was counted (${before})`);
  await page.getByRole('button', { name: /Roguelike/ }).click();
  await page.getByRole('button', { name: /Roguelike.*Your vote/ }).waitFor();
  check((await totalVotes()) === before + 1, `${tag} vote: total did not go up by one`);
  await page.getByRole('button', { name: /Action RPG/ }).click();
  await page.getByRole('button', { name: /Action RPG.*Your vote/ }).waitFor();
  check((await totalVotes()) === before + 1, `${tag} change vote: total changed`);
  check((await page.locator('.option.picked').count()) === 1, `${tag} vote: not exactly one pick`);
  await noSideScroll('vote');
  await shot('2-vote');
  check(
    (await page.getByRole('button', { name: 'Dev', exact: true }).count()) === 0,
    `${tag} a player sees the Dev tab`,
  );

  // Chat: post, delete, report, and the friendly-words filter.
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await page.getByText('ARPG with loot please').waitFor();
  const input = page.getByLabel('Message');
  await input.fill('  hello   from the playthrough  ');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText('hello from the playthrough').waitFor();
  check((await input.inputValue()) === '', `${tag} chat: draft not cleared`);
  await noSideScroll('chat');
  await shot('3-chat');
  await page.getByText('hello from the playthrough').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByText('hello from the playthrough').waitFor({ state: 'detached' });
  // Players can delete only their own messages; others' can only be reported.
  await page.getByText('ARPG with loot please').click();
  await page.getByRole('button', { name: 'Report' }).waitFor();
  check(
    (await page.getByRole('button', { name: 'Delete' }).count()) === 0,
    `${tag} chat: a player can delete someone else's message`,
  );
  await page.getByRole('button', { name: 'Report' }).click();
  await page.getByText('ARPG with loot please').waitFor({ state: 'detached' });
  await page.getByText('reported and hidden').waitFor();
  await input.fill('this is a badword');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText("Let's keep it friendly").waitFor();
  check(
    (await page.getByText('this is a badword').count()) === 0,
    `${tag} chat: unclean message posted`,
  );

  // About repeats the intro; a reload skips it.
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await page.getByText("This game doesn't exist yet.").waitFor();
  await noSideScroll('about');
  await page.waitForTimeout(400); // the mock writes appStorage after ~100 ms
  await page.reload();
  await page.getByText(/votes? so far/).waitFor();
  check(
    (await page.getByText("This game doesn't exist yet.").count()) === 0,
    `${tag} intro shown again`,
  );

  // The game's owner (?owner plays the owner in the local preview) can delete
  // anyone's message.
  await page.goto(`${URL}?owner`);
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await page.getByText('first! what is this game going to be?').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByText('first! what is this game going to be?').waitFor({ state: 'detached' });

  // Dev area (owner only): the seeded spam was hidden by 3 reports, Bram's message
  // has one open report. Delete the spam, keep Bram's, then both are resolved.
  const devTab = page.getByRole('button', { name: 'Dev', exact: true });
  await page.locator('.tab-badge', { hasText: '2' }).waitFor();
  await devTab.click();
  const spamCard = page.locator('.flag', { hasText: 'FREE GOLD click my profile' });
  const bramCard = page.locator('.flag', { hasText: 'a roguelike where every run' });
  await spamCard.waitFor();
  check(
    (await spamCard.getByText('Hidden from players').count()) === 1,
    `${tag} dev: hidden message not marked hidden`,
  );
  check(
    (await spamCard.getByText('rundot ugc approve').count()) === 1,
    `${tag} dev: no restore command for a hidden message`,
  );
  await noSideScroll('dev');
  await shot('4-dev');
  await spamCard.getByRole('button', { name: 'Delete message' }).click();
  await spamCard.waitFor({ state: 'detached' });
  await bramCard.getByRole('button', { name: 'Keep' }).click();
  await page.getByText('No open reports').waitFor();
  check((await page.locator('.tab-badge').count()) === 0, `${tag} dev: badge after clearing`);
  await page.getByRole('tab', { name: 'Resolved' }).click();
  await spamCard.getByText('Resolved: deleted').waitFor();
  await bramCard.getByText('Resolved: kept').waitFor();
  // Kept messages stay in the chat; deleted ones don't.
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await page.getByText('a roguelike where every run').waitFor();
  check(
    (await page.getByText('FREE GOLD click my profile').count()) === 0,
    `${tag} dev: deleted message still in chat`,
  );

  check(errors.length === 0, `${tag} console errors: ${errors.join(' | ')}`);
  console.log(`${tag}: done`);
  await context.close();
}
await browser.close();

if (failures.length) {
  console.log(`FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('clean');
