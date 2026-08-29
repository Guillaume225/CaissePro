import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PurchaseRequestsService } from './purchase-requests.service';
import { PurchaseRequestsController } from './purchase-requests.controller';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        dest: cfg.get<string>('upload.dir') || './uploads',
        limits: {
          fileSize: cfg.get<number>('upload.maxFileSize') || 10 * 1024 * 1024,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService],
  exports: [PurchaseRequestsService],
})
export class PurchaseRequestsModule {}
