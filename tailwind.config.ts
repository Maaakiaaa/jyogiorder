import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1B2027",
        sub: "#5B6472",
        line: "#D6DCE2",
        surface: "#FFFFFF",
        canvas: "#E7EBEE",
        "brand-indigo": "#23406E",
        "brand-vermilion": "#E4572E",
        "brand-gold": "#C88A1A",
      },
    },
  },
  plugins: [],
}

export default config
