export const PERMISSIONS = {
  AUDIT_READ: 'audit.read',
  AUDIT_EXPORT: 'audit.export',
} as const;

export const AUDIT_PERMISSIONS = {
  READ: PERMISSIONS.AUDIT_READ,
  EXPORT: PERMISSIONS.AUDIT_EXPORT,
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
