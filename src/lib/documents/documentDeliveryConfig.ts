import { getServiceMode } from '@/lib/services/mode';
import { isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * Edge-Function-Secrets (Supabase Dashboard → Edge Functions → Secrets):
 *
 * E-Mail (eine der Optionen):
 * - RESEND_API_KEY + DOCUMENT_EMAIL_FROM  (Resend, empfohlen)
 * - SENDGRID_API_KEY + DOCUMENT_EMAIL_FROM  (SendGrid)
 * - DOCUMENT_EMAIL_API_URL  (generischer HTTP-POST-Webhook)
 *
 * Fax:
 * - DOCUMENT_FAX_API_URL  (generischer HTTP-POST, z. B. Sipgate/ClickSend-Proxy)
 * - optional DOCUMENT_FAX_API_KEY  (Bearer-Token)
 */

export const DOCUMENT_EMAIL_NOT_CONFIGURED_MESSAGE =
  'E-Mail-Versand ist noch nicht konfiguriert.';

export const DOCUMENT_FAX_NOT_CONFIGURED_MESSAGE =
  'Fax-Versand ist noch nicht konfiguriert.';

export function isDocumentDeliveryBackendAvailable(): boolean {
  return getServiceMode() === 'supabase' && isSupabaseConfigured();
}

export function normalizeGermanFaxNumber(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, '').trim();
  if (!digits) return null;

  if (digits.startsWith('+49')) {
    const rest = digits.slice(3);
    if (rest.length >= 6 && rest.length <= 14) return `+49${rest}`;
    return null;
  }

  if (digits.startsWith('0049')) {
    const rest = digits.slice(4);
    if (rest.length >= 6 && rest.length <= 14) return `+49${rest}`;
    return null;
  }

  if (digits.startsWith('0')) {
    const rest = digits.slice(1);
    if (rest.length >= 6 && rest.length <= 14) return `+49${rest}`;
    return null;
  }

  return null;
}

export function isValidEmailAddress(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 5 && trimmed.includes('@') && trimmed.includes('.');
}
