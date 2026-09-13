/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bone: '#EDE7DD',
        'paper-white': '#FAF8F4',
        ink: '#1C1B19',
        stone: '#A8A199',
        'clay-rose': '#B4675A'
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        none: '0',
        sm: '2px', // Exclusive to form inputs
      }
    },
  },
  plugins: [],
}
