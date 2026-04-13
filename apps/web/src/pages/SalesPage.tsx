import { useTranslation } from 'react-i18next';

export default function SalesPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t('nav.sales')}</h1>
    </div>
  );
}
