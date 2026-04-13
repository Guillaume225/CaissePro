import { useTranslation } from 'react-i18next';
import { Building2, LayoutGrid, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export default function NoAccessPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  const hasNoCompany = !user?.companyIds || user.companyIds.length === 0;
  const hasNoModule = !user?.allowedModules || user.allowedModules.length === 0;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
          <Building2 className="h-10 w-10 text-amber-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{t('noAccess.title')}</h1>

        <p className="mt-3 text-gray-500">{t('noAccess.description')}</p>

        <div className="mt-6 space-y-3">
          {hasNoCompany && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
              <Building2 className="h-5 w-5 shrink-0 text-amber-500" />
              <span>{t('noAccess.noCompany')}</span>
            </div>
          )}
          {hasNoModule && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
              <LayoutGrid className="h-5 w-5 shrink-0 text-amber-500" />
              <span>{t('noAccess.noModule')}</span>
            </div>
          )}
        </div>

        <p className="mt-6 text-sm text-gray-400">{t('noAccess.contactAdmin')}</p>

        <button
          onClick={logout}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}
