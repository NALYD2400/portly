/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#07070c',
        card: '#0e0e1a',
        cardBorder: 'rgba(255, 255, 255, 0.08)',
        primary: {
          DEFAULT: '#a855f7',
          hover: '#9333ea',
          light: 'rgba(168, 85, 247, 0.15)',
        },
        accent: {
          cyan: '#38bdf8',
          pink: '#f472b6',
          green: '#4ade80',
          yellow: '#facc15',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(168, 85, 247, 0.7)' },
        }
      }
    },
  },
  plugins: [],
}
