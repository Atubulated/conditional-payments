import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark Mode Palette - Deep & Vibrant
        midnight: {
          950: '#02040a', // Almost black blue
          900: '#090e1a', // Rich dark blue
          800: '#131b2c', // Card bg
          700: '#1e293b', // Borders
        },
        // Vibrant Accents
        primary: {
          DEFAULT: '#6366f1', // Indigo 500
          glow: 'rgba(99, 102, 241, 0.5)',
        },
        neon: {
          cyan: '#06b6d4',
          purple: '#8b5cf6',
          blue: '#3b82f6',
        }
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;