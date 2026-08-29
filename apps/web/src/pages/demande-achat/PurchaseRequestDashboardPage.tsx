import { useTranslation } from 'react-i18next';
import {
  FileEdit,
  Send,
  Clock,
  RotateCcw,
  XCircle,
  CheckCircle2,
  PackageCheck,
  ClipboardCheck,
  Wrench,
  Package,
  Lock,
  Wallet,
} from 'lucide-react';
import { usePurchaseRequestDashboard } from '@/hooks/usePurchasing';
import { formatCFA } from '@/lib/format';
import { DASHBOARD_STATUSES } from './constants';
import type { PurchaseRequestStatus } from '@/types/demande-achat';

const STATUS_ICON: Record<PurchaseRequestStatus, typeof FileEdit> = {
  DRAFT: FileEdit,
  SUBMITTED: Send,
  IN_VALIDATION: Clock,
  RETURNED: RotateCcw,
  REJECTED: XCircle,
  VALIDATED: CheckCircle2,
  TRANSMITTED: PackageCheck,
  TAKEN_OVER: ClipboardCheck,
  IN_PROCESS: Wrench,
  PROCESSED: Package,
  CLOSED: Lock,
  CANCELLED: XCircle,
};

const STATUS_COLORS: Record<PurchaseRequestStatus, string> = {
  DRAFT: 'border-gray-200 bg-gray-50 text-gray-700',
  SUBMITTED: 'border-amber-200 bg-amber-50 text-amber-700',
  IN_VALIDATION: 'border-amber-200 bg-amber-50 text-amber-700',
  RETURNED: 'border-orange-200 bg-orange-50 text-orange-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
  VALIDATED: 'border-blue-200 bg-blue-50 text-blue-700',
  TRANSMITTED: 'border-blue-200 bg-blue-50 text-blue-700',
  TAKEN_OVER: 'border-purple-200 bg-purple-50 text-purple-700',
  IN_PROCESS: 'border-purple-200 bg-purple-50 text-purple-700',
  PROCESSED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CLOSED: 'border-zinc-200 bg-zinc-100 text-zinc-700',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
};

export default function PurchaseRequestDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePurchaseRequestDashboard();

  const counts = data?.counts;
  const total = counts
    ? Object.values(counts).reduce((sum, n) => sum + (n || 0), 0)
    : 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0a2540]">{t('demandeAchat.dashboard.title')}</h1>
        <p className="text-sm text-[#697386]">{t('demandeAchat.dashboard.subtitle')}</p>
      </div>

      {/* Top summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold/10">
            <ClipboardCheck className="h-6 w-6 text-brand-gold" />
          </div>
          <div>
            <p className="text-sm text-[#697386]">{t('demandeAchat.dashboard.totalRequests')}</p>
            <p className="text-2xl font-bold text-[#0a2540]">{total}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
            <Wallet className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-[#697386]">{t('demandeAchat.dashboard.totalAmount')}</p>
            <p className="text-2xl font-bold text-[#0a2540]">{formatCFA(data?.totalAmount ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#697386]">
          {t('demandeAchat.dashboard.byStatus')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {DASHBOARD_STATUSES.map((status) => {
            const Icon = STATUS_ICON[status];
            const value = counts?.[status] ?? 0;
            return (
              <div key={status} className={`rounded-lg border p-3 text-center ${STATUS_COLORS[status]}`}>
                <Icon className="mx-auto mb-1 h-5 w-5" />
                <p className="text-xl font-bold">{value}</p>
                <p className="text-[11px]">{t(`demandeAchat.status.${status}`)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
