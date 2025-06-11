const baseConfig = require('./jest.config.js');

// Configuration for running tests with cloud services
module.exports = {
  ...baseConfig,
  displayName: 'Cloud Services Tests',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.js',
    // Exclude integration tests if Redis is not configured
    ...(process.env.REDIS_URL && !process.env.REDIS_URL.includes('localhost') 
      ? ['**/__tests__/integration/**/*.test.ts'] 
      : [])
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    // Skip Redis-dependent tests if cloud Redis is not available
    ...((!process.env.REDIS_URL || process.env.REDIS_URL.includes('localhost'))
      ? ['.*RuleEngine.*\\.test\\.ts$']
      : [])
  ],
  globalSetup: undefined,
  globalTeardown: undefined,
};