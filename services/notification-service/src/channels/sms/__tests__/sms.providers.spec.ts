import { ConfigService } from '@nestjs/config';
import { TwilioSmsProvider } from '@/channels/sms/twilio-sms.provider';
import { LocalSmsProvider } from '@/channels/sms/local-sms.provider';

describe('TwilioSmsProvider', () => {
  it('should not send when credentials not configured', async () => {
    const config = {
      get: jest.fn(() => {
        return '';
      }),
    } as unknown as ConfigService;

    const provider = new TwilioSmsProvider(config);
    // Should not throw
    await expect(provider.send('+237600', 'Hello')).resolves.not.toThrow();
  });
});

describe('LocalSmsProvider', () => {
  it('should not send when apiUrl not configured', async () => {
    const config = {
      get: jest.fn(() => {
        return '';
      }),
    } as unknown as ConfigService;

    const provider = new LocalSmsProvider(config);
    await expect(provider.send('+237600', 'Hello')).resolves.not.toThrow();
  });
});
