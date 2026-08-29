import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useFneInvoice } from '@/hooks/useFneInvoices';
import FneInvoiceCreatePage from './FneInvoiceCreatePage';

export default function FneInvoiceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading, isError } = useFneInvoice(id!);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10">
        <div className="flex items-center gap-3 border-l-2 border-red-400 bg-[#fee2e2] px-3 py-2 text-xs text-[#991b1b] rounded-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Facture introuvable</span>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/fne/invoices')}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
      </div>
    );
  }

  if (invoice.status !== 'DRAFT' && invoice.status !== 'ERROR') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10">
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Seules les factures en brouillon ou en erreur peuvent être modifiées.</span>
        </div>
        <button className="btn-secondary" onClick={() => navigate(`/fne/invoices/${id}`)}>
          <ArrowLeft className="h-4 w-4" /> Retour à la facture
        </button>
      </div>
    );
  }

  return <FneInvoiceCreatePage editInvoice={invoice} />;
}
