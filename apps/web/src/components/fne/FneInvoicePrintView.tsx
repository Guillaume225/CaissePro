import type { FneInvoice } from '@/types/fne';
import type { FneSettingRecord } from '@/types/fne';
import type { Company } from '@/types/admin';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Carte bancaire',
  check: 'Chèque',
  'mobile-money': 'Mobile Money',
  transfer: 'Virement',
  deferred: 'Différé',
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  sale: 'Facture de vente',
  estimate: 'Devis',
  credit_note: 'Avoir',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

interface Props {
  invoice: FneInvoice;
  company?: Company | null;
  fneSetting?: FneSettingRecord | null;
  /** Mode préimprimé : masque le logo société */
  preprinted?: boolean;
}

export default function FneInvoicePrintView({ invoice, company, fneSetting, preprinted }: Props) {
  const companyName = company?.name || '';
  const ncc = invoice.fneNcc || '';
  const invoiceLabel = INVOICE_TYPE_LABELS[invoice.invoiceType] || 'Facture de vente';
  const invoiceNumber = invoice.fneReference || invoice.reference;

  // Build tax summary from items
  const taxSummary = buildTaxSummary(invoice);

  // Compute autres taxes total
  const autresTaxes =
    invoice.customTaxes?.reduce((sum, ct) => sum + (invoice.subtotalHt * ct.amount) / 100, 0) ?? 0;

  return (
    <div className="print-only">
      <div
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '11px',
          color: '#222',
          padding: '0',
          lineHeight: 1.5,
        }}
      >
        {/* ══ HEADER ══ */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '24px',
            marginBottom: '20px',
          }}
        >
          {/* LEFT COLUMN */}
          <div style={{ flex: '1 1 55%' }}>
            {/* Company box */}
            <div style={{ border: '1px solid #ccc', padding: '10px 12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{companyName}</div>
              {ncc && <div>NCC : {ncc}</div>}
              {fneSetting?.regimeImposition && (
                <div>Régime d'imposition : {fneSetting.regimeImposition}</div>
              )}
              {fneSetting?.centreImpots && <div>Centre des impôts : {fneSetting.centreImpots}</div>}
            </div>

            {/* Company details */}
            <div style={{ fontSize: '11px' }}>
              {company?.tradeRegister && <div>RCCM : {company.tradeRegister}</div>}
              {fneSetting?.bankRef && <div>Références bancaires : {fneSetting.bankRef}</div>}
              {!fneSetting?.bankRef && <div>Références bancaires :</div>}
              <div>Établissement : {invoice.establishment}</div>
              <div>Adresse :</div>
              {company?.address && <div>{company.address}</div>}
              {company?.phone && <div>Nº Tel : {company.phone}</div>}
              {company?.email && <div>Mail : {company.email}</div>}
              {invoice.clientSellerName && <div>Nom du vendeur : {invoice.clientSellerName}</div>}
              {!invoice.clientSellerName && <div>Nom du vendeur :</div>}
              <div>Nom de PDV : {invoice.pointOfSale}</div>
              <div>Date et heure : {fmtDateTime(invoice.createdAt)}</div>
              <div>
                Mode de paiement : {PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ flex: '1 1 40%', textAlign: 'right' }}>
            {/* Invoice number */}
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
              {invoiceLabel} Nº {invoiceNumber}
            </div>

            {/* QR Code + Company Logo */}
            {invoice.fneToken && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(invoice.fneToken)}`}
                  alt="QR Code FNE"
                  style={{ width: '100px', height: '100px' }}
                />
                {company?.logo && !preprinted && (
                  <div
                    style={{
                      width: '120px',
                      height: '100px',
                      backgroundImage: `url(${company.logo})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact' as never,
                    }}
                    role="img"
                    aria-label={companyName}
                  />
                )}
              </div>
            )}

            {/* Client info */}
            <div style={{ textAlign: 'left', marginTop: '8px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Client</div>
              <div>Nom : {invoice.clientCompanyName}</div>
              <div>Adresse : {invoice.clientEmail}</div>
              <div>NCC : {invoice.clientNcc || ''}</div>
            </div>
          </div>
        </div>

        {/* ══ ITEMS TABLE ══ */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '4px',
            fontSize: '11px',
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Réf</th>
              <th style={thStyle}>Désignation</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>P.U HT</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Qté</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Unité</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Taxes (%)</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Rem. (%)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td style={tdStyle}>{item.reference || ''}</td>
                <td style={tdStyle}>{item.description}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(item.amount)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{item.measurementUnit || ''}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{item.taxes?.join(', ') || ''}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{item.discount || 0}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(item.lineTotalHt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALS ── */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '16px',
            fontSize: '11px',
          }}
        >
          <tbody>
            <TotalRow label="TOTAL HT" value={fmt(invoice.subtotalHt)} />
            <TotalRow label="TVA" value={fmt(invoice.totalVat)} />
            <TotalRow label="TOTAL TTC" value={fmt(invoice.totalTtc)} />
            <TotalRow label="AUTRES TAXES" value={fmt(autresTaxes)} />
            <TotalRow label="TOTAL A PAYER" value={fmt(invoice.totalTtc + autresTaxes)} bold />
          </tbody>
        </table>

        {/* ══ TAX SUMMARY ══ */}
        <div
          style={{
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '4px',
            borderBottom: '1px solid #999',
            paddingBottom: '4px',
          }}
        >
          RESUME DE LA FACTURE
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}>CATEGORIE</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>SOUS-TOTAL</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>TAUX (%)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>TOTAL TAXES</th>
            </tr>
          </thead>
          <tbody>
            {taxSummary.map((row, idx) => (
              <tr key={idx}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>{row.category}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.subtotal)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{row.rate}%</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.totalTaxes)}</td>
              </tr>
            ))}
            {taxSummary.length === 0 && (
              <tr>
                <td style={tdStyle} colSpan={4}>
                  Aucune taxe
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Styles ── */
const thStyle: React.CSSProperties = {
  borderTop: '1px solid #999',
  borderBottom: '1px solid #999',
  padding: '6px 8px',
  fontWeight: 600,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  borderBottom: '1px solid #ddd',
  padding: '5px 8px',
  verticalAlign: 'top',
};

/* ── Total Row ── */
function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr>
      <td colSpan={6} />
      <td
        style={{
          borderBottom: '1px solid #ddd',
          padding: '5px 8px',
          textAlign: 'right',
          fontWeight: bold ? 700 : 600,
          fontSize: bold ? '12px' : '11px',
        }}
      >
        {label}
      </td>
      <td
        style={{
          borderBottom: '1px solid #ddd',
          padding: '5px 8px',
          textAlign: 'right',
          fontWeight: bold ? 700 : 400,
        }}
      >
        {value}
      </td>
    </tr>
  );
}

/* ── Tax summary builder ── */
interface TaxSummaryRow {
  category: string;
  subtotal: number;
  rate: number;
  totalTaxes: number;
}

function buildTaxSummary(invoice: FneInvoice): TaxSummaryRow[] {
  // Group items by their tax codes to build the summary
  const groups: Record<
    string,
    { subtotal: number; vatAmount: number; rate: number; label: string }
  > = {};

  for (const item of invoice.items) {
    const taxKey = item.taxes?.join('+') || 'NONE';
    if (!groups[taxKey]) {
      groups[taxKey] = {
        subtotal: 0,
        vatAmount: 0,
        rate: 0,
        label: item.taxes?.join(', ') || 'Pas de taxe',
      };
    }
    groups[taxKey].subtotal += item.lineTotalHt;
    groups[taxKey].vatAmount += item.lineVat;
    // Estimate rate from first item that has values
    if (item.lineTotalHt > 0 && item.lineVat > 0 && groups[taxKey].rate === 0) {
      groups[taxKey].rate = Math.round((item.lineVat / item.lineTotalHt) * 10000) / 100;
    }
  }

  return Object.values(groups).map((g) => ({
    category: g.label,
    subtotal: g.subtotal,
    rate: g.rate,
    totalTaxes: g.vatAmount,
  }));
}
