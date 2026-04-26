import { createHash } from 'crypto';

/**
 * Derives a deterministic 6-digit numeric identifier from a tenant UUID.
 * Used to build short, readable subdomains: gestion-{schemaId}.i-management.website
 */
export function computeSchemaId(tenantId: string): string {
  const hash = createHash('sha256').update(tenantId.toLowerCase()).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16) % 1_000_000;
  return num.toString().padStart(6, '0');
}
