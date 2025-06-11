const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)'
  ],
  testPathIgnorePatterns: [
    // Skip integration tests locally unless Redis is explicitly available
    ...(process.env.CI || process.env.REDIS_URL ? [] : ['.*\\.integration\\.test\\..*'])
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/page.tsx',
    '!app/**/layout.tsx',
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
    'node_modules/(?!(@supabase|@novu|bullmq|ioredis)/.*)'
  ],
  // Mock problematic modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@supabase/supabase-js$': '<rootDir>/__mocks__/@supabase/supabase-js.js',
    '^@novu/api$': '<rootDir>/__mocks__/@novu/api.js',
    '^bullmq$': '<rootDir>/__mocks__/bullmq.js',
    '^ioredis$': '<rootDir>/__mocks__/ioredis.js',
    '^node-cron$': '<rootDir>/__mocks__/node-cron.js',
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)