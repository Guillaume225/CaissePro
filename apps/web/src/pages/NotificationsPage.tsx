import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  CheckCheck,
  Check,
  Filter,
  ShoppingCart,
  Wallet,
  CreditCard,
  ShieldAlert,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/hooks/useDashboard';
import type { AppNotification, NotificationType } from '@/types/dashboard';

const NOTIF_TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  SALE: <ShoppingCart className="h-4 w-4 text-green-500" />,
  EXPENSE: <Wallet className="h-4 w-4 text-red-500" />,
  PAYMENT: <CreditCard className="h-4 w-4 text-blue-500" />,
  ALERT: <ShieldAlert className="h-4 w-4 text-amber-500" />,
  SYSTEM: <Settings className="h-4 w-4 text-gray-500" />,
};

const NOTIF_TYPE_KEYS: NotificationType[] = ['SALE', 'EXPENSE', 'PAYMENT', 'ALERT', 'SYSTEM'];

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<NotificationType | undefined>(undefined);

  const { data: notifications = [] } = useNotifications(typeFilter ? { type: typeFilter } : undefined);
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // ── Group notifications by date ─────────
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  const grouped: { label: string; items: AppNotification[] }[] = [];
  const buckets: Record<string, AppNotification[]> = {};

  for (const n of notifications) {
    const d = new Date(n.createdAt).toDateString();
    const label = d === today ? t('notifications.today') : d === yesterday ? t('notifications.yesterday') : d;
    if (!buckets[label]) {
      buckets[label] = [];
      grouped.push({ label, items: buckets[label] });
    }
    buckets[label].push(n);
  }

  const handleClick = (notif: AppNotification) => {
    if (!notif.isRead) markAsRead.mutate(notif.id);
    if (notif.entityRoute) navigate(notif.entityRoute);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('notifications.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('notifications.subtitle')}</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            loading={markAllAsRead.isPending}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      {/* ── Type filter pills ──────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        <button
          onClick={() => setTypeFilter(undefined)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            !typeFilter ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-200 text-gray-500 hover:border-gray-300',
          )}
        >
          {t('common.all')}
        </button>
        {NOTIF_TYPE_KEYS.map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? undefined : type)}
            className={cn(
              'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              typeFilter === type ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-200 text-gray-500 hover:border-gray-300',
            )}
          >
            {NOTIF_TYPE_ICONS[type]}
            {type}
          </button>
        ))}
      </div>

      {/* ── Notification list grouped by date ── */}
      {grouped.length > 0 ? (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.items.map((notif) => (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(notif)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(notif); }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-gray-50 cursor-pointer',
                      notif.isRead ? 'border-gray-100 bg-white' : 'border-brand-gold/20 bg-brand-gold/5',
                    )}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50">
                      {NOTIF_TYPE_ICONS[notif.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm truncate', notif.isRead ? 'font-normal text-gray-700' : 'font-semibold text-gray-900')}>
                          {notif.title}
                        </span>
                        {!notif.isRead && <Badge variant="default" className="text-[10px] shrink-0">New</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{notif.message}</p>
                      <span className="mt-1 block text-[10px] text-gray-400">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {!notif.isRead && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead.mutate(notif.id); }}
                        className="mt-1 shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title={t('notifications.markRead')}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 text-center">
          <Bell className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">{t('notifications.noNotifications')}</p>
        </div>
      )}
    </div>
  );
}
