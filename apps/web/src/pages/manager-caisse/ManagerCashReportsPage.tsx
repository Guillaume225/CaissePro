import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Printer,
  FileText,
  BookOpen,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  TrendingUp,
  BarChart3,
  Wallet,
  Search,
  ChevronDown,
  X,
} from 'lucide-react';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import {
  usePeriodClosingHistory,
  useMultiDayOperations,
  useMultiDayAccountingEntries,
  useClosingHistory,
} from '@/hooks/useClosing';
import type { CashDayMovement, CashDayExpense } from '@/hooks/useClosing';
import { useSettings } from '@/hooks/useAdmin';
import { useAuthStore } from '@/stores/auth-store';
import { useReportDesign } from '@/hooks/useReportDesign';
import type { ReportHeaderConfig, ReportFooterConfig } from '@/stores/report-config-store';
import type { CashClosingRecord, AccountingEntry, AccountingEntriesSummary } from '@/types/admin';

/* ─── Helpers ─── */
const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

const fmtShortDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

type PeriodReportType =
  | 'grand-livre'
  | 'balance'
  | 'journal-comptable'
  | 'encaissements'
  | 'decaissements'
  | 'synthese'
  | 'ecarts-cumules';

/* ═══════════════════════════════════════════════════════════
   Report header (company info)
   ═══════════════════════════════════════════════════════════ */
function ReportHeader({ companyName, companyAddress, companyPhone, companyTaxId, title, subtitle, headerConfig }: {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  title: string;
  subtitle?: string;
  headerConfig?: ReportHeaderConfig | null;
}) {
  const hc = headerConfig;
  return (
    <div className="mb-6 border-b-2 border-gray-800 pb-4 text-center">
      {(!hc || hc.showCompanyName) && <h1 className="text-xl font-bold uppercase tracking-wider">{companyName}</h1>}
      {(!hc || hc.showCompanyAddress) && companyAddress && <p className="text-sm text-gray-600">{companyAddress}</p>}
      <div className="flex justify-center gap-4 text-xs text-gray-500">
        {(!hc || hc.showCompanyPhone) && companyPhone && <span>Tél: {companyPhone}</span>}
        {(!hc || hc.showCompanyTaxId) && companyTaxId && <span>NIF: {companyTaxId}</span>}
      </div>
      <div className="mt-4">
        <h2 className="text-lg font-bold uppercase">{hc?.customTitle || title}</h2>
        {(hc?.customSubtitle || subtitle) && <p className="text-sm text-gray-600">{hc?.customSubtitle || subtitle}</p>}
      </div>
    </div>
  );
}

function ReportFooter({ printedBy, footerConfig }: { printedBy: string; footerConfig?: ReportFooterConfig | null }) {
  const fc = footerConfig;
  return (
    <div className="mt-8 border-t border-gray-300 pt-4">
      <div className="flex justify-between text-sm">
        {(!fc || fc.showEstabliPar) && (
          <div>
            <p className="text-gray-500">Établi par:</p>
            <div className="mt-6 w-48 border-b border-gray-400" />
            <p className="mt-1 text-xs text-gray-400">{printedBy}</p>
          </div>
        )}
        {(!fc || fc.showVerifiePar) && (
          <div>
            <p className="text-gray-500">Vérifié par:</p>
            <div className="mt-6 w-48 border-b border-gray-400" />
            <p className="mt-1 text-xs text-gray-400">{fc?.verifiedByLabel || 'Le Directeur'}</p>
          </div>
        )}
      </div>
      {(!fc || fc.showTimestamp) && (
        <p className="mt-4 text-center text-xs text-gray-400">
          Imprimé le {new Date().toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   1. GRAND LIVRE DE CAISSE
   ═══════════════════════════════════════════════════════════ */
function GrandLivreDeCaisse({ days, allOps, periodLabel, companyName, companyAddress, companyPhone, companyTaxId, printedBy }: {
  days: CashClosingRecord[];
  allOps: Record<string, { movements: CashDayMovement[]; expenses: CashDayExpense[] }>;
  periodLabel: string;
  companyName: string; companyAddress?: string; companyPhone?: string; companyTaxId?: string; printedBy: string;
}) {
  const { isFieldVisible, getFieldLabel, isKpiVisible, getKpiLabel, header, footer } = useReportDesign('grand-livre');

  const flatOps = useMemo(() => {
    const ops: { date: string; ref: string; dayRef: string; label: string; entry: number; exit: number }[] = [];
    for (const day of days) {
      const dayData = allOps[day.id];
      if (!dayData) continue;
      dayData.movements.forEach((m) => {
        ops.push({
          date: m.time,
          ref: m.reference || '—',
          dayRef: day.reference,
          label: `${m.category} — ${m.description}`,
          entry: m.type === 'ENTRY' ? m.amount : 0,
          exit: m.type === 'EXIT' ? m.amount : 0,
        });
      });
      dayData.expenses.filter((e) => e.status === 'PAID').forEach((e) => {
        const isEntry = e.categoryDirection === 'ENTRY';
        ops.push({
          date: e.createdAt,
          ref: e.reference,
          dayRef: day.reference,
          label: `${e.categoryName || 'Dépense'} — ${e.beneficiary}`,
          entry: isEntry ? e.amount : 0,
          exit: !isEntry ? e.amount : 0,
        });
      });
    }
    ops.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return ops;
  }, [days, allOps]);

  const totalEntries = flatOps.reduce((s, o) => s + o.entry, 0);
  const totalExits = flatOps.reduce((s, o) => s + o.exit, 0);
  const openingBalance = days.length > 0 ? days[0].openingBalance : 0;

  return (
    <div>
      <ReportHeader companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId}
        title="Grand Livre de Caisse" subtitle={`Période : ${periodLabel}`} headerConfig={header} />

      <div className="mb-4 grid grid-cols-4 gap-2 text-sm">
        {isKpiVisible('openingBalance') && (
          <div className="rounded border p-2 text-center">
            <div className="text-xs text-gray-500">{getKpiLabel('openingBalance', 'Solde initial')}</div>
            <div className="font-bold">{fmt(openingBalance)} FCFA</div>
          </div>
        )}
        {isKpiVisible('totalEntries') && (
          <div className="rounded border p-2 text-center">
            <div className="text-xs text-gray-500">{getKpiLabel('totalEntries', 'Total encaissements')}</div>
            <div className="font-bold text-green-700">{fmt(totalEntries)} FCFA</div>
          </div>
        )}
        {isKpiVisible('totalExits') && (
          <div className="rounded border p-2 text-center">
            <div className="text-xs text-gray-500">{getKpiLabel('totalExits', 'Total décaissements')}</div>
            <div className="font-bold text-red-700">{fmt(totalExits)} FCFA</div>
          </div>
        )}
        {isKpiVisible('closingBalance') && (
          <div className="rounded border p-2 text-center">
            <div className="text-xs text-gray-500">{getKpiLabel('closingBalance', 'Solde final')}</div>
            <div className="font-bold">{fmt(openingBalance + totalEntries - totalExits)} FCFA</div>
          </div>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            {isFieldVisible('date') && <th className="border px-2 py-1 text-left">{getFieldLabel('date', 'Date')}</th>}
            {isFieldVisible('dayRef') && <th className="border px-2 py-1 text-left">{getFieldLabel('dayRef', 'Journée')}</th>}
            {isFieldVisible('reference') && <th className="border px-2 py-1 text-left">{getFieldLabel('reference', 'Référence')}</th>}
            {isFieldVisible('label') && <th className="border px-2 py-1 text-left">{getFieldLabel('label', 'Libellé')}</th>}
            {isFieldVisible('debit') && <th className="border px-2 py-1 text-right">{getFieldLabel('debit', 'Débit (FCFA)')}</th>}
            {isFieldVisible('credit') && <th className="border px-2 py-1 text-right">{getFieldLabel('credit', 'Crédit (FCFA)')}</th>}
            {isFieldVisible('balance') && <th className="border px-2 py-1 text-right">{getFieldLabel('balance', 'Solde (FCFA)')}</th>}
          </tr>
        </thead>
        <tbody>
          {(() => {
            let running = openingBalance;
            return flatOps.map((op, i) => {
              running = running + op.entry - op.exit;
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {isFieldVisible('date') && <td className="border px-2 py-1 text-xs">{fmtShortDate(op.date)}</td>}
                  {isFieldVisible('dayRef') && <td className="border px-2 py-1 font-mono text-xs">{op.dayRef}</td>}
                  {isFieldVisible('reference') && <td className="border px-2 py-1 font-mono text-xs">{op.ref}</td>}
                  {isFieldVisible('label') && <td className="border px-2 py-1">{op.label}</td>}
                  {isFieldVisible('debit') && <td className="border px-2 py-1 text-right">{op.entry > 0 ? fmt(op.entry) : '—'}</td>}
                  {isFieldVisible('credit') && <td className="border px-2 py-1 text-right">{op.exit > 0 ? fmt(op.exit) : '—'}</td>}
                  {isFieldVisible('balance') && <td className="border px-2 py-1 text-right font-medium">{fmt(running)}</td>}
                </tr>
              );
            });
          })()}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td colSpan={[isFieldVisible('date'), isFieldVisible('dayRef'), isFieldVisible('reference'), isFieldVisible('label')].filter(Boolean).length} className="border px-2 py-1 text-right">TOTAUX</td>
            {isFieldVisible('debit') && <td className="border px-2 py-1 text-right text-green-800">{fmt(totalEntries)}</td>}
            {isFieldVisible('credit') && <td className="border px-2 py-1 text-right text-red-800">{fmt(totalExits)}</td>}
            {isFieldVisible('balance') && <td className="border px-2 py-1 text-right">{fmt(openingBalance + totalEntries - totalExits)}</td>}
          </tr>
        </tfoot>
      </table>

      <p className="mt-2 text-right text-xs text-gray-400">{flatOps.length} opérations — {days.length} journées</p>
      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   2. BALANCE DE CAISSE
   ═══════════════════════════════════════════════════════════ */
function BalanceDeCaisse({ days, periodLabel, companyName, companyAddress, companyPhone, companyTaxId, printedBy }: {
  days: CashClosingRecord[];
  periodLabel: string;
  companyName: string; companyAddress?: string; companyPhone?: string; companyTaxId?: string; printedBy: string;
}) {
  const { isFieldVisible, getFieldLabel, header, footer } = useReportDesign('balance');
  const totalDebits = days.reduce((s, d) => s + d.totalEntries, 0);
  const totalCredits = days.reduce((s, d) => s + d.totalExits, 0);
  const openingBalance = days.length > 0 ? days[0].openingBalance : 0;
  const closingBalance = days.length > 0 ? (days[days.length - 1].actualBalance ?? days[days.length - 1].theoreticalBalance) : 0;

  return (
    <div>
      <ReportHeader companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId}
        title="Balance de Caisse" subtitle={`Période : ${periodLabel}`} headerConfig={header} />

      <table className="mx-auto w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            {isFieldVisible('date') && <th className="border px-4 py-2 text-left">{getFieldLabel('date', 'Journée')}</th>}
            {isFieldVisible('reference') && <th className="border px-4 py-2 text-left">{getFieldLabel('reference', 'Date')}</th>}
            {isFieldVisible('debit') && <th className="border px-4 py-2 text-right">{getFieldLabel('debit', 'Total Débit (FCFA)')}</th>}
            {isFieldVisible('credit') && <th className="border px-4 py-2 text-right">{getFieldLabel('credit', 'Total Crédit (FCFA)')}</th>}
            {isFieldVisible('balance') && <th className="border px-4 py-2 text-right">{getFieldLabel('balance', 'Solde (FCFA)')}</th>}
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {isFieldVisible('date') && <td className="border px-4 py-2 font-mono text-xs">{d.reference}</td>}
              {isFieldVisible('reference') && <td className="border px-4 py-2 text-xs">{fmtShortDate(d.openedAt)}</td>}
              {isFieldVisible('debit') && <td className="border px-4 py-2 text-right text-green-700">{fmt(d.totalEntries)}</td>}
              {isFieldVisible('credit') && <td className="border px-4 py-2 text-right text-red-700">{fmt(d.totalExits)}</td>}
              {isFieldVisible('balance') && <td className="border px-4 py-2 text-right font-medium">{fmt(d.actualBalance ?? d.theoreticalBalance)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td colSpan={[isFieldVisible('date'), isFieldVisible('reference')].filter(Boolean).length} className="border px-4 py-2 text-right">TOTAUX PÉRIODE</td>
            {isFieldVisible('debit') && <td className="border px-4 py-2 text-right text-green-800">{fmt(totalDebits)}</td>}
            {isFieldVisible('credit') && <td className="border px-4 py-2 text-right text-red-800">{fmt(totalCredits)}</td>}
            {isFieldVisible('balance') && <td className="border px-4 py-2 text-right">{fmt(closingBalance)}</td>}
          </tr>
        </tfoot>
      </table>

      <div className="mt-4 rounded border p-3 text-sm">
        <div className="grid grid-cols-3 gap-4">
          <div><span className="text-gray-500">Solde d'ouverture :</span> <span className="font-bold">{fmt(openingBalance)} FCFA</span></div>
          <div><span className="text-gray-500">Solde de clôture :</span> <span className="font-bold">{fmt(closingBalance)} FCFA</span></div>
          <div><span className="text-gray-500">Variation :</span> <span className={`font-bold ${closingBalance - openingBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{closingBalance - openingBalance > 0 ? '+' : ''}{fmt(closingBalance - openingBalance)} FCFA</span></div>
        </div>
      </div>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   3. JOURNAL COMPTABLE DE CAISSE (format Sage)
   ═══════════════════════════════════════════════════════════ */
function JournalComptable({ accountingData, periodLabel, companyName, companyAddress, companyPhone, companyTaxId, printedBy }: {
  accountingData: AccountingEntriesSummary[];
  periodLabel: string;
  companyName: string; companyAddress?: string; companyPhone?: string; companyTaxId?: string; printedBy: string;
}) {
  const { isFieldVisible, getFieldLabel, header, footer } = useReportDesign('journal-comptable');
  const allEntries = useMemo(() => {
    const entries: (AccountingEntry & { dayRef: string })[] = [];
    accountingData.forEach((s) => {
      s.entries.forEach((e) => entries.push({ ...e, dayRef: s.cashDayReference ?? '—' }));
    });
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return entries;
  }, [accountingData]);

  const totalDebit = allEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = allEntries.reduce((s, e) => s + e.credit, 0);

  return (
    <div>
      <ReportHeader companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId}
        title="Journal Comptable de Caisse" subtitle={`Période : ${periodLabel} — Format compatible Sage`} headerConfig={header} />

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 text-left">Date</th>
            <th className="border px-2 py-1 text-left">Journal</th>
            <th className="border px-2 py-1 text-left">N° Compte</th>
            <th className="border px-2 py-1 text-left">Libellé compte</th>
            <th className="border px-2 py-1 text-left">Réf. pièce</th>
            <th className="border px-2 py-1 text-left">Libellé écriture</th>
            <th className="border px-2 py-1 text-right">Débit</th>
            <th className="border px-2 py-1 text-right">Crédit</th>
          </tr>
        </thead>
        <tbody>
          {allEntries.map((e, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border px-2 py-1 text-xs">{fmtShortDate(e.date)}</td>
              <td className="border px-2 py-1 font-mono text-xs font-bold">{e.journalCode}</td>
              <td className="border px-2 py-1 font-mono text-xs">{e.accountNumber}</td>
              <td className="border px-2 py-1 text-xs">{e.accountLabel}</td>
              <td className="border px-2 py-1 font-mono text-xs">{e.reference}</td>
              <td className="border px-2 py-1">{e.label}</td>
              <td className="border px-2 py-1 text-right">{e.debit > 0 ? fmt(e.debit) : ''}</td>
              <td className="border px-2 py-1 text-right">{e.credit > 0 ? fmt(e.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td colSpan={6} className="border px-2 py-1 text-right">TOTAUX</td>
            <td className="border px-2 py-1 text-right">{fmt(totalDebit)}</td>
            <td className="border px-2 py-1 text-right">{fmt(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-3 flex items-center gap-2 text-sm">
        {Math.abs(totalDebit - totalCredit) < 1 ? (
          <Badge variant="success">Équilibre confirmé</Badge>
        ) : (
          <Badge variant="destructive">Déséquilibre : {fmt(totalDebit - totalCredit)} FCFA</Badge>
        )}
        <span className="text-xs text-gray-400">{allEntries.length} écritures</span>
      </div>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   4. ÉTAT RÉCAPITULATIF DES ENCAISSEMENTS
   ═══════════════════════════════════════════════════════════ */
function EtatEncaissements({ days, allOps, periodLabel, companyName, companyAddress, companyPhone, companyTaxId, printedBy }: {
  days: CashClosingRecord[];
  allOps: Record<string, { movements: CashDayMovement[]; expenses: CashDayExpense[] }>;
  periodLabel: string;
  companyName: string; companyAddress?: string; companyPhone?: string; companyTaxId?: string; printedBy: string;
}) {
  const { header, footer } = useReportDesign('encaissements');
  const breakdown = useMemo(() => {
    const byCat: Record<string, number> = {};
    const byPayMethod: Record<string, number> = { CASH: 0, CHECK: 0, TRANSFER: 0, MOBILE_MONEY: 0 };
    let total = 0;

    for (const day of days) {
      const dayData = allOps[day.id];
      if (!dayData) continue;

      dayData.movements.filter((m) => m.type === 'ENTRY').forEach((m) => {
        byCat[m.category] = (byCat[m.category] || 0) + m.amount;
        byPayMethod['CASH'] += m.amount; // movements are cash by default
        total += m.amount;
      });

      dayData.expenses.filter((e) => e.status === 'PAID' && e.categoryDirection === 'ENTRY').forEach((e) => {
        byCat[e.categoryName || 'Autres'] = (byCat[e.categoryName || 'Autres'] || 0) + e.amount;
        const pm = e.paymentMethod || 'CASH';
        byPayMethod[pm] = (byPayMethod[pm] || 0) + e.amount;
        total += e.amount;
      });
    }

    return { byCat, byPayMethod, total };
  }, [days, allOps]);

  const payMethodLabels: Record<string, string> = {
    CASH: 'Espèces', CHECK: 'Chèques', TRANSFER: 'Virements', MOBILE_MONEY: 'Mobile Money',
  };

  return (
    <div>
      <ReportHeader companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId}
        title="État Récapitulatif des Encaissements" subtitle={`Période : ${periodLabel}`} headerConfig={header} />

      <h3 className="mb-2 text-sm font-bold uppercase text-gray-600">Ventilation par type d'encaissement</h3>
      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-green-50">
            <th className="border px-3 py-2 text-left">Mode de règlement</th>
            <th className="border px-3 py-2 text-right">Montant (FCFA)</th>
            <th className="border px-3 py-2 text-right">% du total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(breakdown.byPayMethod).filter(([, v]) => v > 0).map(([k, v], i) => (
            <tr key={k} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border px-3 py-2">{payMethodLabels[k] || k}</td>
              <td className="border px-3 py-2 text-right font-medium">{fmt(v)}</td>
              <td className="border px-3 py-2 text-right">{breakdown.total > 0 ? ((v / breakdown.total) * 100).toFixed(1) : '0.0'} %</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-green-100 font-bold">
            <td className="border px-3 py-2">TOTAL ENCAISSEMENTS</td>
            <td className="border px-3 py-2 text-right">{fmt(breakdown.total)}</td>
            <td className="border px-3 py-2 text-right">100 %</td>
          </tr>
        </tfoot>
      </table>

      <h3 className="mb-2 text-sm font-bold uppercase text-gray-600">Ventilation par catégorie</h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2 text-left">Catégorie</th>
            <th className="border px-3 py-2 text-right">Montant (FCFA)</th>
            <th className="border px-3 py-2 text-right">% du total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(breakdown.byCat).sort(([, a], [, b]) => b - a).map(([k, v], i) => (
            <tr key={k} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border px-3 py-2">{k}</td>
              <td className="border px-3 py-2 text-right font-medium">{fmt(v)}</td>
              <td className="border px-3 py-2 text-right">{breakdown.total > 0 ? ((v / breakdown.total) * 100).toFixed(1) : '0.0'} %</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   5. ÉTAT RÉCAPITULATIF DES DÉCAISSEMENTS
   ═══════════════════════════════════════════════════════════ */
function EtatDecaissements({ days, allOps, periodLabel, companyName, companyAddress, companyPhone, companyTaxId, printedBy }: {
  days: CashClosingRecord[];
  allOps: Record<string, { movements: CashDayMovement[]; expenses: CashDayExpense[] }>;
  periodLabel: string;
  companyName: string; companyAddress?: string; companyPhone?: string; companyTaxId?: string; printedBy: string;
}) {
  const { header, footer } = useReportDesign('decaissements');
  const breakdown = useMemo(() => {
    const byNature: Record<string, number> = {};
    const byPayMethod: Record<string, number> = { CASH: 0, CHECK: 0, TRANSFER: 0, MOBILE_MONEY: 0 };
    let total = 0;

    for (const day of days) {
      const dayData = allOps[day.id];
      if (!dayData) continue;

      dayData.movements.filter((m) => m.type === 'EXIT').forEach((m) => {
        byNature[m.category] = (byNature[m.category] || 0) + m.amount;
        byPayMethod['CASH'] += m.amount;
        total += m.amount;
      });

      dayData.expenses.filter((e) => e.status === 'PAID' && e.categoryDirection !== 'ENTRY').forEach((e) => {
        byNature[e.categoryName || 'Autres'] = (byNature[e.categoryName || 'Autres'] || 0) + e.amount;
        const pm = e.paymentMethod || 'CASH';
        byPayMethod[pm] = (byPayMethod[pm] || 0) + e.amount;
        total += e.amount;
      });
    }

    return { byNature, byPayMethod, total };
  }, [days, allOps]);

  const payMethodLabels: Record<string, string> = {
    CASH: 'Espèces', CHECK: 'Chèques', TRANSFER: 'Virements', MOBILE_MONEY: 'Mobile Money',
  };

  return (
    <div>
      <ReportHeader companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId}
        title="État Récapitulatif des Décaissements" subtitle={`Période : ${periodLabel}`} headerConfig={header} />

      <h3 className="mb-2 text-sm font-bold uppercase text-gray-600">Ventilation par mode de paiement</h3>
      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-red-50">
            <th className="border px-3 py-2 text-left">Mode de paiement</th>
            <th className="border px-3 py-2 text-right">Montant (FCFA)</th>
            <th className="border px-3 py-2 text-right">% du total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(breakdown.byPayMethod).filter(([, v]) => v > 0).map(([k, v], i) => (
            <tr key={k} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border px-3 py-2">{payMethodLabels[k] || k}</td>
              <td className="border px-3 py-2 text-right font-medium">{fmt(v)}</td>
              <td className="border px-3 py-2 text-right">{breakdown.total > 0 ? ((v / breakdown.total) * 100).toFixed(1) : '0.0'} %</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-red-100 font-bold">
            <td className="border px-3 py-2">TOTAL DÉCAISSEMENTS</td>
            <td className="border px-3 py-2 text-right">{fmt(breakdown.total)}</td>
            <td className="border px-3 py-2 text-right">100 %</td>
          </tr>
        </tfoot>
      </table>

      <h3 className="mb-2 text-sm font-bold uppercase text-gray-600">Ventilation par nature de dépense</h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2 text-left">Nature</th>
            <th className="border px-3 py-2 text-right">Montant (FCFA)</th>
            <th className="border px-3 py-2 text-right">% du total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(breakdown.byNature).sort(([, a], [, b]) => b - a).map(([k, v], i) => (
            <tr key={k} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border px-3 py-2">{k}</td>
              <td className="border px-3 py-2 text-right font-medium">{fmt(v)}</td>
              <td className="border px-3 py-2 text-right">{breakdown.total > 0 ? ((v / breakdown.total) * 100).toFixed(1) : '0.0'} %</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   6. RAPPORT DE SYNTHÈSE DE TRÉSORERIE
   ═══════════════════════════════════════════════════════════ */
function SyntheseTresorerie({ days, periodLabel, companyName, companyAddress, companyPhone, companyTaxId, printedBy }: {
  days: CashClosingRecord[];
  periodLabel: string;
  companyName: string; companyAddress?: string; companyPhone?: string; companyTaxId?: string; printedBy: string;
}) {
  const { header, footer } = useReportDesign('synthese');
  const openingBalance = days.length > 0 ? days[0].openingBalance : 0;
  const totalEntries = days.reduce((s, d) => s + d.totalEntries, 0);
  const totalExits = days.reduce((s, d) => s + d.totalExits, 0);
  const closingBalance = days.length > 0 ? (days[days.length - 1].actualBalance ?? days[days.length - 1].theoreticalBalance) : 0;
  const netFlow = totalEntries - totalExits;

  return (
    <div>
      <ReportHeader companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId}
        title="Rapport de Synthèse de Trésorerie" subtitle={`Période : ${periodLabel}`} headerConfig={header} />

      {/* Summary table */}
      <table className="mx-auto mb-6 w-[520px] border-collapse text-sm">
        <tbody>
          <tr className="bg-gray-50">
            <td className="border px-4 py-3 font-medium">Solde d'ouverture de la période</td>
            <td className="border px-4 py-3 text-right font-bold">{fmt(openingBalance)} FCFA</td>
          </tr>
          <tr>
            <td className="border px-4 py-3 font-medium">Total des entrées (encaissements)</td>
            <td className="border px-4 py-3 text-right font-bold text-green-700">+ {fmt(totalEntries)} FCFA</td>
          </tr>
          <tr className="bg-gray-50">
            <td className="border px-4 py-3 font-medium">Total des sorties (décaissements)</td>
            <td className="border px-4 py-3 text-right font-bold text-red-700">− {fmt(totalExits)} FCFA</td>
          </tr>
          <tr className={netFlow >= 0 ? 'bg-green-50' : 'bg-red-50'}>
            <td className="border px-4 py-3 text-lg font-bold">Flux net de trésorerie</td>
            <td className={`border px-4 py-3 text-right text-lg font-bold ${netFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {netFlow > 0 ? '+' : ''}{fmt(netFlow)} FCFA
            </td>
          </tr>
          <tr className="bg-blue-50">
            <td className="border px-4 py-3 text-lg font-bold">Solde de clôture de la période</td>
            <td className="border px-4 py-3 text-right text-lg font-bold">{fmt(closingBalance)} FCFA</td>
          </tr>
        </tbody>
      </table>

      {/* Daily trend */}
      <h3 className="mb-2 text-sm font-bold uppercase text-gray-600">Évolution quotidienne de la trésorerie</h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 text-left">Journée</th>
            <th className="border px-2 py-1 text-left">Date</th>
            <th className="border px-2 py-1 text-right">Solde ouverture</th>
            <th className="border px-2 py-1 text-right">Entrées</th>
            <th className="border px-2 py-1 text-right">Sorties</th>
            <th className="border px-2 py-1 text-right">Solde clôture</th>
            <th className="border px-2 py-1 text-right">Variation</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => {
            const actual = d.actualBalance ?? d.theoreticalBalance;
            const variation = actual - d.openingBalance;
            return (
              <tr key={d.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border px-2 py-1 font-mono text-xs">{d.reference}</td>
                <td className="border px-2 py-1 text-xs">{fmtShortDate(d.openedAt)}</td>
                <td className="border px-2 py-1 text-right">{fmt(d.openingBalance)}</td>
                <td className="border px-2 py-1 text-right text-green-700">{fmt(d.totalEntries)}</td>
                <td className="border px-2 py-1 text-right text-red-700">{fmt(d.totalExits)}</td>
                <td className="border px-2 py-1 text-right font-medium">{fmt(actual)}</td>
                <td className={`border px-2 py-1 text-right font-medium ${variation >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {variation > 0 ? '+' : ''}{fmt(variation)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 rounded border p-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div><span className="text-gray-500">Nombre de journées :</span> <span className="font-bold">{days.length}</span></div>
          <div><span className="text-gray-500">Moyenne journalière flux net :</span> <span className="font-bold">{days.length > 0 ? fmt(netFlow / days.length) : '0'} FCFA</span></div>
        </div>
      </div>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   7. ÉTAT DES ÉCARTS CUMULÉS
   ═══════════════════════════════════════════════════════════ */
function EcartsCumules({ days, periodLabel, companyName, companyAddress, companyPhone, companyTaxId, printedBy }: {
  days: CashClosingRecord[];
  periodLabel: string;
  companyName: string; companyAddress?: string; companyPhone?: string; companyTaxId?: string; printedBy: string;
}) {
  const { isFieldVisible, getFieldLabel, isKpiVisible, getKpiLabel, header, footer } = useReportDesign('ecarts-cumules');
  const daysWithVariance = days.filter((d) => d.actualBalance != null);
  const totalVariance = daysWithVariance.reduce((s, d) => s + d.variance, 0);
  const daysWithEcart = daysWithVariance.filter((d) => Math.abs(d.variance) > 0.5);
  const maxEcart = daysWithVariance.length > 0 ? Math.max(...daysWithVariance.map((d) => Math.abs(d.variance))) : 0;

  return (
    <div>
      <ReportHeader companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId}
        title="État des Écarts Cumulés" subtitle={`Période : ${periodLabel} — Audit & Contrôle financier`} headerConfig={header} />

      {/* Summary KPIs */}
      <div className="mb-4 grid grid-cols-4 gap-3 text-sm">
        <div className="rounded border p-3 text-center">
          <div className="text-xs text-gray-500">Journées analysées</div>
          <div className="text-xl font-bold">{daysWithVariance.length}</div>
        </div>
        <div className="rounded border p-3 text-center">
          <div className="text-xs text-gray-500">Journées avec écart</div>
          <div className={`text-xl font-bold ${daysWithEcart.length > 0 ? 'text-red-700' : 'text-green-700'}`}>{daysWithEcart.length}</div>
        </div>
        <div className="rounded border p-3 text-center">
          <div className="text-xs text-gray-500">Écart cumulé</div>
          <div className={`text-xl font-bold ${Math.abs(totalVariance) > 0.5 ? 'text-red-700' : 'text-green-700'}`}>
            {totalVariance > 0 ? '+' : ''}{fmt(totalVariance)} FCFA
          </div>
        </div>
        <div className="rounded border p-3 text-center">
          <div className="text-xs text-gray-500">Écart max (abs.)</div>
          <div className="text-xl font-bold text-amber-700">{fmt(maxEcart)} FCFA</div>
        </div>
      </div>

      {/* Status */}
      {daysWithEcart.length === 0 ? (
        <div className="mb-4 rounded-lg border-2 border-green-300 bg-green-50 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-1 h-10 w-10 text-green-600" />
          <h3 className="text-lg font-bold text-green-800">Aucun écart sur la période</h3>
          <p className="text-sm text-green-600">Toutes les journées sont conformes.</p>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border-2 border-red-300 bg-red-50 p-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-sm font-semibold text-red-800">
            {daysWithEcart.length} journée{daysWithEcart.length > 1 ? 's' : ''} avec écart détecté{daysWithEcart.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Detail table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 text-left">Journée</th>
            <th className="border px-2 py-1 text-left">Date</th>
            <th className="border px-2 py-1 text-right">Solde théorique</th>
            <th className="border px-2 py-1 text-right">Solde réel</th>
            <th className="border px-2 py-1 text-right">Écart</th>
            <th className="border px-2 py-1 text-right">% écart</th>
            <th className="border px-2 py-1 text-left">Nature</th>
            <th className="border px-2 py-1 text-left">Justification</th>
          </tr>
        </thead>
        <tbody>
          {daysWithVariance.map((d, i) => {
            const hasGap = Math.abs(d.variance) > 0.5;
            const pct = d.theoreticalBalance !== 0 ? (d.variance / d.theoreticalBalance) * 100 : 0;
            return (
              <tr key={d.id} className={hasGap ? 'bg-red-50' : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                <td className="border px-2 py-1 font-mono text-xs">{d.reference}</td>
                <td className="border px-2 py-1 text-xs">{fmtShortDate(d.openedAt)}</td>
                <td className="border px-2 py-1 text-right">{fmt(d.theoreticalBalance)}</td>
                <td className="border px-2 py-1 text-right">{fmt(d.actualBalance ?? 0)}</td>
                <td className={`border px-2 py-1 text-right font-bold ${hasGap ? 'text-red-700' : 'text-green-700'}`}>
                  {d.variance > 0 ? '+' : ''}{fmt(d.variance)}
                </td>
                <td className="border px-2 py-1 text-right">{pct.toFixed(2)} %</td>
                <td className="border px-2 py-1 text-xs">
                  {!hasGap ? '—' : d.variance > 0 ? 'Excédent' : 'Manquant'}
                </td>
                <td className="border px-2 py-1 text-xs text-gray-600">{d.comment || '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td colSpan={4} className="border px-2 py-1 text-right">ÉCART CUMULÉ</td>
            <td className={`border px-2 py-1 text-right ${Math.abs(totalVariance) > 0.5 ? 'text-red-800' : 'text-green-800'}`}>
              {totalVariance > 0 ? '+' : ''}{fmt(totalVariance)} FCFA
            </td>
            <td colSpan={3} className="border px-2 py-1" />
          </tr>
        </tfoot>
      </table>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function ManagerCashReportsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const printedBy = user ? `${user.firstName} ${user.lastName}` : '—';

  // Period selection
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [mode, setMode] = useState<'period' | 'day'>('period');
  const [dateFrom, setDateFrom] = useState(firstDay.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [daySearch, setDaySearch] = useState('');
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeReport, setActiveReport] = useState<PeriodReportType>('grand-livre');
  const [openTabs, setOpenTabs] = useState<PeriodReportType[]>(['grand-livre']);

  // For day mode: fetch all closed days to populate the combo
  const { data: rawClosingHistory = [] } = useClosingHistory();
  const allClosedDays = useMemo(
    () => rawClosingHistory
      .filter((d) => d.status === 'CLOSED')
      .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()),
    [rawClosingHistory],
  );

  // Filter combo list by search term
  const filteredDayOptions = useMemo(() => {
    if (!daySearch.trim()) return allClosedDays;
    const q = daySearch.toLowerCase();
    return allClosedDays.filter((d) =>
      d.reference.toLowerCase().includes(q) ||
      fmtDate(d.openedAt).toLowerCase().includes(q) ||
      (d.closedAt && fmtDate(d.closedAt).toLowerCase().includes(q)),
    );
  }, [allClosedDays, daySearch]);

  const selectedDay = useMemo(
    () => allClosedDays.find((d) => d.id === selectedDayId) ?? null,
    [allClosedDays, selectedDayId],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDayDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Data — period mode uses usePeriodClosingHistory; day mode uses the already-fetched selectedDay directly
  const { data: periodDays = [], isLoading: periodDaysLoading } = usePeriodClosingHistory(
    mode === 'period' ? dateFrom : undefined,
    mode === 'period' ? dateTo : undefined,
  );
  const days = mode === 'day' && selectedDay ? [selectedDay] : mode === 'period' ? periodDays : [];
  const daysLoading = mode === 'period' && periodDaysLoading;
  const dayIds = useMemo(() => days.map((d) => d.id), [days]);
  const { data: allOps = {}, isLoading: opsLoading } = useMultiDayOperations(dayIds);
  const { data: accountingData = [], isLoading: accLoading } = useMultiDayAccountingEntries(dayIds);
  const { data: settings } = useSettings();

  const isLoading = daysLoading || (dayIds.length > 0 && (opsLoading || accLoading));

  const company = settings?.company;
  const companyName = company?.name || user?.companyName || 'Entreprise';
  const companyAddress = company?.address;
  const companyPhone = company?.phone;
  const companyTaxId = company?.taxId;

  const periodLabel = mode === 'day' && selectedDay
    ? `${selectedDay.reference} — ${fmtDate(selectedDay.openedAt)}`
    : `Du ${fmtDate((dateFrom || '') + 'T00:00:00')} au ${fmtDate((dateTo || '') + 'T00:00:00')}`;

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Quick period shortcuts
  const setQuickPeriod = useCallback((type: 'month' | 'quarter' | 'year') => {
    const now = new Date();
    let from: Date;
    if (type === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (type === 'quarter') {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1);
    } else {
      from = new Date(now.getFullYear(), 0, 1);
    }
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(now.toISOString().slice(0, 10));
  }, []);

  // Tab management
  const openReport = useCallback((id: PeriodReportType) => {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveReport(id);
  }, []);

  const closeTab = useCallback((id: PeriodReportType) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== id);
      if (next.length === 0) return prev; // keep at least one tab
      if (activeReport === id) {
        const idx = prev.indexOf(id);
        setActiveReport(next[Math.min(idx, next.length - 1)]);
      }
      return next;
    });
  }, [activeReport]);

  const reports: { id: PeriodReportType; label: string; icon: typeof FileText; desc: string }[] = [
    { id: 'grand-livre', label: t('periodReports.grandLivre.title'), icon: BookOpen, desc: t('periodReports.grandLivre.desc') },
    { id: 'balance', label: t('periodReports.balance.title'), icon: Scale, desc: t('periodReports.balance.desc') },
    { id: 'journal-comptable', label: t('periodReports.journalComptable.title'), icon: FileText, desc: t('periodReports.journalComptable.desc') },
    { id: 'encaissements', label: t('periodReports.encaissements.title'), icon: ArrowUpRight, desc: t('periodReports.encaissements.desc') },
    { id: 'decaissements', label: t('periodReports.decaissements.title'), icon: ArrowDownRight, desc: t('periodReports.decaissements.desc') },
    { id: 'synthese', label: t('periodReports.synthese.title'), icon: TrendingUp, desc: t('periodReports.synthese.desc') },
    { id: 'ecarts-cumules', label: t('periodReports.ecartsCumules.title'), icon: AlertTriangle, desc: t('periodReports.ecartsCumules.desc') },
  ];

  return (
    <>
      {/* Screen UI */}
      <div className="no-print space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-6 w-6 text-brand-gold" />
            {t('periodReports.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('periodReports.subtitle')}</p>
        </div>

        {/* Period selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('periodReports.selectPeriod')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mode toggle */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setMode('period')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === 'period'
                    ? 'bg-brand-gold text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('periodReports.modePeriod')}
              </button>
              <button
                onClick={() => setMode('day')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === 'day'
                    ? 'bg-brand-gold text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('periodReports.modeDay')}
              </button>
            </div>

            {mode === 'day' ? (
              <div className="flex flex-wrap items-end gap-4">
                <div className="relative w-80" ref={dropdownRef}>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('periodReports.dayLabel')}</label>
                  {/* Selected value / trigger */}
                  <button
                    type="button"
                    onClick={() => setDayDropdownOpen(!dayDropdownOpen)}
                    className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  >
                    {selectedDay ? (
                      <span className="truncate">
                        <span className="font-medium">{selectedDay.reference}</span>
                        <span className="ml-2 text-gray-500">{fmtDate(selectedDay.openedAt)}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">{t('periodReports.selectDay')}</span>
                    )}
                    <div className="flex items-center gap-1">
                      {selectedDay && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setSelectedDayId(null); setDaySearch(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedDayId(null); setDaySearch(''); } }}
                          className="rounded p-0.5 hover:bg-gray-100"
                        >
                          <X className="h-3.5 w-3.5 text-gray-400" />
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                  </button>

                  {/* Dropdown */}
                  {dayDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                      {/* Search input */}
                      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                        <Search className="h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={daySearch}
                          onChange={(e) => setDaySearch(e.target.value)}
                          placeholder={t('periodReports.searchDay')}
                          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                          autoFocus
                        />
                      </div>
                      {/* Options list */}
                      <ul className="max-h-60 overflow-y-auto py-1">
                        {filteredDayOptions.length === 0 ? (
                          <li className="px-3 py-2 text-center text-sm text-gray-400">
                            {t('periodReports.noDayFound')}
                          </li>
                        ) : (
                          filteredDayOptions.map((d) => (
                            <li
                              key={d.id}
                              onClick={() => {
                                setSelectedDayId(d.id);
                                setDayDropdownOpen(false);
                                setDaySearch('');
                              }}
                              className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-brand-gold/10 ${
                                d.id === selectedDayId ? 'bg-brand-gold/5 font-medium text-brand-gold' : 'text-gray-700'
                              }`}
                            >
                              <span>
                                <span className="font-medium">{d.reference}</span>
                                <span className="ml-2 text-gray-500">{fmtDate(d.openedAt)}</span>
                              </span>
                              <span className="text-xs text-gray-400">{fmt(d.theoreticalBalance)} FCFA</span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('periodReports.dateFrom')}</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('periodReports.dateTo')}</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setQuickPeriod('month')}>
                    {t('periodReports.thisMonth')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickPeriod('quarter')}>
                    {t('periodReports.thisQuarter')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickPeriod('year')}>
                    {t('periodReports.thisYear')}
                  </Button>
                </div>
              </div>
            )}
            {days.length > 0 && (
              <p className="mt-3 text-sm text-gray-500">
                <Wallet className="mr-1 inline h-4 w-4" />
                {t('periodReports.daysFound', { count: days.length })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Report tabs */}
        <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 340px)' }}>
          {/* ── Left sidebar: vertical report list ── */}
          <div className="w-64 shrink-0 space-y-1">
            {reports.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                onClick={() => openReport(id)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  activeReport === id
                    ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                    : openTabs.includes(id)
                    ? 'border-brand-gold/30 bg-brand-gold/5 text-gray-700 hover:bg-brand-gold/10'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium leading-tight">{label}</div>
                  <div className="mt-0.5 text-xs text-gray-400 leading-tight">{desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* ── Right content: dynamic tabs ── */}
          <div className="min-w-0 flex-1">
            {/* Loading state */}
            {isLoading && (
              <div className="py-8 text-center text-sm text-gray-400">
                {t('common.loading')}
              </div>
            )}

            {/* No data */}
            {!isLoading && days.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-gray-400">
                  {t('periodReports.noData')}
                </CardContent>
              </Card>
            )}

            {/* Tabs + content */}
            {!isLoading && days.length > 0 && (
              <>
                {/* Tab bar */}
                <div className="flex items-center justify-between border-b border-gray-200">
                  <div className="flex overflow-x-auto">
                    {openTabs.map((tabId) => {
                      const rpt = reports.find((r) => r.id === tabId);
                      if (!rpt) return null;
                      const TabIcon = rpt.icon;
                      return (
                        <div
                          key={tabId}
                          className={`group flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                            activeReport === tabId
                              ? 'border-brand-gold text-brand-gold'
                              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                          }`}
                          onClick={() => setActiveReport(tabId)}
                        >
                          <TabIcon className="h-3.5 w-3.5" />
                          <span>{rpt.label}</span>
                          {openTabs.length > 1 && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); closeTab(tabId); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); closeTab(tabId); } }}
                              className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100"
                            >
                              <X className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Button size="sm" onClick={handlePrint} className="ml-2 shrink-0">
                    <Printer className="mr-1 h-3.5 w-3.5" />
                    {t('reports.print')}
                  </Button>
                </div>

                {/* Report content */}
                <div className="mt-4 rounded border bg-white p-6">
                  {activeReport === 'grand-livre' && (
                    <GrandLivreDeCaisse days={days} allOps={allOps} periodLabel={periodLabel}
                      companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
                  )}
                  {activeReport === 'balance' && (
                    <BalanceDeCaisse days={days} periodLabel={periodLabel}
                      companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
                  )}
                  {activeReport === 'journal-comptable' && (
                    <JournalComptable accountingData={accountingData} periodLabel={periodLabel}
                      companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
                  )}
                  {activeReport === 'encaissements' && (
                    <EtatEncaissements days={days} allOps={allOps} periodLabel={periodLabel}
                      companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
                  )}
                  {activeReport === 'decaissements' && (
                    <EtatDecaissements days={days} allOps={allOps} periodLabel={periodLabel}
                      companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
                  )}
                  {activeReport === 'synthese' && (
                    <SyntheseTresorerie days={days} periodLabel={periodLabel}
                      companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
                  )}
                  {activeReport === 'ecarts-cumules' && (
                    <EcartsCumules days={days} periodLabel={periodLabel}
                      companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Print area */}
      <div className="print-only">
        {days.length > 0 && (
          <div className="p-4 text-black" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' }}>
            {activeReport === 'grand-livre' && (
              <GrandLivreDeCaisse days={days} allOps={allOps} periodLabel={periodLabel}
                companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
            )}
            {activeReport === 'balance' && (
              <BalanceDeCaisse days={days} periodLabel={periodLabel}
                companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
            )}
            {activeReport === 'journal-comptable' && (
              <JournalComptable accountingData={accountingData} periodLabel={periodLabel}
                companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
            )}
            {activeReport === 'encaissements' && (
              <EtatEncaissements days={days} allOps={allOps} periodLabel={periodLabel}
                companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
            )}
            {activeReport === 'decaissements' && (
              <EtatDecaissements days={days} allOps={allOps} periodLabel={periodLabel}
                companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
            )}
            {activeReport === 'synthese' && (
              <SyntheseTresorerie days={days} periodLabel={periodLabel}
                companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
            )}
            {activeReport === 'ecarts-cumules' && (
              <EcartsCumules days={days} periodLabel={periodLabel}
                companyName={companyName} companyAddress={companyAddress} companyPhone={companyPhone} companyTaxId={companyTaxId} printedBy={printedBy} />
            )}
          </div>
        )}
      </div>
    </>
  );
}
