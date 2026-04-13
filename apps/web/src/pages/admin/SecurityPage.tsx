import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck, Shield, Smartphone, QrCode, Copy,
  CheckCircle2, AlertTriangle, Loader2, KeyRound,
} from 'lucide-react';
import { Button, Modal, Badge } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { useMfaSetup, useMfaVerify, useMfaDisable } from '@/hooks/useAdmin';
import api from '@/lib/api';

export default function SecurityPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  // MFA status from /users/me
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Setup flow
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify' | 'success'>('qr');
  const [qrData, setQrData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [verifyError, setVerifyError] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Disable flow
  const [showDisableModal, setShowDisableModal] = useState(false);

  const mfaSetup = useMfaSetup();
  const mfaVerify = useMfaVerify();
  const mfaDisable = useMfaDisable();

  // Fetch current MFA status
  useState(() => {
    api.get('/users/me').then(({ data }) => {
      const profile = data.data ?? data;
      setMfaEnabled(profile.mfaEnabled ?? false);
    }).catch(() => {
      setMfaEnabled(false);
    }).finally(() => setLoadingStatus(false));
  });

  const startSetup = async () => {
    try {
      const result = await mfaSetup.mutateAsync();
      setQrData({ secret: result.secret, qrCodeDataUrl: result.qrCodeDataUrl });
      setSetupStep('qr');
      setVerifyCode(['', '', '', '', '', '']);
      setVerifyError('');
      setShowSetupModal(true);
    } catch {
      // error handled by mutation
    }
  };

  const handleVerify = async () => {
    const code = verifyCode.join('');
    if (code.length !== 6) return;
    setVerifyError('');
    try {
      await mfaVerify.mutateAsync(code);
      setSetupStep('success');
      setMfaEnabled(true);
    } catch {
      setVerifyError(t('security.mfa.invalidCode'));
      setVerifyCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleDisable = async () => {
    try {
      await mfaDisable.mutateAsync();
      setMfaEnabled(false);
      setShowDisableModal(false);
    } catch {
      // error handled by mutation
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...verifyCode];
    newCode[index] = value.slice(-1);
    setVerifyCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setVerifyCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const copySecret = () => {
    if (qrData?.secret) {
      navigator.clipboard.writeText(qrData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('security.title')}</h1>
        <p className="text-sm text-gray-500">{t('security.subtitle')}</p>
      </div>

      {/* User info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/10 text-sm font-bold text-brand-gold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* 2FA Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              mfaEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
            }`}>
              {mfaEnabled ? <ShieldCheck className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('security.mfa.title')}
                </h3>
                <Badge variant={mfaEnabled ? 'success' : 'warning'}>
                  {mfaEnabled ? t('security.mfa.enabled') : t('security.mfa.disabled')}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">{t('security.mfa.description')}</p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-700">{t('security.mfa.howItWorks')}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-xs font-bold text-brand-gold">1</div>
              <div>
                <p className="text-sm font-medium text-gray-700">{t('security.mfa.step1Title')}</p>
                <p className="text-xs text-gray-500">{t('security.mfa.step1Desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-xs font-bold text-brand-gold">2</div>
              <div>
                <p className="text-sm font-medium text-gray-700">{t('security.mfa.step2Title')}</p>
                <p className="text-xs text-gray-500">{t('security.mfa.step2Desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-xs font-bold text-brand-gold">3</div>
              <div>
                <p className="text-sm font-medium text-gray-700">{t('security.mfa.step3Title')}</p>
                <p className="text-xs text-gray-500">{t('security.mfa.step3Desc')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="mt-6">
          {mfaEnabled ? (
            <Button variant="outline" onClick={() => setShowDisableModal(true)}>
              <Shield className="mr-2 h-4 w-4" />
              {t('security.mfa.disableButton')}
            </Button>
          ) : (
            <Button onClick={startSetup} disabled={mfaSetup.isPending}>
              {mfaSetup.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {t('security.mfa.enableButton')}
            </Button>
          )}
        </div>
      </div>

      {/* Compatible apps */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('security.mfa.compatibleApps')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { name: 'Google Authenticator', icon: Smartphone, desc: 'Android / iOS' },
            { name: 'Microsoft Authenticator', icon: KeyRound, desc: 'Android / iOS' },
            { name: 'Authy', icon: Shield, desc: 'Multi-plateforme' },
          ].map((app) => (
            <div key={app.name} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
              <app.icon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">{app.name}</p>
                <p className="text-xs text-gray-500">{app.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Setup Modal ─────────────────────────────────── */}
      <Modal
        open={showSetupModal}
        onClose={() => { if (setupStep !== 'verify') setShowSetupModal(false); }}
        title={t('security.mfa.setupTitle')}
        size="md"
      >
        {setupStep === 'qr' && qrData && (
          <div className="space-y-5">
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-blue-700">{t('security.mfa.scanInstructions')}</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-4">
                <img
                  src={qrData.qrCodeDataUrl}
                  alt="QR Code"
                  className="h-48 w-48"
                />
              </div>
            </div>

            {/* Manual entry secret */}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-xs font-medium text-gray-500">{t('security.mfa.manualEntry')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono tracking-wider text-gray-900 border border-gray-200">
                  {qrData.secret}
                </code>
                <button
                  onClick={copySecret}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button className="w-full" onClick={() => { setSetupStep('verify'); setTimeout(() => inputRefs.current[0]?.focus(), 100); }}>
              {t('security.mfa.continueToVerify')}
            </Button>
          </div>
        )}

        {setupStep === 'verify' && (
          <div className="space-y-5">
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-sm text-amber-700">{t('security.mfa.verifyInstructions')}</p>
            </div>

            <div>
              <label className="mb-3 block text-center text-sm font-medium text-gray-700">
                {t('security.mfa.enterCode')}
              </label>
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {verifyCode.map((digit, i) => (
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
              {verifyError && (
                <p className="mt-2 text-center text-sm text-red-600">{verifyError}</p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={verifyCode.join('').length !== 6 || mfaVerify.isPending}
            >
              {mfaVerify.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {t('security.mfa.activateButton')}
            </Button>
          </div>
        )}

        {setupStep === 'success' && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('security.mfa.successTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500">{t('security.mfa.successDesc')}</p>
            </div>
            <Button className="w-full" onClick={() => setShowSetupModal(false)}>
              {t('common.close')}
            </Button>
          </div>
        )}
      </Modal>

      {/* ── Disable Confirmation Modal ──────────────────── */}
      <Modal
        open={showDisableModal}
        onClose={() => setShowDisableModal(false)}
        title={t('security.mfa.disableTitle')}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{t('security.mfa.disableWarning')}</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDisableModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDisable}
              disabled={mfaDisable.isPending}
            >
              {mfaDisable.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t('security.mfa.confirmDisable')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
