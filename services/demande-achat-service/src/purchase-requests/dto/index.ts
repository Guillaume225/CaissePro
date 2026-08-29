import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsInt,
  IsBoolean,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
  IsArray,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { IsUUID } from '../../is-uuid-loose';
import { Type, Transform } from 'class-transformer';
import { PurchaseRequestPriority, PurchaseRequestDocumentType } from '../../entities/enums';

export class PurchaseRequestLineDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  articleReference?: string;

  @IsString()
  @MaxLength(500)
  designation!: string;

  @ValidateIf((o) => o.isOffCatalog === true)
  @IsString()
  @IsNotEmpty({ message: 'description is required for off-catalog lines' })
  description?: string;

  @IsOptional()
  @IsBoolean()
  isOffCatalog?: boolean;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsString()
  @MaxLength(50)
  unit!: string;

  // Jamais renseigné par le demandeur (RG : le prix est réservé au chiffrage
  // par le service achats, cf. PurchaseRequestsService.updateLinePricing).
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedUnitPrice?: number;

  @IsOptional()
  @IsDateString()
  desiredDate?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class LinePricingDto {
  @IsUUID()
  lineId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedUnitPrice!: number;
}

export class UpdateLinePricingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinePricingDto)
  lines!: LinePricingDto[];
}

export class CreatePurchaseRequestDto {
  @IsString()
  @MaxLength(255)
  service!: string;

  @IsString()
  @MaxLength(255)
  department!: string;

  @IsString()
  @MaxLength(500)
  subject!: string;

  @IsString()
  justification!: string;

  @IsDateString()
  desiredDate!: string;

  @IsOptional()
  @IsEnum(PurchaseRequestPriority)
  priority?: PurchaseRequestPriority;

  @ValidateIf((o) => !!o.priority && o.priority !== PurchaseRequestPriority.NORMAL)
  @IsString()
  @IsNotEmpty({ message: 'urgencyReason is required when priority is not NORMAL' })
  urgencyReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  project?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  costCenter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  budget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  site?: string;

  @IsOptional()
  @IsString()
  generalComment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestLineDto)
  lines?: PurchaseRequestLineDto[];
}

export class UpdatePurchaseRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  service?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsDateString()
  desiredDate?: string;

  @IsOptional()
  @IsEnum(PurchaseRequestPriority)
  priority?: PurchaseRequestPriority;

  @ValidateIf((o) => !!o.priority && o.priority !== PurchaseRequestPriority.NORMAL)
  @IsString()
  @IsNotEmpty({ message: 'urgencyReason is required when priority is not NORMAL' })
  urgencyReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  project?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  costCenter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  budget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  site?: string;

  @IsOptional()
  @IsString()
  generalComment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestLineDto)
  lines?: PurchaseRequestLineDto[];
}

export class ApprovalActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class RejectReturnDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motif!: string;
}

export class CancelPurchaseRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class ProcessPurchaseRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalInfo?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;
}

export class ClosePurchaseRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comment!: string;
}

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}

export class AddAttachmentDto {
  @IsOptional()
  @IsEnum(PurchaseRequestDocumentType)
  documentType?: PurchaseRequestDocumentType;
}

export class ListPurchaseRequestsQueryDto {
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
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(PurchaseRequestPriority)
  priority?: PurchaseRequestPriority;

  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @IsOptional()
  @IsString()
  service?: string;

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
  sortBy?: string;

  @IsOptional()
  @IsEnum({ ASC: 'ASC', DESC: 'DESC' })
  @Transform(({ value }) => (value as string)?.toUpperCase())
  sortOrder?: 'ASC' | 'DESC';
}

export class PurchasingListQueryDto extends ListPurchaseRequestsQueryDto {}
