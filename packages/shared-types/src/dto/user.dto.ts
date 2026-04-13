/* ═══════════════════════════════════════════
 *  User / Auth / Role DTOs
 * ═══════════════════════════════════════════ */

import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/* ─── Auth ─── */

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class EnableMfaDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password!: string;
}

/* ─── User CRUD ─── */

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
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
  @IsBoolean()
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
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLogin: string | null;
  createdAt: string;
}

/* ─── Role ─── */

export class CreateRoleDto {
  @IsString()
  @MaxLength(50)
  name!: string;

  @IsOptional()
  permissions?: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  permissions?: string[];
}

export interface RoleResponseDto {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
}

/* ─── Department ─── */

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}

export interface DepartmentResponseDto {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
  userCount: number;
}
