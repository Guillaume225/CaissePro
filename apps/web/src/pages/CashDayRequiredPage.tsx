import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Vault, UnlockKeyhole, Clock, CalendarDays } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { useOpenCash, useCashState } from '@/hooks/useClosing';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

export default function CashDayRequiredPage() {
  const { t } = useTranslation();
  const { data: state } = useCashState();
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
        <h1 className="text-2xl font-bold text-gray-900">
          {t('cashDayRequired.title')}
        </h1>

        <p className="mt-3 text-gray-500">
          {t('cashDayRequired.description')}
        </p>

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
        <Button
          className="mt-8 px-8 py-3 text-base"
          onClick={() => setShowOpenModal(true)}
        >
          <UnlockKeyhole className="mr-2 h-5 w-5" />
          {t('closing.openCash')}
        </Button>

        {/* Open Cash Modal */}
        <Modal
          open={showOpenModal}
          onClose={() => setShowOpenModal(false)}
          title={t('closing.openModal.title')}
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <UnlockKeyhole className="h-8 w-8 text-emerald-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-emerald-800">
                    {t('closing.openModal.description')}
                  </p>
                  <p className="text-xs text-emerald-600">
                    {t('closing.openModal.hint')}
                  </p>
                </div>
              </div>
            </div>

            <Input
              label={t('closing.openModal.openingBalance')}
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0"
            />

            {openingBalance !== '' && (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">
                  {t('closing.openModal.preview')}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {fmt(Number(openingBalance) || 0)}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowOpenModal(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleOpen}
                loading={openCash.isPending}
                disabled={openingBalance === ''}
              >
                <UnlockKeyhole className="mr-2 h-4 w-4" />
                {t('closing.openCash')}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
