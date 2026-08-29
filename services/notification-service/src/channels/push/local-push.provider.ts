import { Injectable, Logger } from '@nestjs/common';
import { PushProvider } from './push-provider.interface';

/**
 * No-op push provider used when FCM credentials are not configured
 * (local/dev environments). Logs instead of sending.
 */
@Injectable()
export class LocalPushProvider implements PushProvider {
  private readonly logger = new Logger(LocalPushProvider.name);

  async send(
    tokens: string[],
    title: string,
    body: string,
  ): Promise<{ invalidTokens: string[] }> {
    this.logger.warn(
      `FCM not configured — push "${title}: ${body}" not sent to ${tokens.length} device(s)`,
    );
    return { invalidTokens: [] };
  }
}
