import { ROUTING_RULES } from '@/consumer/routing-rules';
import { NotificationType, NotificationChannel } from '@/common/enums';

describe('Routing Rules', () => {
  it('should have rules for all expected routing keys', () => {
    const expectedKeys = [
      'expense.submitted',
      'expense.approved',
      'expense.rejected',
      'budget.alert',
      'advance.unjustified',
      'receivable.overdue',
      'cashregister.close.required',
      'ai.anomaly.detected',
      'treasury.forecast.alert',
    ];

    for (const key of expectedKeys) {
      expect(ROUTING_RULES[key]).toBeDefined();
      expect(ROUTING_RULES[key].type).toBeDefined();
      expect(ROUTING_RULES[key].channels.length).toBeGreaterThan(0);
    }
  });

  it('expense.submitted should notify approvers via IN_APP + EMAIL', () => {
    const rule = ROUTING_RULES['expense.submitted'];
    expect(rule.type).toBe(NotificationType.EXPENSE_TO_VALIDATE);
    expect(rule.channels).toContain(NotificationChannel.IN_APP);
    expect(rule.channels).toContain(NotificationChannel.EMAIL);
  });

  it('budget.alert should also include SMS channel', () => {
    const rule = ROUTING_RULES['budget.alert'];
    expect(rule.type).toBe(NotificationType.BUDGET_ALERT);
    expect(rule.channels).toContain(NotificationChannel.SMS);
  });

  it('ai.anomaly.detected should also include SMS channel', () => {
    const rule = ROUTING_RULES['ai.anomaly.detected'];
    expect(rule.type).toBe(NotificationType.AI_ANOMALY_DETECTED);
    expect(rule.channels).toContain(NotificationChannel.SMS);
  });

  it('expense.submitted getRecipients should extract approverIds', () => {
    const rule = ROUTING_RULES['expense.submitted'];
    const recipients = rule.getRecipients({ approverIds: ['mgr-1', 'mgr-2'] });
    expect(recipients).toEqual(['mgr-1', 'mgr-2']);
  });

  it('expense.approved getRecipients should extract submitterId', () => {
    const rule = ROUTING_RULES['expense.approved'];
    const recipients = rule.getRecipients({ submitterId: 'emp-1' });
    expect(recipients).toEqual(['emp-1']);
  });

  it('rules should extract entityId from payload', () => {
    const rule = ROUTING_RULES['expense.approved'];
    expect(rule.getEntityId({ id: 'exp-123' })).toBe('exp-123');
  });

  it('budget.alert should extract budgetId as entityId', () => {
    const rule = ROUTING_RULES['budget.alert'];
    expect(rule.getEntityId({ budgetId: 'bgt-1' })).toBe('bgt-1');
  });
});
