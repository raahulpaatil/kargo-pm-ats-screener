import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1d1d1f',
        subtle: '#6e6e73',
        surface: '#ffffff',
        canvas: '#f5f5f7',
        accent: '#0071e3',
        good: '#1db954',
        warn: '#ff9500',
        danger: '#ff3b30',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
          '"SF Pro Text"', 'Inter', 'Helvetica', 'Arial', 'sans-serif',
        ],
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { soft: '0 4px 24px rgba(0,0,0,0.06)' },
    },
  },
  plugins: [],
}
export default config
