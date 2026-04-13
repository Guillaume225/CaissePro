import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { useNarrativeReport } from '@/hooks/useReports';

function buildPeriods(): string[] {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
}

export default function NarrativeReportPage() {
  const { t } = useTranslation();
  const periods = useMemo(buildPeriods, []);
  const [periodIdx, setPeriodIdx] = useState(0);
  const period = periods[periodIdx];
  const { data: report, isLoading, isError } = useNarrativeReport(period);

  const periodLabel = (p: string) => {
    const [y, m] = p.split('-');
    return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
  };

  // Very basic markdown renderer
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('### '))
        return (
          <h3 key={i} className="mt-4 mb-1 text-base font-semibold text-gray-800">
            {line.slice(4)}
          </h3>
        );
      if (line.startsWith('## '))
        return (
          <h2 key={i} className="mt-6 mb-2 text-lg font-bold text-gray-900">
            {line.slice(3)}
          </h2>
        );
      if (line.startsWith('# '))
        return (
          <h1 key={i} className="mt-6 mb-2 text-xl font-bold text-gray-900">
            {line.slice(2)}
          </h1>
        );
      if (line.startsWith('- '))
        return (
          <li key={i} className="ml-4 text-sm text-gray-700 list-disc">
            {renderInline(line.slice(2))}
          </li>
        );
      if (line.startsWith('> '))
        return (
          <blockquote
            key={i}
            className="border-l-4 border-brand-gold/30 pl-3 italic text-sm text-gray-600"
          >
            {renderInline(line.slice(2))}
          </blockquote>
        );
      if (line.trim() === '') return <br key={i} />;
      return (
        <p key={i} className="text-sm text-gray-700 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    });
  };

  const renderInline = (text: string) => {
    // Bold **text**
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="font-semibold">
          {part}
        </strong>
      ) : (
        part
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.narrative.title')}</h1>
        <p className="text-sm text-gray-500">{t('reports.narrative.subtitle')}</p>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-4">
        <button
          disabled={periodIdx >= periods.length - 1}
          onClick={() => setPeriodIdx((i) => i + 1)}
          className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand-gold" />
          <span className="text-sm font-semibold text-gray-800 capitalize">
            {periodLabel(period)}
          </span>
        </div>
        <button
          disabled={periodIdx <= 0}
          onClick={() => setPeriodIdx((i) => i - 1)}
          className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Report content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">{t('reports.narrative.noReport')}</p>
          </CardContent>
        </Card>
      ) : report ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-brand-gold" />
                {t('reports.narrative.aiGenerated')}
              </CardTitle>
              <Badge variant="outline">
                {t('reports.narrative.generatedAt', {
                  date: new Date(report.generatedAt).toLocaleString('fr-FR'),
                })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {renderMarkdown(report.markdownContent)}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
