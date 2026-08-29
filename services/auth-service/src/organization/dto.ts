import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { IsUUID } from '../is-uuid-loose';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsUUID()
  departmentId!: string;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
