import localtunnel from 'localtunnel';
import type { Tunnel } from 'localtunnel';
import { execSync } from 'child_process';

export interface TunnelOptions {
  port: number;
  subdomain?: string;
  onStabilizing?: () => Promise<void>;
}

export class TunnelManager {
  private tunnel?: Tunnel;
  private retryCount = 0;
  private maxRetries = 3;

  async createTunnel(options: TunnelOptions): Promise<{ url: string; tunnel: Tunnel }> {
    console.log(`🌐 Creating tunnel for port ${options.port}...`);

    while (this.retryCount < this.maxRetries) {
      try {
        // Test if local server is accessible first
        await this.testLocalServer(options.port);

        // Create tunnel with options
        const tunnelOptions: any = { 
          port: options.port,
          host: 'https://localtunnel.me' // Explicitly set host
        };
        
        if (options.subdomain) {
          tunnelOptions.subdomain = options.subdomain;
        }

        this.tunnel = await localtunnel(tunnelOptions);
        
        // Set up error handling
        this.tunnel.on('error', (err) => {
          console.error('⚠️  Tunnel error:', err.message);
          if (err.message.includes('connection refused')) {
            console.error('   This is a common LocalTunnel issue. The service may be overloaded.');
          }
        });

        this.tunnel.on('close', () => {
          console.log('🔌 Tunnel connection closed');
        });

        // Test the tunnel
        const tunnelUrl = this.tunnel.url;
        console.log(`📡 Tunnel URL: ${tunnelUrl}`);
        
        // Wait for tunnel to be fully functional
        console.log('⏳ Waiting for tunnel to become ready...');
        const isWorking = await this.waitForTunnelReady(tunnelUrl, options.onStabilizing);
        
        if (!isWorking && this.retryCount < this.maxRetries - 1) {
          console.log('⚠️  Tunnel failed to become ready, retrying with new tunnel...');
          this.tunnel.close();
          this.retryCount++;
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        
        if (!isWorking) {
          throw new Error('Tunnel failed to become ready after all retries');
        }

        console.log('✅ Tunnel created successfully!');
        return { url: tunnelUrl, tunnel: this.tunnel };

      } catch (error) {
        this.retryCount++;
        if (this.retryCount >= this.maxRetries) {
          throw new Error(`Failed to create tunnel after ${this.maxRetries} attempts: ${error}`);
        }
        console.log(`⚠️  Tunnel creation failed (attempt ${this.retryCount}/${this.maxRetries}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    throw new Error('Failed to create tunnel');
  }

  private async testLocalServer(port: number): Promise<void> {
    try {
      const response = await fetch(`http://localhost:${port}/api/novu`);
      if (!response.ok && response.status !== 404) {
        throw new Error(`Local server returned status ${response.status}`);
      }
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Local server not accessible on port ${port}`);
      }
      // Other errors might be OK (like 404)
    }
  }

  private async waitForTunnelReady(tunnelUrl: string, onStabilizing?: () => Promise<void>): Promise<boolean> {
    const maxAttempts = 30; // 30 attempts = ~60 seconds max
    const delayBetweenAttempts = 2000; // 2 seconds
    
    console.log(`   Testing tunnel URL: ${tunnelUrl}/api/novu`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const isReady = await this.testTunnel(tunnelUrl);
      
      if (isReady) {
        console.log('   ✅ Tunnel responded correctly');
        
        // Give LocalTunnel extra time to stabilize
        console.log('   ⏳ Waiting 15 seconds for tunnel to stabilize...');
        
        // Run the callback during stabilization wait if provided
        if (onStabilizing) {
          await onStabilizing();
        } else {
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
        
        // Test again to ensure it's still working
        const stillWorking = await this.testTunnel(tunnelUrl);
        if (stillWorking) {
          console.log('   ✅ Tunnel is stable and ready');
          return true;
        } else {
          console.log('   ⚠️  Tunnel became unstable, retrying...');
        }
      }
      
      if (attempt < maxAttempts) {
        console.log(`   Attempt ${attempt}/${maxAttempts} - Tunnel not ready yet, waiting...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    }
    
    console.log('❌ Tunnel failed to become ready after 60 seconds');
    return false;
  }

  private async testTunnel(tunnelUrl: string): Promise<boolean> {
    try {
      // Test the actual /api/novu endpoint
      const testUrl = `${tunnelUrl}/api/novu`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(testUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      if (data.status === 'ok' && data.frameworkVersion && data.discovered) {
        return true;
      }
      return false;
    } catch (error: any) {
      // Any error means tunnel not ready
      return false;
    }
  }

  closeTunnel(): void {
    if (this.tunnel) {
      this.tunnel.close();
      this.tunnel = undefined;
    }
  }
}