import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';

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
}

export interface CategoryResponseDto {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  parentName: string | null;
  budgetLimit: number | null;
  isActive: boolean;
  children: CategoryResponseDto[];
  createdAt: string;
  updatedAt: string;
}
