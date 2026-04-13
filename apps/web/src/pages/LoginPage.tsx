import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { useTabStore } from '@/stores/tab-store';
import api from '@/lib/api';
import type { User } from '@/types/auth';
import { ShieldCheck, ArrowLeft, Copy, CheckCircle2, Smartphone } from 'lucide-react';

const ROLE_MAP: Record<string, User['role']> = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  ACCOUNTANT: 'viewer',
  DIRECTEUR_GENERAL: 'admin',
  DG: 'admin',
};

function resolveRole(roleName: string): User['role'] {
  return ROLE_MAP[roleName] || ROLE_MAP[roleName.toUpperCase()] || 'viewer';
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [email, setEmail] = useState(import.meta.env.DEV ? 'admin@caisseflow.com' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'CaisseFlow2026!' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // MFA Setup state (when admin enabled MFA but user hasn't configured yet)
  const [mfaSetupStep, setMfaSetupStep] = useState<'qr' | 'verify' | false>(false);
  const [setupToken, setSetupToken] = useState('');
  const [setupQrData, setSetupQrData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [setupCode, setSetupCode] = useState(['', '', '', '', '', '']);
  const setupInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [copied, setCopied] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // Auto-focus first OTP input when MFA step activates
  useEffect(() => {
    if (mfaStep) {
      inputRefs.current[0]?.focus();
    }
  }, [mfaStep]);

  useEffect(() => {
    if (mfaSetupStep === 'verify') {
      setupInputRefs.current[0]?.focus();
    }
  }, [mfaSetupStep]);

  const completeLogin = async (accessToken: string, refreshToken: string) => {
    useAuthStore.getState().setTokens(accessToken, refreshToken);

    const { data: meRes } = await api.get('/users/me');
    const profile = meRes.data ?? meRes;

    const user: User = {
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      role: resolveRole(profile.roleName),
      tenantId: profile.tenantId || '',
      companyId: profile.companyId || undefined,
      companyName: profile.companyName || undefined,
      companyIds: profile.companyIds || [],
      companyNames: profile.companyNames || [],
      permissions: profile.permissions || [],
      allowedModules: profile.allowedModules && profile.allowedModules.length > 0
        ? profile.allowedModules
        : undefined,
    };

    useTabStore.getState().closeAllTabs();
    login(user, accessToken, refreshToken);
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: loginRes } = await api.post('/auth/login', { email, password });
      const resp = loginRes.data ?? loginRes;

      // Server requests MFA setup (admin enabled, user hasn't configured yet)
      if (resp.requiresMfaSetup) {
        setSetupToken(resp.setupToken);
        setSetupQrData({ secret: resp.secret, qrCodeDataUrl: resp.qrCodeDataUrl });
        setMfaSetupStep('qr');
        setLoading(false);
        return;
      }

      // Server requests MFA verification (already configured)
      if (resp.requiresMfa) {
        setMfaToken(resp.mfaToken);
        setMfaStep(true);
        setLoading(false);
        return;
      }

      await completeLogin(resp.accessToken, resp.refreshToken);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; data?: { message?: string } } }; message?: string };
      const msg = e?.response?.data?.data?.message
        || e?.response?.data?.message
        || t('auth.loginError');
      setError(msg);
      useAuthStore.getState().logout();
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const code = mfaCode.join('');
      const { data: loginRes } = await api.post('/auth/login', {
        email, password, mfaCode: code, mfaToken,
      });
      const resp = loginRes.data ?? loginRes;
      await completeLogin(resp.accessToken, resp.refreshToken);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; data?: { message?: string } } }; message?: string };
      const msg = e?.response?.data?.data?.message
        || e?.response?.data?.message
        || t('auth.mfaInvalidCode');
      setError(msg);
      setMfaCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...mfaCode];
    newCode[index] = value.slice(-1);
    setMfaCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setMfaCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const backToLogin = () => {
    setMfaStep(false);
    setMfaToken('');
    setMfaCode(['', '', '', '', '', '']);
    setMfaSetupStep(false);
    setSetupToken('');
    setSetupQrData(null);
    setSetupCode(['', '', '', '', '', '']);
    setCopied(false);
    setError('');
  };

  // ── MFA Setup Verification (during login) ──────────────
  const handleSetupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const code = setupCode.join('');
      const { data: loginRes } = await api.post('/auth/mfa/setup-verify', {
        setupToken,
        code,
      });
      const resp = loginRes.data ?? loginRes;
      await completeLogin(resp.accessToken, resp.refreshToken);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; data?: { message?: string } } }; message?: string };
      const msg = e?.response?.data?.data?.message
        || e?.response?.data?.message
        || t('auth.mfaInvalidCode');
      setError(msg);
      setSetupCode(['', '', '', '', '', '']);
      setupInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSetupOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...setupCode];
    newCode[index] = value.slice(-1);
    setSetupCode(newCode);
    if (value && index < 5) {
      setupInputRefs.current[index + 1]?.focus();
    }
  };

  const handleSetupOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !setupCode[index] && index > 0) {
      setupInputRefs.current[index - 1]?.focus();
    }
  };

  const handleSetupOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setSetupCode(pasted.split(''));
      setupInputRefs.current[5]?.focus();
    }
  };

  const copySecret = () => {
    if (setupQrData) {
      navigator.clipboard.writeText(setupQrData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ─── MFA Setup Step (QR code scan) ──────────────────────
  if (mfaSetupStep === 'qr' && setupQrData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Smartphone className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('auth.mfaSetupTitle')}</h1>
            <p className="mt-2 text-sm text-gray-500">{t('auth.mfaSetupSubtitle')}</p>
          </div>

          <div className="space-y-5">
            {/* Step indicator */}
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-blue-700">{t('auth.mfaSetupScanInstructions')}</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-4">
                <img src={setupQrData.qrCodeDataUrl} alt="QR Code" className="h-48 w-48" />
              </div>
            </div>

            {/* Manual secret */}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-xs font-medium text-gray-500">{t('auth.mfaSetupManualEntry')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono tracking-wider text-gray-900 border border-gray-200">
                  {setupQrData.secret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Compatible apps */}
            <div className="text-center text-xs text-gray-400">
              Google Authenticator · Microsoft Authenticator · Authy
            </div>

            <button
              type="button"
              onClick={() => setMfaSetupStep('verify')}
              className="w-full rounded-lg bg-brand-gold py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-dark"
            >
              {t('auth.mfaSetupContinue')}
            </button>

            <button
              type="button"
              onClick={backToLogin}
              className="flex w-full items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('auth.mfaBackToLogin')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MFA Setup Verification Step ───────────────────────
  if (mfaSetupStep === 'verify') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('auth.mfaSetupVerifyTitle')}</h1>
            <p className="mt-1 text-sm text-gray-500">{t('auth.mfaSetupVerifySubtitle')}</p>
          </div>

          <form onSubmit={handleSetupVerify} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="mb-3 block text-center text-sm font-medium text-gray-700">
                {t('auth.mfaEnterCode')}
              </label>
              <div className="flex justify-center gap-2" onPaste={handleSetupOtpPaste}>
                {setupCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { setupInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleSetupOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleSetupOtpKeyDown(i, e)}
                    className="h-12 w-12 rounded-lg border-gray-300 text-center text-lg font-bold shadow-sm focus:border-brand-gold focus:ring-brand-gold"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || setupCode.join('').length !== 6}
              className="w-full rounded-lg bg-brand-gold py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('auth.mfaSetupActivate')}
            </button>

            <button
              type="button"
              onClick={() => setMfaSetupStep('qr')}
              className="flex w-full items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('auth.mfaSetupBackToQr')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── MFA Step ──────────────────────────────────────────
  if (mfaStep) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('auth.mfaTitle')}</h1>
            <p className="mt-1 text-sm text-gray-500">{t('auth.mfaSubtitle')}</p>
          </div>

          <form onSubmit={handleMfaSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="mb-3 block text-center text-sm font-medium text-gray-700">
                {t('auth.mfaEnterCode')}
              </label>
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {mfaCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="h-12 w-12 rounded-lg border-gray-300 text-center text-lg font-bold shadow-sm focus:border-brand-gold focus:ring-brand-gold"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || mfaCode.join('').length !== 6}
              className="w-full rounded-lg bg-brand-gold py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('auth.mfaVerifyButton')}
            </button>

            <button
              type="button"
              onClick={backToLogin}
              className="flex w-full items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('auth.mfaBackToLogin')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Login Step ───────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-gold text-xl font-bold text-white">
            CF
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('app.tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-gold focus:ring-brand-gold"
              placeholder="admin@caisseflow.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-gold focus:ring-brand-gold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-gold py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.loginButton')}
          </button>

          <p className="text-center text-sm text-gray-500">
            <a href="#" className="text-brand-gold hover:underline">
              {t('auth.forgotPassword')}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
