import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Notification } from '@/entities/notification.entity';
import { DeviceToken } from '@/entities/device-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { EmailModule } from '@/channels/email/email.module';
import { SmsModule } from '@/channels/sms/sms.module';
import { PushModule } from '@/channels/push/push.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, DeviceToken]),
    JwtModule.register({}),
    EmailModule,
    SmsModule,
    PushModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
