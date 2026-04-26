import { PlanCode, AiLevel } from '../plans/plans.config';

export interface LimitStatus {
  limit: number | null;
  current: number;
  percentage: number | null;
  warning: boolean;
}

export interface PlanStatus {
  tenantId: string;
  planCode: PlanCode;
  displayName: string;
  aiLevel: AiLevel;
  limits: Record<string, LimitStatus>;
  features: Record<string, boolean>;
}
