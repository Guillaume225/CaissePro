import { IsEmail, IsOptional, IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  mfaCode?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/, {
    message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character',
  })
  password!: string;
}

export class VerifyMfaDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  roleName: string;
  permissions: string[];
  tenantId: string;
  companyId: string | null;
  departmentId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}
