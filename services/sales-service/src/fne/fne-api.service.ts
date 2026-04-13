import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FneApiLog } from '../entities/fne-api-log.entity';
import { FneSetting } from '../entities/fne-setting.entity';

export interface FneSignResponse {
  ncc: string;
  reference: string;
  token: string;
  warning: boolean;
  balance_funds: number;
  invoice: Record<string, unknown>;
}

export interface FneRefundResponse {
  ncc: string;
  reference: string;
  token: string;
  warning: boolean;
  balance_funds: number;
  invoice?: Record<string, unknown>;
}

interface FneApiConfig {
  apiUrl: string;
  apiKey: string;
  maxRetries: number;
}

@Injectable()
export class FneApiService {
  private readonly logger = new Logger(FneApiService.name);
  private readonly defaultApiUrl: string;
  private readonly defaultApiKey: string;
  private readonly defaultMaxRetries: number;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(FneApiLog)
    private readonly logRepo: Repository<FneApiLog>,
    @InjectRepository(FneSetting)
    private readonly settingRepo: Repository<FneSetting>,
  ) {
    this.defaultApiUrl = this.config.get<string>('fne.apiUrl') || 'http://54.247.95.108/ws';
    this.defaultApiKey = this.config.get<string>('fne.apiKey') || '';
    this.defaultMaxRetries = this.config.get<number>('fne.maxRetries') || 3;
  }

  /** Resolve per-company config or fall back to env defaults */
  private async resolveConfig(companyId?: string): Promise<FneApiConfig> {
    if (companyId) {
      const setting = await this.settingRepo.findOneBy({ companyId, isActive: true });
      if (setting) {
        return {
          apiUrl: setting.apiUrl,
          apiKey: setting.apiKey,
          maxRetries: setting.maxRetries,
        };
      }
    }
    return {
      apiUrl: this.defaultApiUrl,
      apiKey: this.defaultApiKey,
      maxRetries: this.defaultMaxRetries,
    };
  }

  private buildHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }

  /** Sign (certify) an invoice — POST /external/invoices/sign */
  async signInvoice(
    body: Record<string, unknown>,
    invoiceId: string,
    userId: string,
    companyId?: string,
  ): Promise<FneSignResponse> {
    const cfg = await this.resolveConfig(companyId);
    const url = `${cfg.apiUrl}/external/invoices/sign`;
    return this.callWithRetry<FneSignResponse>('POST', url, body, invoiceId, userId, cfg);
  }

  /** Refund (credit note) — POST /external/invoices/{id}/refund */
  async refundInvoice(
    fneInvoiceId: string,
    body: { items: Array<{ id: string; quantity: number }> },
    localInvoiceId: string,
    userId: string,
    companyId?: string,
  ): Promise<FneRefundResponse> {
    const cfg = await this.resolveConfig(companyId);
    const url = `${cfg.apiUrl}/external/invoices/${fneInvoiceId}/refund`;
    return this.callWithRetry<FneRefundResponse>(
      'POST',
      url,
      body as unknown as Record<string, unknown>,
      localInvoiceId,
      userId,
      cfg,
    );
  }

  /** Generic HTTP call with retry for 500 errors */
  private async callWithRetry<T>(
    method: string,
    url: string,
    body: Record<string, unknown>,
    invoiceId: string,
    userId: string,
    cfg: FneApiConfig,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
      const log = this.logRepo.create({
        invoiceId,
        method,
        url,
        requestBody: body,
        attemptNumber: attempt,
        createdBy: userId,
      });

      try {
        const res = await fetch(url, {
          method,
          headers: this.buildHeaders(cfg.apiKey),
          body: JSON.stringify(body),
        });

        let resBody: Record<string, unknown> | null = null;
        const text = await res.text();
        try {
          resBody = JSON.parse(text);
        } catch {
          resBody = { raw: text };
        }

        log.responseStatus = res.status;
        log.responseBody = resBody;
        await this.logRepo.save(log);

        if (res.status === 200 || res.status === 201) {
          return resBody as T;
        }

        if (res.status === 400) {
          throw new BadRequestException(resBody || 'Erreur de validation FNE');
        }

        if (res.status === 401) {
          throw new UnauthorizedException(
            resBody || 'Clé API FNE invalide ou expirée — vérifiez vos paramètres',
          );
        }

        if (res.status >= 500) {
          lastError = new ServiceUnavailableException(
            'Service FNE indisponible — réessayez plus tard',
          );
          this.logger.warn(`FNE API 500 on attempt ${attempt}/${cfg.maxRetries}`);
          continue; // retry
        }

        throw new BadRequestException(`FNE API error (${res.status}): ${text}`);
      } catch (err) {
        if (err instanceof BadRequestException || err instanceof UnauthorizedException) {
          throw err;
        }

        log.errorMessage = err instanceof Error ? err.message : String(err);
        await this.logRepo.save(log).catch(() => {});
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < cfg.maxRetries) {
          this.logger.warn(
            `FNE API network error attempt ${attempt}/${cfg.maxRetries}: ${lastError.message}`,
          );
          continue;
        }
      }
    }

    throw lastError ?? new ServiceUnavailableException('Service FNE indisponible');
  }
}
