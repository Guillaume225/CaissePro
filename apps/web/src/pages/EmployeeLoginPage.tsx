import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuthStore } from '@/stores/employee-auth-store';
import { FileSignature } from 'lucide-react';
import api from '@/lib/api';

export default function EmployeeLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useEmployeeAuthStore();

  const [matricule, setMatricule] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: res } = await api.post('/employees/login', {
        matricule: matricule.trim(),
        email: email.trim(),
      });
      const emp = res.data;

      login({
        matricule: emp.matricule,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        service: emp.service,
        position: emp.position,
        phone: emp.phone,
      });
      navigate('/demande', { replace: true });
    } catch {
      setError(t('employeeAuth.loginError', 'Matricule ou email incorrect, ou compte désactivé.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-6 sm:px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-8 shadow-2xl">
        <div className="mb-6 sm:mb-8 text-center">
          <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-brand-gold text-white">
            <FileSignature className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('employeeAuth.title')}</h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">{t('employeeAuth.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div>
            <label htmlFor="matricule" className="block text-sm font-medium text-gray-700">
              {t('employeeAuth.matricule')}
            </label>
            <input
              id="matricule"
              type="text"
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-gold focus:ring-brand-gold"
              placeholder="MAT-000"
            />
          </div>

          <div>
            <label htmlFor="emp-email" className="block text-sm font-medium text-gray-700">
              {t('employeeAuth.email')}
            </label>
            <input
              id="emp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-gold focus:ring-brand-gold"
              placeholder="prenom.nom@entreprise.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-gold py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('employeeAuth.loginButton')}
          </button>

          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">{t('employeeAuth.hint')}</p>
            <p className="mt-1 text-xs text-amber-600">{t('employeeAuth.hintDetails')}</p>
          </div>
        </form>
      </div>
    </div>
  );
}
