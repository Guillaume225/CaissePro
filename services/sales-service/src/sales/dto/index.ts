import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  IsInt,
  IsEnum,
  Min,
  Max,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { IsUUID } from '../../is-uuid-loose';
import { Type, Transform } from 'class-transformer';
import { SaleStatus, PaymentMethod } from '../../entities/enums';

/* ─── Sale Item ─── */
export class SaleItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPct?: number;
}

/* ─── Create Sale ─── */
export class CreateSaleDto {
  @IsDateString()
  date!: string;

  @IsUUID()
  clientId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  globalDiscountPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

/* ─── Update Sale (DRAFT only) ─── */
export class UpdateSaleDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => SaleItemDto)
  items?: SaleItemDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  globalDiscountPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

/* ─── List / filter ─── */
export class ListSalesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;

  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountMax?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }) => (value as string)?.toUpperCase())
  sortOrder?: 'ASC' | 'DESC';
}

/* ─── Payment ─── */
export class CreatePaymentDto {
  @IsUUID()
  saleId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  checkNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
