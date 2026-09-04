/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        tactical: {
          50: '#e6fff2',
          100: '#b3ffe0',
          200: '#80ffce',
          300: '#4dffbc',
          400: '#1affaa',
          500: '#00e693',
          600: '#00b374',
          700: '#008055',
          800: '#004d33',
          900: '#001a11',
        },
        radar: {
          50: '#e6f3ff',
          100: '#b3d9ff',
          200: '#80bfff',
          300: '#4da6ff',
          400: '#1a8cff',
          500: '#0073e6',
          600: '#005ab3',
          700: '#004080',
          800: '#00264d',
          900: '#000d1a',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        surface: {
          900: '#0a0e17',
          800: '#0f1623',
          700: '#151d2e',
          600: '#1b253a',
          500: '#212e45',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan-line': 'scanline 2s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 230, 147, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 230, 147, 0.6)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
