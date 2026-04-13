/* ═══════════════════════════════════════════
 *  Transversal DTOs: Notification, AuditLog, CashClosing
 * ═══════════════════════════════════════════ */

import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import {
  AuditAction,
  CashClosingStatus,
  Module,
  NotificationType,
} from '../enums/index.js';

/* ─── Notification ─── */

export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;
}

export interface NotificationResponseDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

/* ─── AuditLog ─── */

export interface AuditLogResponseDto {
  id: string;
  userId: string | null;
  userName: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

/* ─── CashClosing ─── */

export class CreateCashClosingDto {
  @IsDateString()
  date!: string;

  @IsEnum(Module)
  module!: Module;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingBalance!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalIn!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalOut!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  closingBalance!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export interface CashClosingResponseDto {
  id: string;
  date: string;
  module: Module;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
  expectedBalance: number;
  variance: number;
  status: CashClosingStatus;
  closedById: string | null;
  closedByName: string | null;
  notes: string | null;
  createdAt: string;
}
