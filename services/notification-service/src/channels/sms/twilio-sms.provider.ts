import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';

/**
 * Twilio SMS provider implementation.
 * If credentials are not configured, logs a warning and skips.
 */
@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;

  constructor(private readonly configService: ConfigService) {
    this.accountSid = this.configService.get<string>('sms.twilioAccountSid', '');
    this.authToken = this.configService.get<string>('sms.twilioAuthToken', '');
    this.fromNumber = this.configService.get<string>('sms.twilioFromNumber', '');
  }

  async send(to: string, message: string): Promise<void> {
    if (!this.accountSid || !this.authToken) {
      this.logger.warn('Twilio credentials not configured — SMS not sent');
      return;
    }

    try {
      // Twilio REST API call via fetch (avoids heavy SDK dependency)
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const body = new URLSearchParams({
        To: to,
        From: this.fromNumber,
        Body: message,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Twilio response ${response.status}: ${errorBody}`);
      }

      this.logger.debug(`SMS sent to ${to} via Twilio`);
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${(error as Error).message}`);
    }
  }
}
