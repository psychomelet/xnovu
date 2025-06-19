const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  globalSetup: '<rootDir>/__tests__/setup/global-setup.ts',
  globalTeardown: '<rootDir>/__tests__/setup/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/jest.console.setup.js'],
  testEnvironment: 'jest-environment-node', // Use node environment for server-side tests
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/setup/'
  ],
  verbose: true, // Show individual test results
  silent: false, // Allow console output
  forceExit: true, // Force Jest to exit after all tests have completed
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'cli/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!**/*.config.{ts,tsx}',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/dist/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  // Transform ES modules from node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(@supabase|@novu)/.*)'
  ],
  // Custom reporters
  reporters: [
    'default',
    '<rootDir>/jest-error-reporter.js'
  ],
  // Module mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Ignore Next.js build output to prevent module name collisions during tests
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)