/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          950: '#172554',
          900: '#1E3A8A',
          800: '#1E40AF',
          700: '#1D4ED8',
          600: '#2563EB',
          500: '#3B82F6',
          400: '#60A5FA',
          300: '#93C5FD',
          200: '#BFDBFE',
          100: '#DBEAFE',
          50:  '#EFF6FF',
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
        'card-hover':'0 4px 20px rgba(37,99,235,0.12)',
        dropdown:   '0 8px 30px rgba(0,0,0,0.14)',
        'glow-sm':  '0 0 0 3px rgba(37,99,235,0.15)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #172554 0%, #1E40AF 50%, #0C4A6E 100%)',
        'card-gradient':  'linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)',
      },
    },
  },
  plugins: [],
}
