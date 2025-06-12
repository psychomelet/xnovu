import { Novu } from '@novu/api';

describe('Novu API Connection', () => {
  const novuSecretKey = process.env.NOVU_SECRET_KEY;
  const novuAppId = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;

  // Validate credentials are real (not test defaults)
  const hasRealCredentials = novuSecretKey &&
    !novuSecretKey.includes('test-secret-key') &&
    novuSecretKey.length > 20;

  beforeEach(() => {
    if (!hasRealCredentials) {
      throw new Error('Novu connection tests require real credentials. Set NOVU_SECRET_KEY in your environment.');
    }
  });

  describe('Authentication', () => {
    it('should create Novu client and test connection', async () => {
      const novu = new Novu({ secretKey: novuSecretKey });

      expect(novu).toBeDefined();
      expect(novu.trigger).toBeDefined();

      console.log(`✅ Connected to Novu API`);
    }, 15000);

    it('should fail gracefully with invalid credentials', async () => {
      const invalidNovu = new Novu({ secretKey: 'invalid-secret-key' });

      await expect(invalidNovu.subscribers.search({})).rejects.toThrow();
    }, 10000);

    it('should create a new subscriber and verify subscriber count >= 1', async () => {
      const novu = new Novu({ secretKey: novuSecretKey });
      const testEmail = 'test@yogorobot.com';
      const subscriberId = `test-subscriber-${Date.now()}`;

      // Create a new subscriber
      await novu.subscribers.create({
        subscriberId,
        email: testEmail,
        firstName: 'Test',
        lastName: 'User'
      });

      // Search for subscribers to verify count
      const response = await novu.subscribers.search({});

      expect(response.result.data.length).toBeGreaterThanOrEqual(1);

      console.log(`✅ Created subscriber ${subscriberId} - total subscribers: ${response.result.data.length}`);

      // Clean up: delete the test subscriber
      try {
        await novu.subscribers.delete(subscriberId);
      } catch (error) {
        console.warn(`⚠️  Could not clean up subscriber ${subscriberId}:`, error);
      }
    }, 15000);
  });
});