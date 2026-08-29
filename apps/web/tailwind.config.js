/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#062A5A',
          foreground: '#E2E8F0',
          accent: '#0D3A72',
          border: '#0F4480',
        },
        brand: {
          gold: '#EA761D',
          'gold-light': '#F09A52',
          'gold-dark': '#E87017',
          'gold-hover': '#C05200',
          navy: '#062A5A',
          orange: '#EA761D',
          blue: '#4884BD',
          'blue-light': '#6A9FD0',
        },
        ink: {
          strong: '#0a2540',
          secondary: '#697386',
          tertiary: '#aab7c4',
        },
        surface: {
          DEFAULT: '#F8F9FA',
          card: '#FFFFFF',
          hover: '#F1F3F5',
        },
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#EA761D',
          600: '#EA761D',
          700: '#C05200',
          800: '#9A3412',
          900: '#7C2D12',
          950: '#431407',
        },
        navy: {
          50: '#EEF3FB',
          100: '#D5E0F3',
          200: '#ABBFE8',
          300: '#7E9DD9',
          400: '#527CC9',
          500: '#2F5BAE',
          600: '#1A428A',
          700: '#062A5A',
          800: '#041E3F',
          900: '#021226',
          950: '#010913',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tighter: '-0.02em',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
