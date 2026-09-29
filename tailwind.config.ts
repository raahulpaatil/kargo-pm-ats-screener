import type { Config } from 'tailwindcss'

// Colors and shadows are theme tokens defined in src/app/globals.css.
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
          '"SF Pro Text"', 'Inter', 'Helvetica', 'Arial', 'sans-serif',
        ],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
}
export default config
