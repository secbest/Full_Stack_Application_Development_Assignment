// Jest does not read Vite's alias configuration, so mirror the "@/" alias here and
// use jsdom for page/component tests that import React DOM.
module.exports = {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/'],
}
