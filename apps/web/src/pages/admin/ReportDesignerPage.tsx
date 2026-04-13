import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, Eye, EyeOff, GripVertical, RotateCcw, ChevronDown, ChevronRight,
  ArrowUp, ArrowDown, Check, AlertTriangle, LayoutTemplate, X, MousePointerClick,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Type,
  Palette, Table2, Ruler, Maximize2, Minimize2, PanelTopClose, PanelBottomClose,
  BarChart3, Layers, Move, Save, CloudUpload, Loader2, CheckCircle2, CloudOff,
  Plus, Trash2, Database, Search, Hash, Calendar, DollarSign, ToggleLeft, ListFilter,
} from 'lucide-react';
import { Button, Badge, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  useReportConfigStore, DEFAULT_REPORTS, DATA_SOURCE_FIELDS, DATA_SOURCE_LABELS,
  type ReportConfig, type ElementStyle, type SectionType,
  type TextAlign,
  type DataSourceGroup, type DataSourceField, type ReportFieldConfig, type ReportKpiConfig,
} from '@/stores/report-config-store';

/* ═══════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════ */

type SelectionKind = 'header' | 'kpi' | 'field' | 'footer' | 'table' | 'section' | 'page';
interface Selection { kind: SelectionKind; key?: string; }

type HeaderBoolKey = 'showCompanyName' | 'showCompanyAddress' | 'showCompanyPhone' | 'showCompanyTaxId' | 'showLogo';
type FooterBoolKey = 'showEstabliPar' | 'showVerifiePar' | 'showTimestamp';

const SECTION_LABELS: Record<SectionType, string> = {
  header: 'En-tête', kpis: 'Indicateurs (KPI)', table: 'Tableau de données',
  summary: 'Résumé', footer: 'Pied de page',
};

const SECTION_ICONS: Record<SectionType, typeof FileText> = {
  header: PanelTopClose, kpis: BarChart3, table: Table2,
  summary: Layers, footer: PanelBottomClose,
};

const FONT_FAMILIES = [
  { value: 'serif' as const, label: 'Serif (Times)' },
  { value: 'sans-serif' as const, label: 'Sans (Arial)' },
  { value: 'monospace' as const, label: 'Mono (Courier)' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24];

const PRESET_COLORS = [
  '#111827', '#374151', '#6b7280', '#1e40af', '#dc2626',
  '#059669', '#d97706', '#7c3aed', '#db2777', '#000000',
];

/* ═══════════════════════════════════════════════════════════════
   Sample data
═══════════════════════════════════════════════════════════════ */

function sampleValue(key: string, row: number): string {
  if (/date|At$/i.test(key)) return ['08/04/2026', '09/04/2026', '10/04/2026', '10/04/2026'][row % 4];
  if (/time|heure/i.test(key)) return ['08:15', '10:42', '14:30', '16:55'][row % 4];
  if (/ref|piece|dayRef/i.test(key)) return `OP-${String(row + 1).padStart(3, '0')}`;
  if (/^seq$|^num$/i.test(key)) return String(row + 1);
  if (/percent|%/i.test(key)) return `${(row * 0.8 + 1.2).toFixed(1)}%`;
  if (/status|statut/i.test(key)) return ['OK', 'Écart', 'OK', 'OK'][row % 4];
  if (/nature|type|direction|sens|category|journal/i.test(key)) return ['Vente', 'Achat', 'Banque', 'Caisse'][row % 4];
  if (/label|libellé|description|comment/i.test(key)) return ['Vente comptoir', 'Fournitures', 'Versement bancaire', 'Frais divers'][row % 4];
  if (/account.*num|accountNumber/i.test(key)) return ['570000', '411000', '512000', '601000'][row % 4];
  if (/account.*label|accountLabel/i.test(key)) return ['Caisse', 'Clients', 'Banque', 'Achats'][row % 4];
  if (/denomination|coupure/i.test(key)) return ['10 000', '5 000', '1 000', '500'][row % 4];
  if (/count|nombre/i.test(key)) return String([15, 8, 3, 1][row % 4]);
  if (/amount|debit|credit|balance|entry|exit|total|cash|check|transfer|mobile|variation|subtotal|cumul|solde|variance|opening|closing|theoretical|actual/i.test(key))
    return new Intl.NumberFormat('fr-FR').format([125000, 50000, 75000, 200000][row % 4]);
  return '···';
}

function sampleKpiValue(key: string): string {
  if (/percent|%|avg/i.test(key)) return '2,3%';
  if (/count|nombre/i.test(key)) return '47';
  return new Intl.NumberFormat('fr-FR').format([125000, 450000, 325000, 250000, 75000][Math.abs(key.length) % 5]) + ' FCFA';
}

/* ═══════════════════════════════════════════════════════════════
   Shared style editor sub‑component
═══════════════════════════════════════════════════════════════ */

function StyleEditor({ style, onChange, label }: {
  style: ElementStyle;
  onChange: (s: Partial<ElementStyle>) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2 border border-white/10 rounded-lg p-3 bg-white/[0.02]">
      {label && <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mb-1">{label}</div>}

      {/* Font family */}
      <div className="flex items-center gap-2">
        <Type size={12} className="text-gray-500 flex-shrink-0" />
        <select
          value={style.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value as ElementStyle['fontFamily'] })}
          className="flex-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-300 px-1.5 py-1 h-6"
        >
          {FONT_FAMILIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* Font size + weight + italic */}
      <div className="flex items-center gap-1">
        <select
          value={style.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="w-14 bg-white/5 border border-white/10 rounded text-[10px] text-gray-300 px-1 py-1 h-6"
        >
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}
        </select>
        <button
          onClick={() => onChange({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })}
          className={cn('p-1 rounded transition-colors', style.fontWeight === 'bold' ? 'bg-brand-gold/20 text-brand-gold' : 'text-gray-500 hover:bg-white/10')}
          title="Gras"
        ><Bold size={12} /></button>
        <button
          onClick={() => onChange({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={cn('p-1 rounded transition-colors', style.fontStyle === 'italic' ? 'bg-brand-gold/20 text-brand-gold' : 'text-gray-500 hover:bg-white/10')}
          title="Italique"
        ><Italic size={12} /></button>

        <div className="ml-auto flex gap-0.5 border border-white/10 rounded overflow-hidden">
          {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ textAlign: a })}
              className={cn('p-1 transition-colors', style.textAlign === a ? 'bg-brand-gold/20 text-brand-gold' : 'text-gray-500 hover:bg-white/10')}
              title={a === 'left' ? 'Gauche' : a === 'center' ? 'Centré' : 'Droite'}
            >
              {a === 'left' ? <AlignLeft size={12} /> : a === 'center' ? <AlignCenter size={12} /> : <AlignRight size={12} />}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="flex items-center gap-1.5">
        <Palette size={12} className="text-gray-500 flex-shrink-0" />
        <div className="flex gap-1 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ color: c })}
              className={cn('w-4 h-4 rounded-full border-2 transition-all', style.color === c ? 'border-brand-gold scale-110' : 'border-transparent hover:scale-110')}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Field-type icon helper
═══════════════════════════════════════════════════════════════ */

const FIELD_TYPE_ICON: Record<string, typeof Type> = {
  text: Type, number: Hash, date: Calendar, datetime: Calendar,
  currency: DollarSign, boolean: ToggleLeft, enum: ListFilter,
};

/* ═══════════════════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════════════════ */

export default function ReportDesignerPage() {
  const { t } = useTranslation();
  const store = useReportConfigStore();
  const { configs, updateField, updateFieldStyle, reorderFields, updateKpi, updateKpiStyle,
    updateHeader, updateFooter, updateTable, updatePage, updateSection, reorderSections, reorderKpis,
    addField, removeField, addKpi, removeKpi,
    resetReport, resetAll,
    isSyncing, lastSyncedAt, syncError, loadFromServer, saveToServer, saveAllToServer } = store;

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<'daily' | 'period' | null>('daily');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [fieldPickerSearch, setFieldPickerSearch] = useState('');
  const [fieldPickerGroup, setFieldPickerGroup] = useState<DataSourceGroup | 'all'>('all');
  const [fieldPickerMode, setFieldPickerMode] = useState<'field' | 'kpi'>('field');

  // Auto-load configs from server on mount
  useEffect(() => { loadFromServer(); }, []);

  const selectedReport = configs.find((c) => c.id === selectedReportId) || null;
  const dailyReports = configs.filter((c) => c.category === 'daily');
  const periodReports = configs.filter((c) => c.category === 'period');

  const isModified = useCallback((rid: string) => {
    const cur = configs.find((c) => c.id === rid);
    const def = DEFAULT_REPORTS.find((r) => r.id === rid);
    return cur && def ? JSON.stringify(cur) !== JSON.stringify(def) : false;
  }, [configs]);

  const clearSelection = () => setSelection(null);
  const select = (kind: SelectionKind, key?: string) => setSelection({ kind, key });

  /* ── Drag & Drop for columns ── */
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  /* ── Drag & Drop for sections ── */
  const dragSection = useRef<SectionType | null>(null);
  const dragOverSection = useRef<SectionType | null>(null);
  const [sectionDropTarget, setSectionDropTarget] = useState<SectionType | null>(null);

  /* ── Drag & Drop for KPIs ── */
  const dragKpi = useRef<string | null>(null);
  const dragOverKpi = useRef<string | null>(null);
  const [kpiDropTarget, setKpiDropTarget] = useState<string | null>(null);

  /* ── Drag & Drop for columns visual ── */
  const [fieldDropTarget, setFieldDropTarget] = useState<string | null>(null);

  const handleDragStart = (k: string) => { dragItem.current = k; };
  const handleDragOver = (e: React.DragEvent, k: string) => { e.preventDefault(); dragOverItem.current = k; setFieldDropTarget(k); };
  const handleDrop = () => {
    if (!selectedReportId || !dragItem.current || !dragOverItem.current || dragItem.current === dragOverItem.current) return;
    const r = configs.find((c) => c.id === selectedReportId);
    if (!r) return;
    const keys = [...r.fields].sort((a, b) => a.order - b.order).map((f) => f.key);
    const fi = keys.indexOf(dragItem.current), ti = keys.indexOf(dragOverItem.current);
    if (fi < 0 || ti < 0) return;
    keys.splice(fi, 1); keys.splice(ti, 0, dragItem.current);
    reorderFields(selectedReportId, keys);
    dragItem.current = dragOverItem.current = null;
    setFieldDropTarget(null);
  };
  const handleDragEnd = () => { setFieldDropTarget(null); };

  /* ── Section drag handlers ── */
  const handleSectionDragStart = (e: React.DragEvent, type: SectionType) => {
    dragSection.current = type;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', type);
  };
  const handleSectionDragOver = (e: React.DragEvent, type: SectionType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverSection.current = type;
    setSectionDropTarget(type);
  };
  const handleSectionDrop = (type: SectionType) => {
    if (!selectedReportId || !dragSection.current || dragSection.current === type) {
      setSectionDropTarget(null);
      return;
    }
    const rp = configs.find((c) => c.id === selectedReportId);
    if (!rp) return;
    const sorted = [...rp.sections].sort((a, b) => a.order - b.order).map((s) => s.type);
    const fi = sorted.indexOf(dragSection.current);
    const ti = sorted.indexOf(type);
    if (fi < 0 || ti < 0) return;
    sorted.splice(fi, 1);
    sorted.splice(ti, 0, dragSection.current);
    reorderSections(selectedReportId, sorted);
    dragSection.current = dragOverSection.current = null;
    setSectionDropTarget(null);
  };
  const handleSectionDragEnd = () => { setSectionDropTarget(null); };

  /* ── KPI drag handlers ── */
  const handleKpiDragStart = (e: React.DragEvent, key: string) => {
    dragKpi.current = key;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  };
  const handleKpiDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverKpi.current = key;
    setKpiDropTarget(key);
  };
  const handleKpiDrop = (key: string) => {
    if (!selectedReportId || !dragKpi.current || dragKpi.current === key) {
      setKpiDropTarget(null);
      return;
    }
    const rp = configs.find((c) => c.id === selectedReportId);
    if (!rp) return;
    const keys = rp.kpis.map((k) => k.key);
    const fi = keys.indexOf(dragKpi.current);
    const ti = keys.indexOf(key);
    if (fi < 0 || ti < 0) return;
    keys.splice(fi, 1);
    keys.splice(ti, 0, dragKpi.current);
    reorderKpis(selectedReportId, keys);
    dragKpi.current = dragOverKpi.current = null;
    setKpiDropTarget(null);
  };
  const handleKpiDragEnd = () => { setKpiDropTarget(null); };

  const moveField = (fieldKey: string, dir: 'up' | 'down') => {
    if (!selectedReport) return;
    const sorted = [...selectedReport.fields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((f) => f.key === fieldKey);
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= sorted.length) return;
    const keys = sorted.map((f) => f.key);
    [keys[idx], keys[target]] = [keys[target], keys[idx]];
    reorderFields(selectedReport.id, keys);
  };

  /* ═══════════════════════════════════════════════════════════
     LEFT — Report list
  ═══════════════════════════════════════════════════════════ */

  const ReportListItem = ({ r }: { r: ReportConfig }) => {
    const mod = isModified(r.id);
    const active = selectedReportId === r.id;
    return (
      <button onClick={() => { setSelectedReportId(r.id); setSelection(null); }}
        className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all',
          active ? 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30' : 'hover:bg-white/5 text-gray-300')}>
        <FileText size={14} className={active ? 'text-brand-gold' : 'text-gray-500'} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{r.name}</div>
          <div className="text-[10px] text-gray-500">{r.fields.filter((f) => f.visible).length}/{r.fields.length} colonnes</div>
        </div>
        {mod && <span className="w-1.5 h-1.5 rounded-full bg-brand-gold flex-shrink-0" />}
      </button>
    );
  };

  const CategoryGroup = ({ cat, label, items }: { cat: 'daily' | 'period'; label: string; items: ReportConfig[] }) => {
    const exp = expandedCategory === cat;
    return (
      <div>
        <button onClick={() => setExpandedCategory(exp ? null : cat)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-200">
          {exp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {label}
          <Badge className="ml-auto bg-white/10 text-gray-400 text-[9px] px-1">{items.length}</Badge>
        </button>
        {exp && <div className="space-y-0.5 ml-1">{items.map((r) => <ReportListItem key={r.id} r={r} />)}</div>}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     CENTER — Paper View (WYSIWYG)
  ═══════════════════════════════════════════════════════════ */

  const PaperView = () => {
    if (!selectedReport) return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
        <LayoutTemplate size={48} strokeWidth={1} />
        <p className="text-sm">{t('reportDesigner.selectReport', 'Sélectionnez un état à personnaliser')}</p>
        <p className="text-xs text-gray-600">Cliquez sur un élément de l'état pour le modifier directement</p>
      </div>
    );

    const rp = selectedReport;
    const sortedSections = [...rp.sections].sort((a, b) => a.order - b.order);
    const sortedFields = [...rp.fields].sort((a, b) => a.order - b.order);
    const visibleFields = sortedFields.filter((f) => f.visible);
    const hiddenFields = sortedFields.filter((f) => !f.visible);
    const visibleKpis = rp.kpis.filter((k) => k.visible);
    const hiddenKpis = rp.kpis.filter((k) => !k.visible);
    const h = rp.header;
    const ft = rp.footer;
    const tbl = rp.table;
    const pg = rp.page;

    const sectionEl = (type: SectionType) => {
      const sec = rp.sections.find((s) => s.type === type);
      if (!sec) return null;

      const isSelected = selection?.kind === 'section' && selection.key === type;
      const bandLabel = SECTION_LABELS[type];

      const isDragOver = sectionDropTarget === type && dragSection.current !== type;

      const wrapBand = (content: React.ReactNode) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => handleSectionDragStart(e, type)}
          onDragOver={(e) => handleSectionDragOver(e, type)}
          onDrop={() => handleSectionDrop(type)}
          onDragEnd={handleSectionDragEnd}
          onClick={(e) => { e.stopPropagation(); select('section', type); }}
          className={cn(
            'relative cursor-pointer transition-all group/band',
            !sec.visible && 'opacity-30',
            isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/20' : 'hover:ring-1 hover:ring-blue-300 hover:ring-inset',
            isDragOver && 'ring-2 ring-green-400 ring-inset bg-green-50/30',
          )}
        >
          {/* Drop indicator line */}
          {isDragOver && (
            <div className="absolute -top-[2px] left-0 right-0 h-[3px] bg-green-500 rounded-full z-20 shadow-sm shadow-green-500/50" />
          )}

          {/* Band label strip with drag handle */}
          <div className={cn(
            'absolute -left-0 top-0 z-10 flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-sans font-bold uppercase tracking-wider rounded-br transition-all cursor-grab active:cursor-grabbing',
            isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200/80 text-gray-500 opacity-0 group-hover/band:opacity-100',
          )}>
            <GripVertical size={8} className="flex-shrink-0" />
            {bandLabel}
          </div>

          {/* Move handle on right side (always visible on hover) */}
          <div className={cn(
            'absolute right-1 top-1 z-10 p-1 rounded bg-gray-200/80 transition-all opacity-0 group-hover/band:opacity-100 cursor-grab active:cursor-grabbing',
            isSelected && 'opacity-100 bg-blue-500/20',
          )}>
            <Move size={10} className={isSelected ? 'text-blue-500' : 'text-gray-500'} />
          </div>

          {sec.visible ? content : (
            <div className="py-3 text-center text-[10px] text-gray-400 italic font-sans border border-dashed border-gray-300 m-2 rounded">
              {bandLabel} — section masquée
            </div>
          )}
        </div>
      );

      switch (type) {
        case 'header': return wrapBand(
          <div
            onClick={(e) => { e.stopPropagation(); select('header'); }}
            className={cn(
              'text-center cursor-pointer transition-all relative',
              selection?.kind === 'header' ? 'bg-blue-50/60' : '',
            )}
            style={{ padding: `${pg.marginTop}px ${pg.marginLeft}px 16px`, fontFamily: h.companyStyle.fontFamily }}
          >
            {h.showCompanyName && (
              <div style={{ fontSize: h.companyStyle.fontSize, fontWeight: h.companyStyle.fontWeight, color: h.companyStyle.color, fontStyle: h.companyStyle.fontStyle, textAlign: h.companyStyle.textAlign }}>
                SOCIÉTÉ ABC SARL
              </div>
            )}
            {h.showCompanyAddress && <div className="text-xs text-gray-500">123 Avenue du Commerce, Brazzaville, Congo</div>}
            {h.showCompanyPhone && <div className="text-xs text-gray-500">Tél: +242 06 123 4567</div>}
            {h.showCompanyTaxId && <div className="text-xs text-gray-500">RCCM: CG-BZV-01-2024-A1234</div>}

            {(!h.showCompanyName || !h.showCompanyAddress || !h.showCompanyPhone || !h.showCompanyTaxId) && (
              <div className="flex justify-center gap-2 mt-1 flex-wrap">
                {!h.showCompanyName && <span className="text-[9px] text-gray-300 line-through font-sans">Nom</span>}
                {!h.showCompanyAddress && <span className="text-[9px] text-gray-300 line-through font-sans">Adresse</span>}
                {!h.showCompanyPhone && <span className="text-[9px] text-gray-300 line-through font-sans">Tél</span>}
                {!h.showCompanyTaxId && <span className="text-[9px] text-gray-300 line-through font-sans">Fiscal</span>}
              </div>
            )}

            <div className="border-t border-gray-300 mt-3 pt-3">
              <div style={{ fontSize: h.titleStyle.fontSize, fontWeight: h.titleStyle.fontWeight, color: h.titleStyle.color, fontStyle: h.titleStyle.fontStyle, textAlign: h.titleStyle.textAlign, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {h.customTitle || rp.name}
              </div>
              {h.customSubtitle && (
                <div style={{ fontSize: h.subtitleStyle.fontSize, color: h.subtitleStyle.color, fontStyle: h.subtitleStyle.fontStyle, textAlign: h.subtitleStyle.textAlign }} className="mt-0.5">
                  {h.customSubtitle}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-0.5">
                {rp.category === 'daily' ? 'Journée du 10/04/2026' : 'Période du 01/04/2026 au 10/04/2026'}
              </div>
            </div>
          </div>,
        );

        case 'kpis': return rp.kpis.length > 0 ? wrapBand(
          <div className="px-8 py-3">
            <div className="flex flex-wrap gap-2">
              {visibleKpis.map((kpi) => {
                const isSel = selection?.kind === 'kpi' && selection.key === kpi.key;
                const isDrop = kpiDropTarget === kpi.key && dragKpi.current !== kpi.key;
                return (
                  <div key={kpi.key}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); handleKpiDragStart(e, kpi.key); }}
                    onDragOver={(e) => { e.stopPropagation(); handleKpiDragOver(e, kpi.key); }}
                    onDrop={(e) => { e.stopPropagation(); handleKpiDrop(kpi.key); }}
                    onDragEnd={handleKpiDragEnd}
                    onClick={(e) => { e.stopPropagation(); select('kpi', kpi.key); }}
                    className={cn('flex-1 min-w-[100px] rounded-lg p-2.5 text-center cursor-pointer transition-all border-2 relative group/kpi',
                      isSel ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-blue-100 bg-blue-50/70 hover:border-blue-300',
                      isDrop && 'border-green-400 bg-green-50/50 ring-1 ring-green-300')}>
                    {/* KPI drag handle */}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/kpi:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-white rounded-full p-0.5 shadow-sm border border-gray-200">
                      <GripVertical size={8} className="text-gray-400 rotate-90" />
                    </div>
                    {isDrop && <div className="absolute -left-[3px] top-1 bottom-1 w-[3px] bg-green-500 rounded-full shadow-sm shadow-green-500/50" />}
                    <div style={{ fontSize: kpi.style.fontSize, fontFamily: kpi.style.fontFamily, fontWeight: kpi.style.fontWeight as string, color: kpi.style.color, fontStyle: kpi.style.fontStyle, textAlign: kpi.style.textAlign }}>
                      {kpi.customLabel || kpi.label}
                    </div>
                    <div className="text-sm font-bold text-blue-900 mt-0.5">{sampleKpiValue(kpi.key)}</div>
                  </div>
                );
              })}
              {hiddenKpis.map((kpi) => (
                <div key={kpi.key}
                  draggable
                  onDragStart={(e) => { e.stopPropagation(); handleKpiDragStart(e, kpi.key); }}
                  onDragOver={(e) => { e.stopPropagation(); handleKpiDragOver(e, kpi.key); }}
                  onDrop={(e) => { e.stopPropagation(); handleKpiDrop(kpi.key); }}
                  onDragEnd={handleKpiDragEnd}
                  onClick={(e) => { e.stopPropagation(); select('kpi', kpi.key); }}
                  className={cn('flex-1 min-w-[80px] rounded-lg p-2 text-center cursor-pointer border-2 border-dashed border-gray-200 bg-gray-50/50 opacity-40 hover:opacity-60',
                    kpiDropTarget === kpi.key && 'border-green-400 opacity-80')}>
                  <div className="text-[9px] text-gray-400 font-sans line-through">{kpi.customLabel || kpi.label}</div>
                  <div className="text-[9px] text-gray-400 font-sans">masqué</div>
                </div>
              ))}
            </div>
          </div>,
        ) : null;

        case 'table': return wrapBand(
          <div className="px-8 py-3"
            onClick={(e) => { e.stopPropagation(); select('table'); }}>
            <div className={cn('overflow-hidden', tbl.showBorders ? 'border border-gray-300 rounded' : '')}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ backgroundColor: tbl.headerBg, color: tbl.headerColor }}>
                    {sortedFields.map((field) => {
                      const isSel = selection?.kind === 'field' && selection.key === field.key;
                      if (!field.visible) return (
                        <th key={field.key}
                          onClick={(e) => { e.stopPropagation(); select('field', field.key); }}
                          className={cn('w-3 min-w-[12px] max-w-[12px] px-0 py-2 cursor-pointer', isSel ? 'bg-blue-100' : 'opacity-40 hover:opacity-70')}
                          title={`${field.customLabel || field.label} (masqué)`}>
                          <div className="flex justify-center"><div className="w-[3px] h-5 bg-gray-300 rounded-full" /></div>
                        </th>
                      );
                      return (
                        <th key={field.key} draggable
                          onDragStart={() => handleDragStart(field.key)}
                          onDragOver={(e) => handleDragOver(e, field.key)}
                          onDrop={handleDrop}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => { e.stopPropagation(); select('field', field.key); }}
                          className={cn('group/col px-2 py-2 cursor-pointer transition-all select-none relative',
                            tbl.showBorders && 'border-b border-gray-300',
                            isSel ? 'bg-blue-100 text-blue-800 shadow-inner' : 'hover:bg-blue-50/60',
                            fieldDropTarget === field.key && dragItem.current !== field.key && 'bg-green-50')}
                          style={{ width: field.width ? `${field.width}%` : undefined, textAlign: field.style.textAlign, fontSize: field.style.fontSize, fontFamily: field.style.fontFamily, fontWeight: 600 }}>
                          {/* Drop indicator */}
                          {fieldDropTarget === field.key && dragItem.current !== field.key && (
                            <div className="absolute -left-[2px] top-1 bottom-1 w-[3px] bg-green-500 rounded-full z-10 shadow-sm shadow-green-500/50" />
                          )}
                          <div className="flex items-center gap-1">
                            <GripVertical size={10} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover/col:opacity-100 transition-opacity" />
                            <span className="truncate">{field.customLabel || field.label}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3].map((row) => (
                    <tr key={row}
                      className={cn(
                        tbl.showBorders && 'border-t border-gray-100',
                        tbl.stripedRows && row % 2 === 1 && 'bg-gray-50/50',
                      )}>
                      {sortedFields.map((field) => {
                        const isSel = selection?.kind === 'field' && selection.key === field.key;
                        if (!field.visible) return <td key={field.key} className="w-3 min-w-[12px] max-w-[12px] px-0 bg-gray-50/30" />;
                        return (
                          <td key={field.key}
                            className={cn('px-2 py-1.5', isSel && 'bg-blue-50/50')}
                            style={{ textAlign: field.style.textAlign, fontSize: field.style.fontSize, fontFamily: field.style.fontFamily, color: field.style.color, fontWeight: field.style.fontWeight as string, fontStyle: field.style.fontStyle }}>
                            {sampleValue(field.key, row)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {tbl.showTotalsRow && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: tbl.headerBg }}>
                      {sortedFields.map((field) => {
                        if (!field.visible) return <td key={field.key} className="w-3 min-w-[12px] max-w-[12px] px-0" />;
                        const isNum = /amount|debit|credit|balance|entry|exit|total|cash|subtotal|variation/i.test(field.key);
                        const isFirst = sortedFields.findIndex((f) => f.visible) === sortedFields.indexOf(field);
                        return (
                          <td key={field.key} className="px-2 py-1.5 font-sans text-[11px]"
                            style={{ textAlign: field.style.textAlign, color: tbl.headerColor }}>
                            {isFirst && !isNum ? tbl.totalsLabel : isNum ? '450 000' : ''}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {hiddenFields.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1 text-[9px] text-gray-400 font-sans">
                <EyeOff size={10} className="flex-shrink-0" />
                {hiddenFields.length} colonne(s) masquée(s): {hiddenFields.map((f) => f.customLabel || f.label).join(', ')}
              </div>
            )}
          </div>,
        );

        case 'summary': return wrapBand(
          <div className="px-8 py-3">
            <div className="border border-gray-200 rounded p-3 bg-gray-50/50 text-xs text-gray-600 font-sans italic">
              Zone de résumé personnalisable (texte libre, métriques agrégées...)
            </div>
          </div>,
        );

        case 'footer': return wrapBand(
          <div
            onClick={(e) => { e.stopPropagation(); select('footer'); }}
            className={cn('text-xs cursor-pointer transition-all relative', selection?.kind === 'footer' && 'bg-blue-50/60')}
            style={{ padding: `20px ${pg.marginRight}px ${pg.marginBottom}px ${pg.marginLeft}px`, fontFamily: ft.style.fontFamily, fontSize: ft.style.fontSize, color: ft.style.color }}>
            <div className="flex justify-between items-start">
              {ft.showEstabliPar ? (
                <div><span className="font-semibold text-gray-700">Établi par :</span>{' '}<span className="text-gray-500">Jean Dupont</span></div>
              ) : <div className="font-sans text-[10px] text-gray-300 line-through italic">"Établi par" (masqué)</div>}
              {ft.showVerifiePar ? (
                <div><span className="font-semibold text-gray-700">Vérifié par :</span>{' '}<span className="text-gray-500">{ft.verifiedByLabel || 'Le Directeur'}</span></div>
              ) : <div className="font-sans text-[10px] text-gray-300 line-through italic">"Vérifié par" (masqué)</div>}
            </div>
            {ft.showTimestamp
              ? <div className="text-gray-400 text-right mt-2">Imprimé le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              : <div className="text-right mt-2 font-sans text-[10px] text-gray-300 line-through italic">Date & heure (masqué)</div>}
          </div>,
        );
      }
      return null;
    };

    return (
      <div className="flex-1 overflow-auto p-6"
        style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
        onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3 max-w-[820px] mx-auto px-1">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-gray-200">{rp.name}</h2>
            {isModified(rp.id) && <Badge className="bg-brand-gold/15 text-brand-gold text-[10px]">{t('reportDesigner.modified', 'modifié')}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">{visibleFields.length}/{sortedFields.length} col · {visibleKpis.length}/{rp.kpis.length} KPI</span>

            {/* Zoom */}
            <div className="flex items-center gap-1 border border-white/10 rounded px-1">
              <button onClick={() => setZoom(Math.max(60, zoom - 10))} className="text-gray-400 hover:text-gray-200 p-0.5"><Minimize2 size={10} /></button>
              <span className="text-[10px] text-gray-500 w-8 text-center">{zoom}%</span>
              <button onClick={() => setZoom(Math.min(150, zoom + 10))} className="text-gray-400 hover:text-gray-200 p-0.5"><Maximize2 size={10} /></button>
            </div>

            {/* Page config */}
            <button onClick={() => select('page')}
              className={cn('p-1.5 rounded transition-colors border', selection?.kind === 'page' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-white/10 text-gray-400 hover:text-gray-200')}>
              <Ruler size={14} />
            </button>

            {isModified(rp.id) && (
              <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)}
                className="border-white/10 text-gray-400 hover:text-red-400 text-xs h-7">
                <RotateCcw size={12} className="mr-1" />{t('reportDesigner.resetReport', 'Réinitialiser')}
              </Button>
            )}
          </div>
        </div>

        {/* A4 Paper */}
        <div className="mx-auto bg-white rounded-sm relative"
          style={{
            maxWidth: rp.page.orientation === 'portrait' ? 820 : 1050,
            minHeight: rp.page.orientation === 'portrait' ? 700 : 500,
            boxShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
            fontFamily: "'Times New Roman', Georgia, serif",
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}>

          {/* Section bands rendered in order */}
          {sortedSections.map((sec) => sectionEl(sec.type))}
        </div>

        {/* Hints */}
        <div className="max-w-[820px] mx-auto mt-3 text-center">
          <p className="text-[10px] text-gray-500">
            Glissez les sections pour réordonner · Glissez les colonnes et KPIs pour les déplacer · Cliquez pour modifier le style
          </p>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     RIGHT — Properties Inspector
  ═══════════════════════════════════════════════════════════ */

  const PropertiesPanel = () => {
    if (!selectedReport) return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 p-4">
        <MousePointerClick size={28} strokeWidth={1.5} className="text-gray-600" />
        <p className="text-[10px] text-center text-gray-500">Sélectionnez d'abord un état</p>
      </div>
    );

    if (!selection) {
      // Default panel: show data sources summary + quick add buttons
      const dsGroups = [...new Set(DATA_SOURCE_FIELDS.map((f) => f.group))] as DataSourceGroup[];
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-brand-gold" />
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Sources de données</h3>
          </div>
          <p className="text-[10px] text-gray-500">
            {DATA_SOURCE_FIELDS.length} champs disponibles dans {dsGroups.length} sources. Ajoutez des colonnes ou KPIs depuis ces sources.
          </p>
          <div className="space-y-1">
            {dsGroups.map((g) => {
              const count = DATA_SOURCE_FIELDS.filter((f) => f.group === g).length;
              const usedCount = DATA_SOURCE_FIELDS.filter((f) => f.group === g && (selectedReport.fields.some((ef) => ef.key === f.key) || selectedReport.kpis.some((ek) => ek.key === f.key))).length;
              return (
                <div key={g} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.02] border border-white/5">
                  <Database size={10} className="text-brand-gold/50" />
                  <span className="text-[11px] text-gray-300 flex-1 truncate">{DATA_SOURCE_LABELS[g]}</span>
                  <span className="text-[9px] text-gray-500">{usedCount}/{count}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setFieldPickerMode('field'); setShowFieldPicker(true); }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-brand-gold bg-brand-gold/5 hover:bg-brand-gold/10 border border-brand-gold/20 rounded-lg py-2 transition-colors">
              <Plus size={12} /> Ajouter un champ
            </button>
            <button
              onClick={() => { setFieldPickerMode('kpi'); setShowFieldPicker(true); }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-brand-gold bg-brand-gold/5 hover:bg-brand-gold/10 border border-brand-gold/20 rounded-lg py-2 transition-colors">
              <Plus size={12} /> Ajouter un KPI
            </button>
          </div>
          <p className="text-[9px] text-gray-600 text-center">Cliquez sur un élément de l'aperçu pour personnaliser son style</p>
        </div>
      );
    }

    const rp = selectedReport;
    const CloseBtn = () => <button onClick={clearSelection} className="p-1 rounded hover:bg-white/10 text-gray-500"><X size={14} /></button>;

    /* ── Page properties ── */
    if (selection.kind === 'page') {
      const pg = rp.page;
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Page</h3>
            <CloseBtn />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Orientation</label>
            <div className="flex gap-1">
              {(['portrait', 'landscape'] as const).map((o) => (
                <button key={o} onClick={() => updatePage(rp.id, { orientation: o })}
                  className={cn('flex-1 text-[10px] py-1.5 rounded border transition-colors',
                    pg.orientation === o ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-white/10 text-gray-400 hover:bg-white/5')}>
                  {o === 'portrait' ? 'Portrait' : 'Paysage'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Marges (px)</label>
            <div className="grid grid-cols-2 gap-1.5">
              {([['marginTop', 'Haut'], ['marginBottom', 'Bas'], ['marginLeft', 'Gauche'], ['marginRight', 'Droite']] as const).map(([k, l]) => (
                <div key={k} className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-500 w-10">{l}</span>
                  <Input type="number" value={pg[k]} onChange={(e) => updatePage(rp.id, { [k]: Math.max(0, Math.min(80, Number(e.target.value))) })}
                    className="bg-white/5 border-white/10 text-xs h-7 w-14" />
                </div>
              ))}
            </div>
          </div>

          {/* Sections order */}
          <div className="pt-3 border-t border-white/10">
            <label className="block text-[10px] text-gray-500 uppercase mb-2">Sections (ordre & visibilité)</label>
            <div className="space-y-1">
              {[...rp.sections].sort((a, b) => a.order - b.order).map((sec, idx, arr) => {
                const Icon = SECTION_ICONS[sec.type];
                const moveSecUp = () => {
                  if (idx === 0) return;
                  const types = arr.map((s) => s.type);
                  [types[idx], types[idx - 1]] = [types[idx - 1], types[idx]];
                  reorderSections(rp.id, types);
                };
                const moveSecDown = () => {
                  if (idx === arr.length - 1) return;
                  const types = arr.map((s) => s.type);
                  [types[idx], types[idx + 1]] = [types[idx + 1], types[idx]];
                  reorderSections(rp.id, types);
                };
                return (
                  <div key={sec.type} className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-white/5 group/secitem">
                    <GripVertical size={10} className="text-gray-600 flex-shrink-0" />
                    <Icon size={12} className="text-gray-500 flex-shrink-0" />
                    <span className="text-[11px] text-gray-300 flex-1 truncate">{SECTION_LABELS[sec.type]}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/secitem:opacity-100 transition-opacity">
                      <button onClick={moveSecUp} disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-white/10 text-gray-500 disabled:opacity-30"><ArrowUp size={10} /></button>
                      <button onClick={moveSecDown} disabled={idx === arr.length - 1}
                        className="p-0.5 rounded hover:bg-white/10 text-gray-500 disabled:opacity-30"><ArrowDown size={10} /></button>
                    </div>
                    <button onClick={() => updateSection(rp.id, sec.type, { visible: !sec.visible })}
                      className={cn('p-0.5 rounded transition-colors', sec.visible ? 'text-green-400' : 'text-gray-600')}>
                      {sec.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    /* ── Section properties ── */
    if (selection.kind === 'section' && selection.key) {
      const sec = rp.sections.find((s) => s.type === selection.key);
      if (!sec) return null;
      const sortedSecs = [...rp.sections].sort((a, b) => a.order - b.order);
      const secIdx = sortedSecs.findIndex((s) => s.type === sec.type);
      const moveSec = (dir: 'up' | 'down') => {
        const types = sortedSecs.map((s) => s.type);
        const target = dir === 'up' ? secIdx - 1 : secIdx + 1;
        if (target < 0 || target >= types.length) return;
        [types[secIdx], types[target]] = [types[target], types[secIdx]];
        reorderSections(rp.id, types);
      };
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">{SECTION_LABELS[sec.type]}</h3>
            <CloseBtn />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => updateSection(rp.id, sec.type, { visible: !sec.visible })}
              className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer',
                sec.visible ? 'bg-green-500 border-green-500' : 'border-gray-600')}>
              {sec.visible && <Check size={10} className="text-white" />}
            </div>
            <span className="text-xs text-gray-300">{sec.visible ? 'Visible' : 'Masqué'}</span>
          </label>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Position ({secIdx + 1}/{sortedSecs.length})</label>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={secIdx === 0} onClick={() => moveSec('up')}
                className="border-white/10 text-xs h-6 flex-1"><ArrowUp size={12} className="mr-1" />Monter</Button>
              <Button variant="outline" size="sm" disabled={secIdx === sortedSecs.length - 1} onClick={() => moveSec('down')}
                className="border-white/10 text-xs h-6 flex-1"><ArrowDown size={12} className="mr-1" />Descendre</Button>
            </div>
          </div>
          <p className="text-[10px] text-gray-500">Glissez la section directement sur l'aperçu ou utilisez les boutons ci-dessus. Cliquez sur les éléments à l'intérieur pour modifier leur style.</p>
        </div>
      );
    }

    /* ── Header properties ── */
    if (selection.kind === 'header') {
      const hd = rp.header;
      const toggles: { key: HeaderBoolKey; label: string }[] = [
        { key: 'showCompanyName', label: 'Nom de la société' },
        { key: 'showCompanyAddress', label: 'Adresse' },
        { key: 'showCompanyPhone', label: 'Téléphone' },
        { key: 'showCompanyTaxId', label: 'N° fiscal / RCCM' },
        { key: 'showLogo', label: 'Logo' },
      ];
      return (
        <div className="p-4 space-y-3 overflow-y-auto max-h-full">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">En-tête</h3>
            <CloseBtn />
          </div>
          <div className="space-y-1">
            {toggles.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                <div onClick={() => updateHeader(rp.id, { [key]: !hd[key] })}
                  className={cn('w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer',
                    hd[key] ? 'bg-brand-gold border-brand-gold' : 'border-gray-600')}>
                  {hd[key] && <Check size={10} className="text-black" />}
                </div>
                <span className="text-xs text-gray-300">{label}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="block text-[10px] text-gray-500 uppercase">Titre personnalisé</label>
            <Input value={hd.customTitle || ''} onChange={(e) => updateHeader(rp.id, { customTitle: e.target.value || undefined })}
              placeholder={rp.name} className="bg-white/5 border-white/10 text-xs h-7" />
            <label className="block text-[10px] text-gray-500 uppercase">Sous-titre</label>
            <Input value={hd.customSubtitle || ''} onChange={(e) => updateHeader(rp.id, { customSubtitle: e.target.value || undefined })}
              placeholder="Ex: Exercice 2025" className="bg-white/5 border-white/10 text-xs h-7" />
          </div>
          <StyleEditor label="Style du titre" style={hd.titleStyle} onChange={(s) => updateHeader(rp.id, { titleStyle: { ...hd.titleStyle, ...s } })} />
          <StyleEditor label="Style société" style={hd.companyStyle} onChange={(s) => updateHeader(rp.id, { companyStyle: { ...hd.companyStyle, ...s } })} />
        </div>
      );
    }

    /* ── KPI properties ── */
    if (selection.kind === 'kpi' && selection.key) {
      const kpi = rp.kpis.find((k) => k.key === selection.key);
      if (!kpi) return null;
      return (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Indicateur</h3>
            <CloseBtn />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Libellé</label>
            <Input value={kpi.customLabel || kpi.label}
              onChange={(e) => updateKpi(rp.id, kpi.key, { customLabel: e.target.value || undefined })}
              className="bg-white/5 border-white/10 text-xs h-7" />
            {kpi.customLabel && kpi.customLabel !== kpi.label && (
              <span className="text-[9px] text-gray-500 mt-0.5 block">par défaut: {kpi.label}</span>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => updateKpi(rp.id, kpi.key, { visible: !kpi.visible })}
              className={cn('w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer',
                kpi.visible ? 'bg-green-500 border-green-500' : 'border-gray-600')}>
              {kpi.visible && <Check size={10} className="text-white" />}
            </div>
            <span className="text-xs text-gray-300">{kpi.visible ? 'Visible' : 'Masqué'}</span>
          </label>
          {/* Remove custom KPI */}
          {!DEFAULT_REPORTS.find((d) => d.id === rp.id)?.kpis.some((dk) => dk.key === kpi.key) && (
            <button onClick={() => { removeKpi(rp.id, kpi.key); clearSelection(); }}
              className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors w-full">
              <Trash2 size={12} /> Supprimer ce KPI
            </button>
          )}
          <StyleEditor label="Style" style={kpi.style} onChange={(s) => updateKpiStyle(rp.id, kpi.key, s)} />
          {/* Quick nav */}
          <div className="pt-2 border-t border-white/10">
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Tous les KPIs</label>
            <div className="space-y-0.5">{rp.kpis.map((k) => (
              <button key={k.key} onClick={() => select('kpi', k.key)}
                className={cn('w-full text-left text-[11px] px-2 py-0.5 rounded flex items-center gap-2',
                  k.key === selection.key ? 'bg-blue-500/15 text-blue-400' : 'text-gray-400 hover:bg-white/5',
                  !k.visible && 'opacity-50')}>
                {k.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                <span className="truncate">{k.customLabel || k.label}</span>
              </button>
            ))}</div>
            <button
              onClick={() => { setFieldPickerMode('kpi'); setShowFieldPicker(true); }}
              className="mt-1.5 flex items-center gap-1.5 text-[11px] text-brand-gold hover:text-brand-gold/80 hover:bg-brand-gold/10 px-2 py-1 rounded transition-colors w-full">
              <Plus size={12} /> Ajouter un KPI
            </button>
          </div>
        </div>
      );
    }

    /* ── Table properties ── */
    if (selection.kind === 'table') {
      const tbl = rp.table;
      return (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Tableau</h3>
            <CloseBtn />
          </div>
          <div className="space-y-1.5">
            {([
              ['showBorders', 'Bordures du tableau'],
              ['stripedRows', 'Lignes alternées'],
              ['showTotalsRow', 'Ligne de totaux'],
            ] as [keyof Pick<typeof tbl, 'showBorders' | 'stripedRows' | 'showTotalsRow'>, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                <div onClick={() => updateTable(rp.id, { [key]: !tbl[key] })}
                  className={cn('w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer',
                    tbl[key] ? 'bg-brand-gold border-brand-gold' : 'border-gray-600')}>
                  {tbl[key] && <Check size={10} className="text-black" />}
                </div>
                <span className="text-xs text-gray-300">{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Libellé totaux</label>
            <Input value={tbl.totalsLabel} onChange={(e) => updateTable(rp.id, { totalsLabel: e.target.value })}
              className="bg-white/5 border-white/10 text-xs h-7" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 uppercase mb-1">Fond en-tête</label>
              <div className="flex gap-1">
                {['#f3f4f6', '#e5e7eb', '#dbeafe', '#fef9c3', '#dcfce7', '#ffffff'].map((c) => (
                  <button key={c} onClick={() => updateTable(rp.id, { headerBg: c })}
                    className={cn('w-5 h-5 rounded border-2', tbl.headerBg === c ? 'border-brand-gold' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 uppercase mb-1">Texte en-tête</label>
              <div className="flex gap-1">
                {['#374151', '#111827', '#1e40af', '#991b1b', '#166534'].map((c) => (
                  <button key={c} onClick={() => updateTable(rp.id, { headerColor: c })}
                    className={cn('w-5 h-5 rounded border-2', tbl.headerColor === c ? 'border-brand-gold' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 italic">Cliquez sur une colonne du tableau pour modifier son style individuel</p>
        </div>
      );
    }

    /* ── Field / Column properties ── */
    if (selection.kind === 'field' && selection.key) {
      const sorted = [...rp.fields].sort((a, b) => a.order - b.order);
      const field = sorted.find((f) => f.key === selection.key);
      if (!field) return null;
      const idx = sorted.indexOf(field);
      return (
        <div className="p-4 space-y-3 overflow-y-auto max-h-full">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Colonne</h3>
            <CloseBtn />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Libellé</label>
            <Input value={field.customLabel || field.label}
              onChange={(e) => updateField(rp.id, field.key, { customLabel: e.target.value || undefined })}
              className="bg-white/5 border-white/10 text-xs h-7" />
            {field.customLabel && field.customLabel !== field.label && (
              <span className="text-[9px] text-gray-500 mt-0.5 block">par défaut: {field.label}</span>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => updateField(rp.id, field.key, { visible: !field.visible })}
              className={cn('w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer',
                field.visible ? 'bg-green-500 border-green-500' : 'border-gray-600')}>
              {field.visible && <Check size={10} className="text-white" />}
            </div>
            <span className="text-xs text-gray-300">{field.visible ? 'Visible' : 'Masqué'}</span>
          </label>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Largeur (%)</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={60} value={field.width || 0}
                onChange={(e) => updateField(rp.id, field.key, { width: Number(e.target.value) || undefined })}
                className="flex-1 h-1 accent-brand-gold" />
              <span className="text-[10px] text-gray-400 w-10 text-right">{field.width ? `${field.width}%` : 'auto'}</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Position ({idx + 1}/{sorted.length})</label>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => moveField(field.key, 'up')}
                className="border-white/10 text-xs h-6 flex-1"><ArrowUp size={12} className="mr-1" />Monter</Button>
              <Button variant="outline" size="sm" disabled={idx === sorted.length - 1} onClick={() => moveField(field.key, 'down')}
                className="border-white/10 text-xs h-6 flex-1"><ArrowDown size={12} className="mr-1" />Descendre</Button>
            </div>
          </div>
          <StyleEditor label="Style de la colonne" style={field.style} onChange={(s) => updateFieldStyle(rp.id, field.key, s)} />
          {/* Remove custom field */}
          {!DEFAULT_REPORTS.find((d) => d.id === rp.id)?.fields.some((df) => df.key === field.key) && (
            <button onClick={() => { removeField(rp.id, field.key); clearSelection(); }}
              className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors w-full">
              <Trash2 size={12} /> Supprimer cette colonne
            </button>
          )}
          {/* Quick nav */}
          <div className="pt-2 border-t border-white/10">
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Toutes les colonnes</label>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">{sorted.map((f, i) => (
              <button key={f.key} onClick={() => select('field', f.key)}
                className={cn('w-full text-left text-[11px] px-2 py-0.5 rounded flex items-center gap-2',
                  f.key === selection.key ? 'bg-blue-500/15 text-blue-400' : 'text-gray-400 hover:bg-white/5',
                  !f.visible && 'opacity-50')}>
                <span className="w-3 text-center text-[9px] text-gray-600">{i + 1}</span>
                {f.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                <span className="truncate">{f.customLabel || f.label}</span>
              </button>
            ))}</div>
            <button
              onClick={() => { setFieldPickerMode('field'); setShowFieldPicker(true); }}
              className="mt-1.5 flex items-center gap-1.5 text-[11px] text-brand-gold hover:text-brand-gold/80 hover:bg-brand-gold/10 px-2 py-1 rounded transition-colors w-full">
              <Plus size={12} /> Ajouter un champ
            </button>
          </div>
        </div>
      );
    }

    /* ── Footer properties ── */
    if (selection.kind === 'footer') {
      const ftr = rp.footer;
      const toggles: { key: FooterBoolKey; label: string }[] = [
        { key: 'showEstabliPar', label: '"Établi par" (caissier)' },
        { key: 'showVerifiePar', label: '"Vérifié par" (directeur)' },
        { key: 'showTimestamp', label: "Date & heure d'impression" },
      ];
      return (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Pied de page</h3>
            <CloseBtn />
          </div>
          <div className="space-y-1">
            {toggles.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                <div onClick={() => updateFooter(rp.id, { [key]: !ftr[key] })}
                  className={cn('w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer',
                    ftr[key] ? 'bg-brand-gold border-brand-gold' : 'border-gray-600')}>
                  {ftr[key] && <Check size={10} className="text-black" />}
                </div>
                <span className="text-xs text-gray-300">{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Libellé "Vérifié par"</label>
            <Input value={ftr.verifiedByLabel || ''} onChange={(e) => updateFooter(rp.id, { verifiedByLabel: e.target.value || undefined })}
              placeholder="Le Directeur" className="bg-white/5 border-white/10 text-xs h-7" />
          </div>
          <StyleEditor label="Style pied de page" style={ftr.style} onChange={(s) => updateFooter(rp.id, { style: { ...ftr.style, ...s } })} />
        </div>
      );
    }

    return null;
  };

  /* ═══════════════════════════════════════════════════════════
     MAIN RENDER
  ═══════════════════════════════════════════════════════════ */

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div>
          <h1 className="text-lg font-bold text-gray-100">{t('reportDesigner.title', "Éditeur d'états imprimables")}</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Conception visuelle DFM — Cliquez directement sur l'aperçu PDF pour personnaliser la structure, les champs et la mise en page
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync status */}
          {isSyncing && (
            <span className="flex items-center gap-1 text-[10px] text-brand-gold animate-pulse">
              <Loader2 size={12} className="animate-spin" /> Synchronisation…
            </span>
          )}
          {saveSuccess && !isSyncing && (
            <span className="flex items-center gap-1 text-[10px] text-green-400">
              <CheckCircle2 size={12} /> Enregistré
            </span>
          )}
          {syncError && !isSyncing && (
            <span className="flex items-center gap-1 text-[10px] text-red-400" title={syncError}>
              <CloudOff size={12} /> Erreur
            </span>
          )}
          {lastSyncedAt && !isSyncing && !saveSuccess && !syncError && (
            <span className="text-[9px] text-gray-500">
              Dernière sync: {new Date(lastSyncedAt).toLocaleTimeString('fr-FR')}
            </span>
          )}

          {/* Save current */}
          {selectedReportId && (
            <Button variant="outline" size="sm" disabled={isSyncing}
              onClick={async () => {
                await saveToServer(selectedReportId);
                if (!useReportConfigStore.getState().syncError) {
                  setSaveSuccess(true);
                  setTimeout(() => setSaveSuccess(false), 2000);
                }
              }}
              className="text-brand-gold border-brand-gold/30 hover:bg-brand-gold/10 text-xs">
              <Save size={12} className="mr-1.5" />Enregistrer
            </Button>
          )}

          {/* Save all */}
          <Button variant="outline" size="sm" disabled={isSyncing}
            onClick={async () => {
              await saveAllToServer();
              if (!useReportConfigStore.getState().syncError) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
              }
            }}
            className="text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10 text-xs">
            <CloudUpload size={12} className="mr-1.5" />Tout enregistrer
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowResetAllConfirm(true)}
            className="text-gray-400 hover:text-red-400 border-white/10 text-xs">
            <RotateCcw size={12} className="mr-1.5" />{t('reportDesigner.resetAll', 'Tout réinitialiser')}
          </Button>
        </div>
      </div>

      {/* Three columns */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 border-r border-white/10 overflow-y-auto p-2 space-y-2 flex-shrink-0">
          <CategoryGroup cat="daily" label={t('reportDesigner.dailyReports', 'États journaliers')} items={dailyReports} />
          <CategoryGroup cat="period" label={t('reportDesigner.periodReports', 'États périodiques')} items={periodReports} />

          {/* ── Data Source Panel ── */}
          {selectedReport && (
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
                <Database size={12} className="text-brand-gold" />
                Sources de données
              </div>
              <div className="mt-1 space-y-0.5 max-h-60 overflow-y-auto">
                {(() => {
                  const groups = [...new Set(DATA_SOURCE_FIELDS.map((f) => f.group))] as DataSourceGroup[];
                  return groups.map((g) => {
                    const fields = DATA_SOURCE_FIELDS.filter((f) => f.group === g);
                    return (
                      <details key={g} className="group/ds">
                        <summary className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-[11px] text-gray-400 select-none">
                          <ChevronRight size={10} className="transition-transform group-open/ds:rotate-90 text-gray-600" />
                          <span className="truncate flex-1">{DATA_SOURCE_LABELS[g]}</span>
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-white/10 text-gray-500">{fields.length}</Badge>
                        </summary>
                        <div className="ml-4 mt-0.5 space-y-0">
                          {fields.map((f) => {
                            const Icon = FIELD_TYPE_ICON[f.type] || Type;
                            const alreadyField = selectedReport.fields.some((ef) => ef.key === f.key);
                            const alreadyKpi = selectedReport.kpis.some((ek) => ek.key === f.key);
                            return (
                              <div key={f.key}
                                className={cn('flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px]',
                                  (alreadyField || alreadyKpi) ? 'text-gray-600' : 'text-gray-400 hover:bg-white/5')}>
                                <Icon size={9} className={(alreadyField || alreadyKpi) ? 'text-gray-600' : 'text-brand-gold/60'} />
                                <span className="truncate flex-1">{f.label}</span>
                                {(alreadyField || alreadyKpi) && <Check size={8} className="text-green-500/50" />}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    );
                  });
                })()}
              </div>
              <div className="flex gap-1 mt-2 px-1">
                <button
                  onClick={() => { setFieldPickerMode('field'); setShowFieldPicker(true); }}
                  className="flex-1 flex items-center justify-center gap-1 text-[10px] text-brand-gold hover:text-brand-gold/80 bg-brand-gold/5 hover:bg-brand-gold/10 border border-brand-gold/20 rounded py-1 transition-colors">
                  <Plus size={10} /> Champ
                </button>
                <button
                  onClick={() => { setFieldPickerMode('kpi'); setShowFieldPicker(true); }}
                  className="flex-1 flex items-center justify-center gap-1 text-[10px] text-brand-gold hover:text-brand-gold/80 bg-brand-gold/5 hover:bg-brand-gold/10 border border-brand-gold/20 rounded py-1 transition-colors">
                  <Plus size={10} /> KPI
                </button>
              </div>
            </div>
          )}
        </div>
        <PaperView />
        <div className="w-64 border-l border-white/10 overflow-y-auto flex-shrink-0">
          <PropertiesPanel />
        </div>
      </div>

      {/* ── Field / KPI Picker Modal ── */}
      {showFieldPicker && selectedReport && (() => {
        const allGroups = [...new Set(DATA_SOURCE_FIELDS.map((f) => f.group))] as DataSourceGroup[];
        const existingKeys = new Set(
          fieldPickerMode === 'field'
            ? selectedReport.fields.map((f) => f.key)
            : selectedReport.kpis.map((k) => k.key)
        );
        const filteredFields = DATA_SOURCE_FIELDS
          .filter((f) => fieldPickerGroup === 'all' || f.group === fieldPickerGroup)
          .filter((f) =>
            !fieldPickerSearch || f.label.toLowerCase().includes(fieldPickerSearch.toLowerCase()) || f.key.toLowerCase().includes(fieldPickerSearch.toLowerCase())
          );

        const handleAdd = (dsField: DataSourceField) => {
          if (!selectedReport) return;
          if (fieldPickerMode === 'field') {
            const newField: ReportFieldConfig = {
              key: dsField.key,
              label: dsField.label,
              visible: true,
              order: selectedReport.fields.length,
              style: { fontFamily: 'sans-serif', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', color: '#374151' },
            };
            addField(selectedReport.id, newField);
          } else {
            const newKpi: ReportKpiConfig = {
              key: dsField.key,
              label: dsField.label,
              visible: true,
              style: { fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center', color: '#111827' },
            };
            addKpi(selectedReport.id, newKpi);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowFieldPicker(false)}>
            <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-brand-gold" />
                  <h3 className="font-bold text-sm text-gray-100">
                    {fieldPickerMode === 'field' ? 'Ajouter un champ (colonne)' : 'Ajouter un indicateur (KPI)'}
                  </h3>
                </div>
                <button onClick={() => setShowFieldPicker(false)} className="text-gray-500 hover:text-gray-300 p-1"><X size={16} /></button>
              </div>

              {/* Search + group filter */}
              <div className="px-5 py-3 border-b border-white/10 space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Rechercher un champ…"
                    value={fieldPickerSearch}
                    onChange={(e) => setFieldPickerSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-brand-gold/50"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setFieldPickerGroup('all')}
                    className={cn('px-2 py-0.5 rounded-full text-[10px] border transition-colors',
                      fieldPickerGroup === 'all'
                        ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold'
                        : 'border-white/10 text-gray-400 hover:bg-white/5')}>
                    Tous
                  </button>
                  {allGroups.map((g) => (
                    <button
                      key={g}
                      onClick={() => setFieldPickerGroup(g)}
                      className={cn('px-2 py-0.5 rounded-full text-[10px] border transition-colors',
                        fieldPickerGroup === g
                          ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold'
                          : 'border-white/10 text-gray-400 hover:bg-white/5')}>
                      {DATA_SOURCE_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field list */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
                {filteredFields.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-6">Aucun champ trouvé</p>
                ) : (
                  (() => {
                    // Group filtered fields by group
                    const byGroup = filteredFields.reduce<Record<string, DataSourceField[]>>((acc, f) => {
                      (acc[f.group] ??= []).push(f);
                      return acc;
                    }, {});
                    return Object.entries(byGroup).map(([g, fields]) => (
                      <div key={g}>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5">
                          <Database size={10} /> {DATA_SOURCE_LABELS[g as DataSourceGroup]}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {fields.map((f) => {
                            const already = existingKeys.has(f.key);
                            const Icon = FIELD_TYPE_ICON[f.type] || Type;
                            return (
                              <button
                                key={f.key}
                                disabled={already}
                                onClick={() => handleAdd(f)}
                                className={cn(
                                  'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[11px] transition-colors',
                                  already
                                    ? 'border-white/5 text-gray-600 bg-white/[0.02] cursor-not-allowed'
                                    : 'border-white/10 text-gray-300 hover:border-brand-gold/30 hover:bg-brand-gold/5 cursor-pointer'
                                )}>
                                <Icon size={12} className={already ? 'text-gray-600' : 'text-brand-gold/70'} />
                                <span className="truncate flex-1">{f.label}</span>
                                {already ? (
                                  <Check size={10} className="text-green-500/50 flex-shrink-0" />
                                ) : (
                                  <Plus size={10} className="text-brand-gold/50 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
                <span className="text-[10px] text-gray-500">
                  {filteredFields.length} champ{filteredFields.length > 1 ? 's' : ''} disponible{filteredFields.length > 1 ? 's' : ''}
                  {' · '}{existingKeys.size} déjà ajouté{existingKeys.size > 1 ? 's' : ''}
                </span>
                <Button variant="outline" size="sm" onClick={() => setShowFieldPicker(false)}
                  className="text-xs border-white/10">Fermer</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reset single modal */}
      {showResetConfirm && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3 text-yellow-400"><AlertTriangle size={20} /><h3 className="font-bold">{t('reportDesigner.confirmResetTitle', 'Réinitialiser cet état ?')}</h3></div>
            <p className="text-sm text-gray-300">{t('reportDesigner.confirmResetMsg', 'La configuration de « {{name}} » sera rétablie.', { name: selectedReport.name })}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>{t('common.cancel', 'Annuler')}</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => { resetReport(selectedReport.id); setShowResetConfirm(false); setSelection(null); }}>
                {t('reportDesigner.resetConfirm', 'Réinitialiser')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset all modal */}
      {showResetAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3 text-red-400"><AlertTriangle size={20} /><h3 className="font-bold">{t('reportDesigner.confirmResetAllTitle', 'Tout réinitialiser ?')}</h3></div>
            <p className="text-sm text-gray-300">{t('reportDesigner.confirmResetAllMsg', 'Toutes les personnalisations seront perdues.')}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowResetAllConfirm(false)}>{t('common.cancel', 'Annuler')}</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => { resetAll(); setShowResetAllConfirm(false); setSelection(null); }}>
                {t('reportDesigner.resetConfirm', 'Réinitialiser')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
