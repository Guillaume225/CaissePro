import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, ShieldAlert, BadgeDollarSign } from 'lucide-react';
import { useSettings, useUpdateSettings } from '@/hooks/useAdmin';
import type { AppSettings } from '@/types/admin';

export default function CashSettingsPage() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  const defaultSettings: AppSettings = {
    validation: { maxDisbursementAmount: 0, advanceJustificationDays: 0 },
    finance: { defaultTvaRate: 0, maxDiscountByRole: {} },
    ai: { anomalyThreshold: 0, forecastHorizonDays: 0 },
    smtp: { host: '', port: 587, user: '', password: '', fromName: '', fromEmail: '' },
    company: { name: '', address: '', phone: '', taxId: '' },
  };

  useEffect(() => {
    if (settings)
      setForm({
        ...defaultSettings,
        ...settings,
        validation: { ...defaultSettings.validation, ...settings.validation },
        finance: { ...defaultSettings.finance, ...settings.finance },
        ai: { ...defaultSettings.ai, ...settings.ai },
        smtp: { ...defaultSettings.smtp, ...settings.smtp },
        company: { ...defaultSettings.company, ...settings.company },
      });
  }, [settings]);

  if (isLoading || !form) {
    return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  }

  const handleSave = async () => {
    await updateSettings.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateNested = <K extends keyof AppSettings>(section: K, field: string, value: unknown) => {
    setForm((f) => (f ? { ...f, [section]: { ...f[section], [field]: value } } : f));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2540]">Limites & Paramètres de caisse</h1>
          <p className="text-sm text-[#697386]">
            Configurez les seuils de validation, montants limites et paramètres financiers
          </p>
        </div>
        <button
          className="btn-primary disabled:opacity-50"
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          {updateSettings.isPending && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          <Save className="h-4 w-4" />
          {saved ? t('common.success') : t('common.save')}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Validation thresholds */}
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0a2540]">
            <ShieldAlert className="h-4 w-4 text-brand-gold" />
            {t('admin.settings.validationSection')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label">{t('admin.settings.maxDisbursement')}</label>
              <input
                className="input"
                type="number"
                value={form.validation.maxDisbursementAmount}
                onChange={(e) =>
                  updateNested('validation', 'maxDisbursementAmount', +e.target.value)
                }
              />
              <p className="mt-1 text-xs text-[#aab7c4]">
                {t('admin.settings.maxDisbursementHint')}
              </p>
            </div>
            <div>
              <label className="label">{t('admin.settings.advanceDays')}</label>
              <input
                className="input"
                type="number"
                value={form.validation.advanceJustificationDays}
                onChange={(e) =>
                  updateNested('validation', 'advanceJustificationDays', +e.target.value)
                }
              />
              <p className="mt-1 text-xs text-[#aab7c4]">{t('admin.settings.advanceDaysHint')}</p>
            </div>
          </div>
        </div>

        {/* Finance */}
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0a2540]">
            <BadgeDollarSign className="h-4 w-4 text-brand-gold" />
            {t('admin.settings.financeSection')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label">{t('admin.settings.defaultTva')}</label>
              <input
                className="input"
                type="number"
                value={form.finance.defaultTvaRate}
                onChange={(e) => updateNested('finance', 'defaultTvaRate', +e.target.value)}
              />
              <p className="mt-1 text-xs text-[#aab7c4]">{t('admin.settings.defaultTvaHint')}</p>
            </div>
            <div>
              <p className="label">{t('admin.settings.maxDiscounts')}</p>
              {Object.entries(form.finance.maxDiscountByRole).map(([role, val]) => (
                <div key={role} className="mb-2 flex items-center gap-3">
                  <span className="w-24 text-xs capitalize text-[#697386]">{role}</span>
                  <input
                    className="input max-w-[100px]"
                    type="number"
                    value={val}
                    onChange={(e) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              finance: {
                                ...f.finance,
                                maxDiscountByRole: {
                                  ...f.finance.maxDiscountByRole,
                                  [role]: +e.target.value,
                                },
                              },
                            }
                          : f,
                      )
                    }
                  />
                  <span className="text-xs text-[#aab7c4]">%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
