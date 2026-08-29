import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PUSH_PROVIDER } from './push-provider.interface';
import { FcmPushProvider } from './fcm-push.provider';
import { LocalPushProvider } from './local-push.provider';

@Module({
  providers: [
    {
      provide: PUSH_PROVIDER,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('push.provider', 'fcm');
        if (provider === 'local') {
          return new LocalPushProvider();
        }
        return new FcmPushProvider(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [PUSH_PROVIDER],
})
export class PushModule {}
