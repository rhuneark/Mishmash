import { Logo } from '../ui/Logo';

interface Props {
  /** First launch: the full-screen welcome. Otherwise the About tab. */
  first?: boolean;
  onVote: () => void;
  onChat: () => void;
}

const STEPS = [
  { icon: '💡', name: 'Suggest', text: 'Pitch ideas in the Town Square chat.' },
  { icon: '🗳️', name: 'Vote', text: 'Everyone votes on what gets added next.' },
  { icon: '🔨', name: 'We build it', text: 'The winner lands in the next update.' },
];

export function Intro({ first = false, onVote, onChat }: Props) {
  return (
    <div className={`intro-screen${first ? ' first' : ''}`}>
      <div className="scroll">
        <div className="intro">
          <Logo size={first ? 'big' : 'small'} />
          <div>
            <h2 className="intro-title">This game doesn't exist yet.</h2>
            <p className="intro-lead">You're going to help build it.</p>
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
          <p className="intro-lead">Update by update, it becomes a mishmash of everyone's ideas.</p>
          <div className="card callout">
            <div className="label">First up</div>
            <p>
              What should Mishmash be at its core? An action RPG? A story? A platformer? You decide.
            </p>
          </div>
        </div>
      </div>
      <div className="actions">
        <button className="btn primary" onClick={onVote}>
          Vote on the base
        </button>
        <button className="btn" onClick={onChat}>
          Say hi in chat
        </button>
      </div>
    </div>
  );
}
