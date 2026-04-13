import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';

/**
 * Local / generic SMS API provider.
 * Sends via a configurable HTTP endpoint (e.g. local operator gateway).
 */
@Injectable()
export class LocalSmsProvider implements SmsProvider {
  private readonly logger = new Logger(LocalSmsProvider.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('sms.apiUrl', '');
    this.apiKey = this.configService.get<string>('sms.apiKey', '');
  }

  async send(to: string, message: string): Promise<void> {
    if (!this.apiUrl) {
      this.logger.warn('Local SMS API URL not configured — SMS not sent');
      return;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ to, message }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Local SMS API response ${response.status}: ${errorBody}`);
      }

      this.logger.debug(`SMS sent to ${to} via local API`);
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${(error as Error).message}`);
    }
  }
}
