// Schedules the daily reminders (game/reminders.ts) after each visit and each game: the old
// schedule goes, a new one comes, unless the player turned them off in Settings.

import * as run from '../sdk/run';
import { REMINDER_IDS, reminderPlan } from '../game/reminders';
import { prefs } from './prefs';
import { loadRecords } from './records';
import { describeSave, loadIsland, playerId } from './session';

let chain: Promise<void> = Promise.resolve();

export function planReminders(): void {
  chain = chain.then(async () => {
    await run.ready();
    await run.cancelReminders(REMINDER_IDS);
    if (!prefs.get().reminders) return;
    const records = await loadRecords();
    const save = await loadIsland();
    const info = save ? describeSave(save, playerId()) : null;
    const now = Date.now();
    const plan = reminderPlan(
      {
        island: info && !info.escaped ? { name: info.name, day: info.day } : null,
        daily: records.daily,
      },
      now,
      -new Date().getTimezoneOffset(),
      run.isWeb(),
    );
    await run.scheduleReminders(
      plan.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        delaySeconds: (r.at - now) / 1000,
      })),
    );
  });
}
