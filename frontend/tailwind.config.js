/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode toggling via class
  theme: {
    extend: {
      colors: {
        primary: '#059669', // Emerald
        secondary: '#D97706', // Warm Amber
        accent: '#0D9488', // Teal
        danger: '#E11D48', // Rose
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
