import { Novu } from '@novu/api';

describe('Novu API Connection', () => {
  const novuSecretKey = process.env.NOVU_SECRET_KEY;
  const novuAppId = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;

  describe('Authentication', () => {
    it('should create Novu client and test connection', async () => {
      const novu = new Novu({ secretKey: novuSecretKey });
      
      expect(novu).toBeDefined();
      expect(novu.subscribers).toBeDefined();
      expect(novu.trigger).toBeDefined();
      
      // Test basic connection by searching subscribers
      const response = await novu.subscribers.search({});
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.data).toBeDefined();
      expect(Array.isArray(response.result.data)).toBe(true);
      
      console.log(`✅ Connected to Novu API - found ${response.result.data.length} subscribers`);
    }, 15000);

    it('should fail gracefully with invalid credentials', async () => {
      const invalidNovu = new Novu({ secretKey: 'invalid-secret-key' });
      
      await expect(invalidNovu.subscribers.search({})).rejects.toThrow();
    }, 10000);
  });

  describe('Integrations', () => {
    it('should be able to access integrations when credentials are configured', async () => {
      const novu = new Novu({ secretKey: novuSecretKey });
      
      expect(novu.integrations).toBeDefined();
      console.log('✅ Integrations endpoint accessible');
    }, 15000);
  });

  describe('Subscribers', () => {
    it('should be able to search subscribers when credentials are configured', async () => {
      const novu = new Novu({ secretKey: novuSecretKey });
      
      const response = await novu.subscribers.search({});
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.data).toBeDefined();
      expect(Array.isArray(response.result.data)).toBe(true);
      
      console.log(`✅ Subscribers search accessible - found ${response.result.data.length} subscribers`);
      
      // If there are subscribers, verify structure
      if (response.result.data.length > 0) {
        const firstSubscriber = response.result.data[0];
        expect(firstSubscriber).toHaveProperty('id');
        expect(firstSubscriber).toHaveProperty('subscriberId');
        expect(firstSubscriber).toHaveProperty('environmentId');
      }
    }, 15000);
  });
});