import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  FileSignature,
  Send,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  User,
  X,
} from 'lucide-react';
import { useEmployeeAuthStore } from '@/stores/employee-auth-store';
import { cn } from '@/lib/utils';
import {
  useCreateDisbursementRequest,
  trackDisbursementRequest,
} from '@/hooks/useDisbursementRequests';
import type { DisbursementRequest } from '@/hooks/useDisbursementRequests';
import api from '@/lib/api';

/* ─── Types ─────────────────────────────────────── */
interface FormData {
  service: string;
  lastName: string;
  firstName: string;
  position: string;
  phone: string;
  matricule: string;
  email: string;
  amount: string;
  reason: string;
}

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
      <div className="relative w-full max-w-md rounded-md bg-white shadow-2xl">
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

const SERVICE_OPTIONS = [
  { value: 'comptabilite', label: 'Comptabilité' },
  { value: 'logistique', label: 'Logistique' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'rh', label: 'Ressources Humaines' },
  { value: 'direction', label: 'Direction Générale' },
  { value: 'informatique', label: 'Informatique' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'production', label: 'Production' },
  { value: 'autre', label: 'Autre' },
];

function matchServiceValue(raw?: string): string {
  if (!raw) return '';
  const lower = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    SERVICE_OPTIONS.find((o) => {
      const lbl = o.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return o.value === raw || lbl === lower;
    })?.value ?? ''
  );
}

export default function DemandePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { employee, logout } = useEmployeeAuthStore();
  const createRequest = useCreateDisbursementRequest();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastReference, setLastReference] = useState('');
  const [trackingRef, setTrackingRef] = useState('');
  const [trackingResult, setTrackingResult] = useState<DisbursementRequest | null>(null);
  const [trackingError, setTrackingError] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'tracking'>('form');
  const [maxDisbursement, setMaxDisbursement] = useState<number>(0);
  const [myRequests, setMyRequests] = useState<DisbursementRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    api
      .get('/employees/disbursement-limit')
      .then(({ data: res }) => setMaxDisbursement(Number(res.data?.maxDisbursementAmount ?? 0)))
      .catch(() => setMaxDisbursement(0));
  }, []);

  const loadMyRequests = () => {
    if (!employee?.matricule) return;
    setLoadingRequests(true);
    api
      .get(`/disbursement-requests/my/${encodeURIComponent(employee.matricule)}`)
      .then(({ data: res }) => setMyRequests(res.data ?? []))
      .catch(() => setMyRequests([]))
      .finally(() => setLoadingRequests(false));
  };

  useEffect(() => {
    if (activeTab === 'tracking') loadMyRequests();
  }, [activeTab]);

  const handleLogout = () => {
    logout();
    navigate('/demande/login');
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      service: matchServiceValue(employee?.service),
      lastName: employee?.lastName ?? '',
      firstName: employee?.firstName ?? '',
      position: employee?.position ?? '',
      phone: employee?.phone ?? '',
      matricule: employee?.matricule ?? '',
      email: employee?.email ?? '',
      amount: '',
      reason: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    const serviceLabel =
      SERVICE_OPTIONS.find((s) => s.value === data.service)?.label ?? data.service;

    const result = await createRequest.mutateAsync({
      lastName: data.lastName,
      firstName: data.firstName,
      position: data.position,
      service: serviceLabel,
      phone: data.phone,
      matricule: data.matricule,
      email: data.email,
      amount: Number(data.amount),
      reason: data.reason,
    });

    setLastReference(result.reference);
    setShowSuccessModal(true);
    reset();
    loadMyRequests();
  };

  const handleTrack = async () => {
    setTrackingError(false);
    setTrackingResult(null);
    try {
      const found = await trackDisbursementRequest(trackingRef.trim());
      if (found) {
        setTrackingResult(found);
      } else {
        setTrackingError(true);
      }
    } catch {
      setTrackingError(true);
    }
  };

  const statusConfig: Record<string, { classes: string; icon: typeof Clock; label: string }> = {
    PENDING: {
      classes: 'bg-amber-50 text-amber-800',
      icon: Clock,
      label: t('demande.status.pending'),
    },
    APPROVED: {
      classes: 'bg-[#dcfce7] text-[#166534]',
      icon: CheckCircle2,
      label: t('demande.status.approved'),
    },
    REJECTED: {
      classes: 'bg-[#fee2e2] text-[#991b1b]',
      icon: XCircle,
      label: t('demande.status.rejected'),
    },
    PROCESSED: {
      classes: 'bg-[#dcfce7] text-[#166534]',
      icon: CheckCircle2,
      label: t('demande.status.approved'),
    },
    VALIDATING: {
      classes: 'bg-amber-50 text-amber-800',
      icon: RefreshCw,
      label: 'En cours de validation',
    },
    VALIDATED: { classes: 'bg-[#dcfce7] text-[#166534]', icon: CheckCircle2, label: 'Validé' },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Employee info bar */}
      {employee && (
        <div className="bg-sidebar text-white px-3 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/20">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-brand-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {employee.position} — {employee.service} · {employee.matricule}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex shrink-0 items-center rounded-md px-2 py-1.5 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('employeeAuth.logout')}</span>
          </button>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900">
            <FileSignature className="h-5 w-5 sm:h-6 sm:w-6 text-brand-gold" />
            {t('demande.title')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">{t('demande.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={cn(
              'flex-1 rounded-md px-3 py-2.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition',
              activeTab === 'form'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <FileSignature className="mr-1.5 sm:mr-2 inline h-4 w-4" />
            {t('demande.tabs.newRequest')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            className={cn(
              'flex-1 rounded-md px-3 py-2.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition',
              activeTab === 'tracking'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Search className="mr-1.5 sm:mr-2 inline h-4 w-4" />
            {t('demande.tabs.tracking')}
          </button>
        </div>

        {/* ─── New Request Form ─────────────────────── */}
        {activeTab === 'form' && (
          <div className="card">
            <h3 className="text-base font-semibold text-[#0a2540]">{t('demande.form.title')}</h3>
            <p className="mb-4 text-sm text-gray-500">{t('demande.form.subtitle')}</p>
            <div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                {/* Row 1: Service + Matricule */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('demande.form.service')}</label>
                    <select
                      className="input"
                      {...register('service', {
                        required: t('demande.form.errors.serviceRequired'),
                      })}
                      disabled={!!employee}
                    >
                      <option value="">{t('demande.form.servicePlaceholder')}</option>
                      {SERVICE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {errors.service?.message && (
                      <p className="mt-1 text-xs text-red-500">{errors.service.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">{t('demande.form.matricule')}</label>
                    <input
                      className="input"
                      {...register('matricule', {
                        required: t('demande.form.errors.matriculeRequired'),
                      })}
                      placeholder="MAT-000"
                      disabled={!!employee}
                    />
                    {errors.matricule?.message && (
                      <p className="mt-1 text-xs text-red-500">{errors.matricule.message}</p>
                    )}
                  </div>
                </div>

                {/* Row 2: Nom + Prénom */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('demande.form.lastName')}</label>
                    <input
                      className="input"
                      {...register('lastName', {
                        required: t('demande.form.errors.lastNameRequired'),
                      })}
                      placeholder={t('demande.form.lastNamePlaceholder')}
                      disabled={!!employee}
                    />
                    {errors.lastName?.message && (
                      <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">{t('demande.form.firstName')}</label>
                    <input
                      className="input"
                      {...register('firstName', {
                        required: t('demande.form.errors.firstNameRequired'),
                      })}
                      placeholder={t('demande.form.firstNamePlaceholder')}
                      disabled={!!employee}
                    />
                    {errors.firstName?.message && (
                      <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
                    )}
                  </div>
                </div>

                {/* Row 3: Poste + Téléphone */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('demande.form.position')}</label>
                    <input
                      className="input"
                      {...register('position', {
                        required: t('demande.form.errors.positionRequired'),
                      })}
                      placeholder={t('demande.form.positionPlaceholder')}
                      disabled={!!employee}
                    />
                    {errors.position?.message && (
                      <p className="mt-1 text-xs text-red-500">{errors.position.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">{t('demande.form.phone')}</label>
                    <input
                      className="input"
                      {...register('phone', {
                        required: t('demande.form.errors.phoneRequired'),
                        pattern: {
                          value: /^[+]?[\d\s-]{8,}$/,
                          message: t('demande.form.errors.phoneInvalid'),
                        },
                      })}
                      type="tel"
                      placeholder="+225 07 00 00 00"
                      disabled={!!employee}
                    />
                    {errors.phone?.message && (
                      <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
                    )}
                  </div>
                </div>

                {/* Row 4: Email + Montant */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('demande.form.email')}</label>
                    <input
                      className="input"
                      {...register('email', {
                        required: t('demande.form.errors.emailRequired'),
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: t('demande.form.errors.emailInvalid'),
                        },
                      })}
                      type="email"
                      placeholder="prenom.nom@entreprise.com"
                      disabled={!!employee}
                    />
                    {errors.email?.message && (
                      <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">{t('demande.form.amount')}</label>
                    <input
                      className="input"
                      {...register('amount', {
                        required: t('demande.form.errors.amountRequired'),
                        min: { value: 1, message: t('demande.form.errors.amountMin') },
                        validate: (v) => {
                          if (maxDisbursement > 0 && Number(v) > maxDisbursement) {
                            return `Le montant dépasse la limite autorisée de ${fmt(maxDisbursement)}`;
                          }
                          return true;
                        },
                      })}
                      type="number"
                      placeholder="0"
                    />
                    {errors.amount?.message ? (
                      <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>
                    ) : maxDisbursement > 0 ? (
                      <p className="mt-1 text-xs text-[#aab7c4]">
                        Limite max : {fmt(maxDisbursement)}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Motif */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('demande.form.reason')} *
                  </label>
                  <textarea
                    {...register('reason', {
                      required: t('demande.form.errors.reasonRequired'),
                      minLength: { value: 10, message: t('demande.form.errors.reasonMinLength') },
                    })}
                    rows={3}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1',
                      errors.reason
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-200 focus:border-brand-gold focus:ring-brand-gold',
                    )}
                    placeholder={t('demande.form.reasonPlaceholder')}
                  />
                  {errors.reason && (
                    <p className="mt-1 text-xs text-red-500">{errors.reason.message}</p>
                  )}
                </div>

                {/* Submit */}
                <div className="flex">
                  <button
                    type="submit"
                    className="btn-primary w-full disabled:opacity-50 sm:ml-auto sm:w-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    <Send className="h-4 w-4" />
                    {t('demande.form.submit')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Tracking Tab ─────────────────────────── */}
        {activeTab === 'tracking' && (
          <div className="space-y-6">
            {/* Search by reference */}
            <div className="card">
              <h3 className="text-base font-semibold text-[#0a2540]">
                {t('demande.tracking.title')}
              </h3>
              <p className="mb-4 text-sm text-gray-500">{t('demande.tracking.subtitle')}</p>
              <div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    className="input flex-1"
                    value={trackingRef}
                    onChange={(e) => setTrackingRef(e.target.value)}
                    placeholder={t('demande.tracking.placeholder')}
                    onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                  />
                  <button
                    className="btn-primary w-full disabled:opacity-50 sm:w-auto"
                    onClick={handleTrack}
                    disabled={!trackingRef.trim()}
                  >
                    <Search className="h-4 w-4" />
                    {t('demande.tracking.search')}
                  </button>
                </div>

                {/* Tracking result */}
                {trackingResult && (
                  <div className="mt-6 rounded-lg border border-gray-200 p-3 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-mono text-sm text-brand-gold">
                        {trackingResult.reference}
                      </span>
                      {(() => {
                        const cfg = statusConfig[trackingResult.status];
                        const Icon = cfg.icon;
                        return (
                          <span
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cfg.classes}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-500">{t('demande.form.lastName')}</p>
                        <p className="text-sm font-medium">
                          {trackingResult.lastName} {trackingResult.firstName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('demande.form.service')}</p>
                        <p className="text-sm font-medium">{trackingResult.service}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('demande.form.position')}</p>
                        <p className="text-sm font-medium">{trackingResult.position}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('demande.form.matricule')}</p>
                        <p className="text-sm font-medium">{trackingResult.matricule}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('common.amount')}</p>
                        <p className="text-sm font-bold text-gray-900">
                          {fmt(trackingResult.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('demande.table.date')}</p>
                        <p className="text-sm font-medium">
                          {new Date(trackingResult.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">{t('demande.form.reason')}</p>
                      <p className="text-sm text-gray-700">{trackingResult.reason}</p>
                    </div>

                    {/* Status timeline */}
                    <div className="rounded-lg bg-gray-50 p-3 sm:p-4">
                      <p className="mb-2 text-xs font-medium text-gray-500 uppercase">
                        {t('demande.tracking.timeline')}
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              {t('demande.tracking.submitted')}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(trackingResult.createdAt).toLocaleString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        {trackingResult.status === 'PENDING' && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
                              <RefreshCw
                                className="h-3.5 w-3.5 text-amber-600 animate-spin"
                                style={{ animationDuration: '3s' }}
                              />
                            </div>
                            <p className="text-sm text-amber-600">
                              {t('demande.tracking.inReview')}
                            </p>
                          </div>
                        )}
                        {(trackingResult.status === 'APPROVED' ||
                          trackingResult.status === 'PROCESSED') && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-green-700">
                                {t('demande.tracking.approvedAt')}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(trackingResult.updatedAt).toLocaleString('fr-FR')}
                              </p>
                            </div>
                          </div>
                        )}
                        {trackingResult.status === 'REJECTED' && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                              <XCircle className="h-3.5 w-3.5 text-red-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-red-700">
                                {t('demande.tracking.rejectedAt')}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(trackingResult.updatedAt).toLocaleString('fr-FR')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Error */}
                {trackingError && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm">{t('demande.tracking.notFound')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ─── My Requests List ─────────────────── */}
            <div className="card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#0a2540]">Mes demandes</h3>
                <button
                  className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100 disabled:opacity-50"
                  onClick={loadMyRequests}
                  disabled={loadingRequests}
                >
                  <RefreshCw className={cn('h-4 w-4', loadingRequests && 'animate-spin')} />
                </button>
              </div>
              <div>
                {loadingRequests && myRequests.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">Chargement…</p>
                )}
                {!loadingRequests && myRequests.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucune demande effectuée pour le moment.
                  </p>
                )}
                {myRequests.length > 0 && (
                  <div className="space-y-3">
                    {myRequests.map((req) => {
                      const cfg = statusConfig[req.status];
                      const Icon = cfg?.icon ?? Clock;
                      return (
                        <div
                          key={req.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            setTrackingRef(req.reference);
                            setTrackingResult(req);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-brand-gold">
                                {req.reference}
                              </span>
                              <span
                                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg?.classes ?? 'bg-amber-50 text-amber-800'}`}
                              >
                                <Icon className="h-3 w-3" />
                                {cfg?.label ?? req.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-1 truncate">{req.reason}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(req.createdAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                            {fmt(req.amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success modal */}
        <ModalShell
          open={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          title={t('demande.success.title')}
        >
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">{t('demande.success.message')}</p>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{t('demande.success.reference')}</p>
              <p className="text-lg font-bold text-brand-gold">{lastReference}</p>
            </div>
            <p className="text-xs text-gray-400">{t('demande.success.hint')}</p>
            <button
              className="btn-primary w-full"
              onClick={() => setShowSuccessModal(false)}
            >
              {t('common.close')}
            </button>
          </div>
        </ModalShell>
      </div>
    </div>
  );
}
