import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Vault, UnlockKeyhole, Clock, CalendarDays, X } from 'lucide-react';
import { useOpenCash, useCashState } from '@/hooks/useClosing';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

function ModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-md bg-white text-left shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e0e6eb] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0a2540]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#697386] hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function CashDayRequiredPage() {
  const { t } = useTranslation();
  useCashState();
  const openCash = useOpenCash();

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');

  const handleOpen = async () => {
    await openCash.mutateAsync(Number(openingBalance) || 0);
    setShowOpenModal(false);
    setOpeningBalance('');
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-brand-gold/10">
          <Vault className="h-12 w-12 text-brand-gold" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900">{t('cashDayRequired.title')}</h1>

        <p className="mt-3 text-gray-500">{t('cashDayRequired.description')}</p>

        {/* Info cards */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm text-blue-800">
            <Clock className="h-5 w-5 shrink-0 text-blue-500" />
            <span>{t('cashDayRequired.hint')}</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm text-gray-600">
            <CalendarDays className="h-5 w-5 shrink-0 text-gray-400" />
            <span>
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Open button */}
        <button
          className="btn-primary mt-8 px-8 py-3 text-base"
          onClick={() => setShowOpenModal(true)}
        >
          <UnlockKeyhole className="h-5 w-5" />
          {t('closing.openCash')}
        </button>

        {/* Open Cash Modal */}
        <ModalShell
          open={showOpenModal}
          onClose={() => setShowOpenModal(false)}
          title={t('closing.openModal.title')}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <UnlockKeyhole className="h-8 w-8 text-emerald-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-emerald-800">
                    {t('closing.openModal.description')}
                  </p>
                  <p className="text-xs text-emerald-600">{t('closing.openModal.hint')}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="label">{t('closing.openModal.openingBalance')}</label>
              <input
                className="input"
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
              />
            </div>

            {openingBalance !== '' && (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{t('closing.openModal.preview')}</p>
                <p className="text-lg font-bold text-gray-900">
                  {fmt(Number(openingBalance) || 0)}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowOpenModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary disabled:opacity-50"
                onClick={handleOpen}
                disabled={openingBalance === '' || openCash.isPending}
              >
                {openCash.isPending && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <UnlockKeyhole className="h-4 w-4" />
                {t('closing.openCash')}
              </button>
            </div>
          </div>
        </ModalShell>
      </div>
    </div>
  );
}
