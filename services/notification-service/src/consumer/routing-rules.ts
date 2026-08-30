import { NotificationType, NotificationChannel } from '@/common/enums';

/**
 * Routing rule: maps a RabbitMQ routing key to a notification type,
 * defines who receives it and through which channels.
 */
export interface RoutingRule {
  /** Notification type to create */
  type: NotificationType;
  /** Title template (Handlebars) */
  title: string;
  /** Message template (Handlebars) */
  message: string;
  /** Default delivery channels */
  channels: NotificationChannel[];
  /**
   * Who receives: a function that extracts recipient user IDs
   * from the event payload. Returns an array of user IDs.
   */
  getRecipients: (payload: Record<string, unknown>) => string[];
  /** Entity type for deep-linking */
  entityType: string;
  /** Extract entity ID from payload */
  getEntityId: (payload: Record<string, unknown>) => string | null;
}

/**
 * Helper to extract a single field as recipient array.
 */
function recipientFromField(field: string) {
  return (payload: Record<string, unknown>): string[] => {
    const value = (payload[field] as string) || (payload.userId as string);
    return value ? [value] : [];
  };
}

function recipientFromArrayField(field: string) {
  return (payload: Record<string, unknown>): string[] => {
    const arr = payload[field] as string[] | undefined;
    return Array.isArray(arr) ? arr : [];
  };
}

function entityIdFrom(field: string) {
  return (payload: Record<string, unknown>): string | null =>
    (payload[field] as string) || (payload.id as string) || null;
}

/**
 * Routing table: RabbitMQ routing key → RoutingRule
 */
export const ROUTING_RULES: Record<string, RoutingRule> = {
  /* ------------------------------------------------------------------ */
  /*  Expense events                                                    */
  /* ------------------------------------------------------------------ */
  'expense.submitted': {
    type: NotificationType.EXPENSE_TO_VALIDATE,
    title: 'Nouvelle dépense à valider',
    message:
      'La dépense #{{reference}} de {{amount}} FCFA soumise par {{submitterName}} nécessite votre validation.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromArrayField('approverIds'),
    entityType: 'expense',
    getEntityId: entityIdFrom('id'),
  },

  'expense.approved': {
    type: NotificationType.EXPENSE_APPROVED,
    title: 'Dépense approuvée',
    message:
      'Votre dépense #{{reference}} de {{amount}} FCFA a été approuvée par {{approverName}}.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromField('submitterId'),
    entityType: 'expense',
    getEntityId: entityIdFrom('id'),
  },

  'expense.rejected': {
    type: NotificationType.EXPENSE_REJECTED,
    title: 'Dépense rejetée',
    message: 'Votre dépense #{{reference}} a été rejetée. Motif : {{reason}}.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromField('submitterId'),
    entityType: 'expense',
    getEntityId: entityIdFrom('id'),
  },

  /* ------------------------------------------------------------------ */
  /*  Budget alerts                                                     */
  /* ------------------------------------------------------------------ */
  'budget.alert': {
    type: NotificationType.BUDGET_ALERT,
    title: 'Alerte budget — {{percentage}}% consommé',
    message:
      'Le budget «{{budgetName}}» a atteint {{percentage}}% de consommation ({{consumed}}/{{total}} FCFA).',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
    getRecipients: recipientFromArrayField('recipientIds'),
    entityType: 'budget',
    getEntityId: entityIdFrom('budgetId'),
  },

  /* ------------------------------------------------------------------ */
  /*  Advance unjustified reminder                                      */
  /* ------------------------------------------------------------------ */
  'advance.unjustified': {
    type: NotificationType.ADVANCE_UNJUSTIFIED,
    title: 'Rappel : avance non justifiée',
    message:
      "L'avance #{{reference}} de {{amount}} FCFA n'a pas encore été justifiée. Échéance : {{deadline}}.",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromField('userId'),
    entityType: 'advance',
    getEntityId: entityIdFrom('id'),
  },

  /* ------------------------------------------------------------------ */
  /*  Sales / receivable events                                         */
  /* ------------------------------------------------------------------ */
  'receivable.overdue': {
    type: NotificationType.RECEIVABLE_OVERDUE,
    title: 'Créance échue',
    message:
      'La créance #{{reference}} de {{amount}} FCFA (client : {{clientName}}) est échue depuis le {{dueDate}}.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromArrayField('recipientIds'),
    entityType: 'receivable',
    getEntityId: entityIdFrom('id'),
  },

  /* ------------------------------------------------------------------ */
  /*  Cash register                                                     */
  /* ------------------------------------------------------------------ */
  'cashregister.close.required': {
    type: NotificationType.CASH_REGISTER_CLOSE_REQUIRED,
    title: 'Clôture de caisse requise',
    message:
      'La caisse «{{registerName}}» doit être clôturée. Dernière opération : {{lastOperation}}.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromArrayField('recipientIds'),
    entityType: 'cash_register',
    getEntityId: entityIdFrom('registerId'),
  },

  /* ------------------------------------------------------------------ */
  /*  AI anomaly                                                        */
  /* ------------------------------------------------------------------ */
  'ai.anomaly.detected': {
    type: NotificationType.AI_ANOMALY_DETECTED,
    title: "Anomalie détectée par l'IA",
    message:
      'Une anomalie «{{anomalyType}}» a été détectée : {{description}}. Score de confiance : {{confidence}}%.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
    getRecipients: recipientFromArrayField('recipientIds'),
    entityType: 'anomaly',
    getEntityId: entityIdFrom('anomalyId'),
  },

  /* ------------------------------------------------------------------ */
  /*  Treasury forecast                                                 */
  /* ------------------------------------------------------------------ */
  'treasury.forecast.alert': {
    type: NotificationType.TREASURY_FORECAST_ALERT,
    title: 'Alerte de trésorerie prédictive',
    message: 'Prévision : {{forecastMessage}}. Solde prévu le {{forecastDate}} : {{amount}} FCFA.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromArrayField('recipientIds'),
    entityType: 'treasury_forecast',
    getEntityId: entityIdFrom('forecastId'),
  },

  /* ------------------------------------------------------------------ */
  /*  Demande d'Achat (e-DA — purchase request workflow)                */
  /* ------------------------------------------------------------------ */
  'da.submitted': {
    type: NotificationType.DA_SUBMITTED,
    title: 'Demande d’achat soumise',
    message: 'Votre demande d’achat #{{number}} ({{subject}}) a été soumise pour validation.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromField('requesterId'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },

  'da.to_validate': {
    type: NotificationType.DA_TO_VALIDATE,
    title: 'Demande d’achat à valider',
    message:
      'La demande d’achat #{{number}} ({{subject}}) de {{amount}} FCFA nécessite votre validation (niveau {{currentApprovalLevel}}).',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.PUSH],
    getRecipients: recipientFromArrayField('approverIds'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },

  'da.returned': {
    type: NotificationType.DA_RETURNED,
    title: 'Demande d’achat retournée',
    message:
      'Votre demande d’achat #{{number}} ({{subject}}) vous a été retournée pour correction. Motif : {{comment}}.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromField('requesterId'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },

  'da.approved': {
    type: NotificationType.DA_APPROVED,
    title: 'Demande d’achat approuvée',
    message: 'Votre demande d’achat #{{number}} ({{subject}}) a franchi le niveau de validation {{currentApprovalLevel}}.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromField('requesterId'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },

  'da.rejected': {
    type: NotificationType.DA_REJECTED,
    title: 'Demande d’achat rejetée',
    message: 'Votre demande d’achat #{{number}} ({{subject}}) a été rejetée. Motif : {{comment}}.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromField('requesterId'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },

  'da.to_price': {
    type: NotificationType.DA_TO_PRICE,
    title: 'Demande d’achat à chiffrer',
    message:
      'La demande d’achat #{{number}} ({{subject}}) attend un chiffrage (prix + devis) avant de pouvoir entrer en validation.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    // Mêmes limites que da.validated_transmitted : pas de résolution rôle→utilisateurs
    // pour l'instant, les publishers renseignent purchasingUserIds quand ils le peuvent.
    getRecipients: recipientFromArrayField('purchasingUserIds'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },

  'da.priced': {
    type: NotificationType.DA_PRICED,
    title: 'Demande d’achat chiffrée',
    message: 'Votre demande d’achat #{{number}} ({{subject}}) a été chiffrée par le service achats.',
    channels: [NotificationChannel.IN_APP],
    getRecipients: recipientFromField('requesterId'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },

  'da.validated_transmitted': {
    type: NotificationType.DA_VALIDATED_TRANSMITTED,
    title: 'Demande d’achat transmise aux achats',
    message:
      'La demande d’achat #{{number}} ({{subject}}) de {{amount}} FCFA est entièrement validée et transmise au service achats.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    // No role→users resolution mechanism exists yet (see expense.submitted's
    // approverIds precedent) — publishers populate purchasingUserIds when
    // they can resolve concrete recipients for the configured purchasing role.
    getRecipients: recipientFromArrayField('purchasingUserIds'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },

  'da.processed': {
    type: NotificationType.DA_PROCESSED,
    title: 'Bon de commande généré',
    message: 'Le bon de commande de votre demande d’achat #{{number}} ({{subject}}) a été généré.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromField('requesterId'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },

  'da.cancelled': {
    type: NotificationType.DA_CANCELLED,
    title: 'Demande d’achat annulée',
    message: 'La demande d’achat #{{number}} ({{subject}}) a été annulée. {{comment}}',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    getRecipients: recipientFromField('requesterId'),
    entityType: 'purchase_request',
    getEntityId: entityIdFrom('purchaseRequestId'),
  },
};
