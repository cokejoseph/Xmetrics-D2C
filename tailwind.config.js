/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          950: '#0A1F5C',
          900: '#0F2E7A',
          800: '#1240A8',
          700: '#1048C4',
          600: '#1658E3',
          500: '#2D6BF0',
          400: '#5B8EF0',
          300: '#93B8F8',
          200: '#C7DBFD',
          100: '#E0ECFF',
          50:  '#EEF4FF',
        },
        sidebar: {
          bg:           '#FFFFFF',
          hover:        '#F5F7FF',
          active:       '#EFF6FF',
          text:         '#6B7280',
          'text-active':'#2563EB',
        },
        page: {
          bg: '#F8F9FB',
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
        card:       '0 1px 3px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.05)',
        'card-hover':'0 4px 20px rgba(22,88,227,0.12)',
        dropdown:   '0 8px 30px rgba(0,0,0,0.14)',
        'glow-sm':  '0 0 0 3px rgba(22,88,227,0.15)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #172554 0%, #1E40AF 50%, #0C4A6E 100%)',
        'card-gradient':  'linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)',
      },
    },
  },
  plugins: [],
}
