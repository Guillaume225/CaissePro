/**
 * Maps a notification's entityType/entityId (as published by the backend
 * routing rules, see notification-service/src/consumer/routing-rules.ts)
 * to the frontend route for that entity. Entity types with no dedicated
 * detail page (advance, receivable, cash_register, anomaly,
 * treasury_forecast, budget) resolve to null — the notification is still
 * markable as read, it just doesn't navigate anywhere.
 */
export function getNotificationRoute(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case 'purchase_request':
      return `/demande-achat/${entityId}`;
    case 'expense':
      return `/expenses/${entityId}`;
    default:
      return null;
  }
}
