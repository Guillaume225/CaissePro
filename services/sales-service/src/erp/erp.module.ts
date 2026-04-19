import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpSetting } from '../entities/erp-setting.entity';
import { FneAccountingEntry } from '../entities/fne-accounting-entry.entity';
import { ErpSettingsService } from './erp-settings.service';
import { ErpSettingsController } from './erp-settings.controller';
import { SageErpService } from './sage-erp.service';
import { ErpController } from './erp.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ErpSetting, FneAccountingEntry])],
  controllers: [ErpSettingsController, ErpController],
  providers: [ErpSettingsService, SageErpService],
  exports: [ErpSettingsService, SageErpService],
})
export class ErpModule {}
