import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import { ErpSetting } from '../entities/erp-setting.entity';
import { PurchaseRequest } from '../entities/purchase-request.entity';
import { PurchaseRequestLine } from '../entities/purchase-request-line.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

/**
 * Sage ERP connector for purchase orders (bons de commande), mirroring
 * sales-service's SageErpService (same DCP REST queue API, same HTTPS
 * client), but posting to Sage's "import contrat" processus instead of the
 * accounting-entries one, with its own CSV shape:
 *
 *   Reference DA;DateBC;CodeFournisseur;DesignationProduit;CodeProduit;PrixUnitaire;Qte
 *
 * Example:
 *   DA-2026-000004;01/01/2026;FOUR001;Ecrans 24 pouces;PROD-DIVERS;600;6
 */

const FIELD_SEPARATOR = ';';
const LINE_SEPARATOR = '\n';
const SAGE_PRODUCT_CODE = 'PROD-DIVERS';

export interface SagePoPostResult {
  success: boolean;
  message: string;
  rawResponse?: string;
}

@Injectable()
export class SagePurchaseOrderService {
  private readonly logger = new Logger(SagePurchaseOrderService.name);

  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  /**
   * Poste un bon de commande vers Sage. Appelé automatiquement depuis
   * PurchaseRequestsService.process() une fois le fournisseur renseigné et
   * la demande passée à PROCESSED — jamais bloquant : les erreurs sont
   * retournées à l'appelant (qui les stocke sur la demande) plutôt que
   * levées, pour ne jamais faire échouer la génération du bon de commande.
   */
  async postPurchaseOrder(
    tenantId: string,
    request: PurchaseRequest,
    lines: PurchaseRequestLine[],
  ): Promise<SagePoPostResult> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const erpSettingRepo = ds.getRepository(ErpSetting);

    const setting = await erpSettingRepo.findOne({ where: { isActive: true } });
    if (!setting) {
      this.logger.warn(`[SAGE-BC] Aucune configuration ERP active — DA ${request.number} non envoyée`);
      return { success: false, message: 'Configuration ERP Sage non trouvée ou inactive' };
    }
    if (!setting.autoPostPurchaseOrders) {
      this.logger.log(`[SAGE-BC] Envoi automatique désactivé — DA ${request.number} non envoyée`);
      return { success: false, message: "Envoi automatique des bons de commande désactivé dans la configuration ERP" };
    }
    if (!lines.length) {
      return { success: false, message: 'Aucune ligne sur la demande — rien à envoyer' };
    }

    const body = this.buildRequestBody(request, lines);
    const url = this.buildUrl(setting);

    this.logger.log('══════════════════════════════════════════════════════');
    this.logger.log(`[SAGE-BC] Envoi du bon de commande ${request.number} vers Sage`);
    this.logger.log(`[SAGE-BC] URL: ${url}`);
    this.logger.log(`[SAGE-BC] Body (${body.length} chars):\n${body}`);

    try {
      const { status, body: responseText } = await this.httpsPost(url, body, setting.accessToken);
      this.logger.log(`[SAGE-BC] HTTP Status: ${status}`);
      this.logger.log(`[SAGE-BC] Response (${responseText.length} chars): ${responseText.substring(0, 2000)}`);
      this.logger.log('══════════════════════════════════════════════════════');

      if (status >= 200 && status < 300) {
        return {
          success: true,
          message: `Bon de commande ${request.number} envoyé à Sage`,
          rawResponse: responseText.substring(0, 500),
        };
      }
      return {
        success: false,
        message: this.describeHttpError(status, url, responseText),
        rawResponse: responseText.substring(0, 500),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[SAGE-BC] ❌ Erreur de connexion: ${errorMsg}`);
      this.logger.log('══════════════════════════════════════════════════════');
      return { success: false, message: `Erreur de connexion vers ${setting.apiUrl} : ${errorMsg}` };
    }
  }

  private describeHttpError(status: number, url: string, responseText: string): string {
    const host = (() => {
      try {
        return new URL(url).origin;
      } catch {
        return url;
      }
    })();
    const cleanBody = responseText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const snippet = cleanBody ? cleanBody.substring(0, 300) : '(réponse vide)';

    if (status === 404) {
      return `Erreur Sage: HTTP 404 — l'URL de l'API Sage (${host}) ne correspond à aucune route. Vérifiez la configuration ERP. Réponse du serveur : ${snippet}`;
    }
    if (status === 401 || status === 403) {
      return `Erreur Sage: HTTP ${status} — accès refusé. Vérifiez le jeton d'accès configuré dans les paramètres ERP. Réponse du serveur : ${snippet}`;
    }
    if (status >= 500) {
      return `Erreur Sage: HTTP ${status} — le serveur Sage a rencontré une erreur interne. Réponse du serveur : ${snippet}`;
    }
    return `Erreur Sage: HTTP ${status} — ${snippet}`;
  }

  /** HTTPS POST that accepts self-signed certificates (native fetch/undici can't). */
  private httpsPost(url: string, body: string, accessToken: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'AuthToken': accessToken,
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
        rejectUnauthorized: false,
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout after 30s'));
      });

      req.write(body);
      req.end();
    });
  }

  private buildUrl(setting: ErpSetting): string {
    const base = setting.apiUrl.replace(/\/+$/, '');
    const params = new URLSearchParams({
      'queuename': setting.poQueueName,
      'message.action': 'processus',
      'message.accessToken': setting.accessToken,
      'processus.className': setting.poProcessusClass,
      'processus.methodName': setting.poProcessusMethod,
      'processus.parameters.className': setting.poParametersClass,
      'processus.parameters.code': setting.poParametersCode,
    });
    return `${base}/server/rpc.l1000/rest/queue.inqueue?${params.toString()}`;
  }

  /**
   * Reference DA;DateBC;CodeFournisseur;DesignationProduit;CodeProduit;PrixUnitaire;Qte
   * One line per purchase-request line. CodeProduit is always "PROD-DIVERS"
   * for every bon de commande — e-DA lines aren't matched to a Sage product
   * catalog, they're all booked under this single generic product code.
   */
  private buildRequestBody(request: PurchaseRequest, lines: PurchaseRequestLine[]): string {
    const dateBc = this.formatDate(request.processedAt ?? new Date());
    const rows = lines.map((l) =>
      [
        request.number ?? '',
        dateBc,
        request.supplierCode ?? '',
        this.sanitizeForSage(l.designation).substring(0, 100),
        SAGE_PRODUCT_CODE,
        this.formatAmount(Number(l.estimatedUnitPrice)),
        this.formatAmount(Number(l.quantity)),
      ].join(FIELD_SEPARATOR),
    );
    return rows.join(LINE_SEPARATOR);
  }

  private formatDate(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  }

  private formatAmount(value: number): string {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
  }

  private sanitizeForSage(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[–—―‐‑‒]/g, '-')
      .replace(/[‘’‚]/g, "'")
      .replace(/[“”„]/g, '"')
      .replace(/[…]/g, '...')
      .replace(/[«»]/g, '"')
      .replace(/[^\x20-\x7E]/g, '');
  }
}
