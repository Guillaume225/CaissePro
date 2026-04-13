import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  FileCheck2,
  QrCode,
  Undo2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Printer,
  Pencil,
  Link2,
  Trash2,
} from 'lucide-react';
import { Button, Badge, Card } from '@/components/ui';
import { useFneInvoice, useCreateCreditNote, useCertifyFneInvoice, useDeleteFneInvoice } from '@/hooks/useFneInvoices';
import { formatCFA, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useCompanies } from '@/hooks/useAdmin';
import { useFneSetting } from '@/hooks/useFneSettings';
import { useModuleStore } from '@/stores/module-store';
import FneInvoicePrintView from '@/components/fne/FneInvoicePrintView';
import type { FneInvoiceStatus, FneInvoiceItem } from '@/types/fne';

/* ── Status config ────────────────────────────────────── */
const STATUS_CONFIG: Record<FneInvoiceStatus, { label: string; variant: 'outline' | 'success' | 'warning' | 'destructive'; color: string }> = {
  DRAFT: { label: 'Brouillon', variant: 'outline', color: 'text-gray-500' },
  CERTIFIED: { label: 'Certifiée', variant: 'success', color: 'text-green-600' },
  CREDIT_NOTE: { label: 'Avoir émis', variant: 'warning', color: 'text-amber-600' },
  ERROR: { label: 'Erreur', variant: 'destructive', color: 'text-red-600' },
};

const TEMPLATE_LABELS: Record<string, string> = { B2B: 'Entreprise', B2C: 'Particulier', B2G: 'Gouvernement', B2F: 'Étranger' };
const PAYMENT_LABELS: Record<string, string> = { cash: 'Espèces', card: 'Carte', check: 'Chèque', 'mobile-money': 'Mobile Money', transfer: 'Virement', deferred: 'Différé' };

export default function FneInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const readOnly = useModuleStore((s) => s.activeModule) === 'decision';
  const { data: invoice, isLoading, isError } = useFneInvoice(id!);
  const creditNoteMutation = useCreateCreditNote();
  const certifyMutation = useCertifyFneInvoice();
  const deleteMutation = useDeleteFneInvoice();

  // Company & FNE settings for print view
  const companyId = useAuthStore((s) => s.user?.companyId ?? '');
  const { data: companies } = useCompanies();
  const company = companies?.find((c) => c.id === companyId) ?? null;
  const { data: fneSetting } = useFneSetting(companyId);

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [refundItems, setRefundItems] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [preprinted, setPreprinted] = useState(false);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-gold" /></div>;
  if (isError || !invoice) return <div className="text-center py-20 text-red-600">Facture introuvable</div>;

  const sc = STATUS_CONFIG[invoice.status];

  const handleCopyToken = () => {
    if (invoice.fneToken) {
      navigator.clipboard.writeText(invoice.fneToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreditNote = async () => {
    const items = Object.entries(refundItems)
      .filter(([, qty]) => qty > 0)
      .map(([fneItemId, quantity]) => ({ fneItemId, quantity }));
    if (!items.length) return;
    try {
      const creditNote = await creditNoteMutation.mutateAsync({ invoiceId: invoice.id, payload: { items } });
      setShowCreditModal(false);
      setRefundItems({});
      // Navigate to the newly created credit note
      navigate(`/fne/invoices/${creditNote.id}`);
    } catch {
      // Error shown in UI
    }
  };

  const canCertify = invoice.status === 'DRAFT' || invoice.status === 'ERROR';
  const canDelete = invoice.status === 'DRAFT' || invoice.status === 'ERROR';
  const isCreditNote = invoice.invoiceType === 'credit_note';
  const hasReturnableItems = invoice.items.some((it) => it.fneItemId && (it.quantity - it.quantityReturned) > 0);
  const canCreditNote = invoice.status === 'CERTIFIED' && hasReturnableItems;

  const handleCertify = async () => {
    try {
      await certifyMutation.mutateAsync(invoice.id);
    } catch {
      // Error shown in UI
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(invoice.id);
      navigate('/fne/invoices');
    } catch {
      // Error shown in UI
    }
  };

  return (
    <>
    <div className="space-y-6 no-print">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/fne/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{invoice.reference}</h1>
              <Badge variant={sc.variant}>{sc.label}</Badge>
              {isCreditNote && <Badge variant="warning">Avoir</Badge>}
            </div>
            <p className="text-sm text-gray-500">{formatDateTime(invoice.createdAt)}</p>
            {/* Link to original invoice (if this is a credit note) */}
            {isCreditNote && invoice.creditNoteOf && (
              <button onClick={() => navigate(`/fne/invoices/${invoice.creditNoteOf}`)}
                className="flex items-center gap-1.5 text-xs text-brand-gold hover:text-brand-gold/80 mt-1">
                <Link2 className="h-3.5 w-3.5" /> Facture d'origine
              </button>
            )}
            {/* Links to credit notes (if this invoice has any) */}
            {!isCreditNote && invoice.creditNotes?.map((cn) => (
              <button key={cn.id} onClick={() => navigate(`/fne/invoices/${cn.id}`)}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 mt-1">
                <Link2 className="h-3.5 w-3.5" /> Avoir : {cn.reference}
                <Badge variant={STATUS_CONFIG[cn.status]?.variant ?? 'outline'} className="text-[10px] px-1.5 py-0">{STATUS_CONFIG[cn.status]?.label ?? cn.status}</Badge>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { setPreprinted(false); setTimeout(() => window.print(), 100); }} className="text-gray-600 hover:text-gray-800">
            <Printer className="mr-2 h-4 w-4" /> {t('common.print', 'Imprimer')}
          </Button>
          <Button variant="ghost" onClick={() => { setPreprinted(true); setTimeout(() => window.print(), 100); }} className="text-gray-600 hover:text-gray-800">
            <Printer className="mr-2 h-4 w-4" /> Préimprimé
          </Button>
          {!readOnly && canCertify && (
            <Button
              variant="outline"
              onClick={() => navigate(`/fne/invoices/${invoice.id}/edit`)}
              className="text-brand-gold border-brand-gold hover:bg-brand-gold/5"
            >
              <Pencil className="mr-2 h-4 w-4" /> {t('common.edit', 'Modifier')}
            </Button>
          )}
          {!readOnly && canCertify && (
            <Button
              onClick={handleCertify}
              disabled={certifyMutation.isPending}
              className="bg-brand-gold text-white hover:bg-brand-gold/90"
            >
              {certifyMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Certification…</>
                : <><FileCheck2 className="mr-2 h-4 w-4" /> Certifier</>
              }
            </Button>
          )}
          {!readOnly && canCreditNote && (
            <Button variant="ghost" onClick={() => setShowCreditModal(true)} className="text-amber-600 hover:text-amber-700">
              <Undo2 className="mr-2 h-4 w-4" /> {t('fne.creditNote', 'Avoir')}
            </Button>
          )}
          {!readOnly && canDelete && (
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
            </Button>
          )}
        </div>
      </div>

      {/* ── Error info ── */}
      {invoice.status === 'ERROR' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 mb-2"><AlertCircle className="h-5 w-5" /> Erreur de certification</div>
          <pre className="whitespace-pre-wrap text-xs">
            {invoice.fneResponse ? JSON.stringify(invoice.fneResponse, null, 2) : 'Pas de détails disponibles'}
          </pre>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: Client & params + FNE info ── */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{t('fne.clientInfo', 'Client')}</h3>
            <div className="space-y-2 text-sm">
              <InfoRow label="Nom" value={invoice.clientCompanyName} />
              <InfoRow label="Téléphone" value={invoice.clientPhone} />
              <InfoRow label="Email" value={invoice.clientEmail} />
              {invoice.clientNcc && <InfoRow label="NCC" value={invoice.clientNcc} />}
              {invoice.clientSellerName && <InfoRow label="Vendeur" value={invoice.clientSellerName} />}
            </div>

            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide pt-2">{t('fne.params', 'Paramètres')}</h3>
            <div className="space-y-2 text-sm">
              <InfoRow label="Type" value={`${invoice.template} — ${TEMPLATE_LABELS[invoice.template] ?? ''}`} />
              <InfoRow label="Paiement" value={PAYMENT_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod} />
              <InfoRow label="Point de vente" value={invoice.pointOfSale} />
              <InfoRow label="Établissement" value={invoice.establishment} />
              {invoice.isRne && <InfoRow label="RNE" value={invoice.rne} />}
              {invoice.foreignCurrency && (
                <InfoRow label="Devise" value={`${invoice.foreignCurrency} (taux: ${invoice.foreignCurrencyRate})`} />
              )}
            </div>
          </Card>

          {/* ── QR code / FNE info ── */}
          {invoice.status === 'CERTIFIED' && (
            <Card className="p-5">
              <div className="flex flex-col gap-4">
                {/* QR Code */}
                {invoice.fneToken && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-lg bg-white p-4">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(invoice.fneToken)}`}
                        alt="QR Code FNE"
                        className="h-[180px] w-[180px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleCopyToken}
                        className="flex items-center gap-1.5 text-xs text-brand-gold hover:text-brand-gold/80 transition-colors">
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? 'Copié !' : 'Copier le lien'}
                      </button>
                      <a href={invoice.fneToken} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-brand-gold hover:text-brand-gold/80">
                        <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
                      </a>
                    </div>
                  </div>
                )}

                {/* FNE details */}
                <div className="grid gap-3 text-sm">
                  <InfoRow label="NCC FNE" value={invoice.fneNcc} />
                  <InfoRow label="Réf. FNE" value={invoice.fneReference} />
                  <InfoRow label="ID Facture FNE" value={invoice.fneInvoiceId} />
                  <InfoRow label="Solde stickers" value={String(invoice.balanceSticker)} />
                  {invoice.fneWarning && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs">Avertissement FNE : solde stickers bas</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── Right: Items & totals ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  <th className="px-4 py-3 text-right">P.U. HT</th>
                  <th className="px-4 py-3 text-right">Rem.%</th>
                  <th className="px-4 py-3">Taxes</th>
                  <th className="px-4 py-3 text-right">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{item.description}</div>
                      {item.reference && <div className="text-xs text-gray-500">Réf: {item.reference}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCFA(item.amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{item.discount ? `${item.discount}%` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.taxes?.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCFA(item.lineTotalTtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Totals card */}
          <Card className="p-5 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Sous-total HT</span><span>{formatCFA(invoice.subtotalHt)}</span>
            </div>
            {invoice.discountPct > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Remise globale ({invoice.discountPct}%)</span><span>-{formatCFA(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-500">
              <span>TVA</span><span>{formatCFA(invoice.totalVat)}</span>
            </div>
            {invoice.customTaxes?.map((ct, idx) => (
              <div key={idx} className="flex justify-between text-sm text-gray-500">
                <span>{ct.name} ({ct.amount}%)</span>
                <span>{formatCFA(invoice.subtotalHt * ct.amount / 100)}</span>
              </div>
            ))}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total TTC</span><span>{formatCFA(invoice.totalTtc)}</span>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Credit Note Modal ── */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('fne.createCreditNote', 'Créer un avoir')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('fne.creditNoteDesc', 'Sélectionnez les articles et quantités à retourner.')}</p>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {invoice.items.filter((it) => it.fneItemId).map((item) => {
                const remaining = item.quantity - item.quantityReturned;
                if (remaining <= 0) return null;
                return (
                  <div key={item.id} className="flex items-center gap-4 rounded-lg border border-gray-200 p-3">
                    <div className="flex-1">
                      <div className="text-sm text-gray-900">{item.description}</div>
                      <div className="text-xs text-gray-500">Disponible: {remaining} / {item.quantity}</div>
                    </div>
                    <input type="number" min={0} max={remaining}
                      value={refundItems[item.fneItemId!] ?? 0}
                      onChange={(e) => setRefundItems((p) => ({ ...p, [item.fneItemId!]: Math.min(Number(e.target.value), remaining) }))}
                      className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 text-center shadow-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold focus:outline-none" />
                  </div>
                );
              })}
            </div>

            {creditNoteMutation.isError && (
              <div className="mt-3 text-sm text-red-600">
                {(creditNoteMutation.error as Error)?.message || 'Erreur lors de la création de l\'avoir'}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <Button variant="ghost" onClick={() => { setShowCreditModal(false); setRefundItems({}); }}>
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button onClick={handleCreditNote}
                disabled={!Object.values(refundItems).some((v) => v > 0) || creditNoteMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700">
                {creditNoteMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi…</>
                ) : (
                  <><Undo2 className="mr-2 h-4 w-4" /> Créer l'avoir</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Supprimer la facture</h3>
                <p className="text-sm text-gray-500">Cette action est irréversible</p>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              Êtes-vous sûr de vouloir supprimer la facture <span className="font-semibold">{invoice.reference}</span> ?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleteMutation.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Suppression…</>
                  : <><Trash2 className="mr-2 h-4 w-4" /> Supprimer</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ── Print View (hidden on screen, shown when printing) ── */}
    <FneInvoicePrintView invoice={invoice} company={company} fneSetting={fneSetting} preprinted={preprinted} />
    </>
  );
}

/* ── Helper ── */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value || '—'}</span>
    </div>
  );
}
