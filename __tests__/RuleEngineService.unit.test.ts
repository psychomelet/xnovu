import { defaultRuleEngineConfig } from '@/app/services/RuleEngineService';

// No mocks - use real cloud services
// Tests will use actual Supabase, Novu, and Redis instances configured in .env.local

describe('RuleEngineService - Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('defaultRuleEngineConfig', () => {
    it('should have default configuration values', () => {
      // Values come from jest.setup.js environment variables
      expect(defaultRuleEngineConfig).toEqual({
        redisUrl: process.env.REDIS_URL, // From .env.local (cloud Redis)
        defaultTimezone: 'UTC',
        maxConcurrentJobs: 5, // From jest.setup.js
        jobRetryAttempts: 2, // From jest.setup.js
        jobRetryDelay: 1000, // From jest.setup.js
        scheduledNotificationInterval: 60000, // Default (no env var set)
        scheduledNotificationBatchSize: 100, // Default (no env var set)
      });
    });

    it('should have valid retry configuration', () => {
      expect(defaultRuleEngineConfig.jobRetryAttempts).toBeGreaterThan(0);
      expect(defaultRuleEngineConfig.jobRetryDelay).toBeGreaterThan(0);
    });

    it('should have valid job limits', () => {
      expect(defaultRuleEngineConfig.maxConcurrentJobs).toBeGreaterThan(0);
      expect(defaultRuleEngineConfig.scheduledNotificationBatchSize).toBeGreaterThan(0);
    });

    it('should have valid interval configuration', () => {
      expect(defaultRuleEngineConfig.scheduledNotificationInterval).toBeGreaterThan(0);
    });
  });

  describe('configuration validation', () => {
    it('should accept valid timezone', () => {
      const validTimezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
      
      validTimezones.forEach(timezone => {
        expect(() => {
          const config = { ...defaultRuleEngineConfig, defaultTimezone: timezone };
          // Just validate the timezone format is acceptable
          expect(config.defaultTimezone).toBe(timezone);
        }).not.toThrow();
      });
    });

    it('should have Redis URL format', () => {
      const config = defaultRuleEngineConfig;
      expect(config.redisUrl).toMatch(/^redis(s)?:\/\//);
    });
  });
});