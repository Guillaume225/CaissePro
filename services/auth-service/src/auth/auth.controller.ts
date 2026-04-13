import { Controller, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyMfaDto,
} from './dto';
import { Public, CurrentUser } from '../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const tokens = await this.authService.login(dto, ip, userAgent);
    return {
      success: true,
      data: tokens,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const tokens = await this.authService.refresh(dto.refreshToken, ip, userAgent);
    return {
      success: true,
      data: tokens,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    await this.authService.logout(userId, dto.refreshToken, ip, userAgent);
    return {
      success: true,
      data: { message: 'Logged out successfully' },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  async setupMfa(@CurrentUser('id') userId: string) {
    const result = await this.authService.setupMfa(userId);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@CurrentUser('id') userId: string, @Body() dto: VerifyMfaDto) {
    const result = await this.authService.verifyMfa(userId, dto.code);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '';
    await this.authService.forgotPassword(dto.email, ip);
    return {
      success: true,
      data: { message: 'If the email exists, a reset link has been sent' },
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '';
    await this.authService.resetPassword(dto.token, dto.password, ip);
    return {
      success: true,
      data: { message: 'Password reset successfully' },
      timestamp: new Date().toISOString(),
    };
  }
}
