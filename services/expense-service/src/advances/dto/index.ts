import {
  IsNumber,
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { IsUUID } from '../../is-uuid-loose';
import { Type } from 'class-transformer';
import { AdvanceStatus } from '../../entities/enums';

export class CreateAdvanceDto {
  @IsUUID()
  employeeId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsString()
  reason!: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsDateString()
  @IsOptional()
  justificationDeadline?: string;
}

export class JustifyAdvanceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  justifiedAmount!: number;

  @IsString()
  @IsOptional()
  justificationNote?: string;
}

export class UpdateAdvanceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsDateString()
  @IsOptional()
  justificationDeadline?: string;
}

export class ListAdvancesQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  perPage?: number;

  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsEnum(AdvanceStatus)
  @IsOptional()
  status?: AdvanceStatus;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;
}
