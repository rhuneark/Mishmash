// Links out of the game. RUN runs the game in a sandbox that blocks new windows,
// and the SDK has no call to open an outside page, so the game copies a link for
// the player to paste into their browser (and shows it to copy by hand).

export const JAM_URL = 'https://run.world/jams/octoberjam?game=7VPvCLP7URUp69R6K10O';

/** Copies text to the clipboard; false when that isn't allowed here. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older hosts: copy from a selected text box.
    try {
      const box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand('copy');
      box.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
