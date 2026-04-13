import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  X,
  AlertTriangle,
  Sparkles,
  Save,
  Send,
  FileText,
} from 'lucide-react';
import { Button, Card, Badge, Input } from '@/components/ui';
import {
  useCreateExpense,
  useExpenseCategories,
  useAiCategorySuggestion,
  useAiAnomalyCheck,
} from '@/hooks/useExpenses';
import { useSettings } from '@/hooks/useAdmin';
import { formatCFA, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CreateExpensePayload, PaymentMethod } from '@/types/expense';

// ── Types ────────────────────────────────────────────────
interface Step1Data {
  date: string;
  categoryId: string;
  subCategoryId?: string;
}

interface Step2Data {
  beneficiary: string;
  amount: string;
  paymentMethod: PaymentMethod;
  observations: string;
  description: string;
}

interface Step3Data {
  files: FileWithPreview[];
}

interface FileWithPreview {
  file: File;
  preview: string;
  ocrDetectedAmount?: number;
}

type FormData = Step1Data & Step2Data & Step3Data;

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'CHECK', label: 'Chèque' },
  { value: 'TRANSFER', label: 'Virement' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

const STEPS = [
  { key: 'general', icon: FileText },
  { key: 'details', icon: FileText },
  { key: 'attachments', icon: Upload },
  { key: 'summary', icon: Check },
];

export default function ExpenseCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const requestState = location.state as {
    fromRequest?: boolean;
    requestId?: string;
    reference?: string;
    beneficiary?: string;
    amount?: number;
    description?: string;
    service?: string;
    matricule?: string;
  } | null;
  const [currentStep, setCurrentStep] = useState(0);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);

  const { data: categories } = useExpenseCategories();
  const { data: appSettings } = useSettings();
  const createMutation = useCreateExpense();
  const aiCategoryMutation = useAiCategorySuggestion();
  const aiAnomalyMutation = useAiAnomalyCheck();

  // ── Form setup ─────────────────────────────
  const {
    register,
    watch,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      date: todayISO(),
      categoryId: '',
      subCategoryId: '',
      beneficiary: requestState?.beneficiary ?? '',
      amount: requestState?.amount ? String(requestState.amount) : '',
      paymentMethod: 'CASH',
      observations: requestState?.fromRequest
        ? `Demande ${requestState.reference ?? ''} — ${requestState.service ?? ''} — ${requestState.matricule ?? ''}`
        : '',
      description: requestState?.description ?? '',
      files: [],
    },
  });

  const watchedCategory = watch('categoryId');
  const watchedAmount = watch('amount');
  const watchedBeneficiary = watch('beneficiary');
  const watchedDescription = watch('description');
  const watchedDate = watch('date');

  const selectedCategory = categories?.find((c) => c.id === watchedCategory);
  const subCategories = selectedCategory?.children ?? [];

  const maxDisbursement = appSettings?.validation?.maxDisbursementAmount ?? 0;
  const parsedAmount = parseFloat(watchedAmount) || 0;
  const isOverLimit = maxDisbursement > 0 && parsedAmount > maxDisbursement;

  // ── Step validation ────────────────────────
  const validateStep = async (): Promise<boolean> => {
    switch (currentStep) {
      case 0:
        return trigger(['date', 'categoryId']);
      case 1:
        return trigger(['amount', 'paymentMethod']);
      case 2:
        return true; // files are optional
      default:
        return true;
    }
  };

  const nextStep = async () => {
    const valid = await validateStep();
    if (!valid) return;

    // When moving to summary (step 3), trigger AI checks if service is available
    if (currentStep === 2) {
      const amount = parseFloat(watchedAmount);
      if (amount > 0 && appSettings?.ai?.enabled) {
        // AI category suggestion
        aiCategoryMutation.mutate({
          description: watchedDescription,
          beneficiary: watchedBeneficiary,
          amount,
        });
        // AI anomaly check
        if (watchedCategory && watchedDate) {
          aiAnomalyMutation.mutate({
            amount,
            categoryId: watchedCategory,
            beneficiary: watchedBeneficiary,
            date: watchedDate,
          });
        }
      }
    }

    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 0));

  // ── File handling ──────────────────────────
  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      const currentAmount = parseFloat(watchedAmount);
      const accepted = Array.from(newFiles)
        .filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf')
        .map((file) => ({
          file,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        }));

      setFiles((prev) => [...prev, ...accepted]);

      // Simulate OCR detection (in production, this would call the API)
      // For demo, randomly detect amounts on image files
      accepted.forEach((f, i) => {
        if (f.file.type.startsWith('image/') && currentAmount > 0) {
          // Simulate OCR checking after a delay
          setTimeout(() => {
            const ocrAmount =
              currentAmount + (Math.random() > 0.5 ? Math.round(Math.random() * 5000) : 0);
            if (ocrAmount !== currentAmount && currentAmount > 0) {
              setOcrWarning(
                t('expenses.ocrAmountMismatch', {
                  ocrAmount: formatCFA(ocrAmount),
                  formAmount: formatCFA(currentAmount),
                }),
              );
              setFiles((prev) =>
                prev.map((pf, pi) =>
                  pi === prev.length - accepted.length + i
                    ? { ...pf, ocrDetectedAmount: ocrAmount }
                    : pf,
                ),
              );
            }
          }, 1500);
        }
      });
    },
    [watchedAmount, t],
  );

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
    setOcrWarning(null);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  // ── Submit ─────────────────────────────────
  const onSubmit = () => {
    const values = getValues();
    const payload: CreateExpensePayload = {
      date: values.date,
      amount: parseFloat(values.amount),
      description: values.description || undefined,
      beneficiary: values.beneficiary || undefined,
      paymentMethod: values.paymentMethod,
      categoryId: values.categoryId,
      observations: values.observations || undefined,
      disbursementRequestId: requestState?.requestId || undefined,
    };

    createMutation.mutate(payload, {
      onSuccess: (expense) => {
        navigate(`/expenses/${expense.id}`);
      },
    });
  };

  // ── Render ─────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/expenses')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('expenses.newExpense')}</h1>
          <p className="text-sm text-gray-500">{t('expenses.createSubtitle')}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <div key={step.key} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  isActive && 'bg-brand-gold text-white',
                  isDone && 'bg-green-500 text-white',
                  !isActive && !isDone && 'bg-gray-100 text-gray-400',
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:inline',
                  isActive ? 'text-gray-900' : 'text-gray-400',
                )}
              >
                {t(`expenses.step${i + 1}`)}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-px flex-1',
                    i < currentStep ? 'bg-green-300' : 'bg-gray-200',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <Card>
        {/* ── Step 1: General info ──────── */}
        {currentStep === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t('expenses.step1')}</h2>

            <Input
              id="date"
              type="date"
              label={t('common.date')}
              error={errors.date?.message}
              {...register('date', { required: t('expenses.dateRequired') })}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                {t('expenses.category')} *
              </label>
              <select
                {...register('categoryId', { required: t('expenses.categoryRequired') })}
                className={cn(
                  'w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold',
                  errors.categoryId ? 'border-red-400' : 'border-gray-300',
                )}
              >
                <option value="">{t('expenses.selectCategory')}</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="text-xs text-red-500">{errors.categoryId.message}</p>
              )}
            </div>

            {subCategories.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  {t('expenses.subCategory')}
                </label>
                <select
                  {...register('subCategoryId')}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                >
                  <option value="">{t('expenses.selectSubCategory')}</option>
                  {subCategories.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {requestState?.fromRequest && requestState.description && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
                <p className="text-xs font-medium text-amber-800">
                  {t('expenses.requestDescription')}
                </p>
                <p className="text-sm text-amber-900">{requestState.description}</p>
                {requestState.reference && (
                  <p className="text-xs text-amber-600">
                    {requestState.reference} — {requestState.beneficiary} ({requestState.matricule})
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Details ───────────── */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t('expenses.step2')}</h2>

            <Input
              id="beneficiary"
              label={t('expenses.beneficiary')}
              placeholder={t('expenses.beneficiaryPlaceholder')}
              {...register('beneficiary')}
            />

            <Input
              id="amount"
              type="number"
              label={`${t('common.amount')} (FCFA) *`}
              placeholder="0"
              error={errors.amount?.message}
              {...register('amount', {
                required: t('expenses.amountRequired'),
                min: { value: 1, message: t('expenses.amountMin') },
              })}
            />
            {isOverLimit && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t('expenses.overDisbursementLimit', { max: formatCFA(maxDisbursement) })}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                {t('expenses.paymentMethod')} *
              </label>
              <select
                {...register('paymentMethod', { required: true })}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              id="description"
              label={t('expenses.description')}
              placeholder={t('expenses.descriptionPlaceholder')}
              {...register('description')}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                {t('expenses.observations')}
              </label>
              <textarea
                {...register('observations')}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                placeholder={t('expenses.observationsPlaceholder')}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Attachments ───────── */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t('expenses.step3')}</h2>

            {/* OCR Warning */}
            {ocrWarning && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {t('expenses.ocrWarningTitle')}
                  </p>
                  <p className="mt-1 text-sm text-amber-600">{ocrWarning}</p>
                </div>
                <button
                  onClick={() => setOcrWarning(null)}
                  className="ml-auto text-amber-400 hover:text-amber-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Drag & drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors',
                dragOver
                  ? 'border-brand-gold bg-brand-gold/5'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400',
              )}
            >
              <Upload className={cn('h-10 w-10', dragOver ? 'text-brand-gold' : 'text-gray-400')} />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">{t('expenses.dropFiles')}</p>
                <p className="mt-1 text-xs text-gray-500">{t('expenses.dropFilesHint')}</p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <span className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                  {t('expenses.browseFiles')}
                </span>
              </label>
            </div>

            {/* File previews */}
            {files.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white"
                  >
                    {f.preview ? (
                      <img src={f.preview} alt={f.file.name} className="h-32 w-full object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center bg-gray-50">
                        <FileText className="h-10 w-10 text-gray-300" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-gray-700">{f.file.name}</p>
                      <p className="text-xs text-gray-400">{(f.file.size / 1024).toFixed(0)} KB</p>
                      {f.ocrDetectedAmount && (
                        <Badge variant="warning" className="mt-1">
                          OCR: {formatCFA(f.ocrDetectedAmount)}
                        </Badge>
                      )}
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Summary ───────────── */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('expenses.step4')}</h2>

            {/* Recap */}
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              <SummaryRow label={t('common.date')} value={getValues('date')} />
              <SummaryRow label={t('expenses.category')} value={selectedCategory?.name ?? '—'} />
              <SummaryRow
                label={t('expenses.beneficiary')}
                value={getValues('beneficiary') || '—'}
              />
              <SummaryRow
                label={t('common.amount')}
                value={watchedAmount ? formatCFA(parseFloat(watchedAmount)) : '—'}
                highlight
              />
              <SummaryRow
                label={t('expenses.paymentMethod')}
                value={
                  PAYMENT_METHODS.find((m) => m.value === getValues('paymentMethod'))?.label ?? '—'
                }
              />
              <SummaryRow
                label={t('expenses.description')}
                value={getValues('description') || '—'}
              />
              <SummaryRow
                label={t('expenses.attachments')}
                value={`${files.length} ${t('expenses.filesCount')}`}
              />
            </div>

            {/* AI Category suggestion */}
            {aiCategoryMutation.data && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <Sparkles className="h-4 w-4" />
                  {t('expenses.aiCategorySuggestion')}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="info">{aiCategoryMutation.data.categoryName}</Badge>
                  <span className="text-xs text-blue-600">
                    {t('expenses.confidence')}:{' '}
                    {Math.round(aiCategoryMutation.data.confidence * 100)}%
                  </span>
                </div>
                {aiCategoryMutation.data.alternatives.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {aiCategoryMutation.data.alternatives.map((alt) => (
                      <button
                        key={alt.categoryId}
                        onClick={() => setValue('categoryId', alt.categoryId)}
                        className="rounded-md bg-blue-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-200"
                      >
                        {alt.categoryName} ({Math.round(alt.confidence * 100)}%)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Anomaly score */}
            {aiAnomalyMutation.data && aiAnomalyMutation.data.score > 0.5 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  {t('expenses.anomalyDetected')}
                </div>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-amber-200">
                      <div
                        className="h-2 rounded-full bg-amber-500 transition-all"
                        style={{ width: `${aiAnomalyMutation.data.score * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-amber-700">
                      {Math.round(aiAnomalyMutation.data.score * 100)}%
                    </span>
                  </div>
                  {aiAnomalyMutation.data.reasons.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {aiAnomalyMutation.data.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-amber-700">
                          • {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {aiAnomalyMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
                {t('expenses.aiAnalyzing')}
              </div>
            )}
          </div>
        )}

        {/* ── Navigation buttons ──────── */}
        <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
          <div>
            {currentStep > 0 && (
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4" />
                {t('common.previous')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentStep === STEPS.length - 1 ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => onSubmit(true)}
                  loading={createMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                  {t('expenses.saveDraft')}
                </Button>
                <Button
                  onClick={() => onSubmit(false)}
                  loading={createMutation.isPending}
                  disabled={isOverLimit}
                >
                  <Send className="h-4 w-4" />
                  {t('expenses.submitForApproval')}
                </Button>
              </>
            ) : (
              <Button onClick={nextStep}>
                {t('common.next')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────
function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span
        className={cn(
          'text-sm',
          highlight ? 'font-bold text-gray-900' : 'font-medium text-gray-700',
        )}
      >
        {value}
      </span>
    </div>
  );
}
