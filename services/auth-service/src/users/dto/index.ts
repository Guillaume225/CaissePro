import {
  IsEmail,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';
import { IsUUID } from '../../is-uuid-loose';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/, {
    message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character' })
  password!: string;

  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsArray()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { each: true, message: 'each value in companyIds must be a valid UUID' })
  companyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['expense', 'sales', 'admin', 'decision', 'fne', 'manager-caisse'], { each: true })
  allowedModules?: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsArray()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { each: true, message: 'each value in companyIds must be a valid UUID' })
  companyIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  mfaConfigured?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['expense', 'sales', 'admin', 'decision', 'fne', 'manager-caisse'], { each: true })
  allowedModules?: string[];
}

export class ListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  tenantId: string;
  departmentId: string | null;
  companyId: string | null;
  companyName: string | null;
  companyIds: string[];
  companyNames: string[];
  isActive: boolean;
  mfaEnabled: boolean;
  mfaConfigured: boolean;
  lastLogin: string | null;
  createdAt: string;
  allowedModules: string[];
}
