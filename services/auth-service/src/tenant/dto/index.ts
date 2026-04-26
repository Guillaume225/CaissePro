import { IsEmail, IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { PlanCode } from '../../plans/plans.config';

export class UpdateTenantPlanDto {
  @IsEnum(['STARTER', 'BUSINESS', 'PRO', 'ENTERPRISE'])
  planCode!: PlanCode;
}

export class TenantPlanStatusDto {
  tenantId!: string;
  externalTenantId!: string;
  planCode!: PlanCode;
  displayName!: string;
  aiLevel!: string;
  limits!: Record<string, { limit: number | null; current: number; percentage: number | null }>;
  features!: Record<string, boolean>;
}
