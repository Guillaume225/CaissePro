import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Notification } from '@/entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { EmailModule } from '@/channels/email/email.module';
import { SmsModule } from '@/channels/sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    JwtModule.register({}),
    EmailModule,
    SmsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
