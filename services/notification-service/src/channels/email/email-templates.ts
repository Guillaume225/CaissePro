import { NotificationType } from '@/common/enums';

const LAYOUT_HEADER = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a73e8, #0d47a1); padding: 24px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .header .subtitle { margin-top: 4px; font-size: 13px; opacity: 0.85; }
    .body { padding: 32px; color: #333333; line-height: 1.6; }
    .body h2 { color: #1a73e8; font-size: 18px; margin-top: 0; }
    .info-box { background: #f0f4ff; border-left: 4px solid #1a73e8; padding: 16px; margin: 16px 0; border-radius: 4px; }
    .alert-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 16px; margin: 16px 0; border-radius: 4px; }
    .danger-box { background: #fce4ec; border-left: 4px solid #e53935; padding: 16px; margin: 16px 0; border-radius: 4px; }
    .success-box { background: #e8f5e9; border-left: 4px solid #43a047; padding: 16px; margin: 16px 0; border-radius: 4px; }
    .btn { display: inline-block; padding: 12px 24px; background: #1a73e8; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 20px 32px; background: #f8f9fa; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
    .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-label { font-weight: 600; min-width: 140px; color: #555; }
    .detail-value { color: #333; }
  </style>
</head>
<body>
  <div style="padding: 20px 0;">
    <div class="container">
`;

const LAYOUT_FOOTER = `
      <div class="footer">
        <p>CaisseFlow Pro — Système de gestion financière</p>
        <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

function wrap(headerTitle: string, headerSubtitle: string, body: string): string {
  return `${LAYOUT_HEADER}
      <div class="header">
        <h1>${headerTitle}</h1>
        <div class="subtitle">${headerSubtitle}</div>
      </div>
      <div class="body">
        ${body}
      </div>
${LAYOUT_FOOTER}`;
}

export const EMAIL_TEMPLATES: Record<string, string> = {
  /* ------------------------------------------------------------------ */
  [NotificationType.EXPENSE_TO_VALIDATE]: wrap(
    '📋 Dépense à valider',
    'Une nouvelle dépense nécessite votre approbation',
    `<h2>Nouvelle dépense soumise</h2>
     <div class="info-box">
       <div class="detail-row"><span class="detail-label">Référence :</span> <span class="detail-value">{{reference}}</span></div>
       <div class="detail-row"><span class="detail-label">Montant :</span> <span class="detail-value">{{amount}} FCFA</span></div>
       <div class="detail-row"><span class="detail-label">Soumis par :</span> <span class="detail-value">{{submitterName}}</span></div>
       <div class="detail-row"><span class="detail-label">Catégorie :</span> <span class="detail-value">{{category}}</span></div>
       <div class="detail-row"><span class="detail-label">Description :</span> <span class="detail-value">{{description}}</span></div>
     </div>
     <p>Veuillez examiner cette dépense et prendre une décision.</p>`,
  ),

  /* ------------------------------------------------------------------ */
  [NotificationType.EXPENSE_APPROVED]: wrap(
    '✅ Dépense approuvée',
    'Votre dépense a été validée',
    `<h2>Dépense approuvée</h2>
     <div class="success-box">
       <div class="detail-row"><span class="detail-label">Référence :</span> <span class="detail-value">{{reference}}</span></div>
       <div class="detail-row"><span class="detail-label">Montant :</span> <span class="detail-value">{{amount}} FCFA</span></div>
       <div class="detail-row"><span class="detail-label">Approuvé par :</span> <span class="detail-value">{{approverName}}</span></div>
     </div>
     <p>Votre dépense a été approuvée et sera traitée pour paiement.</p>`,
  ),

  /* ------------------------------------------------------------------ */
  [NotificationType.EXPENSE_REJECTED]: wrap(
    '❌ Dépense rejetée',
    "Votre dépense n'a pas été approuvée",
    `<h2>Dépense rejetée</h2>
     <div class="danger-box">
       <div class="detail-row"><span class="detail-label">Référence :</span> <span class="detail-value">{{reference}}</span></div>
       <div class="detail-row"><span class="detail-label">Montant :</span> <span class="detail-value">{{amount}} FCFA</span></div>
       <div class="detail-row"><span class="detail-label">Motif :</span> <span class="detail-value">{{reason}}</span></div>
     </div>
     <p>Vous pouvez corriger et soumettre à nouveau votre dépense si nécessaire.</p>`,
  ),

  /* ------------------------------------------------------------------ */
  [NotificationType.BUDGET_ALERT]: wrap(
    '⚠️ Alerte budget',
    'Un seuil budgétaire a été atteint',
    `<h2>Alerte de consommation budgétaire</h2>
     <div class="alert-box">
       <div class="detail-row"><span class="detail-label">Budget :</span> <span class="detail-value">{{budgetName}}</span></div>
       <div class="detail-row"><span class="detail-label">Consommation :</span> <span class="detail-value">{{percentage}}%</span></div>
       <div class="detail-row"><span class="detail-label">Consommé :</span> <span class="detail-value">{{consumed}} / {{total}} FCFA</span></div>
       <div class="detail-row"><span class="detail-label">Département :</span> <span class="detail-value">{{departmentName}}</span></div>
     </div>
     <p>Veuillez prendre les mesures nécessaires pour maîtriser les dépenses sur ce budget.</p>`,
  ),

  /* ------------------------------------------------------------------ */
  [NotificationType.ADVANCE_UNJUSTIFIED]: wrap(
    '🔔 Avance non justifiée',
    "Rappel de justification d'avance",
    `<h2>Rappel : avance non justifiée</h2>
     <div class="alert-box">
       <div class="detail-row"><span class="detail-label">Référence :</span> <span class="detail-value">{{reference}}</span></div>
       <div class="detail-row"><span class="detail-label">Montant :</span> <span class="detail-value">{{amount}} FCFA</span></div>
       <div class="detail-row"><span class="detail-label">Date avance :</span> <span class="detail-value">{{advanceDate}}</span></div>
       <div class="detail-row"><span class="detail-label">Échéance :</span> <span class="detail-value">{{deadline}}</span></div>
     </div>
     <p>Merci de fournir les justificatifs dans les meilleurs délais.</p>`,
  ),

  /* ------------------------------------------------------------------ */
  [NotificationType.RECEIVABLE_OVERDUE]: wrap(
    '💰 Créance échue',
    'Une créance client est en souffrance',
    `<h2>Créance échue</h2>
     <div class="danger-box">
       <div class="detail-row"><span class="detail-label">Référence :</span> <span class="detail-value">{{reference}}</span></div>
       <div class="detail-row"><span class="detail-label">Client :</span> <span class="detail-value">{{clientName}}</span></div>
       <div class="detail-row"><span class="detail-label">Montant :</span> <span class="detail-value">{{amount}} FCFA</span></div>
       <div class="detail-row"><span class="detail-label">Échue depuis :</span> <span class="detail-value">{{dueDate}}</span></div>
     </div>
     <p>Veuillez procéder aux relances nécessaires.</p>`,
  ),

  /* ------------------------------------------------------------------ */
  [NotificationType.CASH_REGISTER_CLOSE_REQUIRED]: wrap(
    '🏪 Clôture de caisse requise',
    'Action requise sur une caisse',
    `<h2>Clôture de caisse requise</h2>
     <div class="alert-box">
       <div class="detail-row"><span class="detail-label">Caisse :</span> <span class="detail-value">{{registerName}}</span></div>
       <div class="detail-row"><span class="detail-label">Dernière opération :</span> <span class="detail-value">{{lastOperation}}</span></div>
     </div>
     <p>Veuillez procéder à la clôture de cette caisse dans les meilleurs délais.</p>`,
  ),

  /* ------------------------------------------------------------------ */
  [NotificationType.AI_ANOMALY_DETECTED]: wrap(
    '🤖 Anomalie IA détectée',
    "Le système d'intelligence artificielle a identifié une anomalie",
    `<h2>Anomalie détectée</h2>
     <div class="danger-box">
       <div class="detail-row"><span class="detail-label">Type :</span> <span class="detail-value">{{anomalyType}}</span></div>
       <div class="detail-row"><span class="detail-label">Description :</span> <span class="detail-value">{{description}}</span></div>
       <div class="detail-row"><span class="detail-label">Confiance :</span> <span class="detail-value">{{confidence}}%</span></div>
     </div>
     <p>Veuillez examiner cette anomalie et prendre les mesures correctives si nécessaire.</p>`,
  ),

  /* ------------------------------------------------------------------ */
  [NotificationType.TREASURY_FORECAST_ALERT]: wrap(
    '📈 Alerte trésorerie prédictive',
    'Prévision de trésorerie nécessitant votre attention',
    `<h2>Alerte de trésorerie</h2>
     <div class="alert-box">
       <div class="detail-row"><span class="detail-label">Prévision :</span> <span class="detail-value">{{forecastMessage}}</span></div>
       <div class="detail-row"><span class="detail-label">Date prévue :</span> <span class="detail-value">{{forecastDate}}</span></div>
       <div class="detail-row"><span class="detail-label">Solde prévu :</span> <span class="detail-value">{{amount}} FCFA</span></div>
     </div>
     <p>Nous vous recommandons de prendre des mesures préventives.</p>`,
  ),

  /* ------------------------------------------------------------------ */
  DEFAULT: wrap(
    '🔔 Notification CaisseFlow',
    'Vous avez une nouvelle notification',
    `<h2>{{subject}}</h2>
     <div class="info-box">
       <p>{{textContent}}</p>
     </div>`,
  ),
};
