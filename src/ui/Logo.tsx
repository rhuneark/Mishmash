const LETTERS = 'MISHMASH'.split('');

export function Logo({ size = 'big' }: { size?: 'big' | 'small' }) {
  return (
    <h1 className={`wordmark ${size}`} aria-label="Mishmash">
      {LETTERS.map((letter, i) => (
        <span key={i} className={`tile tile-${i % 4}`} aria-hidden="true">
          {letter}
        </span>
      ))}
    </h1>
  );
}
