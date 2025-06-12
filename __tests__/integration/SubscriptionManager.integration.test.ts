/**
 * @jest-environment node
 */

import { SubscriptionManager } from '../../app/services/realtime/SubscriptionManager'

const mockNotification = {
  id: 1,
  name: 'test-notification',
  enterprise_id: 'test-enterprise',
  notification_workflow_id: 1,
  recipients: ['12345678-1234-5234-9234-123456789012'],
  payload: { message: 'test' },
  notification_status: 'PENDING' as const,
  channels: ['EMAIL' as const],
  overrides: null,
  tags: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

describe('SubscriptionManager Integration', () => {
  const hasRealCredentials = process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY && 
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('supabase.co') && 
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY.length > 50 &&
    process.env.NOVU_SECRET_KEY &&
    !process.env.NOVU_SECRET_KEY.includes('test-secret-key') &&
    process.env.NOVU_SECRET_KEY.length > 20

  beforeEach(() => {
    if (!hasRealCredentials) {
      throw new Error('Integration tests require real credentials. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, and NOVU_SECRET_KEY')
    }
  })

  it('should handle notification processing flow with real connections', async () => {
    const mockOnNotification = jest.fn()
    
    const manager = new SubscriptionManager({
      enterpriseId: 'test-enterprise',
      onNotification: mockOnNotification
    })
    
    // Start the manager with real APIs
    await manager.start()
    
    // Wait for subscription to establish
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Verify it's active
    const status = manager.getStatus()
    expect(status.isActive).toBe(true)
    expect(status.queueLength).toBe(0)
    
    // Test queue functionality with real connections
    const addToQueueMethod = (manager as any).addToQueue.bind(manager)
    addToQueueMethod(mockNotification)
    
    const queueStatus = manager.getStatus()
    expect(queueStatus.queueLength).toBe(1)
    
    await manager.stop()
    
    console.log('✅ SubscriptionManager integration test with real APIs completed')
  }, 15000)

  it('should properly handle lifecycle with real Supabase connection', async () => {
    const manager = new SubscriptionManager({
      enterpriseId: 'test-enterprise'
    })
    
    // Test start/stop cycle
    await manager.start()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const activeStatus = manager.getStatus()
    expect(activeStatus.isActive).toBe(true)
    expect(manager.isHealthy()).toBe(true)
    
    await manager.stop()
    
    const stoppedStatus = manager.getStatus()
    expect(stoppedStatus.isActive).toBe(false)
    expect(stoppedStatus.isShuttingDown).toBe(true)
  }, 10000)
})