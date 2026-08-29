import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileBarChart, Download, Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { useGenerateReport, useReportHistory } from '@/hooks/useReports';
import type { ReportType, ReportRequest } from '@/types/admin';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.generator.title')}</h1>
        <p className="text-sm text-gray-500">{t('reports.generator.subtitle')}</p>
      </div>

      {/* Generator form */}
      <div className="card">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0a2540]">
          <FileBarChart className="h-4 w-4 text-brand-gold" />
          {t('reports.generator.newReport')}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">{t('reports.generator.reportType')}</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ReportType })}
            >
              {REPORT_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {t(`reports.types.${rt}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('reports.generator.dateFrom')}</label>
            <input
              className="input"
              type="date"
              value={form.dateFrom}
              onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('reports.generator.dateTo')}</label>
            <input
              className="input"
              type="date"
              value={form.dateTo}
              onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('reports.generator.format')}</label>
            <select
              className="input"
              value={form.format || 'pdf'}
              onChange={(e) => setForm({ ...form, format: e.target.value as 'pdf' | 'xlsx' })}
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="btn-primary disabled:opacity-50"
            onClick={handleGenerate}
            disabled={generate.isPending}
          >
            {generate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('reports.generator.generating')}
              </>
            ) : (
              <>
                <FileBarChart className="h-4 w-4" />
                {t('reports.generator.generate')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">{t('reports.history.title')}</h2>
        {historyLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                      {t('reports.history.name')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                      {t('reports.history.type')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                      {t('reports.history.period')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                      {t('reports.history.size')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                      {t('common.date')}
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-[#aab7c4]">
                        {t('reports.history.empty')}
                      </td>
                    </tr>
                  )}
                  {history.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {r.format === 'pdf' ? (
                            <FileText className="h-4 w-4 text-red-500" />
                          ) : (
                            <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          )}
                          <span className="font-medium text-[#0a2540]">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#1e40af]">
                          {t(`reports.types.${r.type}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[#697386]">
                        {new Date(r.dateFrom).toLocaleDateString('fr-FR')} —{' '}
                        {new Date(r.dateTo).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-3 py-2 text-xs text-[#697386]">{formatSize(r.size)}</td>
                      <td className="px-3 py-2 text-xs text-[#697386]">
                        {new Date(r.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={r.downloadUrl}
                          download
                          className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100 hover:text-brand-gold"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
