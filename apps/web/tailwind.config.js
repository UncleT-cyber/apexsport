/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      padding: {
        'safe-bottom': 'env(safe-area-inset-bottom, 16px)',
        'safe-top': 'env(safe-area-inset-top, 0px)',
      },
      margin: {
        'safe-bottom': 'env(safe-area-inset-bottom, 16px)',
      },
    },
  },
  plugins: [],
}
