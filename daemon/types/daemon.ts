/**
 * Type definitions for the unified daemon system
 */

export interface DaemonConfig {
  enterpriseIds: string[];
  healthPort: number;
  logLevel: string;
  redis: {
    url: string;
  };
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

export interface SubscriptionPoolConfig {
  enterpriseIds: string[];
  supabaseUrl: string;
  supabaseServiceKey: string;
  reconnectDelay: number;
  maxRetries: number;
  healthCheckInterval: number;
  notificationQueue: any; // Will be EnhancedNotificationQueue
}

export interface EnterpriseSubscriptionStatus {
  enterpriseId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'subscribed' | 'error' | 'reconnecting';
  lastConnected?: Date;
  lastError?: string;
  retryCount: number;
  isHealthy: boolean;
}

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
    queue: 'healthy' | 'unhealthy' | 'not_initialized';
  };
  enterprise_status: Record<string, string>;
  queue_stats?: {
    notification: any;
    ruleExecution: any;
    realtime: any;
  };
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