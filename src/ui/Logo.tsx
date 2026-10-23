/** The game's name, styled like the store art: BLOOM over a pink ISLAND. */
export function Logo({ size = 'big' }: { size?: 'big' | 'small' }) {
  return (
    <h1 className={`brand ${size}`}>
      Bloom <span>Island</span>
    </h1>
  );
}
