import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        line: v('line'),
        fg: v('fg'),
        'fg-muted': v('fg-muted'),
        'fg-subtle': v('fg-subtle'),
        accent: v('accent'),
        'accent-fg': v('accent-fg'),
        running: v('status-running'),
        waiting: v('status-waiting'),
        idle: v('status-idle'),
        ended: v('status-ended'),
        danger: v('danger'),
        success: v('success'),
        warning: v('warning'),
        info: v('info'),
      },
      fontFamily: {
        sans: [
          'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"',
          'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
        mono: [
          'ui-monospace', 'SFMono-Regular', '"JetBrains Mono"', 'Menlo', 'Consolas',
          '"Liberation Mono"', 'monospace',
        ],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '4px',
        lg: '6px',
      },
      boxShadow: {
        raised: '0 1px 0 rgb(var(--fg) / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.5)',
        signal: '0 0 0 1px rgb(var(--status-waiting) / 0.55), 0 0 28px -6px rgb(var(--status-waiting) / 0.45)',
      },
      keyframes: {
        'ring-out': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        beacon: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'ring-out': 'ring-out 1.8s ease-out infinite',
        beacon: 'beacon 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
