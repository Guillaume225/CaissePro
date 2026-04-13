import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { IsUUID } from '../../is-uuid-loose';
import { CategoryDirection } from '../../entities/enums';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(20)
  code!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetLimit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9]{3,10}$/, { message: 'Account number must be 3-10 digits' })
  accountingDebitAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9]{3,10}$/, { message: 'Account number must be 3-10 digits' })
  accountingCreditAccount?: string;

  @IsOptional()
  @IsEnum(CategoryDirection)
  direction?: CategoryDirection;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(CategoryDirection)
  direction?: CategoryDirection;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9]{3,10}$/, { message: 'Account number must be 3-10 digits' })
  accountingDebitAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9]{3,10}$/, { message: 'Account number must be 3-10 digits' })
  accountingCreditAccount?: string;
}

export interface CategoryResponseDto {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  parentName: string | null;
  budgetLimit: number | null;
  isActive: boolean;
  direction: string;
  accountingDebitAccount: string | null;
  accountingCreditAccount: string | null;
  children: CategoryResponseDto[];
  createdAt: string;
  updatedAt: string;
}
