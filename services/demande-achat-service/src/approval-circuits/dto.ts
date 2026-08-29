import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ApprovalStepDto {
  @IsOptional()
  @IsNumber()
  level?: number;

  @IsString()
  role!: string;

  @IsOptional()
  @IsString()
  approverId?: string;

  @IsOptional()
  @IsString()
  approverName?: string;
}

export class CreateApprovalCircuitDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  steps?: ApprovalStepDto[];
}
