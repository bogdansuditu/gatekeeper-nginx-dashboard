/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'rgb(var(--bg-canvas) / <alpha-value>)',
          dark: 'rgb(var(--bg-canvas) / <alpha-value>)',
          light: '#f4f5fa',
        },
        surface: {
          DEFAULT: 'rgb(var(--bg-surface) / <alpha-value>)',
          dark: 'rgb(var(--bg-surface) / <alpha-value>)',
          light: '#e9ecf6',
        },
        card: {
          DEFAULT: 'rgb(var(--bg-card) / <alpha-value>)',
          dark: 'rgb(var(--bg-card) / <alpha-value>)',
          'dark-hover': 'rgb(var(--bg-card-hover) / <alpha-value>)',
          light: '#ffffff',
          'light-hover': '#f8f9ff',
        },
        border: {
          DEFAULT: 'rgb(var(--border-subtle) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
          'subtle-light': '#dce1f0',
          focus: 'rgb(var(--border-focus) / <alpha-value>)',
        },
        accent: {
          primary: 'rgb(var(--accent-primary) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          purple: '#8553f0',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          'primary-light': '#121426',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          'secondary-light': '#58607e',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          'muted-light': '#8d96b3',
        },
        status: {
          healthy: 'rgb(var(--status-healthy) / <alpha-value>)',
          warning: 'rgb(var(--status-warning) / <alpha-value>)',
          critical: 'rgb(var(--status-critical) / <alpha-value>)',
        }
      },
      borderRadius: {
        card: '14px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
