import { useState, useRef, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { useImportFneInvoices } from '@/hooks/useFneInvoices';
import type { CreateFneInvoicePayload, CreateFneInvoiceItemPayload, FneTemplate, FnePaymentMethod } from '@/types/fne';

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ─── CSV Template ─── */
const CSV_HEADERS = [
  'template', 'paymentMethod', 'clientCompanyName', 'clientPhone', 'clientEmail',
  'clientNcc', 'pointOfSale', 'establishment', 'discount',
  'itemDescription', 'itemReference', 'itemQuantity', 'itemAmount', 'itemDiscount', 'itemTax', 'itemUnit',
];

const CSV_EXAMPLE = [
  CSV_HEADERS.join(';'),
  'B2C;cash;Société ABC;+22500000001;contact@abc.ci;;PDV Principal;Établissement 1;0;Ordinateur portable HP;REF-001;2;350000;0;TVA;unité',
  ';;;;;;;;;;Souris sans fil;REF-002;5;15000;0;TVA;unité',
  'B2B;transfer;Entreprise XYZ;+22500000002;info@xyz.ci;NCC-12345;PDV Principal;Établissement 1;5;Service consulting;SRV-001;10;50000;0;TVA;heure',
].join('\n');

const VALID_TEMPLATES = ['B2B', 'B2C', 'B2G', 'B2F'];
const VALID_PAYMENTS = ['cash', 'card', 'check', 'mobile-money', 'transfer', 'deferred'];
const VALID_TAXES = ['TVA', 'TVAB', 'TVAC', 'TVAD', 'TVAE'];

/* ─── CSV parsing ─── */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ';' || ch === ',') { fields.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

interface ParsedInvoice {
  invoice: CreateFneInvoicePayload;
  rowStart: number;
  rowEnd: number;
}

function parseCsvToInvoices(text: string): { invoices: ParsedInvoice[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { invoices: [], errors: ['Le fichier doit contenir au moins un en-tête + une ligne de données.'] };

  // Skip header
  const dataLines = lines.slice(1);
  const invoices: ParsedInvoice[] = [];
  const errors: string[] = [];

  let currentInvoice: CreateFneInvoicePayload | null = null;
  let currentItems: CreateFneInvoiceItemPayload[] = [];
  let rowStart = 2;

  const flushInvoice = (rowEnd: number) => {
    if (currentInvoice && currentItems.length > 0) {
      invoices.push({ invoice: { ...currentInvoice, items: currentItems }, rowStart, rowEnd });
    }
    currentInvoice = null;
    currentItems = [];
  };

  for (let i = 0; i < dataLines.length; i++) {
    const fields = parseCsvLine(dataLines[i]);
    const rowNum = i + 2; // 1-based, accounting for header

    const [
      template, paymentMethod, clientCompanyName, clientPhone, clientEmail,
      clientNcc, pointOfSale, establishment, discount,
      itemDescription, itemReference, itemQuantity, itemAmount, itemDiscount, itemTax, itemUnit,
    ] = fields;

    // If invoice-level fields are present, start a new invoice
    if (clientCompanyName && clientPhone) {
      flushInvoice(rowNum - 1);
      rowStart = rowNum;

      if (!VALID_TEMPLATES.includes(template)) {
        errors.push(`Ligne ${rowNum}: template invalide "${template}" (attendu: ${VALID_TEMPLATES.join(', ')})`);
        continue;
      }
      if (!VALID_PAYMENTS.includes(paymentMethod)) {
        errors.push(`Ligne ${rowNum}: méthode de paiement invalide "${paymentMethod}" (attendu: ${VALID_PAYMENTS.join(', ')})`);
        continue;
      }

      currentInvoice = {
        template: template as FneTemplate,
        invoiceType: 'sale',
        paymentMethod: paymentMethod as FnePaymentMethod,
        clientCompanyName,
        clientPhone,
        clientEmail: clientEmail || '',
        clientNcc: clientNcc || undefined,
        pointOfSale: pointOfSale || '',
        establishment: establishment || '',
        discount: discount ? Number(discount) : 0,
        items: [],
      };
    }

    // Parse item
    if (!itemDescription) {
      if (!clientCompanyName) errors.push(`Ligne ${rowNum}: ligne vide ou incomplète, ignorée.`);
      continue;
    }

    if (!currentInvoice) {
      errors.push(`Ligne ${rowNum}: article sans facture associée (il manque les champs client).`);
      continue;
    }

    const qty = Number(itemQuantity);
    const amt = Number(itemAmount);
    if (!qty || qty <= 0) { errors.push(`Ligne ${rowNum}: quantité invalide "${itemQuantity}".`); continue; }
    if (!amt || amt < 0) { errors.push(`Ligne ${rowNum}: montant invalide "${itemAmount}".`); continue; }

    const tax = (itemTax || 'TVA').toUpperCase();
    if (!VALID_TAXES.includes(tax)) {
      errors.push(`Ligne ${rowNum}: taxe invalide "${itemTax}" (attendu: ${VALID_TAXES.join(', ')})`);
      continue;
    }

    currentItems.push({
      description: itemDescription,
      reference: itemReference || undefined,
      quantity: qty,
      amount: amt,
      discount: itemDiscount ? Number(itemDiscount) : 0,
      taxes: [tax],
      measurementUnit: itemUnit || undefined,
    });
  }

  // Flush last invoice
  flushInvoice(dataLines.length + 1);

  return { invoices, errors };
}

/* ─── Component ─── */
export default function ImportFneInvoicesDialog({ open, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsed, setParsed] = useState<ParsedInvoice[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; errors: Array<{ index: number; error: string }> } | null>(null);
  const [fileName, setFileName] = useState('');
  const importMutation = useImportFneInvoices();

  const reset = useCallback(() => {
    setStep('upload');
    setParseErrors([]);
    setParsed([]);
    setImportResult(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { invoices, errors } = parseCsvToInvoices(text);
      setParsed(invoices);
      setParseErrors(errors);
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    try {
      const result = await importMutation.mutateAsync(parsed.map((p) => p.invoice));
      setImportResult(result);
      setStep('result');
    } catch {
      // Error shown via mutation state
    }
  };

  const downloadTemplate = () => {
    const bom = '\uFEFF';
    const blob = new Blob([bom + CSV_EXAMPLE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele_import_factures_fne.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            <FileSpreadsheet className="inline-block mr-2 h-5 w-5" />
            Importer des factures
          </h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Importez un fichier CSV pour créer plusieurs factures en brouillon.
              Chaque groupe de lignes avec les mêmes informations client constitue une facture.
            </p>

            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-brand-gold transition-colors">
              <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-3">
                Glissez-déposez un fichier CSV ou cliquez pour sélectionner
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFile}
                className="hidden"
              />
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
                Choisir un fichier
              </Button>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-800 mb-2">Format attendu (séparateur: point-virgule ;)</p>
              <p className="text-xs text-blue-700 mb-2">
                Colonnes : <code className="bg-blue-100 px-1 rounded">template;paymentMethod;clientCompanyName;clientPhone;clientEmail;clientNcc;pointOfSale;establishment;discount;itemDescription;itemReference;itemQuantity;itemAmount;itemDiscount;itemTax;itemUnit</code>
              </p>
              <ul className="text-xs text-blue-700 space-y-1 mb-3">
                <li>• <strong>Première ligne</strong> d'une facture : remplissez tous les champs</li>
                <li>• <strong>Lignes suivantes</strong> (articles) : laissez les champs client vides</li>
                <li>• <strong>template</strong> : B2B, B2C, B2G ou B2F</li>
                <li>• <strong>paymentMethod</strong> : cash, card, check, mobile-money, transfer, deferred</li>
                <li>• <strong>itemTax</strong> : TVA (18%), TVAB (9%), TVAC (0%), TVAD (0%), TVAE</li>
              </ul>
              <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-blue-600">
                <Download className="mr-2 h-4 w-4" /> Télécharger le modèle CSV
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline">{fileName}</Badge>
              <span className="text-sm text-gray-600">
                {parsed.length} facture{parsed.length > 1 ? 's' : ''} détectée{parsed.length > 1 ? 's' : ''}
                ({parsed.reduce((s, p) => s + p.invoice.items.length, 0)} articles)
              </span>
            </div>

            {/* Parse warnings */}
            {parseErrors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-800 mb-1">
                  <AlertTriangle className="inline-block mr-1 h-4 w-4" />
                  {parseErrors.length} avertissement{parseErrors.length > 1 ? 's' : ''} :
                </p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {parseErrors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}

            {/* Invoice preview table */}
            {parsed.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2">Template</th>
                      <th className="px-3 py-2">Articles</th>
                      <th className="px-3 py-2 text-right">Total estimé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((p, idx) => {
                      const totalHt = p.invoice.items.reduce((s, it) => {
                        const ht = it.quantity * it.amount * (1 - (it.discount ?? 0) / 100);
                        return s + ht;
                      }, 0);
                      return (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2 text-gray-900">{p.invoice.clientCompanyName}</td>
                          <td className="px-3 py-2"><Badge variant="outline">{p.invoice.template}</Badge></td>
                          <td className="px-3 py-2 text-gray-600">{p.invoice.items.length} article{p.invoice.items.length > 1 ? 's' : ''}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{totalHt.toLocaleString('fr-FR')} FCFA</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {parsed.length === 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
                <p className="text-sm text-red-700">Aucune facture valide détectée dans le fichier.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="ghost" onClick={reset}>Changer de fichier</Button>
              <Button
                onClick={handleImport}
                disabled={parsed.length === 0 || importMutation.isPending}
                className="bg-brand-gold text-white hover:bg-brand-gold/90"
              >
                {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Importer {parsed.length} facture{parsed.length > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {step === 'result' && importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {importResult.imported} facture{importResult.imported > 1 ? 's' : ''} importée{importResult.imported > 1 ? 's' : ''} en brouillon.
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  Vous pouvez les certifier individuellement ou en masse depuis la liste.
                </p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-800 mb-2">
                  {importResult.errors.length} erreur{importResult.errors.length > 1 ? 's' : ''} :
                </p>
                <ul className="text-xs text-red-700 space-y-1">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>• Facture #{e.index} : {e.error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <Button onClick={handleClose}>Fermer</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
