import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { App } from 'firebase-admin/app';
import { PushProvider } from './push-provider.interface';

const FCM_BATCH_SIZE = 500; // hard limit of the multicast API

/**
 * Firebase Cloud Messaging provider via the Admin SDK.
 * Requires FCM_SERVICE_ACCOUNT_JSON (the service account JSON, as a string)
 * to be configured — falls back to logging a warning otherwise.
 */
@Injectable()
export class FcmPushProvider implements PushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  private app: App | null = null;

  constructor(private readonly configService: ConfigService) {}

  private async getApp(): Promise<App | null> {
    if (this.app) return this.app;

    const raw = this.configService.get<string>('push.fcmServiceAccountJson', '');
    if (!raw) {
      this.logger.warn('FCM_SERVICE_ACCOUNT_JSON not configured — push notifications disabled');
      return null;
    }

    try {
      const { initializeApp, cert } = await import('firebase-admin/app');
      const serviceAccount = JSON.parse(raw);
      this.app = initializeApp({ credential: cert(serviceAccount) }, 'notification-service');
      this.logger.log(`Firebase Admin SDK initialized (project: ${serviceAccount.project_id})`);
      return this.app;
    } catch (error) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${(error as Error).message}`);
      return null;
    }
  }

  async send(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<{ invalidTokens: string[] }> {
    const app = await this.getApp();
    if (!app || tokens.length === 0) return { invalidTokens: [] };

    const { getMessaging } = await import('firebase-admin/messaging');
    const messaging = getMessaging(app);
    const invalidTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
      const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          data,
        });
        response.responses.forEach((r, idx) => {
          if (r.success) return;
          if (this.isInvalidTokenError(r.error?.code)) {
            invalidTokens.push(batch[idx]);
          } else {
            this.logger.warn(`FCM send failed for a token: ${r.error?.code} — ${r.error?.message}`);
          }
        });
        this.logger.log(
          `FCM push: ${response.successCount}/${batch.length} delivered, ${response.failureCount} failed`,
        );
      } catch (error) {
        this.logger.error(`FCM multicast send failed: ${(error as Error).message}`);
      }
    }

    return { invalidTokens };
  }

  private isInvalidTokenError(code: string | undefined): boolean {
    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    );
  }
}
