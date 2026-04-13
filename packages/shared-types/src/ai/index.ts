/* ═══════════════════════════════════════════
 *  AI / ML Types
 * ═══════════════════════════════════════════ */

/* ─── Category Prediction (auto-categorization of expenses) ─── */

export interface CategoryPrediction {
  categoryId: string;
  categoryName: string;
  confidence: number; // 0-1
  alternativeSuggestions: Array<{
    categoryId: string;
    categoryName: string;
    confidence: number;
  }>;
}

/* ─── Anomaly Detection ─── */

export interface AnomalyScore {
  entityId: string;
  entityType: 'expense' | 'sale' | 'payment';
  score: number; // 0-1 (1 = highly anomalous)
  reasons: AnomalyReason[];
  detectedAt: string;
}

export interface AnomalyReason {
  code: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: Record<string, unknown>;
}

/* ─── Sales Forecast ─── */

export interface SalesForecast {
  period: string; // e.g. "2026-04"
  predictedRevenue: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  growthRate: number; // percent vs. previous period
  breakdown: SalesForecastBreakdown[];
}

export interface SalesForecastBreakdown {
  category: string;
  predictedRevenue: number;
  percentOfTotal: number;
}

/* ─── Client Scoring ─── */

export interface ClientScore {
  clientId: string;
  clientName: string;
  score: number; // 0-100
  riskClass: 'A' | 'B' | 'C' | 'D';
  paymentBehavior: PaymentBehaviorMetrics;
  recommendation: string;
  computedAt: string;
}

export interface PaymentBehaviorMetrics {
  averageDaysToPayment: number;
  onTimePaymentRate: number; // 0-1
  totalPurchases: number;
  totalOutstanding: number;
  lastPaymentDate: string | null;
}

/* ─── OCR ─── */

export interface OCRResult {
  rawText: string;
  confidence: number;
  extractedFields: OCRExtractedFields;
  language: string;
  processingTimeMs: number;
}

export interface OCRExtractedFields {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  invoiceNumber: string | null;
  taxAmount: number | null;
  lineItems: OCRLineItem[];
}

export interface OCRLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  total: number | null;
}

/* ─── AI Chat / Narrative Reports ─── */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    sources?: string[];
  };
}

export interface NarrativeReport {
  id: string;
  title: string;
  period: string;
  module: 'EXPENSE' | 'SALE' | 'GLOBAL';
  summary: string;
  sections: NarrativeSection[];
  generatedAt: string;
  modelName: string;
}

export interface NarrativeSection {
  heading: string;
  body: string;
  highlights: string[];
  charts?: string[]; // chart IDs to render alongside
}

/* ─── AI Prediction record (mirrors DB entity) ─── */

export interface AIPredictionDto {
  id: string;
  modelName: string;
  entityType: string;
  entityId: string | null;
  prediction: Record<string, unknown>;
  confidence: number;
  userFeedback: string | null;
  createdAt: string;
}
