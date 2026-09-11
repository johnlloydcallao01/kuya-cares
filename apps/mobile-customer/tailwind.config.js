/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  // NativeWind v2.0.11 Enterprise Configuration
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7e6',
          100: '#fdecc0',
          200: '#fbd896',
          300: '#f9c46b',
          400: '#f7b04b',
          500: '#f3a823', // Your orange brand color
          600: '#e89a1f',
          700: '#d18a1a',
          800: '#ba7a16',
          900: '#9a5f0f',
        },
        // Enterprise-grade color palette
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      },
      fontFamily: {
        // Enterprise typography
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['SF Mono', 'Monaco', 'monospace'],
      },
      spacing: {
        // Enterprise spacing scale
        '18': '4.5rem',
        '88': '22rem',
      }
    },
  },
  plugins: [],
}

