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
        sans: ['Space Grotesk', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        teal: {
          50:  '#effefb',
          100: '#c7fff4',
          200: '#90ffe9',
          300: '#51f7da',
          400: '#2dd4a8',
          500: '#0d9e80',
          600: '#087f68',
          700: '#0b6554',
          800: '#0d4f4f',
          900: '#0f3d3d',
        },
        coral: {
          50:  '#fef3f2',
          100: '#fde4e1',
          200: '#fdcdc8',
          300: '#fbaba2',
          400: '#e8614d',
          500: '#d94a36',
          600: '#c13525',
          700: '#a22b1d',
          800: '#86271c',
          900: '#70261e',
        },
        lime: {
          50:  '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#84cc16',
          500: '#65a30d',
          600: '#4d7c0f',
          700: '#3f6212',
          800: '#365314',
          900: '#1a2e05',
        },
        sage: {
          50:  '#f4f7f5',
          100: '#e0ebe4',
          200: '#c2d6ca',
          300: '#9bb9a6',
          400: '#7a9a8e',
          500: '#577b6e',
          600: '#436257',
          700: '#374f47',
          800: '#2e413b',
          900: '#273732',
        },
        base: {
          950: '#060F0F',
          900: '#0A1A1A',
          800: '#0E2424',
          700: '#122E2E',
          600: '#1A3C3C',
          500: '#245050',
          400: '#2F6464',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan-line': 'scanline 2s linear infinite',
        'radar-spin': 'radarSpin 4s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(45, 212, 168, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(45, 212, 168, 0.6)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        radarSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
