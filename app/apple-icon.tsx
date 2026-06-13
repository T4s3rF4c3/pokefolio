import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Apple expects an opaque PNG. We render the PokeballMark on top of the same
// dark background the app's chrome uses so it sits nicely on the home screen.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at 30% 25%, #1c1f2f 0%, #06070d 75%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <svg width="140" height="140" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="f" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#ff4d0a" />
              <stop offset="100%" stopColor="#ff9656" />
            </linearGradient>
            <linearGradient id="d" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1c1f2f" />
              <stop offset="100%" stopColor="#0c0e18" />
            </linearGradient>
            <radialGradient id="s" cx="35%" cy="30%" r="40%">
              <stop offset="0%" stopColor="white" stopOpacity="0.7" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill="url(#d)" />
          <path d="M2 32 a30 30 0 0 1 60 0 z" fill="url(#f)" />
          <rect x="2" y="29" width="60" height="6" fill="#06070d" />
          <circle cx="32" cy="32" r="8" fill="#06070d" stroke="#dadcec" strokeWidth="2.2" />
          <circle cx="32" cy="32" r="3.4" fill="#dadcec" />
          <circle cx="22" cy="20" r="9" fill="url(#s)" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
