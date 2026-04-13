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
} from 'lucide-react';
import { useEmployeeAuthStore } from '@/stores/employee-auth-store';
import {
  Button,
  Input,
  Select,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Modal,
} from '@/components/ui';
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

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

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
  const lower = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return SERVICE_OPTIONS.find((o) => {
    const lbl = o.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return o.value === raw || lbl === lower;
  })?.value ?? '';
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
    api.get('/employees/disbursement-limit')
      .then(({ data: res }) => setMaxDisbursement(Number(res.data?.maxDisbursementAmount ?? 0)))
      .catch(() => setMaxDisbursement(0));
  }, []);

  const loadMyRequests = () => {
    if (!employee?.matricule) return;
    setLoadingRequests(true);
    api.get(`/disbursement-requests/my/${encodeURIComponent(employee.matricule)}`)
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
    const serviceLabel = SERVICE_OPTIONS.find((s) => s.value === data.service)?.label ?? data.service;

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

  const statusConfig: Record<string, { variant: 'warning' | 'success' | 'destructive'; icon: typeof Clock; label: string }> = {
    PENDING: { variant: 'warning', icon: Clock, label: t('demande.status.pending') },
    APPROVED: { variant: 'success', icon: CheckCircle2, label: t('demande.status.approved') },
    REJECTED: { variant: 'destructive', icon: XCircle, label: t('demande.status.rejected') },
    PROCESSED: { variant: 'success', icon: CheckCircle2, label: t('demande.status.approved') },
    VALIDATING: { variant: 'warning', icon: RefreshCw, label: 'En cours de validation' },
    VALIDATED: { variant: 'success', icon: CheckCircle2, label: 'Validé' },
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
              <p className="text-sm font-medium truncate">{employee.firstName} {employee.lastName}</p>
              <p className="text-xs text-gray-400 truncate">{employee.position} — {employee.service} · {employee.matricule}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="shrink-0 text-gray-400 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('employeeAuth.logout')}</span>
          </Button>
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
        <Card>
          <CardHeader>
            <CardTitle>{t('demande.form.title')}</CardTitle>
            <p className="text-sm text-gray-500">{t('demande.form.subtitle')}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
              {/* Row 1: Service + Matricule */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  {...register('service', { required: t('demande.form.errors.serviceRequired') })}
                  label={t('demande.form.service')}
                  options={SERVICE_OPTIONS}
                  placeholder={t('demande.form.servicePlaceholder')}
                  error={errors.service?.message}
                  disabled={!!employee}
                />
                <Input
                  {...register('matricule', { required: t('demande.form.errors.matriculeRequired') })}
                  label={t('demande.form.matricule')}
                  placeholder="MAT-000"
                  error={errors.matricule?.message}
                  disabled={!!employee}
                />
              </div>

              {/* Row 2: Nom + Prénom */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  {...register('lastName', { required: t('demande.form.errors.lastNameRequired') })}
                  label={t('demande.form.lastName')}
                  placeholder={t('demande.form.lastNamePlaceholder')}
                  error={errors.lastName?.message}
                  disabled={!!employee}
                />
                <Input
                  {...register('firstName', { required: t('demande.form.errors.firstNameRequired') })}
                  label={t('demande.form.firstName')}
                  placeholder={t('demande.form.firstNamePlaceholder')}
                  error={errors.firstName?.message}
                  disabled={!!employee}
                />
              </div>

              {/* Row 3: Poste + Téléphone */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  {...register('position', { required: t('demande.form.errors.positionRequired') })}
                  label={t('demande.form.position')}
                  placeholder={t('demande.form.positionPlaceholder')}
                  error={errors.position?.message}
                  disabled={!!employee}
                />
                <Input
                  {...register('phone', {
                    required: t('demande.form.errors.phoneRequired'),
                    pattern: {
                      value: /^[+]?[\d\s-]{8,}$/,
                      message: t('demande.form.errors.phoneInvalid'),
                    },
                  })}
                  label={t('demande.form.phone')}
                  type="tel"
                  placeholder="+225 07 00 00 00"
                  error={errors.phone?.message}
                  disabled={!!employee}
                />
              </div>

              {/* Row 4: Email + Montant */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  {...register('email', {
                    required: t('demande.form.errors.emailRequired'),
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: t('demande.form.errors.emailInvalid'),
                    },
                  })}
                  label={t('demande.form.email')}
                  type="email"
                  placeholder="prenom.nom@entreprise.com"
                  error={errors.email?.message}
                  disabled={!!employee}
                />
                <Input
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
                  label={t('demande.form.amount')}
                  type="number"
                  placeholder="0"
                  error={errors.amount?.message}
                  hint={maxDisbursement > 0 ? `Limite max : ${fmt(maxDisbursement)}` : undefined}
                />
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
                <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto sm:ml-auto">
                  <Send className="mr-2 h-4 w-4" />
                  {t('demande.form.submit')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── Tracking Tab ─────────────────────────── */}
      {activeTab === 'tracking' && (
        <div className="space-y-6">
          {/* Search by reference */}
          <Card>
            <CardHeader>
              <CardTitle>{t('demande.tracking.title')}</CardTitle>
              <p className="text-sm text-gray-500">{t('demande.tracking.subtitle')}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    value={trackingRef}
                    onChange={(e) => setTrackingRef(e.target.value)}
                    placeholder={t('demande.tracking.placeholder')}
                    onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                  />
                </div>
                <Button onClick={handleTrack} disabled={!trackingRef.trim()} className="w-full sm:w-auto">
                  <Search className="mr-2 h-4 w-4" />
                  {t('demande.tracking.search')}
                </Button>
              </div>

              {/* Tracking result */}
              {trackingResult && (
                <div className="mt-6 rounded-lg border border-gray-200 p-3 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-mono text-sm text-brand-gold">{trackingResult.reference}</span>
                    {(() => {
                      const cfg = statusConfig[trackingResult.status];
                      const Icon = cfg.icon;
                      return (
                        <Badge variant={cfg.variant} className="flex items-center gap-1.5 px-3 py-1">
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </Badge>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-xs text-gray-500">{t('demande.form.lastName')}</p>
                      <p className="text-sm font-medium">{trackingResult.lastName} {trackingResult.firstName}</p>
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
                      <p className="text-sm font-bold text-gray-900">{fmt(trackingResult.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('demande.table.date')}</p>
                      <p className="text-sm font-medium">{new Date(trackingResult.createdAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">{t('demande.form.reason')}</p>
                    <p className="text-sm text-gray-700">{trackingResult.reason}</p>
                  </div>

                  {/* Status timeline */}
                  <div className="rounded-lg bg-gray-50 p-3 sm:p-4">
                    <p className="mb-2 text-xs font-medium text-gray-500 uppercase">{t('demande.tracking.timeline')}</p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{t('demande.tracking.submitted')}</p>
                          <p className="text-xs text-gray-400">{new Date(trackingResult.createdAt).toLocaleString('fr-FR')}</p>
                        </div>
                      </div>
                      {trackingResult.status === 'PENDING' && (
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
                            <RefreshCw className="h-3.5 w-3.5 text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
                          </div>
                          <p className="text-sm text-amber-600">{t('demande.tracking.inReview')}</p>
                        </div>
                      )}
                      {(trackingResult.status === 'APPROVED' || trackingResult.status === 'PROCESSED') && (
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-green-700">{t('demande.tracking.approvedAt')}</p>
                            <p className="text-xs text-gray-400">{new Date(trackingResult.updatedAt).toLocaleString('fr-FR')}</p>
                          </div>
                        </div>
                      )}
                      {trackingResult.status === 'REJECTED' && (
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                            <XCircle className="h-3.5 w-3.5 text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-red-700">{t('demande.tracking.rejectedAt')}</p>
                            <p className="text-xs text-gray-400">{new Date(trackingResult.updatedAt).toLocaleString('fr-FR')}</p>
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
            </CardContent>
          </Card>

          {/* ─── My Requests List ─────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Mes demandes</CardTitle>
                <Button variant="ghost" size="sm" onClick={loadMyRequests} disabled={loadingRequests}>
                  <RefreshCw className={cn('h-4 w-4', loadingRequests && 'animate-spin')} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRequests && myRequests.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Chargement…</p>
              )}
              {!loadingRequests && myRequests.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Aucune demande effectuée pour le moment.</p>
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
                        onClick={() => { setTrackingRef(req.reference); setTrackingResult(req); }}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-brand-gold">{req.reference}</span>
                            <Badge variant={cfg?.variant ?? 'warning'} className="flex items-center gap-1 text-xs px-2 py-0.5">
                              <Icon className="h-3 w-3" />
                              {cfg?.label ?? req.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mt-1 truncate">{req.reason}</p>
                          <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 whitespace-nowrap">{fmt(req.amount)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success modal */}
      <Modal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={t('demande.success.title')}
        size="sm"
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
          <Button onClick={() => setShowSuccessModal(false)} className="w-full">
            {t('common.close')}
          </Button>
        </div>
      </Modal>
      </div>
    </div>
  );
}
