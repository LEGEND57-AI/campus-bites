/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {

      // 🔤 FONTS
      fontFamily: {
        sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },

      // 🎨 COLOR SYSTEM (IMPORTANT)
      colors: {
        primary: '#3B82F6',     // main blue
        secondary: '#6366F1',   // indigo
        accent: '#06B6D4',      // cyan

        dark: '#0F172A',
        soft: '#F1F5F9',

        // optional detailed shades
        blue: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
      },

      // ✨ ANIMATIONS
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-up': 'fadeUp 0.6s ease',
        'scale-up': 'scaleUp 0.3s ease',
        'shimmer': 'shimmer 2s linear infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleUp: {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },

      // 🌈 GRADIENTS (VERY IMPORTANT)
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
        'accent-gradient': 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
      },

      // 🌑 SHADOWS (clean, not heavy)
      boxShadow: {
        card: '0 8px 25px rgba(0,0,0,0.05)',
        cardHover: '0 12px 35px rgba(0,0,0,0.08)',
      },

      // 🔍 BLUR
      backdropBlur: {
        xs: '2px',
      },

    },
  },
  plugins: [],
}