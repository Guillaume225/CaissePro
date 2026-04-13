import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Send, X, MessageSquare } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { useFneInvoices, useUpdateDecisionComment } from '@/hooks/useFneInvoices';
import { formatCFA, formatDate } from '@/lib/format';
import type { FneInvoice, FneInvoiceStatus } from '@/types/fne';

const STATUS_CONFIG: Record<
  FneInvoiceStatus,
  { label: string; variant: 'outline' | 'warning' | 'info' | 'success' | 'destructive' }
> = {
  DRAFT: { label: 'Brouillon', variant: 'outline' },
  CERTIFIED: { label: 'Certifiée', variant: 'success' },
  CREDIT_NOTE: { label: 'Avoir', variant: 'info' },
  ERROR: { label: 'Erreur', variant: 'destructive' },
};

export default function DevisListPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useFneInvoices({ perPage: 500 });
  const updateComment = useUpdateDecisionComment();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const estimates = useMemo(() => {
    const all = data?.data ?? [];
    return all.filter((inv: FneInvoice) => inv.invoiceType === 'estimate');
  }, [data]);

  const totalTtc = estimates.reduce((sum: number, inv: FneInvoice) => sum + inv.totalTtc, 0);

  const startEdit = (inv: FneInvoice) => {
    setEditingId(inv.id);
    setCommentText(inv.decisionComment ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCommentText('');
  };

  const submitComment = (id: string) => {
    updateComment.mutate(
      { id, comment: commentText.trim() || null },
      { onSuccess: () => cancelEdit() },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liste des devis</h1>
          <p className="mt-1 text-sm text-gray-500">
            Commentez les devis pour orienter l'équipe commerciale
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">{estimates.length} devis</p>
          <p className="text-lg font-bold text-gray-900">{formatCFA(totalTtc)}</p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="flex h-64 items-center justify-center text-red-500 text-sm">
            {t('common.error')}
          </div>
        )}

        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Référence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Client
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Montant TTC
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Commentaire décisionnaire
                  </th>
                </tr>
              </thead>
              <tbody>
                {estimates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-400">
                      <FileText className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                      Aucun devis trouvé
                    </td>
                  </tr>
                ) : (
                  estimates.map((inv: FneInvoice) => {
                    const st = STATUS_CONFIG[inv.status];
                    const isEditing = editingId === inv.id;

                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-medium text-brand-gold">{inv.reference}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(inv.createdAt)}</td>
                        <td className="px-4 py-3 text-gray-700">{inv.clientCompanyName || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCFA(inv.totalTtc)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </td>
                        <td className="px-4 py-3 min-w-[280px]">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') submitComment(inv.id);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                placeholder="Saisir une indication…"
                                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                                autoFocus
                              />
                              <button
                                onClick={() => submitComment(inv.id)}
                                disabled={updateComment.isPending}
                                className="rounded p-1.5 text-brand-gold hover:bg-brand-gold/10 disabled:opacity-50"
                                title="Envoyer"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                title="Annuler"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => startEdit(inv)}
                              className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100"
                              title="Cliquer pour commenter"
                            >
                              {inv.decisionComment ? (
                                <span className="text-gray-700">{inv.decisionComment}</span>
                              ) : (
                                <span className="text-gray-400 italic">
                                  Ajouter un commentaire…
                                </span>
                              )}
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
