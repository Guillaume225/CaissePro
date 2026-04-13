import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileBarChart, Download, Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import {
  Button,
  Select,
  Input,
  Badge,
  DataTable,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import { useGenerateReport, useReportHistory } from '@/hooks/useReports';
import type { ReportType, ReportRequest, GeneratedReport } from '@/types/admin';

type AnyRow = Record<string, unknown>;

const REPORT_TYPES: ReportType[] = [
  'monthly-expenses',
  'fne-monthly-revenue',
  'fne-accounting-summary',
  'cash-closing-summary',
  'tax-report',
];

export default function ReportGeneratorPage() {
  const { t } = useTranslation();
  const generate = useGenerateReport();
  const { data: history = [], isLoading: historyLoading } = useReportHistory();

  const [form, setForm] = useState<ReportRequest>({
    type: 'monthly-expenses',
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    dateTo: new Date().toISOString().slice(0, 10),
    format: 'pdf',
  });

  const handleGenerate = async () => {
    const report = await generate.mutateAsync(form);
    // Auto-download
    if (report.downloadUrl) {
      const a = document.createElement('a');
      a.href = report.downloadUrl;
      a.download = report.name;
      a.click();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const columns: Column<AnyRow>[] = [
    {
      key: 'name',
      header: t('reports.history.name'),
      sortable: true,
      render: (row) => {
        const r = row as unknown as GeneratedReport;
        return (
          <div className="flex items-center gap-2">
            {r.format === 'pdf' ? (
              <FileText className="h-4 w-4 text-red-500" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
            )}
            <span className="font-medium text-gray-900">{r.name}</span>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: t('reports.history.type'),
      sortable: true,
      render: (row) => (
        <Badge variant="info">
          {t(`reports.types.${(row as unknown as GeneratedReport).type}`)}
        </Badge>
      ),
    },
    {
      key: 'dateFrom',
      header: t('reports.history.period'),
      render: (row) => {
        const r = row as unknown as GeneratedReport;
        return (
          <span className="text-xs text-gray-500">
            {new Date(r.dateFrom).toLocaleDateString('fr-FR')} —{' '}
            {new Date(r.dateTo).toLocaleDateString('fr-FR')}
          </span>
        );
      },
    },
    {
      key: 'size',
      header: t('reports.history.size'),
      render: (row) => (
        <span className="text-xs text-gray-500">
          {formatSize((row as unknown as GeneratedReport).size)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('common.date'),
      sortable: true,
      render: (row) => (
        <span className="text-xs text-gray-500">
          {new Date((row as unknown as GeneratedReport).createdAt).toLocaleString('fr-FR')}
        </span>
      ),
    },
    {
      key: 'downloadUrl',
      header: '',
      render: (row) => (
        <a
          href={(row as unknown as GeneratedReport).downloadUrl}
          download
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-gold"
        >
          <Download className="h-4 w-4" />
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.generator.title')}</h1>
        <p className="text-sm text-gray-500">{t('reports.generator.subtitle')}</p>
      </div>

      {/* Generator form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileBarChart className="h-4 w-4 text-brand-gold" />
            {t('reports.generator.newReport')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label={t('reports.generator.reportType')}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ReportType })}
              options={REPORT_TYPES.map((rt) => ({ value: rt, label: t(`reports.types.${rt}`) }))}
            />
            <Input
              label={t('reports.generator.dateFrom')}
              type="date"
              value={form.dateFrom}
              onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
            />
            <Input
              label={t('reports.generator.dateTo')}
              type="date"
              value={form.dateTo}
              onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
            />
            <Select
              label={t('reports.generator.format')}
              value={form.format || 'pdf'}
              onChange={(e) => setForm({ ...form, format: e.target.value as 'pdf' | 'xlsx' })}
              options={[
                { value: 'pdf', label: 'PDF' },
                { value: 'xlsx', label: 'Excel (.xlsx)' },
              ]}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleGenerate} loading={generate.isPending}>
              {generate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('reports.generator.generating')}
                </>
              ) : (
                <>
                  <FileBarChart className="mr-2 h-4 w-4" />
                  {t('reports.generator.generate')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">{t('reports.history.title')}</h2>
        {historyLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : (
          <DataTable
            columns={columns}
            data={history as unknown as AnyRow[]}
            pageSize={10}
            emptyMessage={t('reports.history.empty')}
          />
        )}
      </div>
    </div>
  );
}
