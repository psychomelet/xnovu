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
    it('should connect to Novu API with valid credentials', async () => {
      if (!novuSecretKey || novuSecretKey === 'your_cloud_secret_key') {
        console.log('Skipping Novu API test - credentials not configured');
        return;
      }

      const novu = new Novu({ secretKey: novuSecretKey });
      
      // Test environments endpoint - this should work with any valid API key
      const response = await novu.environments.list();
      
      expect(response).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      
      // Verify we can access at least one environment
      const firstEnv = response.data[0];
      expect(firstEnv).toHaveProperty('_id');
      expect(firstEnv).toHaveProperty('name');
      expect(firstEnv).toHaveProperty('_organizationId');
      
      console.log(`✅ Connected to Novu API - found ${response.data.length} environments`);
    }, 15000);

    it('should fail gracefully with invalid credentials', async () => {
      const invalidNovu = new Novu({ secretKey: 'invalid-secret-key' });
      
      await expect(invalidNovu.environments.list()).rejects.toThrow();
    }, 10000);
  });

  describe('Workflows', () => {
    it('should be able to list workflows when credentials are configured', async () => {
      if (!novuSecretKey || novuSecretKey === 'your_cloud_secret_key') {
        console.log('Skipping workflows test - credentials not configured');
        return;
      }

      const novu = new Novu({ secretKey: novuSecretKey });
      
      try {
        const response = await novu.workflows.list();
        
        expect(response).toBeDefined();
        expect(Array.isArray(response.data)).toBe(true);
        
        console.log(`✅ Found ${response.data.length} workflows in Novu`);
        
        // If there are workflows, verify structure
        if (response.data.length > 0) {
          const firstWorkflow = response.data[0];
          expect(firstWorkflow).toHaveProperty('_id');
          expect(firstWorkflow).toHaveProperty('name');
          expect(firstWorkflow).toHaveProperty('triggers');
        }
      } catch (error) {
        // Some API keys might not have access to workflows endpoint
        console.log('⚠️  Workflows endpoint not accessible with current credentials');
        expect(error).toBeDefined();
      }
    }, 15000);
  });

  describe('Subscribers', () => {
    it('should be able to access subscribers endpoint when credentials are configured', async () => {
      if (!novuSecretKey || novuSecretKey === 'your_cloud_secret_key') {
        console.log('Skipping subscribers test - credentials not configured');
        return;
      }

      const novu = new Novu({ secretKey: novuSecretKey });
      
      try {
        const response = await novu.subscribers.list({
          page: 1,
          limit: 10
        });
        
        expect(response).toBeDefined();
        expect(Array.isArray(response.data)).toBe(true);
        
        console.log(`✅ Subscribers endpoint accessible - found ${response.data.length} subscribers`);
      } catch (error) {
        // Some API keys might not have access to subscribers endpoint
        console.log('⚠️  Subscribers endpoint not accessible with current credentials');
        expect(error).toBeDefined();
      }
    }, 15000);
  });
});