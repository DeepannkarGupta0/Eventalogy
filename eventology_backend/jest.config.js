module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/tests/jest.setup.ts'],
  moduleNameMapper: {
    '^jose$': '<rootDir>/src/tests/__mocks__/jose.js',
  },
};

