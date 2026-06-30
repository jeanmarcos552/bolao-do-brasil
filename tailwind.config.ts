import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        verde: { escuro: '#00501f', DEFAULT: '#009c3b', claro: '#eafaef' },
        amarelo: '#ffdf00',
      },
    },
  },
  plugins: [],
};
export default config;
