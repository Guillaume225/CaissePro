import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import {
  Wallet,
  Cog,
  TrendingUp,
  Receipt,
  FileText,
  Lock,
  CreditCard,
  UserCog,
  Shield,
  FolderTree,
  BookOpen,
  Building2,
  ClipboardList,
  FileBarChart,
  BarChart3,
  MessageSquare,
  ArrowRight,
  Landmark,
  BadgeDollarSign,
  History,
  FileCheck2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useModuleStore, type ModuleId } from '@/stores/module-store';
import { useTabStore } from '@/stores/tab-store';

/* ─── Flow step definition ──────────────────────── */
interface FlowStep {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

interface ModuleFlow {
  id: ModuleId;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  ringColor: string;
  steps: FlowStep[];
}

const moduleFlows: ModuleFlow[] = [
  {
    id: 'expense',
    labelKey: 'modules.expense.name',
    descriptionKey: 'dashboard.flows.expense.description',
    icon: Wallet,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    ringColor: 'bg-orange-100 text-orange-600',
    steps: [
      { to: '/expenses/new', labelKey: 'modules.expense.new', icon: FileText },
      { to: '/expenses', labelKey: 'modules.expense.list', icon: Receipt },
    ],
  },
  {
    id: 'admin',
    labelKey: 'modules.admin.name',
    descriptionKey: 'dashboard.flows.admin.description',
    icon: Cog,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    ringColor: 'bg-emerald-100 text-emerald-600',
    steps: [
      { to: '/admin/users', labelKey: 'modules.admin.users', icon: UserCog },
      { to: '/admin/roles', labelKey: 'modules.admin.roles', icon: Shield },
      { to: '/admin/companies', labelKey: 'modules.admin.companies', icon: Building2 },
      { to: '/admin/audit', labelKey: 'modules.admin.audit', icon: ClipboardList },
    ],
  },
  {
    id: 'manager-caisse',
    labelKey: 'modules.manager-caisse.name',
    descriptionKey: 'dashboard.flows.manager-caisse.description',
    icon: Landmark,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    ringColor: 'bg-amber-100 text-amber-600',
    steps: [
      {
        to: '/manager-caisse/categories',
        labelKey: 'modules.manager-caisse.categories',
        icon: FolderTree,
      },
      {
        to: '/manager-caisse/accounting',
        labelKey: 'modules.manager-caisse.accounting',
        icon: BookOpen,
      },
      {
        to: '/manager-caisse/settings',
        labelKey: 'modules.manager-caisse.settings',
        icon: BadgeDollarSign,
      },
      { to: '/manager-caisse/closing', labelKey: 'modules.manager-caisse.closing', icon: Lock },
      {
        to: '/manager-caisse/closing-history',
        labelKey: 'modules.manager-caisse.closingHistory',
        icon: History,
      },
      {
        to: '/manager-caisse/accounting-entries',
        labelKey: 'modules.manager-caisse.accountingEntries',
        icon: BookOpen,
      },
    ],
  },
  {
    id: 'decision',
    labelKey: 'modules.decision.name',
    descriptionKey: 'dashboard.flows.decision.description',
    icon: TrendingUp,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    ringColor: 'bg-purple-100 text-purple-600',
    steps: [
      { to: '/reports', labelKey: 'modules.decision.reports', icon: FileBarChart },
      { to: '/reports/generator', labelKey: 'modules.decision.generator', icon: BarChart3 },
      { to: '/reports/narrative', labelKey: 'modules.decision.narrative', icon: MessageSquare },
      { to: '/fne/accounting', labelKey: 'modules.decision.fneAccounting', icon: BookOpen },
    ],
  },
  {
    id: 'fne',
    labelKey: 'modules.fne.name',
    descriptionKey: 'dashboard.flows.fne.description',
    icon: FileCheck2,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    ringColor: 'bg-teal-100 text-teal-600',
    steps: [
      { to: '/fne/invoices', labelKey: 'modules.fne.list', icon: FileText },
      { to: '/fne/invoices/new', labelKey: 'modules.fne.new', icon: CreditCard },
    ],
  },
];

export default function GeneralPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeModule, setActiveModule } = useModuleStore();
  const { openTab } = useTabStore();

  const visibleFlows = useMemo(() => {
    const allowed = (() => {
      if (!user) return moduleFlows;
      if (user.role === 'admin') return moduleFlows;
      if (user.allowedModules && user.allowedModules.length > 0) {
        return moduleFlows.filter((f) => user.allowedModules!.includes(f.id));
      }
      return [];
    })();
    return allowed.filter((f) => f.id === activeModule);
  }, [user, activeModule]);

  const handleStepClick = (flow: ModuleFlow, step: FlowStep) => {
    setActiveModule(flow.id);
    openTab({ path: step.to, labelKey: step.labelKey, pinned: false });
    navigate(step.to);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.flows.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('dashboard.flows.subtitle')}</p>
      </div>

      {/* Module flow cards */}
      <div className="grid gap-6 grid-cols-1">
        {visibleFlows.map((flow) => (
          <div
            key={flow.id}
            className={cn(
              'group rounded-xl border-2 bg-white p-6 shadow-sm transition-shadow hover:shadow-md',
              flow.borderColor,
            )}
          >
            {/* Card header */}
            <div className="flex items-center gap-4 mb-5">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl',
                  flow.ringColor,
                )}
              >
                <flow.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className={cn('text-lg font-bold', flow.color)}>{t(flow.labelKey)}</h2>
                <p className="text-sm text-gray-500">{t(flow.descriptionKey)}</p>
              </div>
            </div>

            {/* Flow steps */}
            <div className={cn('rounded-lg p-4', flow.bgColor)}>
              <div className="flex flex-wrap items-center gap-2">
                {flow.steps.map((step, i) => (
                  <div key={step.to} className="flex items-center gap-2">
                    <button
                      onClick={() => handleStepClick(flow, step)}
                      className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm border border-gray-100 transition-all hover:shadow-md hover:scale-[1.02]"
                    >
                      <step.icon className={cn('h-4 w-4 shrink-0', flow.color)} />
                      <span className="whitespace-nowrap">{t(step.labelKey)}</span>
                    </button>
                    {i < flow.steps.length - 1 && (
                      <ArrowRight className={cn('h-4 w-4 shrink-0 opacity-40', flow.color)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
