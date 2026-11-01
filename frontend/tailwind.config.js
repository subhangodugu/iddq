/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        app: {
          bg: "var(--bg-canvas)",
          surface: "var(--bg-surface)",
          card: "var(--bg-card)",
          cardHover: "var(--bg-card-hover)",
          border: "var(--border-subtle)",
          borderStrong: "var(--border-strong)",
          text: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
          primary: "var(--color-primary)",
          secondary: "var(--color-secondary)",
          accent: "var(--color-accent)",
        },
        silicon: {
          emerald: "rgb(var(--status-pass) / <alpha-value>)",
          emeraldMuted: "rgb(var(--status-pass) / <alpha-value>)",
          amber: "rgb(var(--status-warn) / <alpha-value>)",
          amberMuted: "rgb(var(--status-warn) / <alpha-value>)",
          ruby: "rgb(var(--status-fail) / <alpha-value>)",
          rubyMuted: "rgb(var(--status-fail) / <alpha-value>)",
          cyan: "rgb(var(--status-info) / <alpha-value>)",
          cyanMuted: "rgb(var(--status-info) / <alpha-value>)",
          blue: "rgb(var(--status-accent) / <alpha-value>)",
          blueMuted: "rgb(var(--status-accent) / <alpha-value>)",
          purple: "rgb(var(--status-model) / <alpha-value>)",
        }
      },
      fontFamily: {
        mono: ["var(--font-mono)", "JetBrains Mono", "Menlo", "Consolas", "monospace"],
        sans: ["var(--font-sans)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        'glow-cyan': '0 0 24px -4px rgba(6, 182, 212, 0.35)',
        'glow-emerald': '0 0 24px -4px rgba(16, 185, 129, 0.35)',
        'glow-ruby': '0 0 24px -4px rgba(239, 68, 68, 0.35)',
        'card-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.07)',
        'card-light': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(226, 232, 240, 0.9)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        }
      }
    },
  },
  plugins: [],
};
