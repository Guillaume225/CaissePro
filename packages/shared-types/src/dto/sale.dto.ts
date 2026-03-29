/* ═══════════════════════════════════════════
 *  Sale DTOs
 * ═══════════════════════════════════════════ */

import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, SaleStatus } from '../../enums/index.js';

/* ─── Sale Item (nested) ─── */

export class CreateSaleItemDto {
  @IsUUID()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountPercent?: number;
}

/* ─── Create Sale ─── */

export class CreateSaleDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}

/* ─── Update Sale ─── */

export class UpdateSaleDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items?: CreateSaleItemDto[];
}

/* ─── Sale Response ─── */

export interface SaleItemResponseDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  subtotal: number;
}

export interface SaleResponseDto {
  id: string;
  reference: string;
  date: string;
  clientId: string | null;
  clientName: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  status: SaleStatus;
  sellerId: string;
  sellerName: string;
  items: SaleItemResponseDto[];
  payments: PaymentResponseDto[];
  createdAt: string;
  updatedAt: string;
}

/* ─── Payment ─── */

export class CreatePaymentDto {
  @IsUUID()
  saleId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsDateString()
  date!: string;
}

export interface PaymentResponseDto {
  id: string;
  saleId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  date: string;
  receivedById: string;
  receivedByName: string;
  createdAt: string;
}

/* ─── Receivable ─── */

export interface ReceivableResponseDto {
  id: string;
  saleId: string;
  saleReference: string;
  clientId: string;
  clientName: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  status: string;
  agingBucket: string;
  createdAt: string;
}
