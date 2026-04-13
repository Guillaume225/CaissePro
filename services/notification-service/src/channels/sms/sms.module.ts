import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER } from './sms-provider.interface';
import { TwilioSmsProvider } from './twilio-sms.provider';
import { LocalSmsProvider } from './local-sms.provider';

@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('sms.provider', 'twilio');
        if (provider === 'local') {
          return new LocalSmsProvider(config);
        }
        return new TwilioSmsProvider(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
