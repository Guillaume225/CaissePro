import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Building2, Mail, Brain, BadgeDollarSign, ShieldAlert } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { useSettings, useUpdateSettings } from '@/hooks/useAdmin';
import type { AppSettings } from '@/types/admin';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
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
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.settings.title')}</h1>
          <p className="text-sm text-gray-500">{t('admin.settings.subtitle')}</p>
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
              onChange={(e) =>
                updateNested('validation', 'advanceJustificationDays', +e.target.value)
              }
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
              <p className="mb-2 text-sm font-medium text-gray-700">
                {t('admin.settings.maxDiscounts')}
              </p>
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
                                maxDiscountByRole: {
                                  ...f.finance.maxDiscountByRole,
                                  [role]: +e.target.value,
                                },
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

        {/* AI */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Brain className="h-4 w-4 text-brand-gold" />
              {t('admin.settings.aiSection')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t('admin.settings.anomalyThreshold')}
              type="number"
              step="0.01"
              value={form.ai.anomalyThreshold}
              onChange={(e) => updateNested('ai', 'anomalyThreshold', +e.target.value)}
              hint={t('admin.settings.anomalyThresholdHint')}
            />
            <Input
              label={t('admin.settings.forecastDays')}
              type="number"
              value={form.ai.forecastHorizonDays}
              onChange={(e) => updateNested('ai', 'forecastHorizonDays', +e.target.value)}
            />
          </CardContent>
        </Card>

        {/* SMTP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-brand-gold" />
              {t('admin.settings.smtpSection')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('admin.settings.smtpHost')}
                value={form.smtp.host}
                onChange={(e) => updateNested('smtp', 'host', e.target.value)}
              />
              <Input
                label={t('admin.settings.smtpPort')}
                type="number"
                value={form.smtp.port}
                onChange={(e) => updateNested('smtp', 'port', +e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('admin.settings.smtpUser')}
                value={form.smtp.user}
                onChange={(e) => updateNested('smtp', 'user', e.target.value)}
              />
              <Input
                label={t('admin.settings.smtpPassword')}
                type="password"
                value={form.smtp.password}
                onChange={(e) => updateNested('smtp', 'password', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('admin.settings.smtpFromName')}
                value={form.smtp.fromName}
                onChange={(e) => updateNested('smtp', 'fromName', e.target.value)}
              />
              <Input
                label={t('admin.settings.smtpFromEmail')}
                type="email"
                value={form.smtp.fromEmail}
                onChange={(e) => updateNested('smtp', 'fromEmail', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Company */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-brand-gold" />
              {t('admin.settings.companySection')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label={t('admin.settings.companyName')}
                value={form.company.name}
                onChange={(e) => updateNested('company', 'name', e.target.value)}
              />
              <Input
                label={t('admin.settings.companyPhone')}
                value={form.company.phone}
                onChange={(e) => updateNested('company', 'phone', e.target.value)}
              />
              <Input
                label={t('admin.settings.companyTaxId')}
                value={form.company.taxId}
                onChange={(e) => updateNested('company', 'taxId', e.target.value)}
              />
            </div>
            <Input
              label={t('admin.settings.companyAddress')}
              value={form.company.address}
              onChange={(e) => updateNested('company', 'address', e.target.value)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
