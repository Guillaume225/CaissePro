import { IsIn, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token!: string;
}
