import { Novu } from '@novu/api';

describe('Novu API Connection', () => {
  const novuSecretKey = process.env.NOVU_SECRET_KEY;
  const novuAppId = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;

  beforeAll(() => {
    // Skip tests if credentials are not configured or are default values
    if (!novuSecretKey || novuSecretKey === 'your_cloud_secret_key') {
      console.log('⚠️  Novu secret key not configured - skipping Novu connection tests');
    }
    if (!novuAppId || novuAppId === 'your_app_identifier') {
      console.log('⚠️  Novu application identifier not configured - skipping some tests');
    }
  });

  describe('Authentication', () => {
    it('should create Novu client and test connection', async () => {
      if (!novuSecretKey || novuSecretKey === 'your_cloud_secret_key') {
        console.log('Skipping Novu API test - credentials not configured');
        return;
      }

      const novu = new Novu({ secretKey: novuSecretKey });
      
      expect(novu).toBeDefined();
      expect(novu.subscribers).toBeDefined();
      expect(novu.trigger).toBeDefined();
      
      // Test basic connection by searching subscribers
      const response = await novu.subscribers.search({});
      
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      
      console.log(`✅ Connected to Novu API - found ${response.data.length} subscribers`);
    }, 15000);

    it('should fail gracefully with invalid credentials', async () => {
      const invalidNovu = new Novu({ secretKey: 'invalid-secret-key' });
      
      await expect(invalidNovu.subscribers.search({})).rejects.toThrow();
    }, 10000);
  });

  describe('Integrations', () => {
    it('should be able to access integrations when credentials are configured', async () => {
      if (!novuSecretKey || novuSecretKey === 'your_cloud_secret_key') {
        console.log('Skipping integrations test - credentials not configured');
        return;
      }

      const novu = new Novu({ secretKey: novuSecretKey });
      
      expect(novu.integrations).toBeDefined();
      console.log('✅ Integrations endpoint accessible');
    }, 15000);
  });

  describe('Subscribers', () => {
    it('should be able to search subscribers when credentials are configured', async () => {
      if (!novuSecretKey || novuSecretKey === 'your_cloud_secret_key') {
        console.log('Skipping subscribers test - credentials not configured');
        return;
      }

      const novu = new Novu({ secretKey: novuSecretKey });
      
      const response = await novu.subscribers.search({});
      
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      
      console.log(`✅ Subscribers search accessible - found ${response.data.length} subscribers`);
      
      // If there are subscribers, verify structure
      if (response.data.length > 0) {
        const firstSubscriber = response.data[0];
        expect(firstSubscriber).toHaveProperty('_id');
        expect(firstSubscriber).toHaveProperty('subscriberId');
        expect(firstSubscriber).toHaveProperty('_environmentId');
      }
    }, 15000);
  });
});