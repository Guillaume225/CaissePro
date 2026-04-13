import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: number;
  trendLabel?: string;
  className?: string;
  onClick?: () => void;
}

export function Stat({ label, value, icon, trend, trendLabel, className, onClick }: StatProps) {
  const trendDirection = trend === undefined ? null : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-5 shadow-sm',
        onClick && 'cursor-pointer transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
            {icon}
          </div>
        )}
      </div>

      {trendDirection && (
        <div className="mt-3 flex items-center gap-1.5">
          {trendDirection === 'up' && (
            <div className="flex items-center gap-0.5 text-green-600">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">+{trend}%</span>
            </div>
          )}
          {trendDirection === 'down' && (
            <div className="flex items-center gap-0.5 text-red-600">
              <TrendingDown className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{trend}%</span>
            </div>
          )}
          {trendDirection === 'flat' && (
            <div className="flex items-center gap-0.5 text-gray-400">
              <Minus className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">0%</span>
            </div>
          )}
          {trendLabel && (
            <span className="text-xs text-gray-400">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
