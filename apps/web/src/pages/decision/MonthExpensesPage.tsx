import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Receipt } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { useExpenses } from '@/hooks/useExpenses';
import { formatCFA, formatDate } from '@/lib/format';
import type { ExpenseFilters } from '@/types/expense';

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'outline' | 'warning' | 'info' | 'success' | 'destructive' }
> = {
  DRAFT: { label: 'Brouillon', variant: 'outline' },
  PENDING: { label: 'En attente', variant: 'warning' },
  APPROVED_L1: { label: 'Approuvée N1', variant: 'info' },
  APPROVED_L2: { label: 'Approuvée N2', variant: 'info' },
  PAID: { label: 'Payée', variant: 'success' },
  REJECTED: { label: 'Rejetée', variant: 'destructive' },
  CANCELLED: { label: 'Annulée', variant: 'outline' },
};

export default function MonthExpensesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const now = new Date();
  const dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dateTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const filters: ExpenseFilters = useMemo(
    () => ({
      perPage: 200,
      sortBy: 'date',
      sortOrder: 'DESC',
      dateFrom,
      dateTo,
    }),
    [dateFrom, dateTo],
  );

  const { data, isLoading, isError } = useExpenses(filters);
  const expenses = data?.data ?? [];
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pièces de dépense</h1>
          <p className="mt-1 text-sm text-gray-500">Mois en cours — {monthLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">
            {expenses.length} pièce{expenses.length > 1 ? 's' : ''}
          </p>
          <p className="text-lg font-bold text-gray-900">{formatCFA(total)}</p>
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
                    Catégorie
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Bénéficiaire
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Montant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">
                      <Receipt className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                      Aucune pièce de dépense ce mois
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => {
                    const st = STATUS_CONFIG[exp.status] ?? {
                      label: exp.status,
                      variant: 'outline' as const,
                    };
                    return (
                      <tr
                        key={exp.id}
                        onClick={() => navigate(`/expenses/${exp.id}`)}
                        className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-medium text-brand-gold">{exp.reference}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(exp.date)}</td>
                        <td className="px-4 py-3 text-gray-700">{exp.categoryName}</td>
                        <td className="px-4 py-3 text-gray-700">{exp.beneficiary || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCFA(exp.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/expenses/${exp.id}`);
                            }}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Voir"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
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
