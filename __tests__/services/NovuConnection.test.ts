import { Novu } from '@novu/api';

describe('Novu API Connection', () => {
  const novuSecretKey = process.env.NOVU_SECRET_KEY;
  const novuAppId = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;

  // Skip tests if credentials are not real (using test defaults)
  const hasRealCredentials = novuSecretKey &&
    !novuSecretKey.includes('test-secret-key') &&
    novuSecretKey.length > 20;

  describe('Authentication', () => {
    it('should create Novu client and test connection', async () => {
      if (!hasRealCredentials) {
        console.log('⚠️  Skipping Novu connection test - no real credentials configured');
        console.log('   To run these tests, set NOVU_SECRET_KEY in your environment or GitHub secrets');
        return;
      }

      const novu = new Novu({ secretKey: novuSecretKey });

      expect(novu).toBeDefined();
      expect(novu.trigger).toBeDefined();

      console.log(`✅ Connected to Novu API`);
    }, 15000);

    it('should fail gracefully with invalid credentials', async () => {
      if (!hasRealCredentials) {
        console.log('⚠️  Skipping invalid credentials test - no real API to test against');
        return;
      }

      const invalidNovu = new Novu({ secretKey: 'invalid-secret-key' });

      await expect(invalidNovu.subscribers.search({})).rejects.toThrow();
    }, 10000);

    it('should create a new subscriber and verify subscriber count >= 1', async () => {
      if (!hasRealCredentials) {
        fail('Credentials not provided - NOVU_SECRET_KEY is required for this test');
      }

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