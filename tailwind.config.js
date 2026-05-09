/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        community: {
          1: "#a78bfa", 2: "#34d399", 3: "#fb923c", 4: "#60a5fa",
          5: "#f472b6", 6: "#fbbf24", 7: "#22d3ee", 8: "#a3e635",
          9: "#f87171", 10: "#c084fc", 11: "#2dd4bf", 12: "#fdba74",
        },
        you: "#fbbf24",
      },
    },
  },
  plugins: [],
};
