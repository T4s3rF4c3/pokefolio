type Props = { className?: string };

/**
 * Stylized pokéball lock-up. Uses currentColor for the dark hemisphere
 * so it can adapt to surface contrast. Not a Pokémon trademark logo —
 * a generic round-with-band motif sized for sidebar use.
 */
export default function PokeballMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Pokéfolio mark"
    >
      <defs>
        <linearGradient id="pf-flame" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ff4d0a" />
          <stop offset="100%" stopColor="#ff9656" />
        </linearGradient>
        <linearGradient id="pf-dark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1c1f2f" />
          <stop offset="100%" stopColor="#0c0e18" />
        </linearGradient>
        <radialGradient id="pf-shine" cx="35%" cy="30%" r="40%">
          <stop offset="0%" stopColor="white" stopOpacity="0.7" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#pf-dark)" />
      <path
        d="M2 32 a30 30 0 0 1 60 0 z"
        fill="url(#pf-flame)"
      />
      <rect x="2" y="29" width="60" height="6" fill="#06070d" />
      <circle cx="32" cy="32" r="8" fill="#06070d" stroke="#dadcec" strokeWidth="2.2" />
      <circle cx="32" cy="32" r="3.4" fill="#dadcec" />
      <circle cx="22" cy="20" r="9" fill="url(#pf-shine)" />
    </svg>
  );
}
