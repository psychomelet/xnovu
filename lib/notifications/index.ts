export {
  triggerNotificationById,
  triggerNotificationsByIds,
  triggerPendingNotifications,
  triggerNotificationByCriteria,
  type TriggerResult,
  type RecipientResult
} from './trigger';

// Export async notification client for Temporal-based triggers
export { notificationClient } from '../temporal/client';