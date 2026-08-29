import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';

@Controller()
export class AppController {
  @Get('health')
  @Public()
  health() {
    return { status: 'ok', service: 'demande-achat-service', timestamp: new Date().toISOString() };
  }
}
