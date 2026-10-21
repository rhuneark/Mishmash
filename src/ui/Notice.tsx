import * as run from '../sdk/run';

export type NoticeReason = run.UgcFail | 'unclean' | 'held' | 'reported' | 'loadFailed';

export interface NoticeState {
  reason: NoticeReason;
  retryAfterMs?: number;
}

function textFor({ reason, retryAfterMs }: NoticeState): string {
  switch (reason) {
    case 'login':
      return 'Sign in to RUN to take part.';
    case 'rate': {
      const s = retryAfterMs ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0;
      return s ? `Whoa, slow down! Try again in ${s}s.` : 'Whoa, slow down! Try again in a moment.';
    }
    case 'flagged':
    case 'unclean':
      return "Let's keep it friendly. Try different words.";
    case 'held':
      return 'Your message is being checked and may not show up.';
    case 'full':
      return "You've reached the posting limit.";
    case 'reported':
      return 'Thanks, it has been reported and hidden for you.';
    case 'loadFailed':
      return "Couldn't reach the server. Retrying…";
    case 'error':
      return "Couldn't reach the server. Try again.";
  }
}

export function Notice({ state, onClose }: { state: NoticeState; onClose: () => void }) {
  return (
    <div className="notice" role="status">
      <span>{textFor(state)}</span>
      {state.reason === 'login' ? (
        <button className="btn small" onClick={() => void run.promptLogin().then(onClose)}>
          Sign in
        </button>
      ) : (
        <button className="notice-close" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}
