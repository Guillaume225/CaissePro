import {
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CashDayStatus } from '../../entities/enums';

export class OpenCashClosingDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingBalance?: number;
}

export class CloseCashClosingDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actualBalance!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ListCashClosingsQueryDto {
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
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const vals = String(value)
      .split(',')
      .map((v: string) => v.trim());
    const valid = Object.values(CashDayStatus);
    return vals.filter((v: string) => valid.includes(v as CashDayStatus));
  })
  status?: CashDayStatus[];

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }) => (value as string)?.toUpperCase())
  sortOrder?: 'ASC' | 'DESC';
}
