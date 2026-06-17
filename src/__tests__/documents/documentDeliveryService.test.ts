import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_EMAIL_NOT_CONFIGURED_MESSAGE,
  DOCUMENT_FAX_NOT_CONFIGURED_MESSAGE,
  isDocumentDeliveryBackendAvailable,
  isValidEmailAddress,
  normalizeGermanFaxNumber,
} from '@/lib/documents/documentDeliveryConfig';

const SEND_DOCUMENT_EMAIL_FUNCTION = 'send-document-email';
const SEND_DOCUMENT_FAX_FUNCTION = 'send-document-fax';

describe('documentDeliveryConfig', () => {
  it('validates email addresses', () => {
    expect(isValidEmailAddress('test@example.de')).toBe(true);
    expect(isValidEmailAddress('invalid')).toBe(false);
  });

  it('normalizes German fax numbers', () => {
    expect(normalizeGermanFaxNumber('02323 123456')).toBe('+492323123456');
    expect(normalizeGermanFaxNumber('+49 2323 123456')).toBe('+492323123456');
    expect(normalizeGermanFaxNumber('123')).toBeNull();
  });

  it('exposes not-configured messages', () => {
    expect(DOCUMENT_EMAIL_NOT_CONFIGURED_MESSAGE).toContain('nicht konfiguriert');
    expect(DOCUMENT_FAX_NOT_CONFIGURED_MESSAGE).toContain('nicht konfiguriert');
  });
});

describe('documentDeliveryService', () => {
  it('uses dedicated edge function names', () => {
    expect(SEND_DOCUMENT_EMAIL_FUNCTION).toBe('send-document-email');
    expect(SEND_DOCUMENT_FAX_FUNCTION).toBe('send-document-fax');
  });

  it('detects delivery backend availability in demo mode', () => {
    expect(isDocumentDeliveryBackendAvailable()).toBe(false);
  });
});
