/* ═══════════════════════════════════════════
 *  Expense DTOs
 * ═══════════════════════════════════════════ */

import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseStatus, PaymentMethod } from '../../enums/index.js';

/* ─── Create ─── */

export class CreateExpenseDto {
  @IsDateString()
  date!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  beneficiary?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

/* ─── Update ─── */

export class UpdateExpenseDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  beneficiary?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

/* ─── Response ─── */

export interface ExpenseResponseDto {
  id: string;
  reference: string;
  date: string;
  amount: number;
  description: string | null;
  beneficiary: string | null;
  paymentMethod: PaymentMethod;
  status: ExpenseStatus;
  observations: string | null;
  categoryId: string;
  categoryName: string;
  createdById: string;
  createdByName: string;
  costCenterId: string | null;
  projectId: string | null;
  approvals: ExpenseApprovalResponseDto[];
  attachments: ExpenseAttachmentResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseApprovalResponseDto {
  id: string;
  approverId: string;
  approverName: string;
  level: number;
  status: string;
  comment: string | null;
  approvedAt: string | null;
}

export interface ExpenseAttachmentResponseDto {
  id: string;
  filePath: string;
  fileType: string;
  originalFilename: string;
  ocrData: Record<string, unknown> | null;
  createdAt: string;
}

/* ─── Approve / Reject ─── */

export class ApproveExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class RejectExpenseDto {
  @IsString()
  @MaxLength(1000)
  comment!: string;
}

/* ─── Category ─── */

export class CreateExpenseCategoryDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(20)
  code!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetLimit?: number;
}

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetLimit?: number;

  @IsOptional()
  isActive?: boolean;
}

export interface ExpenseCategoryResponseDto {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  parentName: string | null;
  budgetLimit: number | null;
  isActive: boolean;
  children: ExpenseCategoryResponseDto[];
}

/* ─── Advance ─── */

export class CreateAdvanceDto {
  @IsUUID()
  employeeId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsDateString()
  justificationDeadline?: string;
}

export class JustifyAdvanceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  justifiedAmount!: number;
}

export interface AdvanceResponseDto {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  justifiedAmount: number;
  status: string;
  dueDate: string;
  justificationDeadline: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ─── Budget ─── */

export class CreateBudgetDto {
  @IsUUID()
  categoryId!: string;

  @IsUUID()
  departmentId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  allocatedAmount!: number;

  @IsOptional()
  @Type(() => Number)
  alertThresholds?: number[];
}

export interface BudgetResponseDto {
  id: string;
  categoryId: string;
  categoryName: string;
  departmentId: string;
  departmentName: string;
  periodStart: string;
  periodEnd: string;
  allocatedAmount: number;
  consumedAmount: number;
  consumedPercent: number;
  remainingAmount: number;
  alertThresholds: number[];
}
