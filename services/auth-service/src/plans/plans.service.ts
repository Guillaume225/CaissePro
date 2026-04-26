import { Injectable, NotFoundException } from '@nestjs/common';
import { PLAN_DEFINITIONS, PlanCode, PlanDefinition } from './plans.config';

@Injectable()
export class PlansService {
  getPlan(code: PlanCode): PlanDefinition {
    const plan = PLAN_DEFINITIONS[code];
    if (!plan) throw new NotFoundException(`Plan "${code}" inconnu`);
    return plan;
  }

  getAllPlans(): PlanDefinition[] {
    return Object.values(PLAN_DEFINITIONS);
  }

  hasFeature(code: PlanCode, feature: string): boolean {
    const plan = this.getPlan(code);
    return (plan.features as unknown as Record<string, boolean>)[feature] ?? false;
  }

  getLimit(code: PlanCode, limitName: string): number | null {
    const plan = this.getPlan(code);
    const value = (plan.limits as unknown as Record<string, number | null>)[limitName];
    return value ?? null;
  }
}
