// No jest config existed before this - `npm test` had nothing to resolve the "@/" alias
// (defined only in vite.config.js, which Jest never reads) or a jsdom environment for
// react-dom, so any test importing a page component would fail before assertions ran.
module.exports = {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/'],
}
