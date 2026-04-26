import { Module } from '@nestjs/common';
import { ErpSettingsService } from './erp-settings.service';
import { ErpSettingsController } from './erp-settings.controller';
import { SageErpService } from './sage-erp.service';
import { ErpController } from './erp.controller';

@Module({
  controllers: [ErpSettingsController, ErpController],
  providers: [ErpSettingsService, SageErpService],
  exports: [ErpSettingsService, SageErpService],
})
export class ErpModule {}
