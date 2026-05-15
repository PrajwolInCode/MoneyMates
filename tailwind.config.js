/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172422",
        mist: "#f4f8f5",
        mint: "#e9f7ef",
        sage: "#dcebe2",
        moss: "#2f6b57",
        navy: "#0f3d3e",
        coral: "#de6b5f",
        gold: "#c58b2c",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(20, 44, 37, 0.08)",
        elevated: "0 1px 0 rgba(20, 44, 37, 0.04), 0 10px 24px -8px rgba(20, 44, 37, 0.12), 0 2px 4px -1px rgba(20, 44, 37, 0.04)",
        focus: "0 0 0 3px rgba(15, 61, 62, 0.18)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightish: "-0.012em",
      },
    },
  },
  plugins: [],
};
