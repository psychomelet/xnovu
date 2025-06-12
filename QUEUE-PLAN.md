# Unified Daemon & Worker System Implementation Plan

## Overview

This document outlines the implementation of a production-ready daemon system that unifies realtime subscriptions, cron scheduling, scheduled notifications, and BullMQ-based processing into a cohesive, scalable architecture.

## Current State Analysis

### Existing Components
- ✅ **SubscriptionManager**: Handles Supabase realtime subscriptions (INSERT only)
- ✅ **CronManager**: Manages cron-based notification rules
- ✅ **ScheduledNotificationManager**: Processes time-based scheduled notifications
- ✅ **NotificationQueue**: BullMQ-based queue system for notification processing
- ✅ **RuleEngineService**: Orchestrates cron and scheduled components
- ❌ **Integration Gap**: SubscriptionManager not integrated into production flow

### Missing Pieces
- No daemon to run SubscriptionManager in production
- No UPDATE event monitoring in realtime subscriptions
- No unified process management for all components
- No production deployment configuration

## Architecture Design

### 1. Master Daemon (`daemon/index.ts`)

**Purpose**: Single entry point that orchestrates all notification services

**Responsibilities**:
- Initialize and manage SubscriptionManager instances per enterprise
- Start existing RuleEngineService (CronManager + ScheduledNotificationManager)
- Provide health monitoring via HTTP endpoint
- Handle graceful shutdown of all components
- Coordinate startup sequence and dependency management

**Key Features**:
- Enterprise-aware subscription management
- HTTP health check endpoint on port 3001
- Structured logging with enterprise context
- Signal handling for graceful shutdown

### 2. Enhanced SubscriptionManager

**Current Limitations**:
- Only monitors INSERT events
- Uses internal queue instead of BullMQ
- Not enterprise-scoped in production

**Enhancements**:
- Add UPDATE event monitoring alongside INSERT
- Replace internal queue with direct BullMQ integration
- Add enterprise filtering and isolation
- Implement reconnection logic with exponential backoff
- Add subscription health monitoring

**New Capabilities**:
```typescript
// Support both INSERT and UPDATE events
.on('postgres_changes', {
  event: '*', // INSERT, UPDATE, DELETE
  schema: 'notify',
  table: 'ent_notification',
  filter: `enterprise_id=eq.${enterpriseId}`
})

// Direct BullMQ integration
await this.notificationQueue.addRealtimeNotificationJob(jobData)
```

### 3. Unified Queue System

**Extend NotificationQueue** to handle realtime events:

**New Job Types**:
- `realtime-notification-insert`: Process newly inserted notifications
- `realtime-notification-update`: Handle notification updates/status changes
- `realtime-notification-delete`: Handle notification deletions (if needed)

**Queue Priorities**:
- High: Realtime events (immediate processing)
- Medium: Scheduled notifications (time-sensitive)
- Low: Cron-generated notifications (batch processing)

**Enhanced Features**:
- Job deduplication using notification ID + event type
- Enterprise-scoped job processing
- Enhanced retry logic for different job types
- Monitoring and metrics per job type

### 4. Worker Architecture

**Scaling Strategy**:
- **Daemon Process**: 1 instance per deployment
- **Worker Processes**: Multiple instances for processing
- **Enterprise Isolation**: Workers handle jobs for any enterprise
- **Job Type Specialization**: Workers can process all job types

**Worker Configuration**:
```yaml
services:
  daemon:
    replicas: 1  # Single daemon instance
  
  worker:
    replicas: 3  # Scale based on load
    environment:
      - WORKER_CONCURRENCY=5
```

## Implementation Steps

### Phase 1: Core Infrastructure
1. Create daemon entry point structure
2. Enhance SubscriptionManager with UPDATE monitoring
3. Add realtime job types to NotificationQueue
4. Integrate SubscriptionManager with BullMQ

### Phase 2: Enterprise Management
5. Add enterprise-scoped subscription management
6. Implement subscription health monitoring
7. Add reconnection logic with backoff

### Phase 3: Production Readiness
8. Create Docker deployment configuration
9. Add comprehensive health check endpoints
10. Implement structured logging and metrics
11. Add CLI commands for daemon management

### Phase 4: Monitoring & Observability
12. Integrate with Bull Board for queue monitoring
13. Add Prometheus metrics endpoints
14. Implement alerting for subscription failures
15. Add performance monitoring and dashboards

## File Structure

```
daemon/
├── index.ts                 # Master daemon entry point
├── services/
│   ├── DaemonManager.ts     # Main orchestration service
│   ├── (SubscriptionPool removed) # Now uses single shared subscription
│   └── HealthMonitor.ts     # Health check service
├── types/
│   └── daemon.ts           # Daemon-specific types
└── utils/
    ├── logging.ts          # Structured logging
    └── signals.ts          # Signal handling

app/services/realtime/
├── SubscriptionManager.ts   # Enhanced with UPDATE monitoring
└── RealtimeJobProcessor.ts  # Realtime-specific job processing

app/services/queue/
├── NotificationQueue.ts     # Enhanced with realtime jobs
└── JobProcessors.ts        # Consolidated job processors

docker/
├── docker-compose.yml      # Development environment
├── docker-compose.prod.yml # Production environment
└── Dockerfile.daemon       # Optimized daemon image
```

## Configuration Management

### Environment Variables

**Daemon Configuration**:
```bash
# Daemon settings
DAEMON_HEALTH_PORT=3001
DAEMON_LOG_LEVEL=info
DAEMON_ENTERPRISE_IDS=ent1,ent2,ent3

# Subscription settings
SUBSCRIPTION_RECONNECT_DELAY=1000
SUBSCRIPTION_MAX_RETRIES=10
SUBSCRIPTION_HEALTH_CHECK_INTERVAL=30000

# Queue settings (existing + new)
REALTIME_QUEUE_PRIORITY=10
SCHEDULED_QUEUE_PRIORITY=5
CRON_QUEUE_PRIORITY=1
```

**Enterprise Configuration**:
Each enterprise can have custom subscription settings:
```bash
# Per-enterprise overrides
ENT_ent1_SUBSCRIPTION_ENABLED=true
ENT_ent1_REALTIME_PRIORITY=10
ENT_ent2_SUBSCRIPTION_ENABLED=false
```

## Monitoring Strategy

### Health Checks

**Daemon Health Endpoint** (`/health`):
```json
{
  "status": "healthy",
  "uptime": 3600,
  "components": {
    "subscriptions": {
      "total": 3,
      "active": 3,
      "failed": 0
    },
    "cronManager": "healthy",
    "scheduledManager": "healthy",
    "queue": "healthy"
  },
  "enterprise_status": {
    "ent1": "subscribed",
    "ent2": "subscribed", 
    "ent3": "reconnecting"
  }
}
```

**Queue Monitoring** (Bull Board):
- Real-time job processing metrics
- Queue depth and processing rates
- Failed job analysis and retry statistics
- Enterprise-specific queue performance

### Logging Strategy

**Structured Logging**:
```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00Z",
  "component": "SubscriptionManager",
  "enterprise_id": "ent1",
  "event": "notification_received",
  "notification_id": 12345,
  "event_type": "INSERT",
  "processing_time_ms": 150
}
```

**Log Aggregation**:
- Centralized logging via Docker logging drivers
- Enterprise-scoped log filtering
- Performance metrics extraction
- Error pattern detection

## Deployment Strategy

### Development Environment

**Single Machine Setup**:
```bash
# Start all services locally
docker-compose up -d

# Services started:
# - Redis (queue backend)
# - Daemon (1 instance)
# - Worker (2 instances)
# - Bull Board (monitoring)
```

### Production Environment

**Multi-Container Setup**:
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Features:
# - Health checks and restart policies
# - Resource limits and reservations
# - Log aggregation configuration
# - Secret management
# - Network isolation
```

**Scaling Strategy**:
- **Vertical**: Increase worker concurrency
- **Horizontal**: Add more worker containers
- **Enterprise**: Deploy daemon per region/cluster

### High Availability

**Failover Strategy**:
- Daemon restart on health check failure
- Redis clustering for queue persistence
- Subscription reconnection on Supabase connection loss
- Worker auto-scaling based on queue depth

**Data Persistence**:
- Queue jobs persist in Redis
- Subscription state recoverable from database
- Failed job analysis and replay capabilities

## Performance Considerations

### Subscription Performance

**Connection Management**:
- Single subscription per enterprise to minimize connections
- Connection pooling for database queries
- Efficient filtering to reduce unnecessary events

**Event Processing**:
- Immediate queue insertion for realtime events
- Batch processing for bulk operations
- Debouncing for rapid successive updates

### Queue Performance

**Job Processing**:
- Priority-based processing (realtime > scheduled > cron)
- Parallel processing with configurable concurrency
- Job deduplication to prevent duplicate processing

**Resource Usage**:
- Memory-efficient job data structures
- Connection pooling for external APIs
- Graceful degradation under high load

## Security Considerations

### Access Control

**API Security**:
- Service role keys for Supabase access
- Novu secret key management
- Redis authentication

**Network Security**:
- Container network isolation
- Internal service communication
- External API rate limiting

### Data Protection

**Sensitive Data**:
- No logging of notification payloads
- Secure environment variable management
- Encrypted communication channels

## Testing Strategy

### Unit Testing

**Component Tests**:
- Enhanced SubscriptionManager functionality
- Realtime job processing logic
- Daemon orchestration services

### Integration Testing

**End-to-End Tests**:
- Full notification flow (realtime + queue + worker)
- Enterprise isolation verification
- Failover and recovery scenarios

### Load Testing

**Performance Tests**:
- High-volume realtime event processing
- Concurrent enterprise subscription handling
- Queue throughput under load

## Migration Plan

### Phase 1: Infrastructure Setup
- Deploy daemon alongside existing system
- Run in monitoring mode (no active processing)
- Verify subscription connectivity and health

### Phase 2: Gradual Rollout
- Enable realtime processing for test enterprise
- Monitor performance and error rates
- Gradually add more enterprises

### Phase 3: Full Migration
- Enable for all enterprises
- Decommission any manual processes
- Monitor and optimize performance

## Success Metrics

### Reliability Metrics
- Subscription uptime (target: 99.9%)
- Job processing success rate (target: 99.5%)
- Mean time to recovery from failures (target: <2 minutes)

### Performance Metrics
- Realtime event processing latency (target: <500ms)
- Queue throughput (target: 1000 jobs/minute)
- Resource utilization (target: <80% CPU/Memory)

### Business Metrics
- Notification delivery success rate
- End-to-end notification latency
- Enterprise-specific performance SLAs

## Future Enhancements

### Advanced Features
- Multi-region deployment support
- Advanced subscription filtering and routing
- Real-time analytics and reporting
- Machine learning-based load prediction

### Integration Opportunities
- Webhook delivery for external systems
- Event sourcing for audit trails
- Advanced retry strategies with backoff policies
- Integration with external monitoring systems

This implementation plan provides a robust foundation for a production-ready notification system that scales with enterprise needs while maintaining reliability and performance.