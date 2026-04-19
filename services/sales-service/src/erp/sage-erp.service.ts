import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ErpSetting } from '../entities/erp-setting.entity';
import { FneAccountingEntry } from '../entities/fne-accounting-entry.entity';

/**
 * Sage ERP connector.
 *
 * Sends accounting entries to the Sage DCP REST queue API.
 *
 * The API expects:
 *  - POST to {baseUrl}/dcp/server/rpc.l1000/rest/queue.inqueue?queuename=...&message.action=processus
 *    &message.accessToken=TOKEN&processus.className=...&processus.methodName=...
 *    &processus.parameters.className=...&processus.parameters.code=...
 *  - Headers: AuthToken, Authorization: Bearer TOKEN, Accept: application/json
 *  - ContentType: application/x-www-form-urlencoded
 *  - Body: CSV/pipe rows (one per entry line):
 *      Col1: numeroPiece | Col2: datePiece | Col3: referenceExterne | Col4: codeJournal
 *      Col5: typePiece | Col6: libelleEcriture | Col7: compteGeneral | Col8: compteAuxiliaire
 *      Col9: montantDebit | Col10: montantCredit | Col11: sens (D/C)
 */

const FIELD_SEPARATOR = '\t'; // tab-separated
const LINE_SEPARATOR = '\n';

export interface ErpPostResult {
  success: boolean;
  entriesPosted: number;
  message: string;
  rawResponse?: string;
  errors?: string[];
}

@Injectable()
export class SageErpService {
  private readonly logger = new Logger(SageErpService.name);

  constructor(
    @InjectRepository(ErpSetting)
    private readonly erpSettingRepo: Repository<ErpSetting>,
    @InjectRepository(FneAccountingEntry)
    private readonly entryRepo: Repository<FneAccountingEntry>,
  ) {}

  /**
   * Post accounting entries to Sage ERP for specific invoices.
   */
  async postEntries(invoiceIds: string[], companyId?: string): Promise<ErpPostResult> {
    // Find active ERP settings
    const setting = companyId
      ? await this.erpSettingRepo.findOne({ where: { companyId, isActive: true } })
      : await this.erpSettingRepo.findOne({ where: { isActive: true } });

    if (!setting) {
      return { success: false, entriesPosted: 0, message: 'Configuration ERP non trouvée ou inactive' };
    }

    // Get unposted entries for these invoices
    const entries = await this.entryRepo.find({
      where: { invoiceId: In(invoiceIds) },
      order: { invoiceReference: 'ASC', debit: 'DESC' },
    });

    if (!entries.length) {
      return { success: false, entriesPosted: 0, message: 'Aucune écriture comptable trouvée' };
    }

    // Filter out already posted
    const unposted = entries.filter((e) => !e.erpPosted);
    if (!unposted.length) {
      return { success: true, entriesPosted: 0, message: 'Toutes les écritures sont déjà comptabilisées dans l\'ERP' };
    }

    // Build the request body
    const body = this.buildRequestBody(unposted, setting);

    // Build the URL
    const url = this.buildUrl(setting);

    this.logger.log(`Posting ${unposted.length} entries to Sage ERP: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'AuthToken': setting.accessToken,
          'Authorization': `Bearer ${setting.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(30000),
      });

      const responseText = await response.text();

      if (response.ok) {
        // Mark entries as posted
        const now = new Date();
        for (const entry of unposted) {
          await this.entryRepo.update(entry.id, {
            erpPosted: true,
            erpPostedAt: now,
            erpResponse: responseText.substring(0, 2000),
            erpError: null,
          });
        }

        this.logger.log(`Successfully posted ${unposted.length} entries to Sage ERP`);
        return {
          success: true,
          entriesPosted: unposted.length,
          message: `${unposted.length} écritures comptabilisées dans Sage`,
          rawResponse: responseText.substring(0, 500),
        };
      } else {
        // Mark entries with error
        const errorMsg = `HTTP ${response.status}: ${responseText.substring(0, 500)}`;
        for (const entry of unposted) {
          await this.entryRepo.update(entry.id, {
            erpError: errorMsg.substring(0, 2000),
          });
        }

        this.logger.error(`Sage ERP error: ${errorMsg}`);
        return {
          success: false,
          entriesPosted: 0,
          message: `Erreur Sage: ${response.status} ${response.statusText}`,
          rawResponse: responseText.substring(0, 500),
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sage ERP connection error: ${errorMsg}`);

      for (const entry of unposted) {
        await this.entryRepo.update(entry.id, {
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
  async postAllUnposted(companyId?: string): Promise<ErpPostResult> {
    const unposted = await this.entryRepo.find({
      where: { erpPosted: false },
      order: { invoiceReference: 'ASC', debit: 'DESC' },
    });

    if (!unposted.length) {
      return { success: true, entriesPosted: 0, message: 'Aucune écriture en attente' };
    }

    const invoiceIds = [...new Set(unposted.map((e) => e.invoiceId))];
    return this.postEntries(invoiceIds, companyId);
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
    return `${base}/dcp/server/rpc.l1000/rest/queue.inqueue?${params.toString()}`;
  }

  /**
   * Build the accounting entries body.
   *
   * Format per line (tab-separated):
   *   numeroPiece | datePiece | refExterne | codeJournal | typePiece |
   *   libelleEcriture | compteGeneral | compteAuxiliaire | montantDebit |
   *   montantCredit | sens
   */
  private buildRequestBody(entries: FneAccountingEntry[], setting: ErpSetting): string {
    const lines: string[] = [];

    for (const entry of entries) {
      const datePiece = this.formatDate(entry.entryDate);
      const sens = Number(entry.debit) > 0 ? 'D' : 'C';
      const montantDebit = Number(entry.debit) > 0 ? Number(entry.debit).toFixed(2) : '0.00';
      const montantCredit = Number(entry.credit) > 0 ? Number(entry.credit).toFixed(2) : '0.00';

      // Determine auxiliary account (client accounts 411xxx get the account as auxiliary)
      const isClientAccount = entry.accountNumber.startsWith('411');
      const compteAuxiliaire = isClientAccount ? entry.accountNumber : '';

      const fields = [
        entry.invoiceReference,                       // Col 1: numéro pièce
        datePiece,                                    // Col 2: date pièce
        entry.invoiceReference,                       // Col 3: référence externe
        entry.journalCode || setting.defaultJournalCode, // Col 4: code journal
        setting.defaultPieceType,                     // Col 5: type pièce
        entry.label.substring(0, 100),                // Col 6: libellé écriture
        entry.accountNumber,                          // Col 7: compte général
        compteAuxiliaire,                             // Col 8: compte auxiliaire
        montantDebit,                                 // Col 9: montant débit
        montantCredit,                                // Col 10: montant crédit
        sens,                                         // Col 11: sens
      ];

      lines.push(fields.join(FIELD_SEPARATOR));
    }

    return lines.join(LINE_SEPARATOR);
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
}
