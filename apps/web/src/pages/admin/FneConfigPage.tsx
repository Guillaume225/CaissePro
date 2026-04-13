import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Building2, Plus, Pencil, Trash2, MapPin, Search, ChevronRight, ArrowLeft, ChevronDown, Settings, Key, Globe, Hash } from 'lucide-react';
import { Button, Input, Modal, Badge } from '@/components/ui';
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
import type { FnePointOfSaleRecord, FneEstablishmentRecord } from '@/types/fne';

interface ItemForm {
  name: string;
  address: string;
  isActive: boolean;
  companyId: string;
}

const defaultForm: ItemForm = { name: '', address: '', isActive: true, companyId: '' };

export default function FneConfigPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  /* ── Company filter ── */
  const { data: companies = [] } = useCompanies();
  const [filterCompanyId, setFilterCompanyId] = useState('');

  /* ── Active tab ── */
  const [activeTab, setActiveTab] = useState<'establishments' | 'settings'>('establishments');

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
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

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
      });
    } else if (!settingLoading && settingsCompanyId) {
      setSettingsForm({ apiUrl: 'http://54.247.95.108/ws', apiKey: '', nif: '', maxRetries: 3, journalSales: 'VF', journalCash: 'CA', regimeImposition: '', centreImpots: '', bankRef: '' });
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
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'est' | 'pos' } | null>(null);

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
    setForm({ name: item.name, address: item.address ?? '', isActive: item.isActive, companyId: item.companyId });
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
    setForm({ name: item.name, address: item.address ?? '', isActive: item.isActive, companyId: '' });
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

  const isPending = createPos.isPending || updatePos.isPending || createEst.isPending || updateEst.isPending;

  const modalLabel = modalTarget === 'est'
    ? t('admin.fneConfig.establishment', 'établissement')
    : t('admin.fneConfig.pointOfSale', 'point de vente');

  /* ── Render POS list for selected establishment ── */
  const renderPosView = () => (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedEst(null); setSearch(''); }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedEst!.name}
            </h1>
            <p className="text-sm text-gray-500">
              {t('admin.fneConfig.posOfEstablishment', 'Points de vente de cet établissement')}
            </p>
          </div>
        </div>
        <Button onClick={openCreatePos}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.fneConfig.addPos', 'Ajouter un point de vente')}
        </Button>
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
            <Button onClick={openCreatePos} className="mt-4" variant="ghost">
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.fneConfig.addPos', 'Ajouter un point de vente')}
            </Button>
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
                <button onClick={() => openEditPos(item)} className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setConfirmDelete({ id: item.id, type: 'pos' })} className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 text-white text-sm font-bold">
                  <Store className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{item.name}</h3>
                  <Badge variant={item.isActive ? 'success' : 'outline'} className="mt-0.5 text-[10px]">
                    {item.isActive ? t('common.active', 'Actif') : t('common.inactive', 'Inactif')}
                  </Badge>
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
              <option key={c.id} value={c.id}>{c.name}</option>
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
            <Button onClick={openCreateEst} className="mt-4" variant="ghost">
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.fneConfig.addEst', 'Ajouter un établissement')}
            </Button>
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
              onClick={() => { setSelectedEst(item); setSearch(''); }}
            >
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-all group-hover:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditEst(item); }}
                  className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: item.id, type: 'est' }); }}
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
                  <Badge variant={item.isActive ? 'success' : 'outline'} className="mt-0.5 text-[10px]">
                    {item.isActive ? t('common.active', 'Actif') : t('common.inactive', 'Inactif')}
                  </Badge>
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
                  <div className="mt-1 text-xs text-gray-400 truncate">
                    {company.name}
                  </div>
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
            <option value="">{t('admin.fneConfig.selectCompany', 'Sélectionner une société...')}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {!settingsCompanyId ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16">
          <Settings className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            {t('admin.fneConfig.selectCompanyFirst', 'Sélectionnez une société pour configurer les paramètres FNE')}
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
                  ? t('admin.fneConfig.settingsConfigured', 'Configuration existante — modifiez si nécessaire')
                  : t('admin.fneConfig.settingsNew', 'Aucune configuration — renseignez les paramètres')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Globe className="h-4 w-4 text-gray-400" />
                {t('admin.fneConfig.apiUrl', 'URL de l\'API FNE')}
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
                {t('admin.fneConfig.apiKeyHint', 'Le token Bearer fourni par la plateforme FNE pour la certification des factures')}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Hash className="h-4 w-4 text-gray-400" />
                {t('admin.fneConfig.nif', 'NIF (Numéro d\'Identification Fiscale)')}
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
                onChange={(e) => setSettingsForm((f) => ({ ...f, maxRetries: parseInt(e.target.value) || 3 }))}
                className="w-32 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
            </div>

            {/* ── Journal codes ── */}
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                {t('admin.fneConfig.journalCodesTitle', 'Codes journaux comptables')}
              </h4>
              <p className="text-xs text-gray-400 mb-4">
                {t('admin.fneConfig.journalCodesHint', 'Codes utilisés lors de la génération des écritures comptables')}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.fneConfig.journalSales', 'Journal de vente')}
                  </label>
                  <input
                    value={settingsForm.journalSales}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, journalSales: e.target.value.toUpperCase() }))}
                    placeholder="VF"
                    maxLength={10}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                  <p className="text-xs text-gray-400">{t('admin.fneConfig.journalSalesHint', 'Ex: VF (Ventes Facturées)')}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.fneConfig.journalCash', 'Journal de caisse')}
                  </label>
                  <input
                    value={settingsForm.journalCash}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, journalCash: e.target.value.toUpperCase() }))}
                    placeholder="CA"
                    maxLength={10}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                  <p className="text-xs text-gray-400">{t('admin.fneConfig.journalCashHint', 'Ex: CA (Caisse)')}</p>
                </div>
              </div>
            </div>

            {/* ── Infos fiscales (pour impression facture) ── */}
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                {t('admin.fneConfig.fiscalInfoTitle', 'Informations fiscales (impression)')}
              </h4>
              <p className="text-xs text-gray-400 mb-4">
                {t('admin.fneConfig.fiscalInfoHint', 'Ces informations apparaissent sur l\'état imprimé de la facture FNE')}
              </p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.fneConfig.regimeImposition', 'Régime d\'imposition')}
                  </label>
                  <input
                    value={settingsForm.regimeImposition}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, regimeImposition: e.target.value }))}
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
                    onChange={(e) => setSettingsForm((f) => ({ ...f, centreImpots: e.target.value }))}
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
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <Button
                onClick={handleSaveSettings}
                disabled={!settingsForm.apiKey}
                loading={upsertSetting.isPending}
              >
                {fneSetting
                  ? t('common.save', 'Enregistrer')
                  : t('common.create', 'Créer')}
              </Button>
              {settingsSaved && (
                <span className="text-sm text-green-600 font-medium">
                  {t('admin.fneConfig.saved', 'Configuration enregistrée !')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {selectedEst ? renderPosView() : (
        <div className="space-y-6">
          {/* Page header + tabs */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('admin.fneConfig.title', 'Configuration FNE')}
              </h1>
              <p className="text-sm text-gray-500">
                {t('admin.fneConfig.subtitle', 'Gérez les établissements, points de vente et paramètres API')}
              </p>
            </div>
            {activeTab === 'establishments' && (
              <Button onClick={openCreateEst}>
                <Plus className="mr-2 h-4 w-4" />
                {t('admin.fneConfig.addEst', 'Ajouter un établissement')}
              </Button>
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
          </div>

          {/* Tab content */}
          {activeTab === 'settings' ? renderSettingsView() : renderEstContent()}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId
          ? `${t('common.edit', 'Modifier')} ${modalLabel}`
          : `${t('admin.fneConfig.add', 'Ajouter')} ${modalLabel}`}
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
                  <option value="">{t('admin.fneConfig.selectCompany', 'Sélectionner une société...')}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          )}
          <Input
            label={t('admin.fneConfig.name', 'Nom')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label={t('admin.fneConfig.address', 'Adresse')}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
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
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button onClick={handleSubmit} disabled={!form.name || (modalTarget === 'est' && !editId && !form.companyId)} loading={isPending}>
              {editId ? t('common.save', 'Enregistrer') : t('common.create', 'Créer')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation Modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('admin.fneConfig.confirmDeleteTitle', 'Confirmer la suppression')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {confirmDelete?.type === 'est'
              ? t('admin.fneConfig.confirmDeleteEst', 'Supprimer cet établissement désactivera aussi tous ses points de vente.')
              : t('admin.fneConfig.confirmDeleteMessage', 'Êtes-vous sûr de vouloir supprimer cet élément ?')}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deletePos.isPending || deleteEst.isPending}
            >
              {t('common.delete', 'Supprimer')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
