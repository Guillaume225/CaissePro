import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import * as https from 'https';
import { ErpSetting } from '../entities/erp-setting.entity';
import { FneAccountingEntry } from '../entities/fne-accounting-entry.entity';
import { FneInvoice } from '../entities/fne-invoice.entity';
import { FneClient } from '../entities/fne-client.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

/**
 * Sage ERP connector.
 *
 * Sends accounting entries to the Sage DCP REST queue API.
 *
 * Body format (semicolon-separated, one line per entry):
 *   Référence facture;Date;Référence externe;Journal;Type pièce;
 *   Libellé écriture;N° Compte;Compte auxiliaire;Montant;Montant;Sens
 *
 * Example:
 *   FNE-2026-00001;19/04/2026;FNE-2026-00001;CA;SALE;Facture FNE-2026-00001 – Client;411000;CLI001;118;118;D
 *   FNE-2026-00001;19/04/2026;FNE-2026-00001;CA;SALE;Facture FNE-2026-00001 – Vente HT;701000;;100;100;C
 *   FNE-2026-00001;19/04/2026;FNE-2026-00001;CA;SALE;Facture FNE-2026-00001 – TVA collectée;443100;;18;18;C
 */

const FIELD_SEPARATOR = ';'; // semicolon-separated for Sage
const LINE_SEPARATOR = '\n';

export interface ErpPostResult {
  success: boolean;
  entriesPosted: number;
  message: string;
  rawResponse?: string;
  errors?: string[];
}

/**
 * Generic entry structure for posting non-FNE entries (e.g. cash closing) to Sage.
 */
export interface RawSageEntry {
  reference: string;       // e.g. CLV-2026-00001
  date: string;            // ISO or DD/MM/YYYY
  journalCode: string;     // e.g. CA
  pieceType: string;       // e.g. SALE, EXPENSE
  label: string;           // e.g. "Dépense DEP-001 – Fournitures"
  accountNumber: string;   // e.g. 601000
  auxiliaryAccount: string; // e.g. CLI001 or empty
  debit: number;
  credit: number;
}

@Injectable()
export class SageErpService {
  private readonly logger = new Logger(SageErpService.name);

  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  /**
   * Post accounting entries to Sage ERP for specific invoices.
   */
  async postEntries(tenantId: string, invoiceIds: string[], companyId?: string): Promise<ErpPostResult> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const erpSettingRepo = ds.getRepository(ErpSetting);
    const entryRepo = ds.getRepository(FneAccountingEntry);

    // Find active ERP settings
    const setting = companyId
      ? await erpSettingRepo.findOne({ where: { companyId, isActive: true } })
      : await erpSettingRepo.findOne({ where: { isActive: true } });

    if (!setting) {
      this.logger.warn('[SAGE] Aucune configuration ERP active trouvée');
      return { success: false, entriesPosted: 0, message: 'Configuration ERP non trouvée ou inactive' };
    }

    this.logger.log('══════════════════════════════════════════════════════');
    this.logger.log('[SAGE] Début du processus "Comptabiliser dans Sage"');
    this.logger.log(`[SAGE] Config ERP id=${setting.id}, apiUrl=${setting.apiUrl}`);
    this.logger.log(`[SAGE] queueName=${setting.queueName}`);
    this.logger.log(`[SAGE] processusClass=${setting.processusClass}`);
    this.logger.log(`[SAGE] processusMethod=${setting.processusMethod}`);
    this.logger.log(`[SAGE] parametersClass=${setting.parametersClass}`);
    this.logger.log(`[SAGE] parametersCode=${setting.parametersCode}`);
    this.logger.log(`[SAGE] defaultJournalCode=${setting.defaultJournalCode}, defaultPieceType=${setting.defaultPieceType}`);
    this.logger.log(`[SAGE] accessToken=${setting.accessToken ? setting.accessToken.substring(0, 8) + '...' : '(vide)'}`);

    // Get unposted entries for these invoices
    const entries = await entryRepo.find({
      where: { invoiceId: In(invoiceIds) },
      order: { invoiceReference: 'ASC', debit: 'DESC' },
    });

    this.logger.log(`[SAGE] Écritures trouvées en base: ${entries.length}`);
    if (!entries.length) {
      this.logger.warn('[SAGE] Aucune écriture comptable trouvée pour ces factures');
      return { success: false, entriesPosted: 0, message: 'Aucune écriture comptable trouvée' };
    }

    // Filter out already posted
    const unposted = entries.filter((e) => !e.erpPosted);
    const alreadyPosted = entries.filter((e) => e.erpPosted);
    this.logger.log(`[SAGE] Déjà comptabilisées: ${alreadyPosted.length}, À poster: ${unposted.length}`);
    if (!unposted.length) {
      this.logger.log('[SAGE] Toutes les écritures sont déjà comptabilisées — rien à faire');
      return { success: true, entriesPosted: 0, message: 'Toutes les écritures sont déjà comptabilisées dans l\'ERP' };
    }

    // Build client code map: invoiceId -> clientCode
    const clientCodeMap = await this.buildClientCodeMap(tenantId, invoiceIds);
    this.logger.log(`[SAGE] Client codes résolus: ${JSON.stringify(Object.fromEntries(clientCodeMap))}`);

    // Build the request body
    const body = this.buildRequestBody(unposted, setting, clientCodeMap);

    // Build the URL
    const url = this.buildUrl(setting);

    // ── Log détaillé des écritures envoyées ──
    this.logger.log('[SAGE] ── Détail des écritures à poster ──');
    for (let i = 0; i < unposted.length; i++) {
      const e = unposted[i];
      this.logger.log(
        `[SAGE]   Ligne ${i + 1}: facture=${e.invoiceReference} compte=${e.accountNumber} ` +
        `débit=${Number(e.debit).toFixed(2)} crédit=${Number(e.credit).toFixed(2)} ` +
        `journal=${e.journalCode || setting.defaultJournalCode} label="${e.label}"`,
      );
    }
    this.logger.log('[SAGE] ── Fin détail écritures ──');

    this.logger.log(`[SAGE] URL complète: ${url}`);
    this.logger.log(`[SAGE] Body (${body.length} chars):\n${body}`);
    this.logger.log(`[SAGE] Envoi HTTPS POST en cours...`);

    try {
      const { status, body: responseText } = await this.httpsPost(url, body, setting.accessToken);

      this.logger.log(`[SAGE] ── Réponse reçue ──`);
      this.logger.log(`[SAGE] HTTP Status: ${status}`);
      this.logger.log(`[SAGE] Response body (${responseText.length} chars): ${responseText.substring(0, 2000)}`);
      this.logger.log(`[SAGE] ── Fin réponse ──`);

      if (status >= 200 && status < 300) {
        // Mark entries as posted
        const now = new Date();
        this.logger.log(`[SAGE] Statut HTTP ${status} = succès, marquage des ${unposted.length} écritures...`);
        for (const entry of unposted) {
          await entryRepo.update(entry.id, {
            erpPosted: true,
            erpPostedAt: now,
            erpResponse: responseText.substring(0, 2000),
            erpError: null,
          });
          this.logger.log(`[SAGE]   ✓ Écriture ${entry.id} (${entry.invoiceReference} / ${entry.accountNumber}) marquée comme postée`);
        }

        this.logger.log(`[SAGE] ✅ ${unposted.length} écritures comptabilisées avec succès`);
        this.logger.log('══════════════════════════════════════════════════════');
        return {
          success: true,
          entriesPosted: unposted.length,
          message: `${unposted.length} écritures comptabilisées dans Sage`,
          rawResponse: responseText.substring(0, 500),
        };
      } else {
        // Mark entries with error
        const errorMsg = `HTTP ${status}: ${responseText.substring(0, 500)}`;
        for (const entry of unposted) {
          await entryRepo.update(entry.id, {
            erpError: errorMsg.substring(0, 2000),
          });
        }

        this.logger.error(`[SAGE] ❌ Erreur HTTP ${status}: ${errorMsg}`);
        this.logger.log('══════════════════════════════════════════════════════');
        return {
          success: false,
          entriesPosted: 0,
          message: `Erreur Sage: HTTP ${status}`,
          rawResponse: responseText.substring(0, 500),
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : '';
      this.logger.error(`[SAGE] ❌ Erreur de connexion: ${errorMsg}`);
      this.logger.error(`[SAGE] Stack: ${errorStack}`);
      this.logger.log('══════════════════════════════════════════════════════');

      for (const entry of unposted) {
        await entryRepo.update(entry.id, {
          erpError: errorMsg.substring(0, 2000),
        });
      }

      return {
        success: false,
        entriesPosted: 0,
        message: `Erreur de connexion: ${errorMsg}`,
      };
    }
  }

  /**
   * Post all unposted entries to Sage ERP.
   */
  async postAllUnposted(tenantId: string, companyId?: string): Promise<ErpPostResult> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const entryRepo = ds.getRepository(FneAccountingEntry);

    const unposted = await entryRepo.find({
      where: { erpPosted: false },
      order: { invoiceReference: 'ASC', debit: 'DESC' },
    });

    if (!unposted.length) {
      return { success: true, entriesPosted: 0, message: 'Aucune écriture en attente' };
    }

    const invoiceIds = [...new Set(unposted.map((e) => e.invoiceId))];
    return this.postEntries(tenantId, invoiceIds, companyId);
  }

  /**
   * Post raw/generic accounting entries to Sage (e.g. cash closing entries).
   * Uses the same semicolon-separated format as FNE entries.
   */
  async postRawEntries(tenantId: string, entries: RawSageEntry[], companyId?: string): Promise<ErpPostResult> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const erpSettingRepo = ds.getRepository(ErpSetting);

    const setting = companyId
      ? await erpSettingRepo.findOne({ where: { companyId, isActive: true } })
      : await erpSettingRepo.findOne({ where: { isActive: true } });

    if (!setting) {
      this.logger.warn('[SAGE-CASH] Aucune configuration ERP active trouvée');
      return { success: false, entriesPosted: 0, message: 'Configuration ERP non trouvée ou inactive' };
    }

    if (!entries.length) {
      return { success: true, entriesPosted: 0, message: 'Aucune écriture à poster' };
    }

    this.logger.log('══════════════════════════════════════════════════════');
    this.logger.log('[SAGE-CASH] Début du processus "Comptabiliser écritures de caisse dans Sage"');
    this.logger.log(`[SAGE-CASH] ${entries.length} écritures à poster`);

    // Build body in same semicolon-separated format
    const body = this.buildRawEntriesBody(entries, setting);
    const url = this.buildUrl(setting);

    this.logger.log('[SAGE-CASH] ── Détail des écritures ──');
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const sens = e.debit > 0 ? 'D' : 'C';
      const montant = e.debit > 0 ? e.debit : e.credit;
      this.logger.log(
        `[SAGE-CASH]   Ligne ${i + 1}: ref=${e.reference} compte=${e.accountNumber} ` +
        `montant=${montant} sens=${sens} label="${e.label}"`,
      );
    }
    this.logger.log('[SAGE-CASH] ── Fin détail ──');
    this.logger.log(`[SAGE-CASH] URL: ${url}`);
    this.logger.log(`[SAGE-CASH] Body (${body.length} chars):\n${body}`);
    this.logger.log('[SAGE-CASH] Envoi HTTPS POST...');

    try {
      const { status, body: responseText } = await this.httpsPost(url, body, setting.accessToken);

      this.logger.log(`[SAGE-CASH] HTTP Status: ${status}`);
      this.logger.log(`[SAGE-CASH] Response: ${responseText.substring(0, 2000)}`);

      if (status >= 200 && status < 300) {
        this.logger.log(`[SAGE-CASH] ✅ ${entries.length} écritures de caisse comptabilisées`);
        this.logger.log('══════════════════════════════════════════════════════');
        return {
          success: true,
          entriesPosted: entries.length,
          message: `${entries.length} écritures de caisse comptabilisées dans Sage`,
          rawResponse: responseText.substring(0, 500),
        };
      } else {
        const errorMsg = `HTTP ${status}: ${responseText.substring(0, 500)}`;
        this.logger.error(`[SAGE-CASH] ❌ Erreur: ${errorMsg}`);
        this.logger.log('══════════════════════════════════════════════════════');
        return {
          success: false,
          entriesPosted: 0,
          message: `Erreur Sage: HTTP ${status}`,
          rawResponse: responseText.substring(0, 500),
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[SAGE-CASH] ❌ Erreur de connexion: ${errorMsg}`);
      this.logger.log('══════════════════════════════════════════════════════');
      return {
        success: false,
        entriesPosted: 0,
        message: `Erreur de connexion: ${errorMsg}`,
      };
    }
  }

  /**
   * HTTPS POST that accepts self-signed certificates.
   * Node.js native fetch (undici) does not support custom agents,
   * so we use the built-in https module directly.
   */
  private httpsPost(
    url: string,
    body: string,
    accessToken: string,
  ): Promise<{ status: number; body: string }> {
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
        rejectUnauthorized: false, // accept self-signed certs
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 0, body: responseBody });
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

  /**
   * Build Sage DCP REST queue URL with all parameters.
   */
  private buildUrl(setting: ErpSetting): string {
    const base = setting.apiUrl.replace(/\/+$/, '');
    const params = new URLSearchParams({
      'queuename': setting.queueName,
      'message.action': 'processus',
      'message.accessToken': setting.accessToken,
      'processus.className': setting.processusClass,
      'processus.methodName': setting.processusMethod,
      'processus.parameters.className': setting.parametersClass,
      'processus.parameters.code': setting.parametersCode,
    });
    return `${base}/server/rpc.l1000/rest/queue.inqueue?${params.toString()}`;
  }

  /**
   * Build the accounting entries body.
   *
   * Format per line (semicolon-separated):
   *   Référence facture;Date;Référence externe;Journal;Type pièce;
   *   Libellé écriture;N° Compte;Compte auxiliaire;Montant;Montant;Sens
   *
   * - Both "Montant" columns contain the same absolute amount.
   * - "Compte auxiliaire" is the client code (from fne_clients) for 411xxx accounts, empty otherwise.
   */
  private buildRequestBody(
    entries: FneAccountingEntry[],
    setting: ErpSetting,
    clientCodeMap: Map<string, string>,
  ): string {
    const lines: string[] = [];

    for (const entry of entries) {
      const datePiece = this.formatDate(entry.entryDate);
      const sens = Number(entry.debit) > 0 ? 'D' : 'C';
      // Absolute amount (same value in both montant columns)
      const rawAmount = Number(entry.debit) > 0
        ? Number(entry.debit)
        : Number(entry.credit);
      const montant = this.formatAmount(rawAmount);

      // Auxiliary account = client code for 411xxx accounts
      const isClientAccount = entry.accountNumber.startsWith('411');
      const compteAuxiliaire = isClientAccount
        ? (clientCodeMap.get(entry.invoiceId) || '')
        : '';

      const fields = [
        entry.invoiceReference,                       // Col 1: Référence facture
        datePiece,                                    // Col 2: Date
        entry.invoiceReference,                       // Col 3: Référence externe
        entry.journalCode || setting.defaultJournalCode, // Col 4: Journal
        setting.defaultPieceType,                     // Col 5: Type pièce
        this.sanitizeForSage(entry.label).substring(0, 100), // Col 6: Libellé écriture
        entry.accountNumber,                          // Col 7: N° Compte
        compteAuxiliaire,                             // Col 8: Compte auxiliaire
        montant,                                      // Col 9: Montant
        montant,                                      // Col 10: Montant (idem)
        sens,                                         // Col 11: Sens (D/C)
      ];

      lines.push(fields.join(FIELD_SEPARATOR));
    }

    return lines.join(LINE_SEPARATOR);
  }

  /**
   * Build body for raw/generic entries (cash closing, etc.).
   * Same semicolon-separated format as FNE entries.
   */
  private buildRawEntriesBody(entries: RawSageEntry[], setting: ErpSetting): string {
    const lines: string[] = [];

    for (const entry of entries) {
      const datePiece = this.formatDate(entry.date);
      const sens = entry.debit > 0 ? 'D' : 'C';
      const rawAmount = entry.debit > 0 ? entry.debit : entry.credit;
      const montant = this.formatAmount(rawAmount);

      const fields = [
        entry.reference,                              // Col 1: Référence
        datePiece,                                    // Col 2: Date
        entry.reference,                              // Col 3: Référence externe
        entry.journalCode || setting.defaultJournalCode, // Col 4: Journal
        entry.pieceType || setting.defaultPieceType,  // Col 5: Type pièce
        this.sanitizeForSage(entry.label).substring(0, 100), // Col 6: Libellé
        entry.accountNumber,                          // Col 7: N° Compte
        entry.auxiliaryAccount || '',                  // Col 8: Compte auxiliaire
        montant,                                      // Col 9: Montant
        montant,                                      // Col 10: Montant (idem)
        sens,                                         // Col 11: Sens (D/C)
      ];

      lines.push(fields.join(';'));
    }

    return lines.join('\n');
  }

  /**
   * Build a map of invoiceId → clientCode by looking up invoices then matching clients.
   */
  private async buildClientCodeMap(tenantId: string, invoiceIds: string[]): Promise<Map<string, string>> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const invoiceRepo = ds.getRepository(FneInvoice);
    const clientRepo = ds.getRepository(FneClient);

    const map = new Map<string, string>();

    // Load invoices to get client phone / company name
    const invoices = await invoiceRepo.find({
      where: { id: In(invoiceIds) },
    });

    for (const inv of invoices) {
      // Try to find the client by phone (most reliable match)
      let client = await clientRepo.findOne({
        where: { phone: inv.clientPhone, isActive: true },
      });

      // Fallback: match by company name
      if (!client) {
        client = await clientRepo.findOne({
          where: { companyName: inv.clientCompanyName, isActive: true },
        });
      }

      if (client?.clientCode) {
        map.set(inv.id, client.clientCode);
        this.logger.log(`[SAGE] Facture ${inv.reference}: client="${client.companyName}" → code="${client.clientCode}"`);
      } else {
        this.logger.warn(`[SAGE] Facture ${inv.reference}: aucun code client trouvé (phone=${inv.clientPhone})`);
      }
    }

    return map;
  }

  /**
   * Format date as DD/MM/YYYY for Sage.
   */
  private formatDate(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Format amount for Sage: whole numbers without decimals (118.00 → "118"),
   * fractional amounts with comma as decimal separator (118.50 → "118,5").
   */
  private formatAmount(value: number): string {
    if (Number.isInteger(value)) {
      return String(value);
    }
    // Up to 2 decimals, strip trailing zeros, use comma
    return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
  }

  /**
   * Sanitize text for Sage: replace Unicode special characters
   * (em/en dashes, smart quotes, etc.) with ASCII equivalents
   * to avoid encoding issues (Sage expects Latin-1 / ASCII).
   */
  private sanitizeForSage(text: string): string {
    // Strip all accents/diacritics: normalize to NFD then remove combining marks
    return text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[–—―‐‑‒]/g, '-')
      .replace(/[‘’‚]/g, "'")
      .replace(/[“”„]/g, '"')
      .replace(/[…]/g, '...')
      .replace(/[«»]/g, '"')
      .replace(/[ ]/g, ' ')
      .replace(/[^\x20-\x7E]/g, '');  // keep only printable ASCII
  }
}
