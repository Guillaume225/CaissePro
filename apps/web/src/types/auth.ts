import type { ModuleId } from '@/stores/module-store';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'cashier' | 'viewer';
  tenantId: string;
  companyId?: string;
  companyName?: string;
  companyIds?: string[];
  companyNames?: string[];
  avatar?: string;
  permissions: string[];
  allowedModules?: ModuleId[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ── MFA / 2FA ────────────────────────────────────────────
export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface LoginResponse {
  requiresMfa?: boolean;
  requiresMfaSetup?: boolean;
  mfaToken?: string;
  setupToken?: string;
  accessToken?: string;
  refreshToken?: string;
}
