/**
 * Portal password hashing aligned with supabase/functions/_shared/crypto.ts
 */
import { createHash, randomBytes } from 'node:crypto';

export async function hashSecret(value, salt) {
  const effectiveSalt = salt ?? `cs-${Date.now().toString(36)}`;
  const payload = `${effectiveSalt}:${value}`;
  const digest = createHash('sha256').update(payload, 'utf8').digest('hex');
  return `sha256:${effectiveSalt}:${digest}`;
}

export async function hashPortalCode(code) {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return hashSecret(normalized, 'portal-code');
}

export function randomPortalPassword() {
  return `AuditEmp${randomBytes(4).toString('hex')}!0`;
}
