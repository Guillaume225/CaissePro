import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';
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
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Facture introuvable</span>
        </div>
        <Button variant="ghost" onClick={() => navigate('/fne/invoices')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
      </div>
    );
  }

  if (invoice.status !== 'DRAFT' && invoice.status !== 'ERROR') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10">
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Seules les factures en brouillon ou en erreur peuvent être modifiées.</span>
        </div>
        <Button variant="ghost" onClick={() => navigate(`/fne/invoices/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la facture
        </Button>
      </div>
    );
  }

  return <FneInvoiceCreatePage editInvoice={invoice} />;
}
