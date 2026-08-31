import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Store,
  Building2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Search,
  ChevronRight,
  ArrowLeft,
  ChevronDown,
  Settings,
  Key,
  Globe,
  Hash,
  Database,
  Zap,
  TestTube2,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFnePointsOfSale,
  useCreateFnePointOfSale,
  useUpdateFnePointOfSale,
  useDeleteFnePointOfSale,
} from '@/hooks/useFnePointsOfSale';
import {
  useFneEstablishments,
  useCreateFneEstablishment,
  useUpdateFneEstablishment,
  useDeleteFneEstablishment,
} from '@/hooks/useFneEstablishments';
import { useCompanies } from '@/hooks/useAdmin';
import { useFneSetting, useUpsertFneSetting } from '@/hooks/useFneSettings';
import { useErpSetting, useUpsertErpSetting, useTestErpConnection } from '@/hooks/useErpSettings';
import type { FnePointOfSaleRecord, FneEstablishmentRecord } from '@/types/fne';

interface ItemForm {
  name: string;
  address: string;
  isActive: boolean;
  companyId: string;
}

const defaultForm: ItemForm = { name: '', address: '', isActive: true, companyId: '' };

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5',
        active ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#f6f9fc] text-[#697386]',
      )}
    >
      {label}
    </span>
  );
}

function ModalShell({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
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

  const sizeClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          'bg-white rounded-md border border-[#e0e6eb] w-full max-h-[90vh] overflow-y-auto',
          sizeClass,
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e6eb]">
            <h2 className="text-sm font-semibold text-[#0a2540]">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-[#697386] hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function FneConfigPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  /* ── Company filter ── */
  const { data: companies = [] } = useCompanies();
  const [filterCompanyId, setFilterCompanyId] = useState('');

  /* ── Active tab ── */
  const [activeTab, setActiveTab] = useState<'establishments' | 'settings' | 'erp'>('establishments');

  /* ── FNE Settings (per-company API config) ── */
  const [settingsCompanyId, setSettingsCompanyId] = useState('');
  const { data: fneSetting, isLoading: settingLoading } = useFneSetting(settingsCompanyId);
  const upsertSetting = useUpsertFneSetting();
  const [settingsForm, setSettingsForm] = useState({
    apiUrl: 'http://54.247.95.108/ws',
    apiKey: '',
    nif: '',
    maxRetries: 3,
    journalSales: 'VF',
    journalCash: 'CA',
    regimeImposition: '',
    centreImpots: '',
    bankRef: '',
    defaultFooter: '',
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  /* ── ERP Sage Settings ── */
  const [erpCompanyId, setErpCompanyId] = useState('');
  const { data: erpSetting, isLoading: erpLoading } = useErpSetting(erpCompanyId);
  const upsertErp = useUpsertErpSetting();
  const testErpConn = useTestErpConnection();
  const [erpSaved, setErpSaved] = useState(false);
  const [erpTestResult, setErpTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [erpForm, setErpForm] = useState({
    erpName: 'sage',
    apiUrl: '',
    accessToken: '',
    queueName: 'QTask',
    processusClass: 'TProcessusImportEcritureFA',
    processusMethod: 'ExecuterAutomate',
    parametersClass: 'TParametreImportEcriture',
    parametersCode: 'GenerationAPI_Tresorerie',
    defaultJournalCode: 'VF',
    defaultPieceType: 'FA',
    autoPostOnCertify: false,
    autoPostOnClosing: false,
    certifyAfterAccounting: false,
    isActive: true,
    poQueueName: 'QTask',
    poProcessusClass: 'TProcessusImportContrat',
    poProcessusMethod: 'ExecuterAutomate',
    poParametersClass: 'TParametreImportContrat',
    poParametersCode: 'GenerationAPI_CommandeAchat',
    autoPostPurchaseOrders: true,
  });

  // Sync ERP form when data is loaded
  useEffect(() => {
    if (erpSetting) {
      setErpForm({
        erpName: erpSetting.erpName ?? 'sage',
        apiUrl: erpSetting.apiUrl,
        accessToken: erpSetting.accessToken,
        queueName: erpSetting.queueName ?? 'QTask',
        processusClass: erpSetting.processusClass ?? 'TProcessusImportEcritureFA',
        processusMethod: erpSetting.processusMethod ?? 'ExecuterAutomate',
        parametersClass: erpSetting.parametersClass ?? 'TParametreImportEcriture',
        parametersCode: erpSetting.parametersCode ?? 'GenerationAPI_Tresorerie',
        defaultJournalCode: erpSetting.defaultJournalCode ?? 'VF',
        defaultPieceType: erpSetting.defaultPieceType ?? 'FA',
        autoPostOnCertify: erpSetting.autoPostOnCertify,
        autoPostOnClosing: erpSetting.autoPostOnClosing,
        certifyAfterAccounting: erpSetting.certifyAfterAccounting,
        isActive: erpSetting.isActive,
        poQueueName: erpSetting.poQueueName ?? 'QTask',
        poProcessusClass: erpSetting.poProcessusClass ?? 'TProcessusImportContrat',
        poProcessusMethod: erpSetting.poProcessusMethod ?? 'ExecuterAutomate',
        poParametersClass: erpSetting.poParametersClass ?? 'TParametreImportContrat',
        poParametersCode: erpSetting.poParametersCode ?? 'GenerationAPI_CommandeAchat',
        autoPostPurchaseOrders: erpSetting.autoPostPurchaseOrders,
      });
    } else if (!erpLoading && erpCompanyId) {
      setErpForm({
        erpName: 'sage',
        apiUrl: '',
        accessToken: '',
        queueName: 'QTask',
        processusClass: 'TProcessusImportEcritureFA',
        processusMethod: 'ExecuterAutomate',
        parametersClass: 'TParametreImportEcriture',
        parametersCode: 'GenerationAPI_Tresorerie',
        defaultJournalCode: 'VF',
        defaultPieceType: 'FA',
        autoPostOnCertify: false,
        autoPostOnClosing: false,
        certifyAfterAccounting: false,
        isActive: true,
        poQueueName: 'QTask',
        poProcessusClass: 'TProcessusImportContrat',
        poProcessusMethod: 'ExecuterAutomate',
        poParametersClass: 'TParametreImportContrat',
        poParametersCode: 'GenerationAPI_CommandeAchat',
        autoPostPurchaseOrders: true,
      });
    }
  }, [erpSetting, erpLoading, erpCompanyId]);

  // Sync form when data is loaded
  useEffect(() => {
    if (fneSetting) {
      setSettingsForm({
        apiUrl: fneSetting.apiUrl,
        apiKey: fneSetting.apiKey,
        nif: fneSetting.nif ?? '',
        maxRetries: fneSetting.maxRetries,
        journalSales: fneSetting.journalSales ?? 'VF',
        journalCash: fneSetting.journalCash ?? 'CA',
        regimeImposition: fneSetting.regimeImposition ?? '',
        centreImpots: fneSetting.centreImpots ?? '',
        bankRef: fneSetting.bankRef ?? '',
        defaultFooter: fneSetting.defaultFooter ?? '',
      });
    } else if (!settingLoading && settingsCompanyId) {
      setSettingsForm({
        apiUrl: 'http://54.247.95.108/ws',
        apiKey: '',
        nif: '',
        maxRetries: 3,
        journalSales: 'VF',
        journalCash: 'CA',
        regimeImposition: '',
        centreImpots: '',
        bankRef: '',
        defaultFooter: '',
      });
    }
  }, [fneSetting, settingLoading, settingsCompanyId]);

  /* ── Selected establishment (master-detail) ── */
  const [selectedEst, setSelectedEst] = useState<FneEstablishmentRecord | null>(null);

  /* ── Establishment hooks ── */
  const { data: estData, isLoading: estLoading } = useFneEstablishments({
    search: selectedEst ? '' : search,
    perPage: 100,
    ...(filterCompanyId && !selectedEst ? { companyId: filterCompanyId } : {}),
  });
  const createEst = useCreateFneEstablishment();
  const updateEst = useUpdateFneEstablishment();
  const deleteEst = useDeleteFneEstablishment();

  /* ── POS hooks (filtered by selected establishment) ── */
  const { data: posData, isLoading: posLoading } = useFnePointsOfSale({
    search: selectedEst ? search : '',
    perPage: 100,
    establishmentId: selectedEst?.id,
  });
  const createPos = useCreateFnePointOfSale();
  const updatePos = useUpdateFnePointOfSale();
  const deletePos = useDeleteFnePointOfSale();

  /* ── Modal state ── */
  const [showModal, setShowModal] = useState(false);
  const [modalTarget, setModalTarget] = useState<'est' | 'pos'>('est');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>(defaultForm);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'est' | 'pos' } | null>(
    null,
  );

  const estList = estData?.data ?? [];
  const posList = posData?.data ?? [];

  /* ── Open modals ── */
  const openCreateEst = () => {
    setModalTarget('est');
    setEditId(null);
    setForm({ ...defaultForm, companyId: filterCompanyId });
    setShowModal(true);
  };

  const openEditEst = (item: FneEstablishmentRecord) => {
    setModalTarget('est');
    setEditId(item.id);
    setForm({
      name: item.name,
      address: item.address ?? '',
      isActive: item.isActive,
      companyId: item.companyId,
    });
    setShowModal(true);
  };

  const openCreatePos = () => {
    setModalTarget('pos');
    setEditId(null);
    setForm({ ...defaultForm, companyId: '' });
    setShowModal(true);
  };

  const openEditPos = (item: FnePointOfSaleRecord) => {
    setModalTarget('pos');
    setEditId(item.id);
    setForm({
      name: item.name,
      address: item.address ?? '',
      isActive: item.isActive,
      companyId: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (modalTarget === 'est') {
      if (editId) {
        await updateEst.mutateAsync({
          id: editId,
          payload: { name: form.name, address: form.address || undefined, isActive: form.isActive },
        });
      } else {
        await createEst.mutateAsync({
          name: form.name,
          address: form.address || undefined,
          companyId: form.companyId,
        });
      }
    } else {
      if (!selectedEst) return;
      if (editId) {
        await updatePos.mutateAsync({
          id: editId,
          payload: { name: form.name, address: form.address || undefined, isActive: form.isActive },
        });
      } else {
        await createPos.mutateAsync({
          name: form.name,
          address: form.address || undefined,
          establishmentId: selectedEst.id,
        });
      }
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'est') {
      await deleteEst.mutateAsync(confirmDelete.id);
      if (selectedEst?.id === confirmDelete.id) setSelectedEst(null);
    } else {
      await deletePos.mutateAsync(confirmDelete.id);
    }
    setConfirmDelete(null);
  };

  const isPending =
    createPos.isPending || updatePos.isPending || createEst.isPending || updateEst.isPending;

  const modalLabel =
    modalTarget === 'est'
      ? t('admin.fneConfig.establishment', 'établissement')
      : t('admin.fneConfig.pointOfSale', 'point de vente');

  /* ── Render POS list for selected establishment ── */
  const renderPosView = () => (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedEst(null);
              setSearch('');
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{selectedEst!.name}</h1>
            <p className="text-sm text-gray-500">
              {t('admin.fneConfig.posOfEstablishment', 'Points de vente de cet établissement')}
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={openCreatePos}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.fneConfig.addPos', 'Ajouter un point de vente')}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.fneConfig.search', 'Rechercher...')}
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
        />
      </div>

      {/* POS list */}
      {posLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading', 'Chargement...')}</p>
      ) : posList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16">
          <Store className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            {search
              ? t('admin.fneConfig.noResults', 'Aucun résultat')
              : t('admin.fneConfig.emptyPos', 'Aucun point de vente pour cet établissement')}
          </p>
          {!search && (
            <button className="btn-secondary mt-4" onClick={openCreatePos}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.fneConfig.addPos', 'Ajouter un point de vente')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posList.map((item) => (
            <div
              key={item.id}
              className={cn(
                'group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
                !item.isActive && 'opacity-60',
              )}
            >
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-all group-hover:opacity-100">
                <button
                  onClick={() => openEditPos(item)}
                  className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete({ id: item.id, type: 'pos' })}
                  className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 text-white text-sm font-bold">
                  <Store className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{item.name}</h3>
                  <StatusBadge
                    active={item.isActive}
                    label={item.isActive ? t('common.active', 'Actif') : t('common.inactive', 'Inactif')}
                  />
                </div>
              </div>
              {item.address && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  <span className="truncate">{item.address}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Render establishment content (search + cards) ── */
  const renderEstContent = () => (
    <>
      {/* Search + company filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.fneConfig.search', 'Rechercher...')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
          />
        </div>
        <div className="relative max-w-xs">
          <select
            value={filterCompanyId}
            onChange={(e) => setFilterCompanyId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-3.5 pr-9 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
          >
            <option value="">{t('admin.fneConfig.allCompanies', 'Toutes les sociétés')}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>
      {estLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading', 'Chargement...')}</p>
      ) : estList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16">
          <Building2 className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            {search
              ? t('admin.fneConfig.noResults', 'Aucun résultat')
              : t('admin.fneConfig.emptyEst', 'Aucun établissement configuré')}
          </p>
          {!search && (
            <button className="btn-secondary mt-4" onClick={openCreateEst}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.fneConfig.addEst', 'Ajouter un établissement')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {estList.map((item) => (
            <div
              key={item.id}
              className={cn(
                'group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md cursor-pointer',
                !item.isActive && 'opacity-60',
              )}
              onClick={() => {
                setSelectedEst(item);
                setSearch('');
              }}
            >
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-all group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditEst(item);
                  }}
                  className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete({ id: item.id, type: 'est' });
                  }}
                  className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white text-sm font-bold">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{item.name}</h3>
                  <StatusBadge
                    active={item.isActive}
                    label={item.isActive ? t('common.active', 'Actif') : t('common.inactive', 'Inactif')}
                  />
                </div>
              </div>
              {item.address && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  <span className="truncate">{item.address}</span>
                </div>
              )}
              {(() => {
                const company = companies.find((c) => c.id === item.companyId);
                return company ? (
                  <div className="mt-1 text-xs text-gray-400 truncate">{company.name}</div>
                ) : null;
              })()}
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-gold">
                <Store className="h-3.5 w-3.5" />
                {t('admin.fneConfig.viewPos', 'Voir les points de vente')}
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  /* ── Render settings view ── */
  const handleSaveSettings = async () => {
    if (!settingsCompanyId) return;
    await upsertSetting.mutateAsync({
      companyId: settingsCompanyId,
      apiUrl: settingsForm.apiUrl || undefined,
      apiKey: settingsForm.apiKey,
      nif: settingsForm.nif || undefined,
      maxRetries: settingsForm.maxRetries,
      journalSales: settingsForm.journalSales || undefined,
      journalCash: settingsForm.journalCash || undefined,
      regimeImposition: settingsForm.regimeImposition || undefined,
      centreImpots: settingsForm.centreImpots || undefined,
      bankRef: settingsForm.bankRef || undefined,
      defaultFooter: settingsForm.defaultFooter || undefined,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const renderSettingsView = () => (
    <div className="space-y-6">
      {/* Company selector */}
      <div className="space-y-1.5 max-w-sm">
        <label className="block text-sm font-medium text-gray-700">
          {t('admin.fneConfig.company', 'Société')} *
        </label>
        <div className="relative">
          <select
            value={settingsCompanyId}
            onChange={(e) => setSettingsCompanyId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-3.5 pr-9 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
          >
            <option value="">
              {t('admin.fneConfig.selectCompany', 'Sélectionner une société...')}
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {!settingsCompanyId ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16">
          <Settings className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            {t(
              'admin.fneConfig.selectCompanyFirst',
              'Sélectionnez une société pour configurer les paramètres FNE',
            )}
          </p>
        </div>
      ) : settingLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading', 'Chargement...')}</p>
      ) : (
        <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {t('admin.fneConfig.apiSettings', 'Paramètres API de certification')}
              </h3>
              <p className="text-xs text-gray-500">
                {fneSetting
                  ? t(
                      'admin.fneConfig.settingsConfigured',
                      'Configuration existante — modifiez si nécessaire',
                    )
                  : t(
                      'admin.fneConfig.settingsNew',
                      'Aucune configuration — renseignez les paramètres',
                    )}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Globe className="h-4 w-4 text-gray-400" />
                {t('admin.fneConfig.apiUrl', "URL de l'API FNE")}
              </label>
              <input
                value={settingsForm.apiUrl}
                onChange={(e) => setSettingsForm((f) => ({ ...f, apiUrl: e.target.value }))}
                placeholder="http://54.247.95.108/ws"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Key className="h-4 w-4 text-gray-400" />
                {t('admin.fneConfig.apiKey', 'Token / Clé API')} *
              </label>
              <input
                type="password"
                value={settingsForm.apiKey}
                onChange={(e) => setSettingsForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="••••••••••••••••"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
              <p className="text-xs text-gray-400">
                {t(
                  'admin.fneConfig.apiKeyHint',
                  'Le token Bearer fourni par la plateforme FNE pour la certification des factures',
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Hash className="h-4 w-4 text-gray-400" />
                {t('admin.fneConfig.nif', "NIF (Numéro d'Identification Fiscale)")}
              </label>
              <input
                value={settingsForm.nif}
                onChange={(e) => setSettingsForm((f) => ({ ...f, nif: e.target.value }))}
                placeholder="Ex: 1234567A"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                {t('admin.fneConfig.maxRetries', 'Nombre de tentatives max')}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={settingsForm.maxRetries}
                onChange={(e) =>
                  setSettingsForm((f) => ({ ...f, maxRetries: parseInt(e.target.value) || 3 }))
                }
                className="w-32 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
            </div>

            {/* ── Journal codes ── */}
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                {t('admin.fneConfig.journalCodesTitle', 'Codes journaux comptables')}
              </h4>
              <p className="text-xs text-gray-400 mb-4">
                {t(
                  'admin.fneConfig.journalCodesHint',
                  'Codes utilisés lors de la génération des écritures comptables',
                )}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.fneConfig.journalSales', 'Journal de vente')}
                  </label>
                  <input
                    value={settingsForm.journalSales}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, journalSales: e.target.value.toUpperCase() }))
                    }
                    placeholder="VF"
                    maxLength={10}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                  <p className="text-xs text-gray-400">
                    {t('admin.fneConfig.journalSalesHint', 'Ex: VF (Ventes Facturées)')}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.fneConfig.journalCash', 'Journal de caisse')}
                  </label>
                  <input
                    value={settingsForm.journalCash}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, journalCash: e.target.value.toUpperCase() }))
                    }
                    placeholder="CA"
                    maxLength={10}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                  <p className="text-xs text-gray-400">
                    {t('admin.fneConfig.journalCashHint', 'Ex: CA (Caisse)')}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Infos fiscales (pour impression facture) ── */}
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                {t('admin.fneConfig.fiscalInfoTitle', 'Informations fiscales (impression)')}
              </h4>
              <p className="text-xs text-gray-400 mb-4">
                {t(
                  'admin.fneConfig.fiscalInfoHint',
                  "Ces informations apparaissent sur l'état imprimé de la facture FNE",
                )}
              </p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.fneConfig.regimeImposition', "Régime d'imposition")}
                  </label>
                  <input
                    value={settingsForm.regimeImposition}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, regimeImposition: e.target.value }))
                    }
                    placeholder="Ex: RNI, RSI, Microentreprise"
                    maxLength={100}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.fneConfig.centreImpots', 'Centre des impôts')}
                  </label>
                  <input
                    value={settingsForm.centreImpots}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, centreImpots: e.target.value }))
                    }
                    placeholder="Ex: 822 Recette des Grandes Entreprises"
                    maxLength={255}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.fneConfig.bankRef', 'Références bancaires')}
                  </label>
                  <input
                    value={settingsForm.bankRef}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, bankRef: e.target.value }))}
                    placeholder="Ex: BIAO CI - 01234567890"
                    maxLength={500}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.fneConfig.defaultFooter', 'Pied de page')}
                  </label>
                  <input
                    value={settingsForm.defaultFooter}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, defaultFooter: e.target.value }))
                    }
                    placeholder="Ex: Merci de votre confiance"
                    maxLength={500}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                  <p className="text-xs text-gray-400">
                    {t(
                      'admin.fneConfig.defaultFooterHint',
                      'Repris automatiquement dans le champ "Pied de page" à la création d\'une nouvelle facture',
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <button
                className="btn-primary"
                onClick={handleSaveSettings}
                disabled={!settingsForm.apiKey || upsertSetting.isPending}
              >
                {upsertSetting.isPending && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {fneSetting ? t('common.save', 'Enregistrer') : t('common.create', 'Créer')}
              </button>
              {settingsSaved && (
                <span className="text-sm text-[#166534] font-medium">
                  ✓ {t('admin.fneConfig.saved', 'Configuration enregistrée !')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ── ERP Sage settings handlers ── */
  const handleSaveErp = async () => {
    if (!erpCompanyId) return;
    await upsertErp.mutateAsync({
      companyId: erpCompanyId,
      erpName: erpForm.erpName,
      apiUrl: erpForm.apiUrl,
      accessToken: erpForm.accessToken,
      queueName: erpForm.queueName || undefined,
      processusClass: erpForm.processusClass || undefined,
      processusMethod: erpForm.processusMethod || undefined,
      parametersClass: erpForm.parametersClass || undefined,
      parametersCode: erpForm.parametersCode || undefined,
      defaultJournalCode: erpForm.defaultJournalCode || undefined,
      defaultPieceType: erpForm.defaultPieceType || undefined,
      autoPostOnCertify: erpForm.autoPostOnCertify,
      autoPostOnClosing: erpForm.autoPostOnClosing,
      certifyAfterAccounting: erpForm.certifyAfterAccounting,
      isActive: erpForm.isActive,
      poQueueName: erpForm.poQueueName || undefined,
      poProcessusClass: erpForm.poProcessusClass || undefined,
      poProcessusMethod: erpForm.poProcessusMethod || undefined,
      poParametersClass: erpForm.poParametersClass || undefined,
      poParametersCode: erpForm.poParametersCode || undefined,
      autoPostPurchaseOrders: erpForm.autoPostPurchaseOrders,
    });
    setErpSaved(true);
    setTimeout(() => setErpSaved(false), 3000);
  };

  const handleTestErp = async () => {
    if (!erpCompanyId) return;
    setErpTestResult(null);
    try {
      const res = await testErpConn.mutateAsync(erpCompanyId);
      setErpTestResult({ ok: res.reachable, msg: res.message });
    } catch {
      setErpTestResult({ ok: false, msg: 'Erreur de connexion' });
    }
    setTimeout(() => setErpTestResult(null), 5000);
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold';

  /* ── Render ERP Sage view ── */
  const renderErpView = () => (
    <div className="space-y-6">
      {/* Company selector */}
      <div className="space-y-1.5 max-w-sm">
        <label className="block text-sm font-medium text-gray-700">Société *</label>
        <div className="relative">
          <select
            value={erpCompanyId}
            onChange={(e) => setErpCompanyId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-3.5 pr-9 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
          >
            <option value="">Sélectionner une société...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {!erpCompanyId ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16">
          <Database className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            Sélectionnez une société pour configurer l&apos;intégration ERP Sage
          </p>
        </div>
      ) : erpLoading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* API Connection */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Connexion API Sage DCP</h3>
                <p className="text-xs text-gray-500">
                  {erpSetting
                    ? 'Configuration existante — modifiez si nécessaire'
                    : 'Aucune configuration — renseignez les paramètres'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Globe className="h-4 w-4 text-gray-400" />
                  URL de base de l&apos;API Sage *
                </label>
                <input
                  value={erpForm.apiUrl}
                  onChange={(e) => setErpForm((f) => ({ ...f, apiUrl: e.target.value }))}
                  placeholder="https://dcp-sage.fr:8084"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Key className="h-4 w-4 text-gray-400" />
                  Token d&apos;accès (Access Token) *
                </label>
                <input
                  type="password"
                  value={erpForm.accessToken}
                  onChange={(e) => setErpForm((f) => ({ ...f, accessToken: e.target.value }))}
                  placeholder="••••••••••••••••"
                  className={inputClass}
                />
                <p className="text-xs text-gray-400">
                  Le token AuthToken / Bearer fourni par Sage DCP
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nom de file (Queue)</label>
                  <input
                    value={erpForm.queueName}
                    onChange={(e) => setErpForm((f) => ({ ...f, queueName: e.target.value }))}
                    placeholder="QTask"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Code journal par défaut</label>
                  <input
                    value={erpForm.defaultJournalCode}
                    onChange={(e) => setErpForm((f) => ({ ...f, defaultJournalCode: e.target.value }))}
                    placeholder="VF"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Classe processus</label>
                  <input
                    value={erpForm.processusClass}
                    onChange={(e) => setErpForm((f) => ({ ...f, processusClass: e.target.value }))}
                    placeholder="TProcessusImportEcritureFA"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Méthode processus</label>
                  <input
                    value={erpForm.processusMethod}
                    onChange={(e) => setErpForm((f) => ({ ...f, processusMethod: e.target.value }))}
                    placeholder="ExecuterAutomate"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Classe paramètres</label>
                  <input
                    value={erpForm.parametersClass}
                    onChange={(e) => setErpForm((f) => ({ ...f, parametersClass: e.target.value }))}
                    placeholder="TParametreImportEcriture"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Code paramètres</label>
                  <input
                    value={erpForm.parametersCode}
                    onChange={(e) => setErpForm((f) => ({ ...f, parametersCode: e.target.value }))}
                    placeholder="GenerationAPI_Tresorerie"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Type de pièce par défaut</label>
                <input
                  value={erpForm.defaultPieceType}
                  onChange={(e) => setErpForm((f) => ({ ...f, defaultPieceType: e.target.value }))}
                  placeholder="FA"
                  maxLength={50}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Purchase orders (e-DA) processus config */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Bons de commande (e-DA)</h3>
                <p className="text-xs text-gray-500">
                  Processus Sage dédié à l&apos;envoi des bons de commande — utilise la même URL et le
                  même token que ci-dessus
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nom de file (Queue)</label>
                  <input
                    value={erpForm.poQueueName}
                    onChange={(e) => setErpForm((f) => ({ ...f, poQueueName: e.target.value }))}
                    placeholder="QTask"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Code paramètres</label>
                  <input
                    value={erpForm.poParametersCode}
                    onChange={(e) => setErpForm((f) => ({ ...f, poParametersCode: e.target.value }))}
                    placeholder="GenerationAPI_CommandeAchat"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Classe processus</label>
                  <input
                    value={erpForm.poProcessusClass}
                    onChange={(e) => setErpForm((f) => ({ ...f, poProcessusClass: e.target.value }))}
                    placeholder="TProcessusImportContrat"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Méthode processus</label>
                  <input
                    value={erpForm.poProcessusMethod}
                    onChange={(e) => setErpForm((f) => ({ ...f, poProcessusMethod: e.target.value }))}
                    placeholder="ExecuterAutomate"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Classe paramètres</label>
                <input
                  value={erpForm.poParametersClass}
                  onChange={(e) => setErpForm((f) => ({ ...f, poParametersClass: e.target.value }))}
                  placeholder="TParametreImportContrat"
                  className={inputClass}
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={erpForm.autoPostPurchaseOrders}
                  onChange={(e) => setErpForm((f) => ({ ...f, autoPostPurchaseOrders: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Envoi automatique à la génération du bon de commande
                  </span>
                  <p className="text-xs text-gray-500">
                    Envoie le bon de commande à Sage dès que l&apos;acheteur renseigne le fournisseur et
                    valide la demande d&apos;achat (étape &quot;Proposition d&apos;achat&quot;)
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Automation options */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Options d&apos;automatisation</h3>
                <p className="text-xs text-gray-500">
                  Configurez quand les écritures sont envoyées automatiquement à Sage
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={erpForm.autoPostOnCertify}
                  onChange={(e) => setErpForm((f) => ({ ...f, autoPostOnCertify: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Comptabilisation automatique à la certification
                  </span>
                  <p className="text-xs text-gray-500">
                    Génère et envoie les écritures comptables vers Sage dès qu&apos;une facture est certifiée FNE
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={erpForm.autoPostOnClosing}
                  onChange={(e) => setErpForm((f) => ({ ...f, autoPostOnClosing: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Comptabilisation automatique à la clôture de caisse
                  </span>
                  <p className="text-xs text-gray-500">
                    Envoie toutes les écritures non comptabilisées vers Sage lors de la clôture de caisse
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={erpForm.certifyAfterAccounting}
                  onChange={(e) => setErpForm((f) => ({ ...f, certifyAfterAccounting: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Certifier après génération des écritures
                  </span>
                  <p className="text-xs text-gray-500">
                    Option pour certifier la facture FNE après la génération des écritures comptables (au lieu d&apos;avant)
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={erpForm.isActive}
                  onChange={(e) => setErpForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Intégration active</span>
                  <p className="text-xs text-gray-500">
                    Activer / désactiver l&apos;intégration ERP Sage sans supprimer la configuration
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              className="btn-primary"
              onClick={handleSaveErp}
              disabled={!erpForm.apiUrl || !erpForm.accessToken || upsertErp.isPending}
            >
              {upsertErp.isPending && (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {erpSetting ? 'Enregistrer' : 'Créer la configuration'}
            </button>
            <button
              className="btn-secondary"
              onClick={handleTestErp}
              disabled={!erpSetting || testErpConn.isPending}
            >
              {testErpConn.isPending ? (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <TestTube2 className="mr-2 h-4 w-4" />
              )}
              Tester la connexion
            </button>
            {erpSaved && (
              <span className="flex items-center gap-1 text-sm text-[#166534] font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Configuration ERP enregistrée !
              </span>
            )}
            {erpTestResult && (
              <span
                className={cn(
                  'flex items-center gap-1 text-sm font-medium',
                  erpTestResult.ok ? 'text-[#166534]' : 'text-[#991b1b]',
                )}
              >
                {erpTestResult.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {erpTestResult.msg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {selectedEst ? (
        renderPosView()
      ) : (
        <div className="space-y-6">
          {/* Page header + tabs */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('admin.fneConfig.title', 'Configuration FNE')}
              </h1>
              <p className="text-sm text-gray-500">
                {t(
                  'admin.fneConfig.subtitle',
                  'Gérez les établissements, points de vente et paramètres API',
                )}
              </p>
            </div>
            {activeTab === 'establishments' && (
              <button className="btn-primary" onClick={openCreateEst}>
                <Plus className="mr-2 h-4 w-4" />
                {t('admin.fneConfig.addEst', 'Ajouter un établissement')}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setActiveTab('establishments')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'establishments'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Building2 className="h-4 w-4" />
              {t('admin.fneConfig.tabEstablishments', 'Établissements')}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'settings'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Settings className="h-4 w-4" />
              {t('admin.fneConfig.tabSettings', 'Paramètres API')}
            </button>
            <button
              onClick={() => setActiveTab('erp')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'erp'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Database className="h-4 w-4" />
              ERP Sage
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'settings'
            ? renderSettingsView()
            : activeTab === 'erp'
              ? renderErpView()
              : renderEstContent()}
        </div>
      )}

      {/* Create / Edit Modal */}
      <ModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={
          editId
            ? `${t('common.edit', 'Modifier')} ${modalLabel}`
            : `${t('admin.fneConfig.add', 'Ajouter')} ${modalLabel}`
        }
        size="md"
      >
        <div className="space-y-4">
          {/* Company selector (only for establishment) */}
          {modalTarget === 'est' && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                {t('admin.fneConfig.company', 'Société')} *
              </label>
              <div className="relative">
                <select
                  value={form.companyId}
                  onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                  disabled={!!editId}
                  className={cn(
                    'w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-3.5 pr-9 text-sm shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold',
                    !!editId && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <option value="">
                    {t('admin.fneConfig.selectCompany', 'Sélectionner une société...')}
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="label">{t('admin.fneConfig.name', 'Nom')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="label">{t('admin.fneConfig.address', 'Adresse')}</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          {editId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
              />
              {t('common.active', 'Actif')}
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel', 'Annuler')}
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={
                !form.name || (modalTarget === 'est' && !editId && !form.companyId) || isPending
              }
            >
              {isPending && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {editId ? t('common.save', 'Enregistrer') : t('common.create', 'Créer')}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Delete confirmation Modal */}
      <ModalShell
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('admin.fneConfig.confirmDeleteTitle', 'Confirmer la suppression')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {confirmDelete?.type === 'est'
              ? t(
                  'admin.fneConfig.confirmDeleteEst',
                  'Supprimer cet établissement désactivera aussi tous ses points de vente.',
                )
              : t(
                  'admin.fneConfig.confirmDeleteMessage',
                  'Êtes-vous sûr de vouloir supprimer cet élément ?',
                )}
          </p>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
              {t('common.cancel', 'Annuler')}
            </button>
            <button
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-600 disabled:pointer-events-none disabled:opacity-50 inline-flex items-center gap-2"
              onClick={handleDelete}
              disabled={deletePos.isPending || deleteEst.isPending}
            >
              {(deletePos.isPending || deleteEst.isPending) && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {t('common.delete', 'Supprimer')}
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
