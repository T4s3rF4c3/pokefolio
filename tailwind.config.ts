import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,js,jsx,mdx}',
    './components/**/*.{ts,tsx,js,jsx,mdx}',
    './lib/**/*.{ts,tsx,js,jsx,mdx}',
  ],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        ink: {
          950: '#06070d',
          900: '#0b0d18',
          800: '#11131f',
          700: '#181a28',
          600: '#222538',
          500: '#2c3046',
          400: '#444a66',
          300: '#6b7090',
          200: '#a7abc4',
          100: '#dadcec',
        },
        flame: {
          50: '#fff4ec',
          100: '#ffe2cc',
          200: '#ffbf91',
          300: '#ff9656',
          400: '#ff6b1f',
          500: '#ff4d0a',
          600: '#e23800',
          700: '#b32c00',
        },
        electric: {
          400: '#ffe24a',
          500: '#fdd000',
          600: '#e0b500',
        },
        psychic: {
          400: '#c089ff',
          500: '#9b53ff',
          600: '#7b2cff',
        },
        water: {
          400: '#52b6ff',
          500: '#2d8df5',
          600: '#1668d6',
        },
        grass: {
          400: '#5fd28a',
          500: '#23b362',
          600: '#0d8f48',
        },
        // Pokémon type color reference
        type: {
          fire: '#ff6b1f',
          water: '#2d8df5',
          grass: '#23b362',
          electric: '#fdd000',
          psychic: '#9b53ff',
          fighting: '#c0392b',
          darkness: '#3a3a4a',
          metal: '#9aa6b4',
          fairy: '#ff7ab6',
          dragon: '#6c5ce7',
          colorless: '#cfd2e0',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'energy-fire': 'linear-gradient(135deg, #ff4d0a 0%, #ffb347 100%)',
        'energy-water': 'linear-gradient(135deg, #1668d6 0%, #52b6ff 100%)',
        'energy-electric': 'linear-gradient(135deg, #e0b500 0%, #ffe24a 100%)',
        'energy-psychic': 'linear-gradient(135deg, #7b2cff 0%, #ff7ab6 100%)',
        'energy-grass': 'linear-gradient(135deg, #0d8f48 0%, #5fd28a 100%)',
        'holo-shimmer':
          'conic-gradient(from 215deg at 50% 50%, #ff4d0a 0deg, #fdd000 60deg, #5fd28a 120deg, #2d8df5 180deg, #9b53ff 240deg, #ff7ab6 300deg, #ff4d0a 360deg)',
      },
      keyframes: {
        'shimmer-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'shimmer-rotate': 'shimmer-rotate 6s linear infinite',
        'fade-up': 'fade-up 0.35s ease-out',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.04), 0 14px 40px -10px rgba(0,0,0,0.6)',
        'glow-flame': '0 0 0 1px rgba(255,107,31,0.35), 0 18px 60px -12px rgba(255,107,31,0.4)',
        'glow-electric': '0 0 0 1px rgba(253,208,0,0.35), 0 18px 60px -12px rgba(253,208,0,0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
