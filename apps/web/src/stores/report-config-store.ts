import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

/* ═══════════════════════════════════════════════════════════════
   TYPES — Visual DFM‑style report design store
═══════════════════════════════════════════════════════════════ */

export type TextAlign = 'left' | 'center' | 'right';
export type FontWeight = 'normal' | 'bold';
export type FontStyle = 'normal' | 'italic';
export type SectionType = 'header' | 'kpis' | 'table' | 'summary' | 'footer';

/* ── Element‑level style ── */
export interface ElementStyle {
  fontSize: number; // px, 8–24
  fontFamily: 'serif' | 'sans-serif' | 'monospace';
  fontWeight: FontWeight;
  fontStyle: FontStyle;
  textAlign: TextAlign;
  color: string; // hex
  backgroundColor?: string;
}

const defaultStyle = (overrides?: Partial<ElementStyle>): ElementStyle => ({
  fontSize: 11,
  fontFamily: 'serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
  color: '#1f2937',
  ...overrides,
});

/* ── Field (column) config ── */
export interface ReportFieldConfig {
  key: string;
  label: string;
  customLabel?: string;
  visible: boolean;
  order: number;
  width?: number; // percentage (0–100); undefined = auto
  style: ElementStyle;
}

/* ── KPI config ── */
export interface ReportKpiConfig {
  key: string;
  label: string;
  customLabel?: string;
  visible: boolean;
  style: ElementStyle;
}

/* ── Section (band) config ── */
export interface SectionConfig {
  type: SectionType;
  visible: boolean;
  order: number; // display ordering
  height?: number; // for spacing control
  style: ElementStyle;
}

/* ── Header config ── */
export interface ReportHeaderConfig {
  showCompanyName: boolean;
  showCompanyAddress: boolean;
  showCompanyPhone: boolean;
  showCompanyTaxId: boolean;
  showLogo: boolean;
  customTitle?: string;
  customSubtitle?: string;
  titleStyle: ElementStyle;
  subtitleStyle: ElementStyle;
  companyStyle: ElementStyle;
}

/* ── Footer config ── */
export interface ReportFooterConfig {
  showEstabliPar: boolean;
  showVerifiePar: boolean;
  showTimestamp: boolean;
  verifiedByLabel?: string;
  style: ElementStyle;
}

/* ── Table config ── */
export interface TableConfig {
  showBorders: boolean;
  stripedRows: boolean;
  headerBg: string;
  headerColor: string;
  showTotalsRow: boolean;
  totalsLabel: string;
}

/* ── Page config ── */
export interface PageConfig {
  orientation: 'portrait' | 'landscape';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

/* ── Full report config ── */
export interface ReportConfig {
  id: string;
  name: string;
  category: 'daily' | 'period';
  page: PageConfig;
  sections: SectionConfig[];
  header: ReportHeaderConfig;
  footer: ReportFooterConfig;
  table: TableConfig;
  fields: ReportFieldConfig[];
  kpis: ReportKpiConfig[];
}

/* ═══════════════════════════════════════════════════════════════
   DEFAULTS
═══════════════════════════════════════════════════════════════ */

/* ── Data‑source field catalog (all available fields from DB entities) ── */

export type DataSourceGroup =
  | 'cash_day'
  | 'cash_movement'
  | 'expense'
  | 'expense_category'
  | 'fne_invoice'
  | 'fne_invoice_item'
  | 'fne_client'
  | 'fne_product'
  | 'fne_accounting'
  | 'advance'
  | 'disbursement'
  | 'user'
  | 'company'
  | 'budget'
  | 'computed';

export interface DataSourceField {
  key: string;
  label: string;
  group: DataSourceGroup;
  type: 'text' | 'number' | 'date' | 'datetime' | 'enum' | 'boolean' | 'currency';
}

const DS_LABELS: Record<DataSourceGroup, string> = {
  cash_day: 'Journée de caisse',
  cash_movement: 'Mouvement de caisse',
  expense: 'Dépense',
  expense_category: 'Catégorie de dépense',
  fne_invoice: 'Facture FNE',
  fne_invoice_item: 'Ligne de facture FNE',
  fne_client: 'Client FNE',
  fne_product: 'Produit FNE',
  fne_accounting: 'Écriture comptable FNE',
  advance: 'Avance',
  disbursement: 'Demande de décaissement',
  user: 'Utilisateur',
  company: 'Société',
  budget: 'Budget',
  computed: 'Champs calculés',
};

export { DS_LABELS as DATA_SOURCE_LABELS };

export const DATA_SOURCE_FIELDS: DataSourceField[] = [
  // ── Journée de caisse ──
  { key: 'cd_reference', label: 'Référence journée', group: 'cash_day', type: 'text' },
  { key: 'cd_cashType', label: 'Type caisse (Dépenses/Ventes)', group: 'cash_day', type: 'enum' },
  { key: 'cd_status', label: 'Statut journée', group: 'cash_day', type: 'enum' },
  { key: 'cd_openingBalance', label: 'Solde ouverture', group: 'cash_day', type: 'currency' },
  { key: 'cd_totalEntries', label: 'Total entrées', group: 'cash_day', type: 'currency' },
  { key: 'cd_totalExits', label: 'Total sorties', group: 'cash_day', type: 'currency' },
  { key: 'cd_theoreticalBalance', label: 'Solde théorique', group: 'cash_day', type: 'currency' },
  { key: 'cd_actualBalance', label: 'Solde réel', group: 'cash_day', type: 'currency' },
  { key: 'cd_variance', label: 'Écart', group: 'cash_day', type: 'currency' },
  { key: 'cd_comment', label: 'Commentaire journée', group: 'cash_day', type: 'text' },
  { key: 'cd_openedAt', label: 'Date/heure ouverture', group: 'cash_day', type: 'datetime' },
  { key: 'cd_closedAt', label: 'Date/heure fermeture', group: 'cash_day', type: 'datetime' },
  { key: 'cd_openedBy', label: 'Ouvert par', group: 'cash_day', type: 'text' },
  { key: 'cd_closedBy', label: 'Fermé par', group: 'cash_day', type: 'text' },

  // ── Mouvement de caisse ──
  { key: 'cm_type', label: 'Type mouvement (Entrée/Sortie)', group: 'cash_movement', type: 'enum' },
  { key: 'cm_category', label: 'Catégorie mouvement', group: 'cash_movement', type: 'enum' },
  { key: 'cm_amount', label: 'Montant mouvement', group: 'cash_movement', type: 'currency' },
  { key: 'cm_reference', label: 'Référence mouvement', group: 'cash_movement', type: 'text' },
  { key: 'cm_description', label: 'Description mouvement', group: 'cash_movement', type: 'text' },
  { key: 'cm_paymentMethod', label: 'Mode de paiement', group: 'cash_movement', type: 'enum' },
  { key: 'cm_createdBy', label: 'Enregistré par', group: 'cash_movement', type: 'text' },
  { key: 'cm_createdAt', label: 'Date/heure mouvement', group: 'cash_movement', type: 'datetime' },

  // ── Dépense ──
  { key: 'exp_reference', label: 'Référence dépense', group: 'expense', type: 'text' },
  { key: 'exp_date', label: 'Date dépense', group: 'expense', type: 'date' },
  { key: 'exp_amount', label: 'Montant dépense', group: 'expense', type: 'currency' },
  { key: 'exp_description', label: 'Description dépense', group: 'expense', type: 'text' },
  { key: 'exp_beneficiary', label: 'Bénéficiaire', group: 'expense', type: 'text' },
  { key: 'exp_paymentMethod', label: 'Mode paiement dépense', group: 'expense', type: 'enum' },
  { key: 'exp_status', label: 'Statut dépense', group: 'expense', type: 'enum' },
  { key: 'exp_observations', label: 'Observations', group: 'expense', type: 'text' },
  { key: 'exp_createdBy', label: 'Créé par', group: 'expense', type: 'text' },
  { key: 'exp_createdAt', label: 'Date création dépense', group: 'expense', type: 'datetime' },

  // ── Catégorie de dépense ──
  { key: 'cat_name', label: 'Nom catégorie', group: 'expense_category', type: 'text' },
  { key: 'cat_code', label: 'Code catégorie', group: 'expense_category', type: 'text' },
  {
    key: 'cat_budgetLimit',
    label: 'Limite budgétaire',
    group: 'expense_category',
    type: 'currency',
  },
  { key: 'cat_debitAccount', label: 'Compte débit', group: 'expense_category', type: 'text' },
  { key: 'cat_creditAccount', label: 'Compte crédit', group: 'expense_category', type: 'text' },
  { key: 'cat_parentName', label: 'Catégorie parente', group: 'expense_category', type: 'text' },

  // ── Facture FNE ──
  { key: 'fne_invoiceNumber', label: 'N° facture FNE', group: 'fne_invoice', type: 'text' },
  { key: 'fne_date', label: 'Date facture FNE', group: 'fne_invoice', type: 'date' },
  { key: 'fne_clientName', label: 'Client FNE', group: 'fne_invoice', type: 'text' },
  { key: 'fne_totalHt', label: 'Total HT', group: 'fne_invoice', type: 'currency' },
  { key: 'fne_totalTva', label: 'Montant TVA', group: 'fne_invoice', type: 'currency' },
  { key: 'fne_totalTtc', label: 'Total TTC', group: 'fne_invoice', type: 'currency' },
  { key: 'fne_status', label: 'Statut facture FNE', group: 'fne_invoice', type: 'enum' },
  { key: 'fne_nim', label: 'NIM', group: 'fne_invoice', type: 'text' },
  { key: 'fne_qrCode', label: 'Code QR', group: 'fne_invoice', type: 'text' },

  // ── Ligne de facture FNE ──
  { key: 'fni_productName', label: 'Nom produit FNE', group: 'fne_invoice_item', type: 'text' },
  { key: 'fni_quantity', label: 'Quantité', group: 'fne_invoice_item', type: 'number' },
  { key: 'fni_unitPrice', label: 'Prix unitaire', group: 'fne_invoice_item', type: 'currency' },
  { key: 'fni_taxRate', label: 'Taux TVA (%)', group: 'fne_invoice_item', type: 'number' },
  { key: 'fni_subtotal', label: 'Sous-total ligne', group: 'fne_invoice_item', type: 'currency' },

  // ── Client FNE ──
  { key: 'fnc_name', label: 'Nom client FNE', group: 'fne_client', type: 'text' },
  { key: 'fnc_taxId', label: 'N° fiscal client', group: 'fne_client', type: 'text' },
  { key: 'fnc_address', label: 'Adresse client FNE', group: 'fne_client', type: 'text' },
  { key: 'fnc_phone', label: 'Téléphone client FNE', group: 'fne_client', type: 'text' },
  { key: 'fnc_email', label: 'Email client FNE', group: 'fne_client', type: 'text' },

  // ── Produit FNE ──
  { key: 'fnp_name', label: 'Nom produit FNE', group: 'fne_product', type: 'text' },
  { key: 'fnp_code', label: 'Code produit', group: 'fne_product', type: 'text' },
  { key: 'fnp_unitPrice', label: 'Prix unitaire', group: 'fne_product', type: 'currency' },
  { key: 'fnp_taxRate', label: 'Taux TVA (%)', group: 'fne_product', type: 'number' },

  // ── Écriture comptable FNE ──
  { key: 'fna_journalCode', label: 'Code journal', group: 'fne_accounting', type: 'text' },
  { key: 'fna_accountNumber', label: 'N° compte', group: 'fne_accounting', type: 'text' },
  { key: 'fna_label', label: 'Libellé écriture', group: 'fne_accounting', type: 'text' },
  { key: 'fna_debit', label: 'Débit', group: 'fne_accounting', type: 'currency' },
  { key: 'fna_credit', label: 'Crédit', group: 'fne_accounting', type: 'currency' },
  { key: 'fna_date', label: 'Date écriture', group: 'fne_accounting', type: 'date' },

  // ── Avance ──
  { key: 'adv_employeeName', label: 'Employé (avance)', group: 'advance', type: 'text' },
  { key: 'adv_amount', label: 'Montant avance', group: 'advance', type: 'currency' },
  { key: 'adv_justifiedAmount', label: 'Montant justifié', group: 'advance', type: 'currency' },
  { key: 'adv_status', label: 'Statut avance', group: 'advance', type: 'enum' },
  { key: 'adv_dueDate', label: 'Échéance avance', group: 'advance', type: 'date' },
  {
    key: 'adv_justificationDeadline',
    label: 'Délai justification',
    group: 'advance',
    type: 'date',
  },

  // ── Demande de décaissement ──
  { key: 'dis_reference', label: 'Référence décaissement', group: 'disbursement', type: 'text' },
  { key: 'dis_lastName', label: 'Nom bénéficiaire', group: 'disbursement', type: 'text' },
  { key: 'dis_firstName', label: 'Prénom bénéficiaire', group: 'disbursement', type: 'text' },
  { key: 'dis_position', label: 'Poste', group: 'disbursement', type: 'text' },
  { key: 'dis_service', label: 'Service', group: 'disbursement', type: 'text' },
  { key: 'dis_phone', label: 'Téléphone bénéficiaire', group: 'disbursement', type: 'text' },
  { key: 'dis_matricule', label: 'Matricule', group: 'disbursement', type: 'text' },
  { key: 'dis_amount', label: 'Montant décaissement', group: 'disbursement', type: 'currency' },
  { key: 'dis_reason', label: 'Motif décaissement', group: 'disbursement', type: 'text' },
  { key: 'dis_status', label: 'Statut décaissement', group: 'disbursement', type: 'enum' },

  // ── Utilisateur ──
  { key: 'usr_firstName', label: 'Prénom utilisateur', group: 'user', type: 'text' },
  { key: 'usr_lastName', label: 'Nom utilisateur', group: 'user', type: 'text' },
  { key: 'usr_fullName', label: 'Nom complet', group: 'user', type: 'text' },
  { key: 'usr_email', label: 'Email utilisateur', group: 'user', type: 'text' },
  { key: 'usr_role', label: 'Rôle', group: 'user', type: 'text' },
  { key: 'usr_department', label: 'Département', group: 'user', type: 'text' },

  // ── Société ──
  { key: 'co_name', label: 'Nom société', group: 'company', type: 'text' },
  { key: 'co_code', label: 'Code société', group: 'company', type: 'text' },
  { key: 'co_address', label: 'Adresse société', group: 'company', type: 'text' },
  { key: 'co_phone', label: 'Téléphone société', group: 'company', type: 'text' },
  { key: 'co_email', label: 'Email société', group: 'company', type: 'text' },
  { key: 'co_taxId', label: 'N° fiscal société', group: 'company', type: 'text' },
  { key: 'co_tradeRegister', label: 'Registre du commerce', group: 'company', type: 'text' },
  { key: 'co_currency', label: 'Devise', group: 'company', type: 'text' },

  // ── Budget ──
  { key: 'bud_categoryName', label: 'Catégorie budget', group: 'budget', type: 'text' },
  { key: 'bud_departmentName', label: 'Département budget', group: 'budget', type: 'text' },
  { key: 'bud_periodStart', label: 'Début période budget', group: 'budget', type: 'date' },
  { key: 'bud_periodEnd', label: 'Fin période budget', group: 'budget', type: 'date' },
  { key: 'bud_allocatedAmount', label: 'Montant alloué', group: 'budget', type: 'currency' },
  { key: 'bud_consumedAmount', label: 'Montant consommé', group: 'budget', type: 'currency' },
  { key: 'bud_remainingAmount', label: 'Reste disponible', group: 'budget', type: 'currency' },
  { key: 'bud_consumedPercent', label: 'Consommation (%)', group: 'budget', type: 'number' },

  // ── Champs calculés ──
  { key: 'calc_seq', label: 'N° de ligne', group: 'computed', type: 'number' },
  { key: 'calc_date', label: 'Date du jour', group: 'computed', type: 'date' },
  { key: 'calc_time', label: 'Heure courante', group: 'computed', type: 'text' },
  { key: 'calc_pageNumber', label: 'N° de page', group: 'computed', type: 'number' },
  { key: 'calc_totalPages', label: 'Total pages', group: 'computed', type: 'number' },
  { key: 'calc_runningBalance', label: 'Solde cumulé', group: 'computed', type: 'currency' },
  { key: 'calc_runningTotal', label: 'Total cumulé', group: 'computed', type: 'currency' },
  { key: 'calc_rowCount', label: 'Nombre de lignes', group: 'computed', type: 'number' },
  { key: 'calc_percentOfTotal', label: '% du total', group: 'computed', type: 'number' },
];

const defaultPage = (): PageConfig => ({
  orientation: 'portrait',
  marginTop: 20,
  marginBottom: 15,
  marginLeft: 20,
  marginRight: 20,
});

const defaultSections = (): SectionConfig[] => [
  {
    type: 'header',
    visible: true,
    order: 0,
    style: defaultStyle({ textAlign: 'center', fontSize: 12 }),
  },
  { type: 'kpis', visible: true, order: 1, style: defaultStyle({ fontSize: 10 }) },
  { type: 'table', visible: true, order: 2, style: defaultStyle({ fontSize: 11 }) },
  {
    type: 'summary',
    visible: false,
    order: 3,
    style: defaultStyle({ fontSize: 11, fontWeight: 'bold' }),
  },
  {
    type: 'footer',
    visible: true,
    order: 4,
    style: defaultStyle({ fontSize: 9, color: '#6b7280' }),
  },
];

const defaultHeader = (): ReportHeaderConfig => ({
  showCompanyName: true,
  showCompanyAddress: true,
  showCompanyPhone: true,
  showCompanyTaxId: true,
  showLogo: true,
  titleStyle: defaultStyle({
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#111827',
  }),
  subtitleStyle: defaultStyle({ fontSize: 10, textAlign: 'center', color: '#6b7280' }),
  companyStyle: defaultStyle({
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#111827',
  }),
});

const defaultFooter = (): ReportFooterConfig => ({
  showEstabliPar: true,
  showVerifiePar: true,
  showTimestamp: true,
  verifiedByLabel: 'Le Directeur',
  style: defaultStyle({ fontSize: 9, color: '#6b7280' }),
});

const defaultTable = (): TableConfig => ({
  showBorders: true,
  stripedRows: true,
  headerBg: '#f3f4f6',
  headerColor: '#374151',
  showTotalsRow: true,
  totalsLabel: 'TOTAUX',
});

function mkFields(
  defs: [string, string][],
  overrides?: Partial<ElementStyle>,
): ReportFieldConfig[] {
  return defs.map(([key, label], i) => ({
    key,
    label,
    visible: true,
    order: i,
    style: defaultStyle({
      textAlign:
        /amount|debit|credit|balance|entry|exit|total|cash|subtotal|variation|variance/i.test(key)
          ? 'right'
          : 'left',
      ...overrides,
    }),
  }));
}

function mkKpis(defs: [string, string][]): ReportKpiConfig[] {
  return defs.map(([key, label]) => ({
    key,
    label,
    visible: true,
    style: defaultStyle({
      fontSize: 10,
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#1e40af',
    }),
  }));
}

/* ═══════════════════════════════════════════════════════════════
   DEFAULT REPORT DEFINITIONS — 12 states
═══════════════════════════════════════════════════════════════ */

export const DEFAULT_REPORTS: ReportConfig[] = [
  // ─── Daily reports ───
  {
    id: 'journal-caisse',
    name: 'Journal de caisse',
    category: 'daily',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['time', 'Heure'],
      ['reference', 'Référence'],
      ['label', 'Libellé'],
      ['entry', 'Entrée (FCFA)'],
      ['exit', 'Sortie (FCFA)'],
      ['balance', 'Solde (FCFA)'],
    ]),
    kpis: mkKpis([
      ['openingBalance', 'Solde initial'],
      ['totalEntries', 'Total encaissements'],
      ['totalExits', 'Total décaissements'],
      ['theoreticalBalance', 'Solde théorique'],
    ]),
  },
  {
    id: 'brouillard-caisse',
    name: 'Brouillard de caisse',
    category: 'daily',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['seq', 'N°'],
      ['time', 'Heure'],
      ['reference', 'Référence'],
      ['type', 'Type'],
      ['category', 'Catégorie'],
      ['description', 'Description'],
      ['direction', 'Sens'],
      ['amount', 'Montant (FCFA)'],
    ]),
    kpis: mkKpis([
      ['totalOps', 'Total opérations'],
      ['totalEntries', 'Total entrées'],
      ['totalExits', 'Total sorties'],
    ]),
  },
  {
    id: 'situation-caisse',
    name: 'Situation de caisse',
    category: 'daily',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['openingBalance', 'Solde initial'],
      ['totalEntries', 'Total encaissements'],
      ['totalExits', 'Total décaissements'],
      ['theoreticalBalance', 'Solde théorique'],
      ['actualBalance', 'Solde réel'],
      ['variance', 'Écart'],
      ['comment', 'Commentaire'],
      ['openedAt', 'Ouvert le'],
      ['closedAt', 'Fermé le'],
    ]),
    kpis: [],
  },
  {
    id: 'comptage',
    name: 'Fiche de comptage',
    category: 'daily',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['denomination', 'Coupure'],
      ['count', 'Nombre'],
      ['subtotal', 'Sous-total (FCFA)'],
      ['cheques', 'Montant chèques'],
      ['mobileMoney', 'Mobile Money'],
    ]),
    kpis: mkKpis([
      ['totalCash', 'Total espèces'],
      ['totalCheques', 'Total chèques'],
      ['totalMobile', 'Total Mobile Money'],
      ['grandTotal', 'Total général'],
    ]),
  },
  {
    id: 'ecarts-journalier',
    name: 'Rapport des écarts',
    category: 'daily',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['reference', 'Référence'],
      ['date', 'Date'],
      ['theoreticalBalance', 'Solde théorique'],
      ['actualBalance', 'Solde réel'],
      ['variance', 'Écart (FCFA)'],
      ['variancePercent', 'Écart (%)'],
      ['nature', 'Nature'],
      ['justification', 'Justification'],
    ]),
    kpis: mkKpis([
      ['totalVariance', 'Écart total'],
      ['variancePercent', 'Écart %'],
    ]),
  },

  // ─── Period reports ───
  {
    id: 'grand-livre',
    name: 'Grand livre de caisse',
    category: 'period',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['date', 'Date'],
      ['dayRef', 'Journée'],
      ['reference', 'Référence'],
      ['label', 'Libellé'],
      ['debit', 'Débit (FCFA)'],
      ['credit', 'Crédit (FCFA)'],
      ['balance', 'Solde (FCFA)'],
    ]),
    kpis: mkKpis([
      ['openingBalance', 'Solde initial'],
      ['totalEntries', 'Total encaissements'],
      ['totalExits', 'Total décaissements'],
      ['closingBalance', 'Solde final'],
    ]),
  },
  {
    id: 'balance',
    name: 'Balance de caisse',
    category: 'period',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['date', 'Date'],
      ['reference', 'Référence'],
      ['debit', 'Débit (FCFA)'],
      ['credit', 'Crédit (FCFA)'],
      ['balance', 'Solde (FCFA)'],
    ]),
    kpis: mkKpis([
      ['totalDebit', 'Total débit'],
      ['totalCredit', 'Total crédit'],
      ['finalBalance', 'Solde final'],
    ]),
  },
  {
    id: 'journal-comptable',
    name: 'Journal comptable de caisse',
    category: 'period',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['date', 'Date'],
      ['journalCode', 'Journal'],
      ['accountNumber', 'N° Compte'],
      ['accountLabel', 'Libellé du compte'],
      ['pieceRef', 'Pièce'],
      ['label', 'Libellé écriture'],
      ['debit', 'Débit (FCFA)'],
      ['credit', 'Crédit (FCFA)'],
    ]),
    kpis: mkKpis([
      ['totalDebit', 'Total débit'],
      ['totalCredit', 'Total crédit'],
      ['entryCount', "Nombre d'écritures"],
    ]),
  },
  {
    id: 'encaissements',
    name: 'État récapitulatif des encaissements',
    category: 'period',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['category', 'Catégorie'],
      ['cash', 'Espèces (FCFA)'],
      ['check', 'Chèques (FCFA)'],
      ['transfer', 'Virements (FCFA)'],
      ['mobileMoney', 'Mobile Money (FCFA)'],
      ['total', 'Total (FCFA)'],
    ]),
    kpis: mkKpis([
      ['totalCash', 'Total espèces'],
      ['totalChecks', 'Total chèques'],
      ['totalTransfers', 'Total virements'],
      ['totalMobile', 'Total Mobile Money'],
      ['grandTotal', 'Total général'],
    ]),
  },
  {
    id: 'decaissements',
    name: 'État récapitulatif des décaissements',
    category: 'period',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['nature', 'Nature'],
      ['cash', 'Espèces (FCFA)'],
      ['check', 'Chèques (FCFA)'],
      ['transfer', 'Virements (FCFA)'],
      ['mobileMoney', 'Mobile Money (FCFA)'],
      ['total', 'Total (FCFA)'],
    ]),
    kpis: mkKpis([
      ['totalCash', 'Total espèces'],
      ['totalChecks', 'Total chèques'],
      ['totalTransfers', 'Total virements'],
      ['totalMobile', 'Total Mobile Money'],
      ['grandTotal', 'Total général'],
    ]),
  },
  {
    id: 'synthese',
    name: 'Rapport de synthèse de trésorerie',
    category: 'period',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['date', 'Date'],
      ['reference', 'Référence'],
      ['openingBalance', 'Solde ouverture'],
      ['entries', 'Encaissements'],
      ['exits', 'Décaissements'],
      ['closingBalance', 'Solde fermeture'],
      ['variation', 'Variation'],
    ]),
    kpis: mkKpis([
      ['periodOpeningBalance', 'Solde début période'],
      ['periodClosingBalance', 'Solde fin période'],
      ['totalEntries', 'Total encaissements'],
      ['totalExits', 'Total décaissements'],
      ['netVariation', 'Variation nette'],
    ]),
  },
  {
    id: 'ecarts-cumules',
    name: 'État des écarts cumulés',
    category: 'period',
    page: defaultPage(),
    sections: defaultSections(),
    header: defaultHeader(),
    footer: defaultFooter(),
    table: defaultTable(),
    fields: mkFields([
      ['date', 'Date'],
      ['reference', 'Référence'],
      ['theoreticalBalance', 'Solde théorique'],
      ['actualBalance', 'Solde réel'],
      ['variance', 'Écart (FCFA)'],
      ['variancePercent', 'Écart (%)'],
      ['cumulativeVariance', 'Écart cumulé'],
      ['status', 'Statut'],
    ]),
    kpis: mkKpis([
      ['totalPositive', 'Excédents cumulés'],
      ['totalNegative', 'Déficits cumulés'],
      ['netVariance', 'Écart net'],
      ['avgVariancePercent', 'Écart moyen %'],
    ]),
  },
];

/* ═══════════════════════════════════════════════════════════════
   STORE
═══════════════════════════════════════════════════════════════ */

interface ReportConfigState {
  configs: ReportConfig[];
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  getConfig: (reportId: string) => ReportConfig | undefined;
  updateConfig: (reportId: string, partial: Partial<ReportConfig>) => void;
  updateField: (reportId: string, fieldKey: string, partial: Partial<ReportFieldConfig>) => void;
  updateFieldStyle: (reportId: string, fieldKey: string, style: Partial<ElementStyle>) => void;
  reorderFields: (reportId: string, fieldKeys: string[]) => void;
  updateKpi: (reportId: string, kpiKey: string, partial: Partial<ReportKpiConfig>) => void;
  updateKpiStyle: (reportId: string, kpiKey: string, style: Partial<ElementStyle>) => void;
  updateHeader: (reportId: string, partial: Partial<ReportHeaderConfig>) => void;
  updateFooter: (reportId: string, partial: Partial<ReportFooterConfig>) => void;
  updateTable: (reportId: string, partial: Partial<TableConfig>) => void;
  updatePage: (reportId: string, partial: Partial<PageConfig>) => void;
  updateSection: (
    reportId: string,
    sectionType: SectionType,
    partial: Partial<SectionConfig>,
  ) => void;
  reorderSections: (reportId: string, sectionTypes: SectionType[]) => void;
  reorderKpis: (reportId: string, kpiKeys: string[]) => void;
  addField: (reportId: string, field: ReportFieldConfig) => void;
  removeField: (reportId: string, fieldKey: string) => void;
  addKpi: (reportId: string, kpi: ReportKpiConfig) => void;
  removeKpi: (reportId: string, kpiKey: string) => void;
  resetReport: (reportId: string) => void;
  resetAll: () => void;
  loadFromServer: () => Promise<void>;
  saveToServer: (reportId: string) => Promise<void>;
  saveAllToServer: () => Promise<void>;
}

export const useReportConfigStore = create<ReportConfigState>()(
  persist(
    (set, get) => ({
      configs: DEFAULT_REPORTS.map((r) => JSON.parse(JSON.stringify(r))),
      isSyncing: false,
      lastSyncedAt: null,
      syncError: null,

      getConfig: (reportId) => get().configs.find((c) => c.id === reportId),

      updateConfig: (reportId, partial) =>
        set((s) => ({
          configs: s.configs.map((c) => (c.id === reportId ? { ...c, ...partial } : c)),
        })),

      updateField: (reportId, fieldKey, partial) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === reportId
              ? {
                  ...c,
                  fields: c.fields.map((f) => (f.key === fieldKey ? { ...f, ...partial } : f)),
                }
              : c,
          ),
        })),

      updateFieldStyle: (reportId, fieldKey, style) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === reportId
              ? {
                  ...c,
                  fields: c.fields.map((f) =>
                    f.key === fieldKey ? { ...f, style: { ...f.style, ...style } } : f,
                  ),
                }
              : c,
          ),
        })),

      reorderFields: (reportId, fieldKeys) =>
        set((s) => ({
          configs: s.configs.map((c) => {
            if (c.id !== reportId) return c;
            const ordered = fieldKeys
              .map((key, i) => {
                const f = c.fields.find((ff) => ff.key === key);
                return f ? { ...f, order: i } : null;
              })
              .filter(Boolean) as ReportFieldConfig[];
            return { ...c, fields: ordered };
          }),
        })),

      updateKpi: (reportId, kpiKey, partial) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === reportId
              ? { ...c, kpis: c.kpis.map((k) => (k.key === kpiKey ? { ...k, ...partial } : k)) }
              : c,
          ),
        })),

      updateKpiStyle: (reportId, kpiKey, style) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === reportId
              ? {
                  ...c,
                  kpis: c.kpis.map((k) =>
                    k.key === kpiKey ? { ...k, style: { ...k.style, ...style } } : k,
                  ),
                }
              : c,
          ),
        })),

      updateHeader: (reportId, partial) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === reportId ? { ...c, header: { ...c.header, ...partial } } : c,
          ),
        })),

      updateFooter: (reportId, partial) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === reportId ? { ...c, footer: { ...c.footer, ...partial } } : c,
          ),
        })),

      updateTable: (reportId, partial) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === reportId ? { ...c, table: { ...c.table, ...partial } } : c,
          ),
        })),

      updatePage: (reportId, partial) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === reportId ? { ...c, page: { ...c.page, ...partial } } : c,
          ),
        })),

      updateSection: (reportId, sectionType, partial) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === reportId
              ? {
                  ...c,
                  sections: c.sections.map((sec) =>
                    sec.type === sectionType ? { ...sec, ...partial } : sec,
                  ),
                }
              : c,
          ),
        })),

      reorderSections: (reportId, sectionTypes) =>
        set((s) => ({
          configs: s.configs.map((c) => {
            if (c.id !== reportId) return c;
            return {
              ...c,
              sections: c.sections.map((sec) => ({
                ...sec,
                order: sectionTypes.indexOf(sec.type),
              })),
            };
          }),
        })),

      reorderKpis: (reportId, kpiKeys) =>
        set((s) => ({
          configs: s.configs.map((c) => {
            if (c.id !== reportId) return c;
            const reordered = kpiKeys
              .map((key) => c.kpis.find((k) => k.key === key))
              .filter(Boolean) as ReportKpiConfig[];
            return { ...c, kpis: reordered };
          }),
        })),

      addField: (reportId, field) =>
        set((s) => ({
          configs: s.configs.map((c) => {
            if (c.id !== reportId) return c;
            if (c.fields.some((f) => f.key === field.key)) return c;
            return { ...c, fields: [...c.fields, { ...field, order: c.fields.length }] };
          }),
        })),

      removeField: (reportId, fieldKey) =>
        set((s) => ({
          configs: s.configs.map((c) => {
            if (c.id !== reportId) return c;
            const filtered = c.fields.filter((f) => f.key !== fieldKey);
            return { ...c, fields: filtered.map((f, i) => ({ ...f, order: i })) };
          }),
        })),

      addKpi: (reportId, kpi) =>
        set((s) => ({
          configs: s.configs.map((c) => {
            if (c.id !== reportId) return c;
            if (c.kpis.some((k) => k.key === kpi.key)) return c;
            return { ...c, kpis: [...c.kpis, kpi] };
          }),
        })),

      removeKpi: (reportId, kpiKey) =>
        set((s) => ({
          configs: s.configs.map((c) => {
            if (c.id !== reportId) return c;
            return { ...c, kpis: c.kpis.filter((k) => k.key !== kpiKey) };
          }),
        })),

      resetReport: (reportId) =>
        set((s) => {
          const def = DEFAULT_REPORTS.find((r) => r.id === reportId);
          if (!def) return s;
          return {
            configs: s.configs.map((c) =>
              c.id === reportId ? JSON.parse(JSON.stringify(def)) : c,
            ),
          };
        }),

      resetAll: () => set({ configs: DEFAULT_REPORTS.map((r) => JSON.parse(JSON.stringify(r))) }),

      /* ── Server sync ── */

      loadFromServer: async () => {
        set({ isSyncing: true, syncError: null });
        try {
          const { data } = await api.get('/report-configs');
          const serverConfigs: Array<{ reportId: string; configJson: string }> = data.data ?? data;
          if (serverConfigs.length > 0) {
            set((s) => {
              const merged = s.configs.map((local) => {
                const remote = serverConfigs.find((r) => r.reportId === local.id);
                if (remote) {
                  try {
                    return JSON.parse(remote.configJson) as ReportConfig;
                  } catch {
                    return local;
                  }
                }
                return local;
              });
              return { configs: merged, isSyncing: false, lastSyncedAt: new Date().toISOString() };
            });
          } else {
            set({ isSyncing: false, lastSyncedAt: new Date().toISOString() });
          }
        } catch (e: unknown) {
          set({
            isSyncing: false,
            syncError: e instanceof Error ? e.message : 'Erreur de synchronisation',
          });
        }
      },

      saveToServer: async (reportId: string) => {
        const cfg = get().configs.find((c) => c.id === reportId);
        if (!cfg) return;
        set({ isSyncing: true, syncError: null });
        try {
          await api.put(`/report-configs/${reportId}`, {
            reportId: cfg.id,
            reportName: cfg.name,
            configJson: JSON.stringify(cfg),
          });
          set({ isSyncing: false, lastSyncedAt: new Date().toISOString() });
        } catch (e: unknown) {
          set({
            isSyncing: false,
            syncError: e instanceof Error ? e.message : 'Erreur de sauvegarde',
          });
        }
      },

      saveAllToServer: async () => {
        const configs = get().configs;
        set({ isSyncing: true, syncError: null });
        try {
          await api.put('/report-configs/bulk', {
            configs: configs.map((c) => ({
              reportId: c.id,
              reportName: c.name,
              configJson: JSON.stringify(c),
            })),
          });
          set({ isSyncing: false, lastSyncedAt: new Date().toISOString() });
        } catch (e: unknown) {
          set({
            isSyncing: false,
            syncError: e instanceof Error ? e.message : 'Erreur de sauvegarde',
          });
        }
      },
    }),
    { name: 'caisseflow-report-configs', version: 2 },
  ),
);
