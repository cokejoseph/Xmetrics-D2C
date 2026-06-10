/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#1E1B4B',
          800: '#312E81',
          700: '#3730A3',
          600: '#4F46E5',
          500: '#6366F1',
          400: '#818CF8',
          300: '#A5B4FC',
          200: '#C7D2FE',
          100: '#E0E7FF',
          50:  '#EEF2FF',
        },
        sidebar: {
          bg:           '#000000',
          hover:        '#1a1a1a',
          active:       '#252525',
          text:         '#9CA3AF',
          'text-active':'#FFFFFF',
        },
        page: {
          bg: '#F7F8FC',
        },
        severity: {
          critical: '#ef4444',
          high:     '#f97316',
          medium:   '#eab308',
          low:      '#22c55e',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card:       '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        'card-hover':'0 4px 20px rgba(79,70,229,0.12)',
        dropdown:   '0 8px 30px rgba(0,0,0,0.14)',
        'glow-sm':  '0 0 0 3px rgba(79,70,229,0.15)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #2E1065 100%)',
        'card-gradient':  'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
      },
    },
  },
  plugins: [],
}
