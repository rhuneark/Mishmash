import { Logo } from '../ui/Logo';

/** The welcome on first launch. */
interface Props {
  onPlay: () => void;
  onVote: () => void;
}

export const STEPS = [
  { icon: '🏝️', name: 'Play', text: 'Survive the island, alone or with friends.' },
  { icon: '🗳️', name: 'Vote', text: 'Everyone votes on what gets added next.' },
  { icon: '🔨', name: 'We build it', text: 'The winner lands in the next update.' },
];

export function Intro({ onPlay, onVote }: Props) {
  return (
    <div className="intro-screen first">
      <div className="scroll">
        <div className="intro">
          <Logo />
          <div>
            <h2 className="intro-title">A game the players build.</h2>
            <p className="intro-lead">
              It starts as a survival game: your plane goes down on an island overrun by the Bloom.
              Craft, build, survive the nights and find a way off, alone or with friends. What gets
              added next is up to you.
            </p>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.name} className="step">
                <span className={`step-icon tile-${i % 4}`} aria-hidden="true">
                  {s.icon}
                </span>
                <span className="step-text">
                  <b>
                    {i + 1}. {s.name}
                  </b>
                  <span>{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="intro-lead">Update by update, it becomes a mix of everyone's ideas.</p>
          <div className="card callout">
            <div className="label">Now voting</div>
            <p>What should we add to the island next? Boats? Farming? Pets? Storms? You decide.</p>
          </div>
        </div>
      </div>
      <div className="actions">
        <button className="btn primary" onClick={onPlay}>
          Play
        </button>
        <button className="btn" onClick={onVote}>
          Vote on what's next
        </button>
      </div>
    </div>
  );
}
