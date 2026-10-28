/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          black: "#000000",
          base: "#121212",
          elevated: "#181818",
          highlight: "#242424",
          card: "#181818",
          cardHover: "#282828",
          press: "#1a1a1a",
          green: "#1ed760",
          greenHover: "#1fdf64",
          greenActive: "#169c46",
          textBase: "#ffffff",
          textSubdued: "#b3b3b3",
          sliderRail: "#4d4d4d",
          sliderTrack: "#ffffff",
          sliderThumb: "#ffffff",
          border: "#282828",
        }
      },
      fontFamily: {
        sans: [
          'SpotifyMixUI',
          'CircularSp',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        title: [
          'SpotifyMixUITitle',
          'CircularSpTitle',
          'SpotifyMixUI',
          'CircularSp',
          '-apple-system',
          'sans-serif'
        ]
      },
      boxShadow: {
        'spotify-player': '0 -1px 0 0 #282828',
        'spotify-card': '0 8px 8px rgba(0,0,0,0.3)',
        'spotify-play-btn': '0 8px 8px rgba(0,0,0,0.3)',
      }
    },
  },
  plugins: [],
}
