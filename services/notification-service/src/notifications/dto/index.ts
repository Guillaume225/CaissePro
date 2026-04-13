import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { NotificationType } from '@/common/enums';

export class ListNotificationsQueryDto {
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
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  read?: boolean;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }) => (value as string)?.toUpperCase())
  sortOrder?: 'ASC' | 'DESC';
}
