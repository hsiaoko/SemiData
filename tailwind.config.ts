import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Wafer Iridescent palette
        substrate: '#DCD9D2',
        surface: '#F4F2EC',
        'surface-2': '#EAE7DF',
        ink: '#15171B',
        'ink-2': '#3A3D44',
        'ink-3': '#6B6E76',
        cobalt: {
          DEFAULT: '#1B4FE3',
          dark: '#1640B8',
          light: '#3F6BEC',
        },
        irid: {
          pink: '#E63780',
          cyan: '#27B2C7',
        },
        bin: {
          s: '#1B4FE3', // S = cobalt
          a: '#3FAE6B', // A = jade
          b: '#E8A53C', // B = amber
          c: '#C24A4A', // C = vermilion
          d: '#8E5BAB', // D = violet (gradation step)
          fail: '#5A5A60', // FAIL = neutral
        },
        line: '#C9C5BB',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
        han: ['var(--font-han)', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.85rem', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
      boxShadow: {
        precise: '0 0 0 1px rgba(21,23,27,0.06)',
        card: '0 1px 0 rgba(21,23,27,0.04), 0 0 0 1px rgba(21,23,27,0.06)',
      },
      letterSpacing: {
        eyebrow: '0.18em',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.9' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        breathe: 'breathe 6s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
