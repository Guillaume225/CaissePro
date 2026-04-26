import { IsEmail, IsEnum, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { PlanCode } from '../../plans/plans.config';

export class ProvisionTenantDto {
  @IsString()
  @IsNotEmpty()
  externalTenantId!: string;

  @IsEnum(['STARTER', 'BUSINESS', 'PRO', 'ENTERPRISE'])
  externalPlanCode!: PlanCode;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @IsOptional()
  adminFirstName?: string;

  @IsString()
  @IsOptional()
  adminLastName?: string;
}

export class DeprovisionTenantDto {
  @IsString()
  @IsNotEmpty()
  externalTenantId!: string;
}
