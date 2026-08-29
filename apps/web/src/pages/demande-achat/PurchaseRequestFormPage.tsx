import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  Upload,
  X,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import {
  usePurchaseRequest,
  useCreatePurchaseRequest,
  useUpdatePurchaseRequest,
  useDeletePurchaseRequest,
  useSubmitPurchaseRequest,
  useUploadPurchaseRequestAttachment,
  useDeletePurchaseRequestAttachment,
} from '@/hooks/usePurchaseRequests';
import { todayISO } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { extractApiErrorMessage } from '@/lib/errors';
import { DOCUMENT_TYPES } from './constants';
import type {
  CreatePurchaseRequestPayload,
  PurchaseRequestLinePayload,
  PurchaseRequestPriority,
  PurchaseRequestDocumentType,
} from '@/types/demande-achat';

interface FormValues {
  service: string;
  department: string;
  subject: string;
  justification: string;
  desiredDate: string;
  priority: PurchaseRequestPriority;
  urgencyReason: string;
  project: string;
  costCenter: string;
  budget: string;
  site: string;
  generalComment: string;
  lines: PurchaseRequestLinePayload[];
}

const emptyLine: PurchaseRequestLinePayload = {
  articleReference: '',
  designation: '',
  description: '',
  isOffCatalog: false,
  quantity: 1,
  unit: 'U',
  desiredDate: '',
  comment: '',
};

export default function PurchaseRequestFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { data: existing, isLoading } = usePurchaseRequest(id ?? '');
  const createMutation = useCreatePurchaseRequest();
  const updateMutation = useUpdatePurchaseRequest(id ?? '');
  const deleteMutation = useDeletePurchaseRequest();
  const submitMutation = useSubmitPurchaseRequest();
  const uploadAttachment = useUploadPurchaseRequestAttachment(id ?? '');
  const deleteAttachment = useDeletePurchaseRequestAttachment(id ?? '');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [docType, setDocType] = useState<PurchaseRequestDocumentType>('AUTRE');
  const [dragOver, setDragOver] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const currentUser = useAuthStore((s) => s.user);

  const {
    register,
    control,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      service: currentUser?.serviceName || '',
      department: currentUser?.departmentName || '',
      subject: '',
      justification: '',
      desiredDate: todayISO(),
      priority: 'NORMAL',
      urgencyReason: '',
      project: '',
      costCenter: '',
      budget: '',
      site: '',
      generalComment: '',
      lines: [{ ...emptyLine }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  useEffect(() => {
    if (!existing) return;
    reset({
      service: existing.service,
      department: existing.department,
      subject: existing.subject,
      justification: existing.justification,
      desiredDate: existing.desiredDate?.slice(0, 10) ?? todayISO(),
      priority: existing.priority,
      urgencyReason: existing.urgencyReason ?? '',
      project: existing.project ?? '',
      costCenter: existing.costCenter ?? '',
      budget: existing.budget ?? '',
      site: existing.site ?? '',
      generalComment: existing.generalComment ?? '',
      lines: existing.lines.length
        ? existing.lines.map((l) => ({
            id: l.id,
            articleReference: l.articleReference ?? '',
            designation: l.designation,
            description: l.description ?? '',
            isOffCatalog: l.isOffCatalog,
            quantity: l.quantity,
            unit: l.unit,
            desiredDate: l.desiredDate?.slice(0, 10) ?? '',
            comment: l.comment ?? '',
          }))
        : [{ ...emptyLine }],
    });
  }, [existing, reset]);

  const watchedPriority = watch('priority');
  const watchedLines = watch('lines');

  const isLocked =
    isEditMode && existing && existing.status !== 'DRAFT' && existing.status !== 'RETURNED';

  function buildPayload(): CreatePurchaseRequestPayload {
    const values = getValues();
    return {
      service: values.service,
      department: values.department,
      subject: values.subject,
      justification: values.justification,
      desiredDate: values.desiredDate,
      priority: values.priority,
      urgencyReason: values.priority !== 'NORMAL' ? values.urgencyReason || undefined : undefined,
      project: values.project || undefined,
      costCenter: values.costCenter || undefined,
      budget: values.budget || undefined,
      site: values.site || undefined,
      generalComment: values.generalComment || undefined,
      lines: values.lines.map((l) => ({
        articleReference: l.articleReference || undefined,
        designation: l.designation,
        description: l.description || undefined,
        isOffCatalog: l.isOffCatalog,
        quantity: Number(l.quantity) || 0,
        unit: l.unit,
        // Le prix est réservé au chiffrage par le service achats — jamais
        // envoyé par le demandeur.
        desiredDate: l.desiredDate || undefined,
        comment: l.comment || undefined,
      })),
    };
  }

  function validateForSubmit(): string | null {
    const values = getValues();
    if (!values.service.trim()) return t('demandeAchat.form.errors.service');
    if (!values.department.trim()) return t('demandeAchat.form.errors.department');
    if (!values.subject.trim()) return t('demandeAchat.form.errors.subject');
    if (!values.justification.trim()) return t('demandeAchat.form.errors.justification');
    if (!values.desiredDate) return t('demandeAchat.form.errors.desiredDate');
    if (values.priority !== 'NORMAL' && !values.urgencyReason.trim()) {
      return t('demandeAchat.form.errors.urgencyReason');
    }
    if (!values.lines.length) return t('demandeAchat.form.errors.linesRequired');
    for (const l of values.lines) {
      if (!l.designation.trim()) return t('demandeAchat.form.errors.designation');
      if (l.isOffCatalog && !l.description?.trim()) {
        return t('demandeAchat.form.errors.descriptionRequired');
      }
      if (!l.quantity || Number(l.quantity) <= 0) return t('demandeAchat.form.errors.quantity');
      if (!l.unit.trim()) return t('demandeAchat.form.errors.unit');
    }
    return null;
  }

  async function handleSaveDraft() {
    setFormError(null);
    const payload = buildPayload();
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(payload);
      } else {
        const created = await createMutation.mutateAsync(payload);
        navigate(`/demande-achat/${created.id}/edit`, { replace: true });
      }
    } catch (err) {
      setFormError(extractApiErrorMessage(err));
    }
  }

  async function handleSubmitRequest() {
    const error = validateForSubmit();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    const payload = buildPayload();
    try {
      let targetId = id;
      if (isEditMode) {
        await updateMutation.mutateAsync(payload);
      } else {
        const created = await createMutation.mutateAsync(payload);
        targetId = created.id;
      }
      if (targetId) {
        await submitMutation.mutateAsync(targetId);
        navigate(`/demande-achat/${targetId}`);
      }
    } catch (err) {
      setFormError(extractApiErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/demande-achat');
    } catch (err) {
      setFormError(extractApiErrorMessage(err));
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || !id) return;
    Array.from(fileList).forEach((file) => {
      uploadAttachment.mutate({ file, documentType: docType });
    });
  }

  if (isEditMode && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/demande-achat')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? t('demandeAchat.form.editTitle') : t('demandeAchat.form.newTitle')}
          </h1>
          <p className="text-sm text-gray-500">{t('demandeAchat.form.subtitle')}</p>
        </div>
      </div>

      {isLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('demandeAchat.form.lockedNotice')}
        </div>
      )}

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      {/* General info */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#697386]">
          {t('demandeAchat.form.generalInfo')}
        </h2>
        {!isEditMode && !currentUser?.serviceId && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {t(
                'demandeAchat.form.noServiceAssigned',
                "Aucun service ne vous a été attribué. Demandez à un administrateur de vous rattacher un service (Gestion des utilisateurs) avant de soumettre une demande d'achat.",
              )}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('demandeAchat.fields.service')} *</label>
            <input className="input bg-zinc-50" disabled readOnly {...register('service')} />
          </div>
          <div>
            <label className="label">{t('demandeAchat.fields.department')} *</label>
            <input className="input bg-zinc-50" disabled readOnly {...register('department')} />
          </div>
        </div>
        <div>
          <label className="label">{t('demandeAchat.fields.subject')} *</label>
          <input className="input" disabled={!!isLocked} {...register('subject')} />
        </div>
        <div>
          <label className="label">{t('demandeAchat.fields.justification')} *</label>
          <textarea
            className="input"
            rows={3}
            disabled={!!isLocked}
            {...register('justification')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('demandeAchat.fields.desiredDate')} *</label>
            <input
              type="date"
              className="input"
              disabled={!!isLocked}
              {...register('desiredDate')}
            />
          </div>
          <div>
            <label className="label">{t('demandeAchat.fields.priority')} *</label>
            <select className="input" disabled={!!isLocked} {...register('priority')}>
              <option value="NORMAL">{t('demandeAchat.priority.NORMAL')}</option>
              <option value="URGENT">{t('demandeAchat.priority.URGENT')}</option>
              <option value="VERY_URGENT">{t('demandeAchat.priority.VERY_URGENT')}</option>
            </select>
          </div>
        </div>
        {watchedPriority !== 'NORMAL' && (
          <div>
            <label className="label">{t('demandeAchat.fields.urgencyReason')} *</label>
            <textarea
              className="input"
              rows={2}
              disabled={!!isLocked}
              placeholder={t('demandeAchat.form.urgencyReasonPlaceholder')}
              {...register('urgencyReason')}
            />
          </div>
        )}

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-[#aab7c4]">
          {t('demandeAchat.form.optionalInfo')}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('demandeAchat.fields.project')}</label>
            <input className="input" disabled={!!isLocked} {...register('project')} />
          </div>
          <div>
            <label className="label">{t('demandeAchat.fields.costCenter')}</label>
            <input className="input" disabled={!!isLocked} {...register('costCenter')} />
          </div>
          <div>
            <label className="label">{t('demandeAchat.fields.budget')}</label>
            <input className="input" disabled={!!isLocked} {...register('budget')} />
          </div>
          <div>
            <label className="label">{t('demandeAchat.fields.site')}</label>
            <input className="input" disabled={!!isLocked} {...register('site')} />
          </div>
        </div>
        <div>
          <label className="label">{t('demandeAchat.fields.generalComment')}</label>
          <textarea
            className="input"
            rows={2}
            disabled={!!isLocked}
            {...register('generalComment')}
          />
        </div>
      </div>

      {/* Lines */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#697386]">
            {t('demandeAchat.form.lines')}
          </h2>
          {!isLocked && (
            <button
              type="button"
              onClick={() => append({ ...emptyLine })}
              className="text-xs font-medium text-brand-gold hover:underline"
            >
              <Plus className="mr-1 inline h-3.5 w-3.5" />
              {t('demandeAchat.form.addLine')}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
              <tr className="text-left text-xs font-medium text-[#697386]">
                <th className="px-2 py-2">{t('demandeAchat.fields.articleReference')}</th>
                <th className="px-2 py-2">{t('demandeAchat.fields.designation')} *</th>
                <th className="px-2 py-2">{t('demandeAchat.fields.offCatalog')}</th>
                <th className="px-2 py-2">{t('demandeAchat.fields.quantity')} *</th>
                <th className="px-2 py-2">{t('demandeAchat.fields.unit')} *</th>
                {!isLocked && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => {
                const line = watchedLines?.[idx];
                const offCatalog = !!line?.isOffCatalog;
                return (
                  <tr key={field.id} className="border-b border-[#e0e6eb]">
                    <td className="px-2 py-1.5">
                      <input
                        className="input py-1"
                        disabled={!!isLocked}
                        {...register(`lines.${idx}.articleReference` as const)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input py-1"
                        disabled={!!isLocked}
                        {...register(`lines.${idx}.designation` as const)}
                      />
                      {offCatalog && (
                        <input
                          className="input mt-1 py-1"
                          placeholder={t('demandeAchat.fields.description')}
                          disabled={!!isLocked}
                          {...register(`lines.${idx}.description` as const)}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        disabled={!!isLocked}
                        {...register(`lines.${idx}.isOffCatalog` as const)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="any"
                        className="input w-20 py-1"
                        disabled={!!isLocked}
                        {...register(`lines.${idx}.quantity` as const)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input w-16 py-1"
                        disabled={!!isLocked}
                        {...register(`lines.${idx}.unit` as const)}
                      />
                    </td>
                    {!isLocked && (
                      <td className="px-2 py-1.5">
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(idx)}
                            className="rounded p-1 text-[#697386] hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="border-t border-[#e0e6eb] pt-3 text-xs text-[#697386]">
          {t(
            'demandeAchat.form.pricingByPurchasing',
            "Les prix ne sont pas saisis à cette étape : le service achats chiffrera cette demande (prix + devis fournisseur) une fois soumise, avant son entrée dans le circuit de validation.",
          )}
        </p>
      </div>

      {/* Attachments — only once the request has an id */}
      {isEditMode && existing && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#697386]">
            {t('demandeAchat.form.attachments')}
          </h2>

          {!isLocked && (
            <div className="flex items-center gap-2">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as PurchaseRequestDocumentType)}
                className="input h-9 w-56"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {t(`demandeAchat.documentType.${dt}`)}
                  </option>
                ))}
              </select>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors',
                  dragOver ? 'border-brand-gold bg-brand-gold/5' : 'border-gray-300 text-gray-500',
                )}
              >
                <Upload className="h-4 w-4" />
                {t('demandeAchat.form.dropFiles')}
                <label className="cursor-pointer text-brand-gold hover:underline">
                  {t('demandeAchat.form.browseFiles')}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
              </div>
            </div>
          )}

          {existing.attachments.length > 0 ? (
            <ul className="divide-y divide-[#e0e6eb]">
              {existing.attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#aab7c4]" />
                    <span className="text-sm text-[#0a2540]">{a.fileName}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                      {t(`demandeAchat.documentType.${a.documentType}`)}
                    </span>
                  </div>
                  {!isLocked && (
                    <button
                      onClick={() => deleteAttachment.mutate(a.id)}
                      className="rounded p-1 text-[#697386] hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#aab7c4]">{t('demandeAchat.form.noAttachments')}</p>
          )}
        </div>
      )}

      {/* Actions */}
      {!isLocked && (
        <div className="flex items-center justify-between">
          <div>
            {isEditMode && existing?.status === 'DRAFT' && (
              <button
                className="btn-secondary text-red-600 hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                {t('demandeAchat.form.deleteDraft')}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              className="btn-secondary disabled:opacity-50"
              onClick={handleSaveDraft}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {t('demandeAchat.form.saveDraft')}
            </button>
            <button
              className="btn-primary disabled:opacity-50"
              onClick={handleSubmitRequest}
              disabled={
                createMutation.isPending || updateMutation.isPending || submitMutation.isPending
              }
            >
              <Send className="h-4 w-4" />
              {t('demandeAchat.form.submitRequest')}
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(false)} />
          <div className="relative w-full max-w-sm rounded-md bg-white p-6 shadow-2xl">
            <p className="text-sm text-[#0a2540]">{t('demandeAchat.form.deleteConfirm')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
