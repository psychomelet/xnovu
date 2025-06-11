# Queue Design Documentation

## Overview

The XNovu notification processing system uses an in-memory queue with retry logic to ensure reliable notification delivery. This document describes the queue architecture, processing strategies, and failure handling mechanisms.

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Realtime          │    │   Processing Queue   │    │   Novu Workflow     │
│   Subscription      │───▶│                      │───▶│   Execution         │
│                     │    │   ┌─────────────┐    │    │                     │
└─────────────────────┘    │   │   Item 1    │    │    └─────────────────────┘
                           │   │   Item 2    │    │
                           │   │   Item 3    │    │
                           │   │     ...     │    │
                           │   └─────────────┘    │
                           │                      │
                           │   ┌─────────────┐    │
                           │   │ Retry Logic │    │
                           │   │ + Backoff   │    │
                           │   └─────────────┘    │
                           └──────────────────────┘
```

## Queue Components

### 1. Queue Item Structure

```typescript
interface QueueItem {
  notification: NotificationRow  // Full notification data from database
  attempts: number               // Current retry attempt count
  lastAttempt?: Date            // Timestamp of last processing attempt
  nextRetry?: Date              // Calculated next retry time
}
```

### 2. Queue Configuration

```typescript
interface QueueConfig {
  maxConcurrent: number    // Maximum parallel processing slots (default: 5)
  retryAttempts: number    // Maximum retry attempts per item (default: 3)
  retryDelay: number       // Base delay between retries in ms (default: 1000)
  queueLimit?: number      // Maximum queue size (default: unlimited)
  processingTimeout?: number // Timeout for individual processing (default: 30s)
}
```

## Processing Strategy

### 1. FIFO (First In, First Out) Queue

The queue processes notifications in the order they were received, ensuring that older notifications are not starved by newer ones.

```typescript
class ProcessingQueue {
  private queue: QueueItem[] = []
  private activeProcessing: number = 0
  
  enqueue(notification: NotificationRow): void {
    this.queue.push({
      notification,
      attempts: 0,
      lastAttempt: new Date()
    })
  }
  
  dequeue(): QueueItem | undefined {
    return this.queue.shift()
  }
}
```

### 2. Concurrency Control

The system maintains a configurable number of concurrent processing slots to balance throughput with resource usage.

```typescript
async processQueue(): Promise<void> {
  const maxConcurrent = this.config.queueConfig?.maxConcurrent || 5
  
  while (
    this.processingQueue.length > 0 &&
    this.activeProcessing < maxConcurrent
  ) {
    const item = this.processingQueue.shift()
    if (!item) break
    
    this.activeProcessing++
    
    // Process asynchronously without blocking
    this.processNotification(item)
      .finally(() => {
        this.activeProcessing--
        // Continue processing remaining items
        this.processQueue().catch(console.error)
      })
  }
}
```

### 3. Processing Lifecycle

Each notification follows this processing lifecycle:

1. **Enqueue**: Add to processing queue with 0 attempts
2. **Dequeue**: Remove from queue when processing slot available
3. **Process**: Update status to PROCESSING and trigger workflow
4. **Success**: Update status to SENT, record transaction ID
5. **Failure**: Increment attempts, schedule retry or mark as FAILED

```typescript
async processNotification(item: QueueItem): Promise<void> {
  const { notification } = item
  const maxAttempts = this.config.queueConfig?.retryAttempts || 3
  
  try {
    // Update status to PROCESSING
    await this.updateNotificationStatus(notification.id, 'PROCESSING')
    
    // Execute workflow
    const result = await this.triggerWorkflow(notification)
    
    // Update status to SENT
    await this.updateNotificationStatus(
      notification.id, 
      'SENT', 
      result.transactionId
    )
    
  } catch (error) {
    item.attempts++
    
    if (item.attempts < maxAttempts) {
      // Schedule retry
      this.scheduleRetry(item)
    } else {
      // Mark as failed
      await this.updateNotificationStatus(
        notification.id, 
        'FAILED', 
        null, 
        error.message
      )
    }
  }
}
```

## Retry Strategy

### 1. Exponential Backoff

The system uses exponential backoff to avoid overwhelming external services during failures.

```typescript
calculateRetryDelay(attempts: number, baseDelay: number): number {
  // Exponential backoff: delay = baseDelay * (2 ^ attempts)
  // With jitter to prevent thundering herd
  const exponentialDelay = baseDelay * Math.pow(2, attempts)
  const jitter = Math.random() * 0.1 * exponentialDelay
  return exponentialDelay + jitter
}

scheduleRetry(item: QueueItem): void {
  const retryDelay = this.calculateRetryDelay(
    item.attempts, 
    this.config.queueConfig?.retryDelay || 1000
  )
  
  item.nextRetry = new Date(Date.now() + retryDelay)
  
  setTimeout(() => {
    this.processingQueue.push(item)
    this.processQueue().catch(console.error)
  }, retryDelay)
}
```

### 2. Retry Limits

Each notification has a maximum retry limit to prevent infinite processing loops.

**Default Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: +1s (with jitter)
- Attempt 3: +2s (with jitter)
- Attempt 4: +4s (with jitter)
- After 3 retries: Mark as FAILED

### 3. Retry Categories

Different error types may warrant different retry strategies:

```typescript
enum RetryStrategy {
  IMMEDIATE = 'immediate',     // Retry immediately (rare)
  EXPONENTIAL = 'exponential', // Standard exponential backoff
  LINEAR = 'linear',           // Linear delay increase
  NO_RETRY = 'no_retry'        // Don't retry (permanent failures)
}

getRetryStrategy(error: Error): RetryStrategy {
  if (error.message.includes('validation')) {
    return RetryStrategy.NO_RETRY  // Data validation errors
  }
  
  if (error.message.includes('timeout')) {
    return RetryStrategy.LINEAR    // Network timeouts
  }
  
  return RetryStrategy.EXPONENTIAL // Default for most errors
}
```

## Memory Management

### 1. Queue Size Limits

To prevent memory exhaustion, the queue implements size limits:

```typescript
enqueue(notification: NotificationRow): boolean {
  const queueLimit = this.config.queueConfig?.queueLimit || Infinity
  
  if (this.queue.length >= queueLimit) {
    console.warn(`Queue limit reached (${queueLimit}), dropping notification`)
    return false
  }
  
  this.queue.push({
    notification,
    attempts: 0,
    lastAttempt: new Date()
  })
  
  return true
}
```

### 2. Memory Cleanup

Regular cleanup of completed and expired items:

```typescript
cleanupQueue(): void {
  const now = Date.now()
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours
  
  // Remove items older than maxAge
  this.queue = this.queue.filter(item => {
    const age = now - item.lastAttempt.getTime()
    return age < maxAge
  })
  
  // Log cleanup statistics
  console.log(`Queue cleanup completed. Items remaining: ${this.queue.length}`)
}

// Run cleanup every hour
setInterval(() => this.cleanupQueue(), 60 * 60 * 1000)
```

### 3. Graceful Shutdown

Handle application shutdown gracefully:

```typescript
async shutdown(): Promise<void> {
  console.log('Shutting down queue processor...')
  
  // Stop accepting new items
  this.isShuttingDown = true
  
  // Wait for active processing to complete
  while (this.activeProcessing > 0) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Persist remaining queue items (optional)
  if (this.queue.length > 0) {
    await this.persistQueueItems(this.queue)
  }
  
  console.log('Queue processor shutdown complete')
}
```

## Error Handling

### 1. Error Classification

```typescript
interface ProcessingError {
  type: 'network' | 'validation' | 'timeout' | 'unknown'
  message: string
  retryable: boolean
  timestamp: Date
}

classifyError(error: Error): ProcessingError {
  if (error.message.includes('ECONNREFUSED')) {
    return {
      type: 'network',
      message: error.message,
      retryable: true,
      timestamp: new Date()
    }
  }
  
  if (error.message.includes('validation')) {
    return {
      type: 'validation',
      message: error.message,
      retryable: false,
      timestamp: new Date()
    }
  }
  
  // Default classification
  return {
    type: 'unknown',
    message: error.message,
    retryable: true,
    timestamp: new Date()
  }
}
```

### 2. Error Recovery

```typescript
async recoverFromError(item: QueueItem, error: ProcessingError): Promise<void> {
  // Log error with context
  console.error('Processing error:', {
    notificationId: item.notification.id,
    attempt: item.attempts,
    error: error
  })
  
  // Update database with error details
  await supabase
    .from('ent_notification')
    .update({
      error_details: {
        type: error.type,
        message: error.message,
        attempt: item.attempts,
        timestamp: error.timestamp
      }
    })
    .eq('id', item.notification.id)
    .eq('enterprise_id', item.notification.enterprise_id)
  
  // Decide on retry strategy
  if (error.retryable && item.attempts < this.maxRetries) {
    this.scheduleRetry(item)
  } else {
    await this.markAsFailed(item, error)
  }
}
```

## Monitoring & Observability

### 1. Queue Metrics

```typescript
interface QueueMetrics {
  queueLength: number
  activeProcessing: number
  totalProcessed: number
  totalFailed: number
  averageProcessingTime: number
  retryRate: number
}

getMetrics(): QueueMetrics {
  return {
    queueLength: this.queue.length,
    activeProcessing: this.activeProcessing,
    totalProcessed: this.metrics.processed,
    totalFailed: this.metrics.failed,
    averageProcessingTime: this.metrics.avgProcessingTime,
    retryRate: this.metrics.retries / this.metrics.processed
  }
}
```

### 2. Health Checks

```typescript
isHealthy(): boolean {
  const metrics = this.getMetrics()
  
  // Check for concerning metrics
  if (metrics.queueLength > 1000) return false
  if (metrics.retryRate > 0.5) return false
  if (metrics.averageProcessingTime > 30000) return false
  
  return true
}

// Health check endpoint
app.get('/health/queue', (req, res) => {
  const healthy = subscriptionManager.isHealthy()
  const metrics = subscriptionManager.getMetrics()
  
  res.status(healthy ? 200 : 500).json({
    healthy,
    metrics
  })
})
```

### 3. Alerts

```typescript
checkAlertConditions(): void {
  const metrics = this.getMetrics()
  
  // High queue depth alert
  if (metrics.queueLength > 500) {
    this.sendAlert('HIGH_QUEUE_DEPTH', {
      queueLength: metrics.queueLength,
      threshold: 500
    })
  }
  
  // High failure rate alert
  if (metrics.retryRate > 0.3) {
    this.sendAlert('HIGH_RETRY_RATE', {
      retryRate: metrics.retryRate,
      threshold: 0.3
    })
  }
}
```

## Performance Optimization

### 1. Batch Processing

For high-volume scenarios, consider batch processing:

```typescript
async processBatch(items: QueueItem[]): Promise<void> {
  const batchSize = 10
  const batches = this.chunkArray(items, batchSize)
  
  for (const batch of batches) {
    await Promise.all(
      batch.map(item => this.processNotification(item))
    )
  }
}
```

### 2. Priority Queues

Future enhancement for priority-based processing:

```typescript
interface PriorityQueueItem extends QueueItem {
  priority: 'low' | 'medium' | 'high' | 'critical'
}

class PriorityQueue {
  private queues: Map<string, QueueItem[]> = new Map([
    ['critical', []],
    ['high', []],
    ['medium', []],
    ['low', []]
  ])
  
  dequeue(): QueueItem | undefined {
    // Process critical first, then high, medium, low
    for (const [priority, queue] of this.queues) {
      if (queue.length > 0) {
        return queue.shift()
      }
    }
    return undefined
  }
}
```

### 3. Dead Letter Queue

For notifications that consistently fail:

```typescript
class DeadLetterQueue {
  private deadLetters: QueueItem[] = []
  
  addDeadLetter(item: QueueItem, reason: string): void {
    this.deadLetters.push({
      ...item,
      deadLetterReason: reason,
      deadLetterTimestamp: new Date()
    })
    
    // Persist to database for analysis
    this.persistDeadLetter(item, reason)
  }
  
  async reprocessDeadLetters(): Promise<void> {
    // Manual reprocessing of dead letters
    const items = this.deadLetters.splice(0)
    for (const item of items) {
      item.attempts = 0 // Reset attempts
      this.processingQueue.push(item)
    }
  }
}
```

## Configuration Examples

### Development Environment
```typescript
const queueConfig = {
  maxConcurrent: 2,
  retryAttempts: 2,
  retryDelay: 500,
  queueLimit: 100
}
```

### Production Environment
```typescript
const queueConfig = {
  maxConcurrent: 20,
  retryAttempts: 5,
  retryDelay: 2000,
  queueLimit: 10000,
  processingTimeout: 60000
}
```

### High-Volume Environment
```typescript
const queueConfig = {
  maxConcurrent: 50,
  retryAttempts: 3,
  retryDelay: 1000,
  queueLimit: 50000,
  processingTimeout: 30000,
  batchSize: 20
}
```