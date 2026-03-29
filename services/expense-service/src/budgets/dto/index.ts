import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBudgetDto {
  @IsUUID()
  categoryId!: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  allocatedAmount!: number;

  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  @Type(() => Number)
  alertThresholds?: number[];
}

export class UpdateBudgetDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  allocatedAmount?: number;

  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  @Type(() => Number)
  alertThresholds?: number[];
}
