import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, ShieldAlert, BadgeDollarSign } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
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
    if (settings) setForm({ ...defaultSettings, ...settings, validation: { ...defaultSettings.validation, ...settings.validation }, finance: { ...defaultSettings.finance, ...settings.finance }, ai: { ...defaultSettings.ai, ...settings.ai }, smtp: { ...defaultSettings.smtp, ...settings.smtp }, company: { ...defaultSettings.company, ...settings.company } });
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
          <h1 className="text-2xl font-bold text-gray-900">Limites & Paramètres de caisse</h1>
          <p className="text-sm text-gray-500">
            Configurez les seuils de validation, montants limites et paramètres financiers
          </p>
        </div>
        <Button onClick={handleSave} loading={updateSettings.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saved ? t('common.success') : t('common.save')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Validation thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-brand-gold" />
              {t('admin.settings.validationSection')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t('admin.settings.maxDisbursement')}
              type="number"
              value={form.validation.maxDisbursementAmount}
              onChange={(e) => updateNested('validation', 'maxDisbursementAmount', +e.target.value)}
              hint={t('admin.settings.maxDisbursementHint')}
            />
            <Input
              label={t('admin.settings.advanceDays')}
              type="number"
              value={form.validation.advanceJustificationDays}
              onChange={(e) => updateNested('validation', 'advanceJustificationDays', +e.target.value)}
              hint={t('admin.settings.advanceDaysHint')}
            />
          </CardContent>
        </Card>

        {/* Finance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BadgeDollarSign className="h-4 w-4 text-brand-gold" />
              {t('admin.settings.financeSection')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t('admin.settings.defaultTva')}
              type="number"
              value={form.finance.defaultTvaRate}
              onChange={(e) => updateNested('finance', 'defaultTvaRate', +e.target.value)}
              hint={t('admin.settings.defaultTvaHint')}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">{t('admin.settings.maxDiscounts')}</p>
              {Object.entries(form.finance.maxDiscountByRole).map(([role, val]) => (
                <div key={role} className="flex items-center gap-3 mb-2">
                  <span className="w-24 text-xs text-gray-500 capitalize">{role}</span>
                  <Input
                    type="number"
                    value={val}
                    onChange={(e) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              finance: {
                                ...f.finance,
                                maxDiscountByRole: { ...f.finance.maxDiscountByRole, [role]: +e.target.value },
                              },
                            }
                          : f,
                      )
                    }
                    className="max-w-[100px]"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
