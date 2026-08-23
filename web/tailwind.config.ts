import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // DaoClaw 暖紅 / 磚紅 品牌色（見 docs/UI-STYLE.md）
        brand: {
          50: "#FBF0EC",
          100: "#F7DED5",
          200: "#EFBEB0",
          300: "#E49A85",
          400: "#D8755B",
          500: "#C5573C",
          600: "#AC4730",
          700: "#8E3826",
          800: "#702D20",
        },
      },
    },
  },
  plugins: [],
};

export default config;
