import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginEmployeeDto {
  @IsString()
  @IsNotEmpty()
  matricule!: string;

  @IsEmail()
  email!: string;
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  matricule!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  service!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  service?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  isActive?: boolean;
}
