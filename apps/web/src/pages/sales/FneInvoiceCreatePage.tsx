import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Building2,
  User,
  ShoppingCart,
  CreditCard,
  AlertCircle,
  Loader2,
  FileText,
  Save,
  Users,
  Search,
  ChevronDown,
  X,
  Package,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useCreateFneInvoice, useUpdateFneInvoice } from '@/hooks/useFneInvoices';
import { useFneClients } from '@/hooks/useFneClients';
import { useFneProducts } from '@/hooks/useFneProducts';
import { useFnePointsOfSale } from '@/hooks/useFnePointsOfSale';
import { useFneEstablishments } from '@/hooks/useFneEstablishments';
import { formatCFA } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  FneTemplate,
  FnePaymentMethod,
  FneInvoiceType,
  FneClientRecord,
  FneProductRecord,
  FnePointOfSaleRecord,
  FneEstablishmentRecord,
  FneInvoice,
  CreateFneInvoiceItemPayload,
} from '@/types/fne';

/* ═══════════════ CONSTANTS ═══════════════════════════════ */

const TEMPLATES: { value: FneTemplate; label: string; desc: string }[] = [
  { value: 'B2C', label: 'B2C', desc: 'Particulier' },
  { value: 'B2B', label: 'B2B', desc: 'Entreprise' },
  { value: 'B2G', label: 'B2G', desc: 'Gouvernement' },
  { value: 'B2F', label: 'B2F', desc: 'Étranger' },
];

const PAYMENT_METHODS: { value: FnePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Espèces' },
  { value: 'card', label: 'Carte bancaire' },
  { value: 'check', label: 'Chèque' },
  { value: 'mobile-money', label: 'Mobile Money' },
  { value: 'transfer', label: 'Virement' },
  { value: 'deferred', label: 'Paiement différé' },
];

const INVOICE_TYPES: { value: FneInvoiceType; label: string; desc: string }[] = [
  { value: 'sale', label: 'Vente', desc: 'Facture de vente' },
  { value: 'estimate', label: 'Devis', desc: 'Devis / Proforma' },
];

const TAX_OPTIONS = [
  { value: 'TVA', label: 'TVA 18%' },
  { value: 'TVAB', label: 'TVAB 9%' },
  { value: 'TVAC', label: 'TVAC 0% (conv.)' },
  { value: 'TVAD', label: 'TVAD 0% (légal)' },
];

const TAX_RATES: Record<string, number> = { TVA: 18, TVAB: 9, TVAC: 0, TVAD: 0 };

const STEPS = [
  { icon: FileText, label: 'Type' },
  { icon: User, label: 'Client' },
  { icon: Building2, label: 'Établissement' },
  { icon: ShoppingCart, label: 'Articles' },
  { icon: CreditCard, label: 'Paiement' },
];

/* ═══════════════ LINE ITEM ══════════════════════════════ */

interface LineItem extends CreateFneInvoiceItemPayload {
  _key: string;
  lineTotalHt: number;
  lineVat: number;
  lineTotalTtc: number;
}

function emptyLine(): LineItem {
  return {
    _key: crypto.randomUUID(),
    description: '',
    quantity: 1,
    amount: 0,
    discount: 0,
    measurementUnit: '',
    taxes: ['TVA'],
    customTaxes: [],
    lineTotalHt: 0,
    lineVat: 0,
    lineTotalTtc: 0,
  };
}

function recalcLine(l: LineItem): LineItem {
  const ht = l.quantity * l.amount * (1 - (l.discount ?? 0) / 100);
  let rate = 0;
  for (const t of l.taxes) rate += TAX_RATES[t] ?? 0;
  for (const ct of l.customTaxes ?? []) rate += ct.amount;
  const vat = ht * (rate / 100);
  return { ...l, lineTotalHt: Math.round(ht * 100) / 100, lineVat: Math.round(vat * 100) / 100, lineTotalTtc: Math.round((ht + vat) * 100) / 100 };
}

/* ═══════════════ COMPONENT ═════════════════════════════ */

interface FneInvoiceFormPageProps {
  editInvoice?: FneInvoice;
}

export default function FneInvoiceCreatePage({ editInvoice }: FneInvoiceFormPageProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateFneInvoice();
  const updateMutation = useUpdateFneInvoice();
  const isEditMode = !!editInvoice;

  /* ── Step state ── */
  const [step, setStep] = useState(0);

  /* ── Step 1: Client ── */
  const [template, setTemplate] = useState<FneTemplate>(editInvoice?.template ?? 'B2C');
  const [invoiceType, setInvoiceType] = useState<FneInvoiceType>(
    editInvoice?.invoiceType === 'estimate' ? 'estimate' : editInvoice?.invoiceType === 'sale' ? 'sale' : 'sale',
  );
  const [clientCompanyName, setClientCompanyName] = useState(editInvoice?.clientCompanyName ?? '');
  const [clientPhone, setClientPhone] = useState(editInvoice?.clientPhone ?? '');
  const [clientEmail, setClientEmail] = useState(editInvoice?.clientEmail ?? '');
  const [clientNcc, setClientNcc] = useState(editInvoice?.clientNcc ?? '');
  const [clientSellerName, setClientSellerName] = useState(editInvoice?.clientSellerName ?? '');
  const [isRne, setIsRne] = useState(editInvoice?.isRne ?? false);
  const [rne, setRne] = useState(editInvoice?.rne ?? '');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  /* ── Combobox refs & click-outside ── */
  const comboRef = useRef<HTMLDivElement>(null);
  const comboSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (showClientDropdown && comboSearchRef.current) {
      comboSearchRef.current.focus();
    }
  }, [showClientDropdown]);

  /* ── Client search query ── */
  const { data: clientsData } = useFneClients({ search: clientSearch, perPage: 10 });
  const clientOptions = clientsData?.data ?? [];

  const selectClient = (client: FneClientRecord) => {
    setSelectedClientId(client.id);
    setClientCompanyName(client.companyName);
    setClientPhone(client.phone);
    setClientEmail(client.email);
    setClientNcc(client.ncc ?? '');
    setClientSellerName(client.sellerName ?? '');
    setClientSearch('');
    setShowClientDropdown(false);
  };

  const clearSelectedClient = () => {
    setSelectedClientId(null);
    setClientCompanyName('');
    setClientPhone('');
    setClientEmail('');
    setClientNcc('');
    setClientSellerName('');
    setClientSearch('');
  };

  /* ── Step 2: Establishment ── */
  const [pointOfSale, setPointOfSale] = useState(editInvoice?.pointOfSale ?? '');
  const [establishment, setEstablishment] = useState(editInvoice?.establishment ?? '');
  const [commercialMessage, setCommercialMessage] = useState(editInvoice?.commercialMessage ?? '');
  const [footer, setFooter] = useState(editInvoice?.footer ?? '');
  const [foreignCurrency, setForeignCurrency] = useState(editInvoice?.foreignCurrency ?? '');
  const [foreignCurrencyRate, setForeignCurrencyRate] = useState<number>(editInvoice?.foreignCurrencyRate ?? 0);

  /* ── Establishment combobox state (declared first so POS can filter by it) ── */
  const [estSearch, setEstSearch] = useState('');
  const [showEstDropdown, setShowEstDropdown] = useState(false);
  const [selectedEstId, setSelectedEstId] = useState<string | null>(null);
  const estDropdownRef = useRef<HTMLDivElement>(null);
  const estSearchRef = useRef<HTMLInputElement>(null);

  const { data: estData } = useFneEstablishments({ search: estSearch, perPage: 20 });
  const estOptions = estData?.data ?? [];

  useEffect(() => {
    function onClickOutsideEst(e: MouseEvent) {
      if (estDropdownRef.current && !estDropdownRef.current.contains(e.target as Node)) {
        setShowEstDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClickOutsideEst);
    return () => document.removeEventListener('mousedown', onClickOutsideEst);
  }, []);

  useEffect(() => {
    if (showEstDropdown && estSearchRef.current) estSearchRef.current.focus();
  }, [showEstDropdown]);

  /* ── POS combobox state (filtered by selected establishment) ── */
  const [posSearch, setPosSearch] = useState('');
  const [showPosDropdown, setShowPosDropdown] = useState(false);
  const [selectedPosId, setSelectedPosId] = useState<string | null>(null);
  const posDropdownRef = useRef<HTMLDivElement>(null);
  const posSearchRef = useRef<HTMLInputElement>(null);

  const { data: posData } = useFnePointsOfSale({ search: posSearch, perPage: 20, establishmentId: selectedEstId ?? undefined });
  const posOptions = posData?.data ?? [];

  useEffect(() => {
    function onClickOutsidePos(e: MouseEvent) {
      if (posDropdownRef.current && !posDropdownRef.current.contains(e.target as Node)) {
        setShowPosDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClickOutsidePos);
    return () => document.removeEventListener('mousedown', onClickOutsidePos);
  }, []);

  useEffect(() => {
    if (showPosDropdown && posSearchRef.current) posSearchRef.current.focus();
  }, [showPosDropdown]);

  const selectPos = (pos: FnePointOfSaleRecord) => {
    setSelectedPosId(pos.id);
    setPointOfSale(pos.name);
    setPosSearch('');
    setShowPosDropdown(false);
  };

  const clearPos = () => {
    setSelectedPosId(null);
    setPointOfSale('');
    setPosSearch('');
  };

  const selectEst = (est: FneEstablishmentRecord) => {
    setSelectedEstId(est.id);
    setEstablishment(est.name);
    setEstSearch('');
    setShowEstDropdown(false);
    // Reset POS when establishment changes
    setSelectedPosId(null);
    setPointOfSale('');
    setPosSearch('');
  };

  const clearEst = () => {
    setSelectedEstId(null);
    setEstablishment('');
    setEstSearch('');
    // Also clear POS
    setSelectedPosId(null);
    setPointOfSale('');
    setPosSearch('');
  };

  /* ── Step 3: Items ── */
  const [lines, setLines] = useState<LineItem[]>(() => {
    if (editInvoice?.items?.length) {
      return editInvoice.items.map((it) => recalcLine({
        _key: crypto.randomUUID(),
        description: it.description,
        quantity: it.quantity,
        amount: it.amount,
        discount: it.discount ?? 0,
        measurementUnit: it.measurementUnit ?? '',
        reference: it.reference ?? '',
        taxes: it.taxes ?? ['TVA'],
        customTaxes: it.customTaxes ?? [],
        lineTotalHt: 0,
        lineVat: 0,
        lineTotalTtc: 0,
      }));
    }
    return [emptyLine()];
  });
  const [productSearch, setProductSearch] = useState('');
  const [productDropdownKey, setProductDropdownKey] = useState<string | null>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  /* ── Product search query ── */
  const { data: productsData } = useFneProducts({ search: productSearch, perPage: 10 });
  const productOptions = productsData?.data ?? [];

  const selectProduct = (lineKey: string, product: FneProductRecord) => {
    updateLine(lineKey, {
      description: product.description,
      reference: product.reference ?? '',
      amount: product.unitPrice,
      measurementUnit: product.measurementUnit ?? '',
      taxes: product.defaultTaxes ?? ['TVA'],
    });
    setProductSearch('');
    setProductDropdownKey(null);
  };

  useEffect(() => {
    function onClickOutsideProduct(e: MouseEvent) {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownKey(null);
      }
    }
    document.addEventListener('mousedown', onClickOutsideProduct);
    return () => document.removeEventListener('mousedown', onClickOutsideProduct);
  }, []);

  /* ── Step 4: Payment ── */
  const [paymentMethod, setPaymentMethod] = useState<FnePaymentMethod>(editInvoice?.paymentMethod ?? 'cash');
  const [globalDiscount, setGlobalDiscount] = useState(editInvoice?.discountPct ?? 0);
  const [invoiceCustomTaxes, setInvoiceCustomTaxes] = useState<Array<{ name: string; amount: number }>>(editInvoice?.customTaxes ?? []);

  /* ── Computed totals ── */
  const totals = useMemo(() => {
    const subtotalHt = lines.reduce((s, l) => s + l.lineTotalHt, 0);
    const totalVatRaw = lines.reduce((s, l) => s + l.lineVat, 0);
    const discAmt = subtotalHt * (globalDiscount / 100);
    const adjHt = subtotalHt - discAmt;
    const adjVat = totalVatRaw * (1 - globalDiscount / 100);
    const ttc = adjHt + adjVat;
    return {
      subtotalHt: Math.round(subtotalHt * 100) / 100,
      discountAmount: Math.round(discAmt * 100) / 100,
      totalVat: Math.round(adjVat * 100) / 100,
      totalTtc: Math.round(ttc * 100) / 100,
    };
  }, [lines, globalDiscount]);

  /* ── Line helpers ── */
  const updateLine = useCallback((key: string, patch: Partial<LineItem>) => {
    setLines((prev) =>
      prev.map((l) => (l._key === key ? recalcLine({ ...l, ...patch }) : l)),
    );
  }, []);
  const addLine = () => setLines((p) => [...p, emptyLine()]);
  const removeLine = (key: string) => setLines((p) => p.filter((l) => l._key !== key));

  /* ── Select single tax on a line (FNE requires exactly one standard tax per item) ── */
  const toggleTax = (key: string, code: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l._key !== key) return l;
        // Single-select: set exactly this one tax
        return recalcLine({ ...l, taxes: [code] });
      }),
    );
  };

  /* ── Custom taxes on a line ── */
  const addCustomTax = (key: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l._key === key
          ? { ...l, customTaxes: [...(l.customTaxes ?? []), { name: '', amount: 0 }] }
          : l,
      ),
    );
  };
  const updateCustomTax = (key: string, idx: number, patch: Partial<{ name: string; amount: number }>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l._key !== key) return l;
        const customTaxes = [...(l.customTaxes ?? [])];
        customTaxes[idx] = { ...customTaxes[idx], ...patch };
        return recalcLine({ ...l, customTaxes });
      }),
    );
  };
  const removeCustomTax = (key: string, idx: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l._key !== key) return l;
        const customTaxes = (l.customTaxes ?? []).filter((_, i) => i !== idx);
        return recalcLine({ ...l, customTaxes });
      }),
    );
  };

  /* ── Validation ── */
  const step1Valid = clientCompanyName && clientPhone && clientEmail && (template !== 'B2B' || clientNcc) && (!isRne || rne);
  const step2Valid = pointOfSale && establishment && (!foreignCurrency || foreignCurrencyRate > 0);
  const step3Valid = lines.length > 0 && lines.every((l) => l.description && l.quantity > 0 && l.amount > 0);
  const canSubmit = step1Valid && step2Valid && step3Valid;

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const payload = {
        template,
        invoiceType,
        paymentMethod,
        clientCompanyName,
        clientPhone,
        clientEmail,
        ...(clientNcc && { clientNcc }),
        ...(clientSellerName && { clientSellerName }),
        ...(isRne && { isRne, rne }),
        pointOfSale,
        establishment,
        ...(commercialMessage && { commercialMessage }),
        ...(footer && { footer }),
        ...(foreignCurrency && { foreignCurrency, foreignCurrencyRate }),
        discount: globalDiscount,
        ...(invoiceCustomTaxes.length && { customTaxes: invoiceCustomTaxes }),
        items: lines.map(({ description, quantity, amount, discount, measurementUnit, taxes, reference, customTaxes }) => ({
          description,
          quantity,
          amount,
          ...(discount && { discount }),
          ...(measurementUnit && { measurementUnit }),
          ...(reference && { reference }),
          taxes,
          ...(customTaxes?.length && { customTaxes }),
        })),
      };

      let invoice;
      if (isEditMode) {
        invoice = await updateMutation.mutateAsync({ id: editInvoice!.id, payload });
      } else {
        invoice = await createMutation.mutateAsync(payload);
      }
      navigate(`/fne/invoices/${invoice.id}`);
    } catch {
      // Error handled by mutation
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/fne/invoices')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode
              ? t('fne.editTitle', 'Modifier la facture')
              : t('fne.createTitle', 'Nouvelle facture FNE')}
          </h1>
          <p className="text-sm text-gray-500">
            {isEditMode
              ? `${editInvoice!.reference} — ${t('fne.editSubtitle', 'Modifier les informations du brouillon')}`
              : t('fne.createSubtitle', 'Créer et certifier une facture normalisée')}
          </p>
        </div>
      </div>

      {/* ── Steps indicator ── */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                active && 'bg-brand-gold text-white',
                done && 'bg-green-500 text-white',
                !active && !done && 'bg-gray-100 text-gray-400',
              )}>
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={cn('hidden sm:inline text-sm font-medium', active ? 'text-gray-900' : 'text-gray-400')}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className={cn('mx-2 h-px flex-1', done ? 'bg-green-300' : 'bg-gray-200')} />}
            </div>
          );
        })}
      </div>

      {/* ── Step content ── */}
      <Card>
        {/* ─── STEP 0: Type de facturation ─── */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t('fne.step0', 'Type de facturation')}</h2>
            <div className="grid grid-cols-2 gap-4">
              {INVOICE_TYPES.map((it) => (
                <button key={it.value} onClick={() => setInvoiceType(it.value)}
                  className={cn(
                    'rounded-lg border p-5 text-center transition-all',
                    invoiceType === it.value
                      ? 'border-brand-gold bg-brand-gold/10 text-brand-gold ring-1 ring-brand-gold'
                      : 'border-gray-300 text-gray-500 hover:border-gray-400',
                  )}>
                  <div className="text-lg font-bold">{it.label}</div>
                  <div className="text-sm mt-1">{it.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 1: Client ─── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t('fne.step1', 'Informations client')}</h2>

            {/* Client combobox */}
            <div className="relative" ref={comboRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="inline h-4 w-4 mr-1" />
                {t('fne.selectClient', 'Sélectionner un client enregistré')}
              </label>
              {/* Combo trigger */}
              <button
                type="button"
                onClick={() => setShowClientDropdown((v) => !v)}
                className={cn(
                  'w-full flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-colors text-left',
                  showClientDropdown
                    ? 'border-brand-gold ring-1 ring-brand-gold'
                    : 'border-gray-300 hover:border-gray-400',
                  selectedClientId ? 'text-gray-900' : 'text-gray-400',
                )}
              >
                <span className="truncate">
                  {selectedClientId
                    ? clientCompanyName + (clientPhone ? ` — ${clientPhone}` : '')
                    : t('fne.searchClient', 'Rechercher par nom, téléphone, email...')}
                </span>
                <span className="flex items-center gap-1 ml-2 shrink-0">
                  {selectedClientId && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); clearSelectedClient(); }}
                      className="rounded p-0.5 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </span>
                  )}
                  <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', showClientDropdown && 'rotate-180')} />
                </span>
              </button>

              {/* Dropdown panel */}
              {showClientDropdown && (
                <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  {/* Search input inside */}
                  <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                    <Search className="h-4 w-4 text-gray-400 shrink-0" />
                    <input
                      ref={comboSearchRef}
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder={t('fne.comboSearchPlaceholder', 'Tapez pour rechercher...')}
                      className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                    />
                    {clientSearch && (
                      <button type="button" onClick={() => setClientSearch('')} className="text-gray-400 hover:text-gray-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Results list */}
                  <div className="max-h-52 overflow-y-auto">
                    {clientOptions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        {clientSearch
                          ? t('fne.noClientsFound', 'Aucun client trouvé')
                          : t('fne.typeToSearch', 'Commencez à taper pour rechercher')}
                      </div>
                    ) : (
                      clientOptions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectClient(c)}
                          className={cn(
                            'w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between',
                            selectedClientId === c.id
                              ? 'bg-brand-gold/10 text-brand-gold'
                              : 'hover:bg-gray-50',
                          )}
                        >
                          <div>
                            <div className="font-medium">{c.companyName}</div>
                            <div className="text-xs text-gray-500">{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
                          </div>
                          {selectedClientId === c.id && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              {selectedClientId && (
                <p className="mt-1.5 text-xs text-green-600">{t('fne.clientSelected', 'Client sélectionné — vous pouvez modifier les champs ci-dessous')}</p>
              )}
            </div>

            {/* Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('fne.template', 'Modèle client')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TEMPLATES.map((tpl) => (
                  <button key={tpl.value} onClick={() => setTemplate(tpl.value)}
                    className={cn(
                      'rounded-lg border p-3 text-center transition-all',
                      template === tpl.value
                        ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                        : 'border-gray-300 text-gray-500 hover:border-gray-400',
                    )}>
                    <div className="font-bold">{tpl.label}</div>
                    <div className="text-xs">{tpl.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Client fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('fne.clientName', 'Nom / Raison sociale')} *</label>
                <input value={clientCompanyName} onChange={(e) => setClientCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('fne.clientPhone', 'Téléphone')} *</label>
                <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('fne.clientEmail', 'Email')} *</label>
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
              </div>
              {template === 'B2B' && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">{t('fne.clientNcc', 'NCC Client')} *</label>
                  <input value={clientNcc} onChange={(e) => setClientNcc(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('fne.clientSeller', 'Vendeur')}</label>
                <input value={clientSellerName} onChange={(e) => setClientSellerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
              </div>
            </div>

            {/* RNE */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isRne} onChange={(e) => setIsRne(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold" />
                <span className="text-sm text-gray-700">{t('fne.isRne', 'Soumis au RNE')}</span>
              </label>
              {isRne && (
                <input placeholder="Numéro RNE" value={rne} onChange={(e) => setRne(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 2: Establishment ─── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t('fne.step2', 'Établissement et paramètres')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Establishment combobox (select first) */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('fne.establishment', 'Établissement')} *</label>
                <div className="relative" ref={estDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowEstDropdown((v) => !v)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-colors text-left',
                      showEstDropdown
                        ? 'border-brand-gold ring-1 ring-brand-gold'
                        : 'border-gray-300 hover:border-gray-400',
                      selectedEstId ? 'text-gray-900' : 'text-gray-400',
                    )}
                  >
                    <span className="truncate">
                      {selectedEstId
                        ? establishment
                        : t('fne.selectEst', 'Sélectionner un établissement...')}
                    </span>
                    <span className="flex items-center gap-1 ml-2 shrink-0">
                      {selectedEstId && (
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); clearEst(); }}
                          className="rounded p-0.5 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </span>
                      )}
                      <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', showEstDropdown && 'rotate-180')} />
                    </span>
                  </button>
                  {showEstDropdown && (
                    <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                        <Search className="h-4 w-4 text-gray-400 shrink-0" />
                        <input
                          ref={estSearchRef}
                          value={estSearch}
                          onChange={(e) => setEstSearch(e.target.value)}
                          placeholder={t('fne.comboSearchPlaceholder', 'Tapez pour rechercher...')}
                          className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                        />
                        {estSearch && (
                          <button type="button" onClick={() => setEstSearch('')} className="text-gray-400 hover:text-gray-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {estOptions.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            {estSearch
                              ? t('fne.noEstFound', 'Aucun établissement trouvé')
                              : t('fne.typeToSearch', 'Commencez à taper pour rechercher')}
                          </div>
                        ) : (
                          estOptions.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => selectEst(e)}
                              className={cn(
                                'w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between',
                                selectedEstId === e.id
                                  ? 'bg-brand-gold/10 text-brand-gold'
                                  : 'hover:bg-gray-50',
                              )}
                            >
                              <div>
                                <div className="font-medium">{e.name}</div>
                                {e.address && <div className="text-xs text-gray-500">{e.address}</div>}
                              </div>
                              {selectedEstId === e.id && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Point of Sale combobox (filtered by establishment) */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('fne.pointOfSale', 'Point de vente')} *</label>
                <div className="relative" ref={posDropdownRef}>
                  <button
                    type="button"
                    onClick={() => selectedEstId && setShowPosDropdown((v) => !v)}
                    disabled={!selectedEstId}
                    className={cn(
                      'w-full flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm shadow-sm transition-colors text-left',
                      !selectedEstId && 'opacity-50 cursor-not-allowed',
                      showPosDropdown
                        ? 'border-brand-gold ring-1 ring-brand-gold'
                        : 'border-gray-300 hover:border-gray-400',
                      selectedPosId ? 'text-gray-900' : 'text-gray-400',
                    )}
                  >
                    <span className="truncate">
                      {selectedPosId
                        ? pointOfSale
                        : selectedEstId
                          ? t('fne.selectPos', 'Sélectionner un point de vente...')
                          : t('fne.selectEstFirst', 'Sélectionnez d\'abord un établissement')}
                    </span>
                    <span className="flex items-center gap-1 ml-2 shrink-0">
                      {selectedPosId && (
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); clearPos(); }}
                          className="rounded p-0.5 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </span>
                      )}
                      <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', showPosDropdown && 'rotate-180')} />
                    </span>
                  </button>
                  {showPosDropdown && (
                    <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                        <Search className="h-4 w-4 text-gray-400 shrink-0" />
                        <input
                          ref={posSearchRef}
                          value={posSearch}
                          onChange={(e) => setPosSearch(e.target.value)}
                          placeholder={t('fne.comboSearchPlaceholder', 'Tapez pour rechercher...')}
                          className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                        />
                        {posSearch && (
                          <button type="button" onClick={() => setPosSearch('')} className="text-gray-400 hover:text-gray-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {posOptions.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            {posSearch
                              ? t('fne.noPosFound', 'Aucun point de vente trouvé')
                              : t('fne.typeToSearch', 'Commencez à taper pour rechercher')}
                          </div>
                        ) : (
                          posOptions.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => selectPos(p)}
                              className={cn(
                                'w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between',
                                selectedPosId === p.id
                                  ? 'bg-brand-gold/10 text-brand-gold'
                                  : 'hover:bg-gray-50',
                              )}
                            >
                              <div>
                                <div className="font-medium">{p.name}</div>
                                {p.address && <div className="text-xs text-gray-500">{p.address}</div>}
                              </div>
                              {selectedPosId === p.id && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('fne.commercialMessage', 'Message commercial')}</label>
                <textarea value={commercialMessage} onChange={(e) => setCommercialMessage(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('fne.footer', 'Pied de page')}</label>
                <textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
              </div>
            </div>

            {/* Foreign currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('fne.foreignCurrency', 'Devise étrangère (optionnel)')}</label>
              <div className="grid gap-4 sm:grid-cols-2">
                <input placeholder="ex: USD, EUR" value={foreignCurrency} onChange={(e) => setForeignCurrency(e.target.value.toUpperCase())}
                  className="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                {foreignCurrency && (
                  <input type="number" placeholder="Taux de change" value={foreignCurrencyRate || ''} onChange={(e) => setForeignCurrencyRate(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Items ─── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{t('fne.step3', 'Articles')}</h2>
              <Button size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> {t('fne.addLine', 'Ajouter')}</Button>
            </div>

            <div className="space-y-4">
              {lines.map((line, idx) => (
                <div key={line._key} className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Article #{idx + 1}</span>
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(line._key)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Product combobox */}
                  <div className="relative" ref={productDropdownKey === line._key ? productDropdownRef : undefined}>
                    <button
                      type="button"
                      onClick={() => {
                        setProductDropdownKey(productDropdownKey === line._key ? null : line._key);
                        setProductSearch('');
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors text-left',
                        productDropdownKey === line._key
                          ? 'border-brand-gold ring-1 ring-brand-gold'
                          : 'border-dashed border-gray-300 hover:border-gray-400 text-gray-400',
                      )}
                    >
                      <Package className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t('fne.selectProduct', 'Sélectionner un produit enregistré...')}</span>
                      <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 transition-transform', productDropdownKey === line._key && 'rotate-180')} />
                    </button>
                    {productDropdownKey === line._key && (
                      <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                          <Search className="h-4 w-4 text-gray-400 shrink-0" />
                          <input
                            autoFocus
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder={t('fne.searchProduct', 'Rechercher un produit...')}
                            className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                          />
                          {productSearch && (
                            <button type="button" onClick={() => setProductSearch('')} className="text-gray-400 hover:text-gray-600">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {productOptions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500">
                              {productSearch
                                ? t('fne.noProductsFound', 'Aucun produit trouvé')
                                : t('fne.typeToSearchProduct', 'Commencez à taper pour rechercher')}
                            </div>
                          ) : (
                            productOptions.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => selectProduct(line._key, p)}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-medium text-gray-900">{p.description}</div>
                                  <div className="text-xs text-gray-500">
                                    {p.reference ? `${p.reference} · ` : ''}{formatCFA(p.unitPrice)}{p.measurementUnit ? ` / ${p.measurementUnit}` : ''}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2">
                      <input placeholder="Description *" value={line.description}
                        onChange={(e) => updateLine(line._key, { description: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                    </div>
                    <div>
                      <input placeholder="Réf. article" value={line.reference ?? ''}
                        onChange={(e) => updateLine(line._key, { reference: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                    </div>
                    <div>
                      <input placeholder="Unité" value={line.measurementUnit ?? ''}
                        onChange={(e) => updateLine(line._key, { measurementUnit: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Qté *</label>
                      <input type="number" min={1} value={line.quantity}
                        onChange={(e) => updateLine(line._key, { quantity: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Prix unit. HT *</label>
                      <input type="number" min={0} value={line.amount}
                        onChange={(e) => updateLine(line._key, { amount: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Remise %</label>
                      <input type="number" min={0} max={100} value={line.discount ?? 0}
                        onChange={(e) => updateLine(line._key, { discount: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                    </div>
                    <div className="flex items-end">
                      <span className="text-sm font-semibold text-gray-900">{formatCFA(line.lineTotalTtc)}</span>
                    </div>
                  </div>
                  {/* Taxes */}
                  <div className="flex flex-wrap gap-2">
                    {TAX_OPTIONS.map((tax) => (
                      <button key={tax.value} onClick={() => toggleTax(line._key, tax.value)}
                        className={cn(
                          'rounded-md border px-3 py-1 text-xs font-medium transition-all',
                          line.taxes.includes(tax.value)
                            ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                            : 'border-gray-300 text-gray-500 hover:border-gray-400',
                        )}>
                        {tax.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom taxes */}
                  <div className="space-y-2">
                    {(line.customTaxes ?? []).map((ct, ctIdx) => (
                      <div key={ctIdx} className="flex items-center gap-2">
                        <input placeholder="Nom de la taxe *" value={ct.name}
                          onChange={(e) => updateCustomTax(line._key, ctIdx, { name: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                        <div className="relative w-28">
                          <input type="number" min={0} max={100} placeholder="Taux" value={ct.amount || ''}
                            onChange={(e) => updateCustomTax(line._key, ctIdx, { amount: Number(e.target.value) })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                        <button onClick={() => removeCustomTax(line._key, ctIdx)}
                          className="text-red-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addCustomTax(line._key)}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand-gold hover:text-brand-gold/80 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Ajouter une taxe personnalisée
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals summary */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Sous-total HT</span>
                <span>{formatCFA(totals.subtotalHt)}</span>
              </div>
              {globalDiscount > 0 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>Remise globale ({globalDiscount}%)</span>
                  <span>-{formatCFA(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-500">
                <span>TVA</span>
                <span>{formatCFA(totals.totalVat)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total TTC</span>
                <span>{formatCFA(totals.totalTtc)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Payment ─── */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t('fne.step4', 'Mode de paiement & finalisation')}</h2>

            {/* Payment method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('fne.paymentMethod', 'Mode de paiement')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PAYMENT_METHODS.map((pm) => (
                  <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                    className={cn(
                      'rounded-lg border p-3 text-center text-sm transition-all',
                      paymentMethod === pm.value
                        ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                        : 'border-gray-300 text-gray-500 hover:border-gray-400',
                    )}>
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Global discount */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">{t('fne.globalDiscount', 'Remise globale %')}</label>
              <input type="number" min={0} max={100} value={globalDiscount}
                onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                className="w-32 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
            </div>

            {/* Invoice-level custom taxes */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">{t('fne.invoiceCustomTaxes', 'Taxes personnalisées (niveau facture)')}</label>
              {invoiceCustomTaxes.map((ct, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input placeholder="Nom de la taxe *" value={ct.name}
                    onChange={(e) => setInvoiceCustomTaxes((prev) => prev.map((t, i) => i === idx ? { ...t, name: e.target.value } : t))}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                  <div className="relative w-28">
                    <input type="number" min={0} max={100} placeholder="Taux" value={ct.amount || ''}
                      onChange={(e) => setInvoiceCustomTaxes((prev) => prev.map((t, i) => i === idx ? { ...t, amount: Number(e.target.value) } : t))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  <button onClick={() => setInvoiceCustomTaxes((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-red-500 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => setInvoiceCustomTaxes((prev) => [...prev, { name: '', amount: 0 }])}
                className="flex items-center gap-1.5 text-xs font-medium text-brand-gold hover:text-brand-gold/80 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Ajouter une taxe personnalisée
              </button>
            </div>

            {/* Final summary */}
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 p-6 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">Récapitulatif</h3>
              <div className="grid gap-2 sm:grid-cols-2 text-sm pt-3">
                <div className="text-gray-500">Type: <span className="text-gray-900">{template}</span></div>
                <div className="text-gray-500">Paiement: <span className="text-gray-900">{PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label}</span></div>
                <div className="text-gray-500">Client: <span className="text-gray-900">{clientCompanyName}</span></div>
                <div className="text-gray-500">Établissement: <span className="text-gray-900">{establishment}</span></div>
                <div className="text-gray-500">Articles: <span className="text-gray-900">{lines.length}</span></div>
                <div className="text-gray-500">Total TTC: <span className="text-gray-900 font-bold">{formatCFA(totals.totalTtc)}</span></div>
              </div>
            </div>

            {/* Warning */}
            {invoiceType === 'sale' && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  {t('fne.certifyWarning', 'La soumission enverra directement la facture \u00e0 l\'API FNE pour certification. Cette action est irr\u00e9versible.')}
                </p>
              </div>
            )}
            {invoiceType === 'estimate' && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-800">
                  {t('fne.draftInfo', 'Le devis sera enregistr\u00e9 en brouillon. Il pourra \u00eatre modifi\u00e9 ou converti en facture ult\u00e9rieurement.')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={prev}>
                <ArrowLeft className="h-4 w-4" /> {t('common.previous', 'Précédent')}
              </Button>
            )}
          </div>
          {step < 4 ? (
            <Button onClick={next}>
              {t('common.next', 'Suivant')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending || updateMutation.isPending}
              className={isEditMode ? 'bg-brand-gold hover:bg-brand-gold/90' : invoiceType === 'estimate' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'}>
              {(createMutation.isPending || updateMutation.isPending) ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isEditMode ? t('fne.saving', 'Enregistrement...') : invoiceType === 'estimate' ? t('fne.saving', 'Enregistrement...') : t('fne.certifying', 'Certification en cours...')}</>
              ) : isEditMode ? (
                <><Save className="mr-2 h-4 w-4" /> {t('fne.saveChanges', 'Enregistrer les modifications')}</>
              ) : invoiceType === 'estimate' ? (
                <><Save className="mr-2 h-4 w-4" /> {t('fne.saveDraft', 'Enregistrer en brouillon')}</>
              ) : (
                <><Check className="mr-2 h-4 w-4" /> {t('fne.certifyAndSend', 'Certifier & envoyer')}</>
              )}
            </Button>
          )}
        </div>

        {/* Error */}
        {(createMutation.isError || updateMutation.isError) && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {((createMutation.error || updateMutation.error) as Error)?.message || t('fne.errorGeneric', 'Erreur lors de la certification')}
          </div>
        )}
      </Card>
    </div>
  );
}
