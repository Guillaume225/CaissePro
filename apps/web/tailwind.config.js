/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
          blue: '#4884BD',
          'blue-light': '#6A9FD0',
        },
        surface: {
          DEFAULT: '#F8F9FA',
          card: '#FFFFFF',
          hover: '#F1F3F5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

