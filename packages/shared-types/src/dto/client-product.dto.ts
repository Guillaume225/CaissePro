/* ═══════════════════════════════════════════
 *  Client & Product DTOs
 * ═══════════════════════════════════════════ */

import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ClientType, RiskClass } from '../../enums/index.js';

/* ─── Client ─── */

export class CreateClientDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsEnum(ClientType)
  type!: ClientType;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export interface ClientResponseDto {
  id: string;
  name: string;
  type: ClientType;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  creditLimit: number;
  score: number;
  riskClass: RiskClass;
  isActive: boolean;
  totalPurchases: number;
  outstandingBalance: number;
  createdAt: string;
}

/* ─── Product ─── */

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(50)
  sku!: string;

  @IsString()
  @MaxLength(100)
  category!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export interface ProductResponseDto {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: number;
  taxRate: number;
  isActive: boolean;
  description: string | null;
  createdAt: string;
}
