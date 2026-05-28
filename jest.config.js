/** @type {import('@jest/types').Config.InitialOptions} */
export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'app.js',
    'connection.js',
    'devices.js',
    'state.js',
    'tradfri-manager.js',
    'settings-manager.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  verbose: true,
  transformIgnorePatterns: ['node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
