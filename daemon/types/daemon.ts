/**
 * Type definitions for the unified daemon system
 */

export interface DaemonConfig {
  enterpriseIds: string[];
  healthPort: number;
  logLevel: string;
  supabase: {
    url: string;
    serviceKey: string;
  };
  novu: {
    secretKey: string;
  };
  subscription: {
    reconnectDelay: number;
    maxRetries: number;
    healthCheckInterval: number;
  };
}

// SubscriptionPoolConfig and EnterpriseSubscriptionStatus removed - no longer needed
// The daemon now uses a single shared subscription manager

export interface DaemonHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  components: {
    subscriptions: {
      total: number;
      active: number;
      failed: number;
      reconnecting: number;
    };
    ruleEngine: 'healthy' | 'unhealthy' | 'not_initialized';
    temporal: 'healthy' | 'unhealthy' | 'not_initialized';
  };
  enterprise_status: Record<string, string>;
  temporal_status?: any;
}

export interface RealtimeJobData {
  type: 'realtime-insert' | 'realtime-update' | 'realtime-delete';
  enterpriseId: string;
  notificationId: number;
  payload: any;
  oldPayload?: any; // For updates
  timestamp: Date;
  eventId: string;
}

export type SignalHandler = (signal: string) => Promise<void>;