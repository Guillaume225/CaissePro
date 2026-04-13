import { Module, forwardRef } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { NotificationsModule } from '@/notifications/notifications.module';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  providers: [ConsumerService],
  exports: [ConsumerService],
})
export class ConsumerModule {}
