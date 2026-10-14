import type { Config } from 'tailwindcss'

// Colors and shadows are theme tokens defined in src/app/globals.css.
// Like 5aitec.com, the whole UI is set in one serif (STIX Two Text);
// `font-pixel` is the DOS-style caption face.
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
        sans: ['var(--font-stix)', '"STIX Two Text"', '"Times New Roman"', 'serif'],
        pixel: ['var(--font-vt323)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
}
export default config
