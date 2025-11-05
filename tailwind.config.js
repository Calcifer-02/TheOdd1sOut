/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vk: {
          blue: '#0077FF',
          lightBlue: '#4986CC',
        },
      },
    },
  },
  plugins: [],
};

