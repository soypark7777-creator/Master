import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        stage: {
          950: "#050506",
          900: "#0b0b0f",
          850: "#111116",
          800: "#18181e"
        },
        gold: {
          100: "#fff6d5",
          200: "#f5ddb4",
          300: "#ebca81",
          400: "#d9a441",
          500: "#bf7f1d"
        }
      },
      boxShadow: {
        neon: "0 0 20px rgba(245, 221, 180, 0.18), 0 0 40px rgba(191, 127, 29, 0.12)",
        stage: "0 24px 80px rgba(0, 0, 0, 0.45)"
      },
      backgroundImage: {
        "stage-radial":
          "radial-gradient(circle at top, rgba(245,221,180,0.18), transparent 32%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08), transparent 24%), linear-gradient(180deg, rgba(9,9,12,0.96), rgba(4,4,6,1))"
      },
      animation: {
        "pulse-gold": "pulseGold 1.8s ease-in-out infinite"
      },
      keyframes: {
        pulseGold: {
          "0%, 100%": {
            boxShadow: "0 0 10px rgba(245,221,180,0.24), 0 0 24px rgba(217,164,65,0.18)"
          },
          "50%": {
            boxShadow: "0 0 24px rgba(255,246,213,0.34), 0 0 48px rgba(217,164,65,0.3)"
          }
        }
      }
    }
  },
  plugins: []
};

export default config;
