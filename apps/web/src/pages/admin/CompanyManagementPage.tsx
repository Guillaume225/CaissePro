import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Pencil, MapPin, Phone, Mail, FileText, Banknote, Upload, X } from 'lucide-react';
import { Button, Input, Modal, Badge } from '@/components/ui';
import { useCompanies, useCreateCompany, useUpdateCompany, useUploadCompanyLogo } from '@/hooks/useAdmin';
import type { Company, CreateCompanyDto, UpdateCompanyDto } from '@/types/admin';

type FormState = CreateCompanyDto & { isActive?: boolean };

const defaultForm: FormState = {
  name: '', code: '', address: '', phone: '', email: '', taxId: '', tradeRegister: '', currency: 'XOF',
};

export default function CompanyManagementPage() {
  const { t } = useTranslation();
  const { data: companies = [], isLoading } = useCompanies();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const uploadLogo = useUploadCompanyLogo();

  const [showModal, setShowModal] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditCompany(null);
    setForm(defaultForm);
    setSubmitError(null);
    setLogoFile(null);
    setLogoPreview(null);
    setShowModal(true);
  };

  const openEdit = (c: Company) => {
    setEditCompany(c);
    setSubmitError(null);
    setLogoFile(null);
    setLogoPreview(c.logo || null);
    setForm({
      name: c.name,
      code: c.code,
      address: c.address || '',
      phone: c.phone || '',
      email: c.email || '',
      taxId: c.taxId || '',
      tradeRegister: c.tradeRegister || '',
      currency: c.currency,
      isActive: c.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      let companyId: string | undefined;
      if (editCompany) {
        const dto: UpdateCompanyDto & { id: string } = { id: editCompany.id };
        if (form.name !== editCompany.name) dto.name = form.name;
        if (form.address !== (editCompany.address || '')) dto.address = form.address || undefined;
        if (form.phone !== (editCompany.phone || '')) dto.phone = form.phone || undefined;
        if (form.email !== (editCompany.email || '')) dto.email = form.email || undefined;
        if (form.taxId !== (editCompany.taxId || '')) dto.taxId = form.taxId || undefined;
        if (form.tradeRegister !== (editCompany.tradeRegister || '')) dto.tradeRegister = form.tradeRegister || undefined;
        if (form.currency !== editCompany.currency) dto.currency = form.currency || undefined;
        if (form.isActive !== editCompany.isActive) dto.isActive = form.isActive;
        await updateCompany.mutateAsync(dto);
        companyId = editCompany.id;
      } else {
        const created = await createCompany.mutateAsync({
          name: form.name,
          code: form.code.replace(/[^A-Z0-9_-]/g, ''),
          address: form.address || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          taxId: form.taxId || undefined,
          tradeRegister: form.tradeRegister || undefined,
          currency: form.currency || 'XOF',
        });
        companyId = created?.id;
      }
      // Upload logo if a new file was selected
      if (logoFile && companyId) {
        await uploadLogo.mutateAsync({ id: companyId, file: logoFile });
      }
      setShowModal(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Erreur lors de l\'enregistrement');
    }
  };

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.companies.title')}</h1>
          <p className="text-sm text-gray-500">{t('admin.companies.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.companies.addCompany')}
        </Button>
      </div>

      {/* Company cards */}
      {isLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16">
          <Building2 className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">{t('admin.companies.empty')}</p>
          <Button onClick={openCreate} className="mt-4" variant="ghost">
            <Plus className="mr-2 h-4 w-4" />
            {t('admin.companies.addCompany')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <div
              key={c.id}
              className={`group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                !c.isActive ? 'opacity-60' : ''
              }`}
            >
              {/* Edit button */}
              <button
                onClick={() => openEdit(c)}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-300 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
              >
                <Pencil className="h-4 w-4" />
              </button>

              {/* Company name + badge */}
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar text-white text-sm font-bold overflow-hidden">
                  {c.logo ? (
                    <img src={c.logo} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    c.code.slice(0, 2)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{c.name}</h3>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">{c.code}</span>
                    <Badge variant={c.isActive ? 'success' : 'outline'} className="text-[10px]">
                      {c.isActive ? t('admin.companies.active') : t('admin.companies.inactive')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-xs text-gray-500">
                {c.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    <span className="truncate">{c.address}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.taxId && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                    <span>{t('admin.companies.taxId')}: {c.taxId}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Banknote className="h-3.5 w-3.5 text-gray-400" />
                  <span>{c.currency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editCompany ? t('admin.companies.editCompany') : t('admin.companies.addCompany')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('admin.companies.name')}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
            <Input
              label={t('admin.companies.code')}
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="SOC-01"
              disabled={!!editCompany}
              required
            />
          </div>

          <Input
            label={t('admin.companies.address')}
            value={form.address || ''}
            onChange={(e) => set('address', e.target.value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('admin.companies.phone')}
              value={form.phone || ''}
              onChange={(e) => set('phone', e.target.value)}
            />
            <Input
              label={t('admin.companies.email')}
              type="email"
              value={form.email || ''}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label={t('admin.companies.taxId')}
              value={form.taxId || ''}
              onChange={(e) => set('taxId', e.target.value)}
            />
            <Input
              label={t('admin.companies.tradeRegister')}
              value={form.tradeRegister || ''}
              onChange={(e) => set('tradeRegister', e.target.value)}
            />
            <Input
              label={t('admin.companies.currency')}
              value={form.currency || 'XOF'}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
              maxLength={3}
            />
          </div>

          {editCompany && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive ?? true}
                onChange={(e) => set('isActive', e.target.checked)}
                className="rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
              />
              {t('admin.companies.active')}
            </label>
          )}

          {/* Logo upload */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Logo</label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="h-16 w-16 rounded-lg border border-gray-200 object-contain bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-red-100 p-0.5 text-red-500 hover:bg-red-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                  <Upload className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 2 * 1024 * 1024) {
                        setSubmitError('Le logo ne doit pas dépasser 2 Mo');
                        return;
                      }
                      setLogoFile(file);
                      const reader = new FileReader();
                      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {logoPreview ? 'Changer le logo' : 'Charger un logo'}
                </Button>
                <p className="mt-1 text-xs text-gray-400">PNG, JPEG, WebP ou SVG — max 2 Mo</p>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.name || !form.code}
              loading={createCompany.isPending || updateCompany.isPending}
            >
              {editCompany ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
