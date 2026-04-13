import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { IsUUID } from '../../is-uuid-loose';
import { Type, Transform } from 'class-transformer';
import { AgingBucket } from '../../entities/enums';

export class ListReceivablesQueryDto {
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
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsEnum(AgingBucket)
  agingBucket?: AgingBucket;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isSettled?: boolean;

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
