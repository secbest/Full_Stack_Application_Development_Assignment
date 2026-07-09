// Only used by Jest - Vite handles its own JSX/ESM transform for dev/build and never
// reads this file. Needed because Jest runs source through babel-jest, which requires
// an explicit babel config to understand JSX and ESM import/export syntax.
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  // src/api/index.js reads import.meta.env.VITE_API_BASE_URL (Vite-only syntax) -
  // Babel/Jest has no native import.meta support, so it rewrites those reads to
  // process.env.VITE_API_BASE_URL instead, which is undefined under Jest and falls
  // back to the same '/api' default the app uses when the env var isn't set.
  plugins: ['babel-plugin-transform-vite-meta-env'],
}
