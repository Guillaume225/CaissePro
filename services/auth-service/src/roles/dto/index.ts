import { IsString, IsOptional, MaxLength, IsArray } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export interface RoleResponseDto {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}
