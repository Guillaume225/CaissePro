import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Printer,
  FileText,
  BookOpen,
  Scale,
  Coins,
  AlertTriangle,
  Search,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import {
  useClosingHistory,
  useCashDayDetail,
  useCashDayOperations,
  useCashState,
} from '@/hooks/useClosing';
import { useSettings } from '@/hooks/useAdmin';
import { useAuthStore } from '@/stores/auth-store';
import { useReportDesign } from '@/hooks/useReportDesign';
import type { ReportHeaderConfig, ReportFooterConfig } from '@/stores/report-config-store';
import type { CashDayDetail, CashDayMovement, CashDayExpense } from '@/hooks/useClosing';

/* ─── Helpers ─── */
const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (d: string) => `${fmtDate(d)} à ${fmtTime(d)}`;

type ReportType = 'journal' | 'brouillard' | 'situation' | 'comptage' | 'ecarts';

/* ═══════════════════════════════════════════════════════════
   Denominations for FCFA counting sheet
   ═══════════════════════════════════════════════════════════ */
const DENOMINATIONS = [
  { label: '10 000 FCFA', value: 10000, type: 'billet' },
  { label: '5 000 FCFA', value: 5000, type: 'billet' },
  { label: '2 000 FCFA', value: 2000, type: 'billet' },
  { label: '1 000 FCFA', value: 1000, type: 'billet' },
  { label: '500 FCFA', value: 500, type: 'billet' },
  { label: '250 FCFA', value: 250, type: 'piece' },
  { label: '200 FCFA', value: 200, type: 'piece' },
  { label: '100 FCFA', value: 100, type: 'piece' },
  { label: '50 FCFA', value: 50, type: 'piece' },
  { label: '25 FCFA', value: 25, type: 'piece' },
  { label: '10 FCFA', value: 10, type: 'piece' },
  { label: '5 FCFA', value: 5, type: 'piece' },
] as const;

/* ═══════════════════════════════════════════════════════════
   Report header (company info) — reused in all reports
   ═══════════════════════════════════════════════════════════ */
function ReportHeader({
  companyName,
  companyAddress,
  companyPhone,
  companyTaxId,
  title,
  subtitle,
  headerConfig,
}: {
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
      {(!hc || hc.showCompanyName) && (
        <h1 className="text-xl font-bold uppercase tracking-wider">{companyName}</h1>
      )}
      {(!hc || hc.showCompanyAddress) && companyAddress && (
        <p className="text-sm text-gray-600">{companyAddress}</p>
      )}
      <div className="flex justify-center gap-4 text-xs text-gray-500">
        {(!hc || hc.showCompanyPhone) && companyPhone && <span>Tél: {companyPhone}</span>}
        {(!hc || hc.showCompanyTaxId) && companyTaxId && <span>NIF: {companyTaxId}</span>}
      </div>
      <div className="mt-4">
        <h2 className="text-lg font-bold uppercase">{hc?.customTitle || title}</h2>
        {(hc?.customSubtitle || subtitle) && (
          <p className="text-sm text-gray-600">{hc?.customSubtitle || subtitle}</p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Report footer with signatures
   ═══════════════════════════════════════════════════════════ */
function ReportFooter({
  printedBy,
  footerConfig,
}: {
  printedBy: string;
  footerConfig?: ReportFooterConfig | null;
}) {
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
            <p className="mt-1 text-xs text-gray-400">{fc?.verifiedByLabel || 'Le Manager'}</p>
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
   1. ÉTAT DE CAISSE (Journal de caisse)
   ═══════════════════════════════════════════════════════════ */
function JournalDeCaisse({
  day,
  movements,
  expenses,
  companyName,
  companyAddress,
  companyPhone,
  companyTaxId,
  printedBy,
}: {
  day: CashDayDetail;
  movements: CashDayMovement[];
  expenses: CashDayExpense[];
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  printedBy: string;
}) {
  const { isFieldVisible, getFieldLabel, isKpiVisible, getKpiLabel, header, footer } =
    useReportDesign('journal-caisse');

  const allOps = useMemo(() => {
    const ops: { time: string; ref: string; label: string; entry: number; exit: number }[] = [];
    movements.forEach((m) => {
      ops.push({
        time: m.time,
        ref: m.reference || '—',
        label: `${m.category} — ${m.description}`,
        entry: m.type === 'ENTRY' ? m.amount : 0,
        exit: m.type === 'EXIT' ? m.amount : 0,
      });
    });
    expenses
      .filter((e) => e.status === 'PAID')
      .forEach((e) => {
        const isEntry = e.categoryDirection === 'ENTRY';
        ops.push({
          time: e.createdAt,
          ref: e.reference,
          label: `${e.categoryName || 'Dépense'} — ${e.beneficiary}`,
          entry: isEntry ? e.amount : 0,
          exit: !isEntry ? e.amount : 0,
        });
      });
    ops.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return ops;
  }, [movements, expenses]);

  const totalEntries = allOps.reduce((s, o) => s + o.entry, 0);
  const totalExits = allOps.reduce((s, o) => s + o.exit, 0);

  return (
    <div>
      <ReportHeader
        companyName={companyName}
        companyAddress={companyAddress}
        companyPhone={companyPhone}
        companyTaxId={companyTaxId}
        title="État de Caisse — Journal de Caisse"
        subtitle={`Journée ${day.reference} du ${fmtDate(day.openedAt)}`}
        headerConfig={header}
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-4 gap-2 text-sm">
        {isKpiVisible('openingBalance') && (
          <div className="rounded border p-2 text-center">
            <div className="text-xs text-gray-500">
              {getKpiLabel('openingBalance', 'Solde initial')}
            </div>
            <div className="font-bold">{fmt(day.openingBalance)} FCFA</div>
          </div>
        )}
        {isKpiVisible('totalEntries') && (
          <div className="rounded border p-2 text-center">
            <div className="text-xs text-gray-500">
              {getKpiLabel('totalEntries', 'Total encaissements')}
            </div>
            <div className="font-bold text-green-700">{fmt(totalEntries)} FCFA</div>
          </div>
        )}
        {isKpiVisible('totalExits') && (
          <div className="rounded border p-2 text-center">
            <div className="text-xs text-gray-500">
              {getKpiLabel('totalExits', 'Total décaissements')}
            </div>
            <div className="font-bold text-red-700">{fmt(totalExits)} FCFA</div>
          </div>
        )}
        {isKpiVisible('theoreticalBalance') && (
          <div className="rounded border p-2 text-center">
            <div className="text-xs text-gray-500">
              {getKpiLabel('theoreticalBalance', 'Solde théorique')}
            </div>
            <div className="font-bold">{fmt(day.theoreticalBalance)} FCFA</div>
          </div>
        )}
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            {isFieldVisible('time') && (
              <th className="border px-2 py-1 text-left">{getFieldLabel('time', 'Heure')}</th>
            )}
            {isFieldVisible('reference') && (
              <th className="border px-2 py-1 text-left">
                {getFieldLabel('reference', 'Référence')}
              </th>
            )}
            {isFieldVisible('label') && (
              <th className="border px-2 py-1 text-left">{getFieldLabel('label', 'Libellé')}</th>
            )}
            {isFieldVisible('entry') && (
              <th className="border px-2 py-1 text-right">
                {getFieldLabel('entry', 'Entrée (FCFA)')}
              </th>
            )}
            {isFieldVisible('exit') && (
              <th className="border px-2 py-1 text-right">
                {getFieldLabel('exit', 'Sortie (FCFA)')}
              </th>
            )}
            {isFieldVisible('balance') && (
              <th className="border px-2 py-1 text-right">
                {getFieldLabel('balance', 'Solde (FCFA)')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {(() => {
            let running = day.openingBalance;
            return allOps.map((op, i) => {
              running = running + op.entry - op.exit;
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {isFieldVisible('time') && (
                    <td className="border px-2 py-1 text-xs">{fmtTime(op.time)}</td>
                  )}
                  {isFieldVisible('reference') && (
                    <td className="border px-2 py-1 font-mono text-xs">{op.ref}</td>
                  )}
                  {isFieldVisible('label') && <td className="border px-2 py-1">{op.label}</td>}
                  {isFieldVisible('entry') && (
                    <td className="border px-2 py-1 text-right">
                      {op.entry > 0 ? fmt(op.entry) : '—'}
                    </td>
                  )}
                  {isFieldVisible('exit') && (
                    <td className="border px-2 py-1 text-right">
                      {op.exit > 0 ? fmt(op.exit) : '—'}
                    </td>
                  )}
                  {isFieldVisible('balance') && (
                    <td className="border px-2 py-1 text-right font-medium">{fmt(running)}</td>
                  )}
                </tr>
              );
            });
          })()}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td
              colSpan={
                [
                  isFieldVisible('time'),
                  isFieldVisible('reference'),
                  isFieldVisible('label'),
                ].filter(Boolean).length
              }
              className="border px-2 py-1 text-right"
            >
              TOTAUX
            </td>
            {isFieldVisible('entry') && (
              <td className="border px-2 py-1 text-right text-green-800">{fmt(totalEntries)}</td>
            )}
            {isFieldVisible('exit') && (
              <td className="border px-2 py-1 text-right text-red-800">{fmt(totalExits)}</td>
            )}
            {isFieldVisible('balance') && (
              <td className="border px-2 py-1 text-right">{fmt(day.theoreticalBalance)}</td>
            )}
          </tr>
        </tfoot>
      </table>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   2. BROUILLARD DE CAISSE
   ═══════════════════════════════════════════════════════════ */
function BrouillardDeCaisse({
  day,
  movements,
  expenses,
  companyName,
  companyAddress,
  companyPhone,
  companyTaxId,
  printedBy,
}: {
  day: CashDayDetail;
  movements: CashDayMovement[];
  expenses: CashDayExpense[];
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  printedBy: string;
}) {
  const { isFieldVisible, getFieldLabel, header, footer } = useReportDesign('brouillard-caisse');

  // All operations in strict chronological order — this is the "day book" for audit
  const allOps = useMemo(() => {
    const ops: {
      time: string;
      ref: string;
      type: string;
      category: string;
      description: string;
      amount: number;
      direction: 'E' | 'S';
    }[] = [];
    movements.forEach((m) => {
      ops.push({
        time: m.time,
        ref: m.reference || '—',
        type: 'Mouvement',
        category: m.category,
        description: m.description,
        amount: m.amount,
        direction: m.type === 'ENTRY' ? 'E' : 'S',
      });
    });
    expenses.forEach((e) => {
      ops.push({
        time: e.createdAt,
        ref: e.reference,
        type: 'Dépense',
        category: e.categoryName || '—',
        description: `${e.beneficiary} — ${e.status}`,
        amount: e.amount,
        direction: e.categoryDirection === 'ENTRY' ? 'E' : 'S',
      });
    });
    ops.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return ops;
  }, [movements, expenses]);

  return (
    <div>
      <ReportHeader
        companyName={companyName}
        companyAddress={companyAddress}
        companyPhone={companyPhone}
        companyTaxId={companyTaxId}
        title="Brouillard de Caisse"
        subtitle={`Journée ${day.reference} du ${fmtDate(day.openedAt)} — Document d'audit`}
        headerConfig={header}
      />

      <p className="mb-3 text-xs text-gray-500 italic">
        Détail chronologique de toutes les opérations enregistrées — usage audit et contrôle
        interne.
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            {isFieldVisible('seq') && (
              <th className="border px-2 py-1 text-left">{getFieldLabel('seq', 'N°')}</th>
            )}
            {isFieldVisible('time') && (
              <th className="border px-2 py-1 text-left">{getFieldLabel('time', 'Heure')}</th>
            )}
            {isFieldVisible('reference') && (
              <th className="border px-2 py-1 text-left">{getFieldLabel('reference', 'Réf.')}</th>
            )}
            {isFieldVisible('type') && (
              <th className="border px-2 py-1 text-left">{getFieldLabel('type', 'Type')}</th>
            )}
            {isFieldVisible('category') && (
              <th className="border px-2 py-1 text-left">
                {getFieldLabel('category', 'Catégorie')}
              </th>
            )}
            {isFieldVisible('description') && (
              <th className="border px-2 py-1 text-left">
                {getFieldLabel('description', 'Description')}
              </th>
            )}
            {isFieldVisible('direction') && (
              <th className="border px-2 py-1 text-center">{getFieldLabel('direction', 'E/S')}</th>
            )}
            {isFieldVisible('amount') && (
              <th className="border px-2 py-1 text-right">
                {getFieldLabel('amount', 'Montant (FCFA)')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {allOps.map((op, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {isFieldVisible('seq') && (
                <td className="border px-2 py-1 text-xs text-gray-500">{i + 1}</td>
              )}
              {isFieldVisible('time') && (
                <td className="border px-2 py-1 text-xs">{fmtTime(op.time)}</td>
              )}
              {isFieldVisible('reference') && (
                <td className="border px-2 py-1 font-mono text-xs">{op.ref}</td>
              )}
              {isFieldVisible('type') && <td className="border px-2 py-1 text-xs">{op.type}</td>}
              {isFieldVisible('category') && (
                <td className="border px-2 py-1 text-xs">{op.category}</td>
              )}
              {isFieldVisible('description') && (
                <td className="border px-2 py-1">{op.description}</td>
              )}
              {isFieldVisible('direction') && (
                <td
                  className={`border px-2 py-1 text-center font-bold ${op.direction === 'E' ? 'text-green-700' : 'text-red-700'}`}
                >
                  {op.direction === 'E' ? 'Entrée' : 'Sortie'}
                </td>
              )}
              {isFieldVisible('amount') && (
                <td className="border px-2 py-1 text-right">{fmt(op.amount)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 text-right text-sm font-bold">Total opérations : {allOps.length}</div>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   3. SITUATION DE CAISSE
   ═══════════════════════════════════════════════════════════ */
function SituationDeCaisse({
  day,
  companyName,
  companyAddress,
  companyPhone,
  companyTaxId,
  printedBy,
}: {
  day: CashDayDetail;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  printedBy: string;
}) {
  const { isFieldVisible, getFieldLabel, header, footer } = useReportDesign('situation-caisse');
  const variance = day.actualBalance != null ? day.actualBalance - day.theoreticalBalance : 0;
  const hasVariance = Math.abs(variance) > 0.5;

  return (
    <div>
      <ReportHeader
        companyName={companyName}
        companyAddress={companyAddress}
        companyPhone={companyPhone}
        companyTaxId={companyTaxId}
        title="Situation de Caisse"
        subtitle={`Journée ${day.reference} du ${fmtDate(day.openedAt)}`}
        headerConfig={header}
      />

      <table className="mx-auto w-[500px] border-collapse text-sm">
        <tbody>
          {isFieldVisible('openingBalance') && (
            <tr className="bg-gray-50">
              <td className="border px-4 py-3 font-medium">
                {getFieldLabel('openingBalance', "Solde d'ouverture")}
              </td>
              <td className="border px-4 py-3 text-right font-bold">
                {fmt(day.openingBalance)} FCFA
              </td>
            </tr>
          )}
          {isFieldVisible('totalEntries') && (
            <tr>
              <td className="border px-4 py-3 font-medium">
                {getFieldLabel('totalEntries', 'Total des entrées')}
              </td>
              <td className="border px-4 py-3 text-right font-bold text-green-700">
                + {fmt(day.totalEntries)} FCFA
              </td>
            </tr>
          )}
          {isFieldVisible('totalExits') && (
            <tr className="bg-gray-50">
              <td className="border px-4 py-3 font-medium">
                {getFieldLabel('totalExits', 'Total des sorties')}
              </td>
              <td className="border px-4 py-3 text-right font-bold text-red-700">
                − {fmt(day.totalExits)} FCFA
              </td>
            </tr>
          )}
          {isFieldVisible('theoreticalBalance') && (
            <tr className="bg-blue-50">
              <td className="border px-4 py-3 text-lg font-bold">
                {getFieldLabel('theoreticalBalance', 'Solde théorique (système)')}
              </td>
              <td className="border px-4 py-3 text-right text-lg font-bold">
                {fmt(day.theoreticalBalance)} FCFA
              </td>
            </tr>
          )}
          {isFieldVisible('actualBalance') && (
            <tr className="bg-yellow-50">
              <td className="border px-4 py-3 text-lg font-bold">
                {getFieldLabel('actualBalance', 'Solde réel (comptage physique)')}
              </td>
              <td className="border px-4 py-3 text-right text-lg font-bold">
                {day.actualBalance != null ? `${fmt(day.actualBalance)} FCFA` : 'Non renseigné'}
              </td>
            </tr>
          )}
          {isFieldVisible('variance') && (
            <tr className={hasVariance ? 'bg-red-50' : 'bg-green-50'}>
              <td className="border px-4 py-3 text-lg font-bold">
                {getFieldLabel('variance', 'Écart constaté')}
              </td>
              <td
                className={`border px-4 py-3 text-right text-lg font-bold ${hasVariance ? 'text-red-700' : 'text-green-700'}`}
              >
                {variance > 0 ? '+' : ''}
                {fmt(variance)} FCFA
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isFieldVisible('comment') && day.comment && (
        <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
          <h4 className="mb-1 text-sm font-bold">Commentaire / Justification :</h4>
          <p className="text-sm text-gray-700">{day.comment}</p>
        </div>
      )}

      {(isFieldVisible('openedAt') || isFieldVisible('closedAt')) && (
        <div className="mt-4 rounded border border-gray-300 p-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            {isFieldVisible('openedAt') && (
              <div>
                <span className="text-gray-500">Ouverture :</span> {fmtDateTime(day.openedAt)} par{' '}
                {day.openedByName}
              </div>
            )}
            {isFieldVisible('closedAt') && day.closedAt && (
              <div>
                <span className="text-gray-500">Clôture :</span> {fmtDateTime(day.closedAt)} par{' '}
                {day.closedByName}
              </div>
            )}
          </div>
        </div>
      )}

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   4. FICHE DE COMPTAGE DE CAISSE
   ═══════════════════════════════════════════════════════════ */
function FicheComptage({
  day,
  counts,
  otherAmounts,
  companyName,
  companyAddress,
  companyPhone,
  companyTaxId,
  printedBy,
}: {
  day: CashDayDetail;
  counts: Record<number, number>;
  otherAmounts: { cheques: number; mobileMoney: number };
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  printedBy: string;
}) {
  const { header, footer } = useReportDesign('comptage');
  const cashTotal = DENOMINATIONS.reduce((s, d) => s + d.value * (counts[d.value] || 0), 0);
  const grandTotal = cashTotal + otherAmounts.cheques + otherAmounts.mobileMoney;

  return (
    <div>
      <ReportHeader
        companyName={companyName}
        companyAddress={companyAddress}
        companyPhone={companyPhone}
        companyTaxId={companyTaxId}
        title="Fiche de Comptage de Caisse"
        subtitle={`Journée ${day.reference} du ${fmtDate(day.openedAt)}`}
        headerConfig={header}
      />

      <h3 className="mb-2 text-sm font-bold uppercase text-gray-600">Billets et pièces</h3>
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-1 text-left">Coupure</th>
            <th className="border px-3 py-1 text-left">Type</th>
            <th className="border px-3 py-1 text-right">Quantité</th>
            <th className="border px-3 py-1 text-right">Montant (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          {DENOMINATIONS.map((d) => {
            const qty = counts[d.value] || 0;
            return (
              <tr key={d.value} className={qty > 0 ? 'bg-white' : 'bg-gray-50 text-gray-400'}>
                <td className="border px-3 py-1">{d.label}</td>
                <td className="border px-3 py-1 capitalize">{d.type}</td>
                <td className="border px-3 py-1 text-right">{qty}</td>
                <td className="border px-3 py-1 text-right font-medium">{fmt(qty * d.value)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td colSpan={3} className="border px-3 py-1 text-right">
              Total espèces
            </td>
            <td className="border px-3 py-1 text-right">{fmt(cashTotal)} FCFA</td>
          </tr>
        </tfoot>
      </table>

      <h3 className="mb-2 text-sm font-bold uppercase text-gray-600">Autres moyens</h3>
      <table className="mb-4 w-full border-collapse text-sm">
        <tbody>
          <tr className="bg-gray-50">
            <td className="border px-3 py-2 font-medium">Chèques</td>
            <td className="border px-3 py-2 text-right">{fmt(otherAmounts.cheques)} FCFA</td>
          </tr>
          <tr>
            <td className="border px-3 py-2 font-medium">Mobile Money</td>
            <td className="border px-3 py-2 text-right">{fmt(otherAmounts.mobileMoney)} FCFA</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="bg-blue-100 font-bold text-lg">
            <td className="border px-3 py-2">TOTAL GÉNÉRAL</td>
            <td className="border px-3 py-2 text-right">{fmt(grandTotal)} FCFA</td>
          </tr>
        </tfoot>
      </table>

      <div className="rounded border p-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500">Solde théorique (système) :</span>
            <span className="ml-2 font-bold">{fmt(day.theoreticalBalance)} FCFA</span>
          </div>
          <div>
            <span className="text-gray-500">Total comptage physique :</span>
            <span className="ml-2 font-bold">{fmt(grandTotal)} FCFA</span>
          </div>
          <div>
            <span className="text-gray-500">Écart :</span>
            <span
              className={`ml-2 font-bold ${Math.abs(grandTotal - day.theoreticalBalance) > 0.5 ? 'text-red-700' : 'text-green-700'}`}
            >
              {fmt(grandTotal - day.theoreticalBalance)} FCFA
            </span>
          </div>
        </div>
      </div>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   5. RAPPORT DES ÉCARTS DE CAISSE
   ═══════════════════════════════════════════════════════════ */
function RapportEcarts({
  day,
  companyName,
  companyAddress,
  companyPhone,
  companyTaxId,
  printedBy,
}: {
  day: CashDayDetail;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  printedBy: string;
}) {
  const { header, footer } = useReportDesign('ecarts-journalier');
  const variance = day.actualBalance != null ? day.actualBalance - day.theoreticalBalance : 0;
  const hasVariance = Math.abs(variance) > 0.5;
  const variancePct = day.theoreticalBalance !== 0 ? (variance / day.theoreticalBalance) * 100 : 0;

  return (
    <div>
      <ReportHeader
        companyName={companyName}
        companyAddress={companyAddress}
        companyPhone={companyPhone}
        companyTaxId={companyTaxId}
        title="Rapport des Écarts de Caisse"
        subtitle={`Journée ${day.reference} du ${fmtDate(day.openedAt)}`}
        headerConfig={header}
      />

      {!hasVariance ? (
        <div className="rounded-lg border-2 border-green-300 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-green-600" />
          <h3 className="text-lg font-bold text-green-800">Aucun écart constaté</h3>
          <p className="mt-1 text-sm text-green-600">
            Le solde réel est conforme au solde théorique.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-lg border-2 border-red-300 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-bold text-red-800">Écart détecté</h3>
            </div>
          </div>

          <table className="mx-auto mb-4 w-[480px] border-collapse text-sm">
            <tbody>
              <tr className="bg-gray-50">
                <td className="border px-4 py-3 font-medium">Solde théorique</td>
                <td className="border px-4 py-3 text-right font-bold">
                  {fmt(day.theoreticalBalance)} FCFA
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-3 font-medium">Solde réel</td>
                <td className="border px-4 py-3 text-right font-bold">
                  {day.actualBalance != null ? `${fmt(day.actualBalance)} FCFA` : '—'}
                </td>
              </tr>
              <tr className="bg-red-50">
                <td className="border px-4 py-3 text-lg font-bold">Écart (montant)</td>
                <td className="border px-4 py-3 text-right text-lg font-bold text-red-700">
                  {variance > 0 ? '+' : ''}
                  {fmt(variance)} FCFA
                </td>
              </tr>
              <tr className="bg-red-50">
                <td className="border px-4 py-3 font-bold">Écart (% du solde théorique)</td>
                <td className="border px-4 py-3 text-right font-bold text-red-700">
                  {variancePct.toFixed(2)} %
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-3 font-medium">Nature de l'écart</td>
                <td className="border px-4 py-3 text-right font-bold">
                  {variance > 0 ? 'Excédent de caisse' : 'Manquant de caisse'}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="rounded border border-gray-300 bg-gray-50 p-4">
            <h4 className="mb-2 font-bold">Justification de l'écart :</h4>
            <div className="min-h-[60px] rounded border bg-white p-3 text-sm">
              {day.comment || (
                <span className="italic text-gray-400">Aucune justification renseignée</span>
              )}
            </div>
          </div>
        </>
      )}

      <div className="mt-4 rounded border border-gray-300 p-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-500">Caissier :</span> {day.openedByName}
          </div>
          {day.closedByName && (
            <div>
              <span className="text-gray-500">Clôturé par :</span> {day.closedByName}
            </div>
          )}
          <div>
            <span className="text-gray-500">Ouverture :</span> {fmtDateTime(day.openedAt)}
          </div>
          {day.closedAt && (
            <div>
              <span className="text-gray-500">Clôture :</span> {fmtDateTime(day.closedAt)}
            </div>
          )}
        </div>
      </div>

      <ReportFooter printedBy={printedBy} footerConfig={footer} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function CashReportsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const printedBy = user ? `${user.firstName} ${user.lastName}` : '—';

  const [selectedCashDayId, setSelectedCashDayId] = useState('');
  const [activeReport, setActiveReport] = useState<ReportType>('journal');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Cash counting state
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [otherAmounts, setOtherAmounts] = useState({ cheques: 0, mobileMoney: 0 });

  // Data
  const { data: history } = useClosingHistory();
  useCashState();
  const { data: settings } = useSettings();

  // Cashier: show their own days (including open); Manager/Admin: closed only
  const availableDays = useMemo(() => {
    const all = history ?? [];
    if (user?.role === 'cashier') {
      return all.filter((d) => d.openedById === user.id);
    }
    return all.filter((d) => d.status === 'CLOSED');
  }, [history, user]);

  const filteredDays = useMemo(() => {
    if (!searchQuery.trim()) return availableDays;
    const q = searchQuery.toLowerCase();
    return availableDays.filter((d) => {
      const ref = d.reference?.toLowerCase() ?? '';
      const dateStr = d.closedAt
        ? new Date(d.closedAt).toLocaleDateString('fr-FR')
        : new Date(d.openedAt).toLocaleDateString('fr-FR');
      return ref.includes(q) || dateStr.includes(q);
    });
  }, [availableDays, searchQuery]);

  const selectedDay = availableDays.find((d) => d.id === selectedCashDayId);
  const isDayOpen = selectedDay ? selectedDay.status !== 'CLOSED' : false;
  const { data: dayDetail } = useCashDayDetail(selectedCashDayId || undefined);
  const { data: opsData } = useCashDayOperations(selectedCashDayId || undefined);

  const company = settings?.company;
  const companyName = company?.name || user?.companyName || 'Entreprise';
  const companyAddress = company?.address;
  const companyPhone = company?.phone;
  const companyTaxId = company?.taxId;

  // Outside click to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const reports: { id: ReportType; label: string; icon: typeof FileText; desc: string }[] = [
    {
      id: 'journal',
      label: t('cashReports.journal.title'),
      icon: FileText,
      desc: t('cashReports.journal.desc'),
    },
    {
      id: 'brouillard',
      label: t('cashReports.brouillard.title'),
      icon: BookOpen,
      desc: t('cashReports.brouillard.desc'),
    },
    {
      id: 'situation',
      label: t('cashReports.situation.title'),
      icon: Scale,
      desc: t('cashReports.situation.desc'),
    },
    {
      id: 'comptage',
      label: t('cashReports.comptage.title'),
      icon: Coins,
      desc: t('cashReports.comptage.desc'),
    },
    {
      id: 'ecarts',
      label: t('cashReports.ecarts.title'),
      icon: AlertTriangle,
      desc: t('cashReports.ecarts.desc'),
    },
  ];

  return (
    <>
      {/* Screen UI */}
      <div className="no-print space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Printer className="h-6 w-6 text-brand-gold" />
            {t('cashReports.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('cashReports.subtitle')}</p>
        </div>

        {/* Cash day selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('cashReports.selectCashDay')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative max-w-md" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              >
                <span className={selectedDay ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedDay
                    ? `${selectedDay.reference} — ${new Date(selectedDay.closedAt || selectedDay.openedAt).toLocaleDateString('fr-FR')}${selectedDay.status !== 'CLOSED' ? ` (${selectedDay.status === 'OPEN' ? 'En cours' : 'En attente'})` : ''}`
                    : t('cashReports.selectPlaceholder')}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {dropdownOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      autoFocus
                      className="w-full border-0 bg-transparent text-sm placeholder-gray-400 outline-none"
                      placeholder={t('cashReports.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <ul className="max-h-60 overflow-y-auto py-1">
                    {filteredDays.length === 0 ? (
                      <li className="px-3 py-2 text-center text-sm text-gray-400">
                        {t('cashReports.noResults')}
                      </li>
                    ) : (
                      filteredDays.map((day) => (
                        <li key={day.id}>
                          <button
                            type="button"
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                              day.id === selectedCashDayId
                                ? 'bg-brand-gold/10 font-medium text-brand-gold'
                                : 'text-gray-700'
                            }`}
                            onClick={() => {
                              setSelectedCashDayId(day.id);
                              setDropdownOpen(false);
                              setSearchQuery('');
                              setCounts({});
                              setOtherAmounts({ cheques: 0, mobileMoney: 0 });
                            }}
                          >
                            <span>
                              {day.reference} —{' '}
                              {new Date(day.closedAt || day.openedAt).toLocaleDateString('fr-FR')}
                            </span>
                            {day.status !== 'CLOSED' && (
                              <Badge
                                variant={day.status === 'OPEN' ? 'info' : 'warning'}
                                className="ml-2 text-[10px] px-1.5 py-0"
                              >
                                {day.status === 'OPEN' ? 'En cours' : 'En attente'}
                              </Badge>
                            )}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Report selector + content */}
        {selectedCashDayId && dayDetail && opsData && (
          <>
            {/* Info banner for open day */}
            {isDayOpen && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-2 text-sm text-blue-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>Journée en cours</strong> — Les rapports sont en temps réel. Le formulaire
                  de comptage est modifiable tant que la caisse n'est pas clôturée.
                </span>
              </div>
            )}

            {/* Report tabs */}
            <div className="flex flex-wrap gap-2">
              {reports.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveReport(id)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    activeReport === id
                      ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Cash counting form (only for "comptage" tab) */}
            {activeReport === 'comptage' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {t('cashReports.comptage.formTitle')}
                    </CardTitle>
                    {!isDayOpen && (
                      <Badge variant="default" className="text-xs">
                        Lecture seule — journée clôturée
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {DENOMINATIONS.map((d) => (
                        <div key={d.value} className="flex items-center gap-2 rounded border p-2">
                          <span className="text-xs font-medium text-gray-600 w-20">{d.label}</span>
                          <input
                            type="number"
                            min={0}
                            disabled={!isDayOpen}
                            className={`w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm ${!isDayOpen ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            value={counts[d.value] || ''}
                            onChange={(e) =>
                              setCounts((prev) => ({
                                ...prev,
                                [d.value]: parseInt(e.target.value) || 0,
                              }))
                            }
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-400">
                            = {fmt((counts[d.value] || 0) * d.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          {t('cashReports.comptage.cheques')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          disabled={!isDayOpen}
                          className={`w-full rounded border border-gray-300 px-3 py-2 text-sm ${!isDayOpen ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          value={otherAmounts.cheques || ''}
                          onChange={(e) =>
                            setOtherAmounts((p) => ({
                              ...p,
                              cheques: parseFloat(e.target.value) || 0,
                            }))
                          }
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          {t('cashReports.comptage.mobileMoney')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          disabled={!isDayOpen}
                          className={`w-full rounded border border-gray-300 px-3 py-2 text-sm ${!isDayOpen ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          value={otherAmounts.mobileMoney || ''}
                          onChange={(e) =>
                            setOtherAmounts((p) => ({
                              ...p,
                              mobileMoney: parseFloat(e.target.value) || 0,
                            }))
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded bg-gray-50 p-3">
                      <span className="font-medium">Total comptage :</span>
                      <span className="text-lg font-bold">
                        {fmt(
                          DENOMINATIONS.reduce((s, d) => s + d.value * (counts[d.value] || 0), 0) +
                            otherAmounts.cheques +
                            otherAmounts.mobileMoney,
                        )}{' '}
                        FCFA
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Print button */}
            <div className="flex justify-end">
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                {t('cashReports.print')}
              </Button>
            </div>

            {/* Report preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t('cashReports.preview')}</CardTitle>
                  <Badge variant="info">{reports.find((r) => r.id === activeReport)?.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div ref={printRef} className="rounded border bg-white p-6">
                  {activeReport === 'journal' && (
                    <JournalDeCaisse
                      day={dayDetail}
                      movements={opsData.movements}
                      expenses={opsData.expenses}
                      companyName={companyName}
                      companyAddress={companyAddress}
                      companyPhone={companyPhone}
                      companyTaxId={companyTaxId}
                      printedBy={printedBy}
                    />
                  )}
                  {activeReport === 'brouillard' && (
                    <BrouillardDeCaisse
                      day={dayDetail}
                      movements={opsData.movements}
                      expenses={opsData.expenses}
                      companyName={companyName}
                      companyAddress={companyAddress}
                      companyPhone={companyPhone}
                      companyTaxId={companyTaxId}
                      printedBy={printedBy}
                    />
                  )}
                  {activeReport === 'situation' && (
                    <SituationDeCaisse
                      day={dayDetail}
                      companyName={companyName}
                      companyAddress={companyAddress}
                      companyPhone={companyPhone}
                      companyTaxId={companyTaxId}
                      printedBy={printedBy}
                    />
                  )}
                  {activeReport === 'comptage' && (
                    <FicheComptage
                      day={dayDetail}
                      counts={counts}
                      otherAmounts={otherAmounts}
                      companyName={companyName}
                      companyAddress={companyAddress}
                      companyPhone={companyPhone}
                      companyTaxId={companyTaxId}
                      printedBy={printedBy}
                    />
                  )}
                  {activeReport === 'ecarts' && (
                    <RapportEcarts
                      day={dayDetail}
                      companyName={companyName}
                      companyAddress={companyAddress}
                      companyPhone={companyPhone}
                      companyTaxId={companyTaxId}
                      printedBy={printedBy}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Print area — hidden on screen, shown on print */}
      <div className="print-only">
        {dayDetail && opsData && (
          <div
            className="p-4 text-black"
            style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' }}
          >
            {activeReport === 'journal' && (
              <JournalDeCaisse
                day={dayDetail}
                movements={opsData.movements}
                expenses={opsData.expenses}
                companyName={companyName}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyTaxId={companyTaxId}
                printedBy={printedBy}
              />
            )}
            {activeReport === 'brouillard' && (
              <BrouillardDeCaisse
                day={dayDetail}
                movements={opsData.movements}
                expenses={opsData.expenses}
                companyName={companyName}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyTaxId={companyTaxId}
                printedBy={printedBy}
              />
            )}
            {activeReport === 'situation' && (
              <SituationDeCaisse
                day={dayDetail}
                companyName={companyName}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyTaxId={companyTaxId}
                printedBy={printedBy}
              />
            )}
            {activeReport === 'comptage' && (
              <FicheComptage
                day={dayDetail}
                counts={counts}
                otherAmounts={otherAmounts}
                companyName={companyName}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyTaxId={companyTaxId}
                printedBy={printedBy}
              />
            )}
            {activeReport === 'ecarts' && (
              <RapportEcarts
                day={dayDetail}
                companyName={companyName}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyTaxId={companyTaxId}
                printedBy={printedBy}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
