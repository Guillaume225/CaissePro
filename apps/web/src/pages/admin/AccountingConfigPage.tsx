import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, X, Pencil, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { Input, Badge } from '@/components/ui';
import { useCategories, useUpdateCategoryAccounting } from '@/hooks/useAdmin';
import type { ExpenseCategory } from '@/types/admin';

interface EditingState {
  id: string;
  debit: string;
  credit: string;
}

export default function AccountingConfigPage() {
  const { t } = useTranslation();
  const { data: categories = [], isLoading } = useCategories();
  const updateAccounting = useUpdateCategoryAccounting();

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(categories.filter(c => !c.parentId).map(c => c.id)));

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const startEdit = (cat: ExpenseCategory) => {
    setEditing({
      id: cat.id,
      debit: cat.accountingDebitAccount || '',
      credit: cat.accountingCreditAccount || '',
    });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    await updateAccounting.mutateAsync({
      id: editing.id,
      accountingDebitAccount: editing.debit || undefined,
      accountingCreditAccount: editing.credit || undefined,
    });
    setEditing(null);
  };

  const isValidAccount = (value: string) => !value || /^[0-9]{3,10}$/.test(value);

  // Flatten categories with hierarchy info
  const flatList: { cat: ExpenseCategory; depth: number }[] = [];
  const rootCats = categories.filter((c) => !c.parentId);

  const buildFlat = (cat: ExpenseCategory, depth: number) => {
    flatList.push({ cat, depth });
    const children = categories.filter((c) => c.parentId === cat.id);
    if (expanded.has(cat.id)) {
      children.forEach((child) => buildFlat(child, depth + 1));
    }
  };
  rootCats.forEach((r) => buildFlat(r, 0));

  const unconfiguredCount = categories.filter(
    (c) => c.isActive && (!c.accountingDebitAccount || !c.accountingCreditAccount),
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.accounting.title')}</h1>
          <p className="text-sm text-gray-500">{t('admin.accounting.subtitle')}</p>
        </div>
        {unconfiguredCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            {t('admin.accounting.unconfigured', { count: unconfiguredCount })}
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 text-blue-500" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">{t('admin.accounting.infoTitle')}</p>
            <p className="mt-1 text-blue-600">{t('admin.accounting.infoDesc')}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16">
          <BookOpen className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">{t('admin.accounting.noCategories')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <div className="col-span-4">{t('admin.accounting.category')}</div>
            <div className="col-span-1 text-center">{t('admin.accounting.code')}</div>
            <div className="col-span-3 text-center">{t('admin.accounting.debitAccount')}</div>
            <div className="col-span-3 text-center">{t('admin.accounting.creditAccount')}</div>
            <div className="col-span-1 text-center">{t('common.actions')}</div>
          </div>

          {/* Rows */}
          {flatList.map(({ cat, depth }) => {
            const isEditing = editing?.id === cat.id;
            const children = categories.filter((c) => c.parentId === cat.id);
            const hasChildren = children.length > 0;
            const missingAccount = cat.isActive && (!cat.accountingDebitAccount || !cat.accountingCreditAccount);

            return (
              <div
                key={cat.id}
                className={`grid grid-cols-12 items-center gap-2 border-b border-gray-100 px-4 py-2.5 transition-colors hover:bg-gray-50 ${
                  !cat.isActive ? 'opacity-50' : ''
                } ${isEditing ? 'bg-blue-50/30' : ''}`}
              >
                {/* Category name */}
                <div className="col-span-4 flex items-center gap-1.5" style={{ paddingLeft: `${depth * 20}px` }}>
                  {hasChildren ? (
                    <button onClick={() => toggleExpand(cat.id)} className="text-gray-400 hover:text-gray-600">
                      {expanded.has(cat.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}
                  <span className={`text-sm ${depth === 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {cat.name}
                  </span>
                  {!cat.isActive && (
                    <Badge variant="outline" className="ml-1 text-[10px]">{t('admin.categories.inactive')}</Badge>
                  )}
                  {missingAccount && !isEditing && (
                    <span className="ml-1 h-2 w-2 rounded-full bg-amber-400" title={t('admin.accounting.notConfigured')} />
                  )}
                </div>

                {/* Code */}
                <div className="col-span-1 text-center">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
                    {cat.code || '—'}
                  </span>
                </div>

                {/* Debit Account */}
                <div className="col-span-3 text-center">
                  {isEditing ? (
                    <Input
                      value={editing.debit}
                      onChange={(e) => setEditing({ ...editing, debit: e.target.value })}
                      placeholder="601000"
                      className={`text-center font-mono text-sm ${!isValidAccount(editing.debit) ? 'border-red-300' : ''}`}
                    />
                  ) : (
                    <span className={`font-mono text-sm ${cat.accountingDebitAccount ? 'text-gray-800' : 'text-gray-300'}`}>
                      {cat.accountingDebitAccount || '—'}
                    </span>
                  )}
                </div>

                {/* Credit Account */}
                <div className="col-span-3 text-center">
                  {isEditing ? (
                    <Input
                      value={editing.credit}
                      onChange={(e) => setEditing({ ...editing, credit: e.target.value })}
                      placeholder="512000"
                      className={`text-center font-mono text-sm ${!isValidAccount(editing.credit) ? 'border-red-300' : ''}`}
                    />
                  ) : (
                    <span className={`font-mono text-sm ${cat.accountingCreditAccount ? 'text-gray-800' : 'text-gray-300'}`}>
                      {cat.accountingCreditAccount || '—'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEdit}
                        disabled={!isValidAccount(editing.debit) || !isValidAccount(editing.credit) || updateAccounting.isPending}
                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={cancelEdit} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(cat)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          {t('admin.accounting.legendMissing')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-gray-700">601000</span>
          {t('admin.accounting.legendExample')}
        </div>
      </div>
    </div>
  );
}
