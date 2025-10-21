import type { Config } from 'tailwindcss' with { 'resolution-mode': 'import' };

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        'fade-in-out': {
          '0%': { opacity: 0, transform: 'translateY(20%)' },
          '10%': { opacity: 1, transform: 'translateY(0%)' },
          '90%': { opacity: 1, transform: 'translateY(0%)' },
          '100%': { opacity: 0, transform: 'translateY(-20%)' },
        },
      },
      animation: {
        'fade-in-out': 'fade-in-out 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
