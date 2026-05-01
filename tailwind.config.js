/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172422",
        mist: "#f4f8f5",
        sage: "#dcebe2",
        moss: "#2f6b57",
        navy: "#0f3d3e",
        coral: "#de6b5f",
        gold: "#c58b2c",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(20, 44, 37, 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
