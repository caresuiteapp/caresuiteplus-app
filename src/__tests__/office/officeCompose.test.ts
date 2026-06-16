import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  OFFICE_COMPOSE_MIN_BODY_LENGTH,
  validateOfficeComposeMessage,
} from '@/lib/communication/officeComposeValidation';
import { sendDomainMessage } from '@/lib/communication/domainMessageService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

const root = path.join(__dirname, '..', '..', '..');
const LIVE_TENANT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function stubDemoEnv() {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
}

function stubLiveEnv() {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
}

describe('Office Compose Nachricht verfassen', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Validierung', () => {
    it('verlangt Empfänger bei aktivierter Empfängerauswahl', () => {
      expect(
        validateOfficeComposeMessage({
          subject: 'Termin',
          body: 'ok',
          requireRecipient: true,
          recipientType: 'client',
          recipientId: '',
        }),
      ).toBe('Bitte Empfänger auswählen.');
    });

    it('akzeptiert kurze Nachrichten wie "ok"', () => {
      expect(
        validateOfficeComposeMessage({
          subject: 'Rückmeldung',
          body: 'ok',
          requireRecipient: true,
          recipientType: 'internal',
          recipientId: 'office-broadcast',
        }),
      ).toBeNull();
      expect(OFFICE_COMPOSE_MIN_BODY_LENGTH).toBe(1);
    });

    it('verlangt mindestens 3 Zeichen im Betreff', () => {
      expect(
        validateOfficeComposeMessage({
          subject: 'ab',
          body: 'ok',
          requireRecipient: true,
          recipientType: 'internal',
          recipientId: 'office-broadcast',
        }),
      ).toBe('Betreff muss mindestens 3 Zeichen haben.');
    });
  });

  describe('Produktions-UI', () => {
    beforeEach(() => {
      stubLiveEnv();
    });

    it('ComposeMessageForm blendet Demo-Hinweis im Live-Pfad aus', () => {
      const source = readSrc('src/screens/shared/ComposeMessageForm.tsx');
      expect(source).toContain('isLiveServiceMode');
      expect(source).toContain('showDemoHint');
      expect(source).toContain('Empfänger wählen und Nachricht senden');
    });

    it('OfficeComposeMessageScreen aktiviert Empfängerauswahl', () => {
      const source = readSrc('src/screens/office/OfficeComposeMessageScreen.tsx');
      expect(source).toContain('enableRecipientSelection');
      expect(source).toContain('Nachricht verfassen');
    });
  });

  describe('Demo-Persistenz', () => {
    beforeEach(() => {
      stubDemoEnv();
    });

    it('sendDomainMessage speichert Office-Nachricht mit Empfänger', async () => {
      const result = await sendDomainMessage({
        wpNumber: 153,
        domain: 'office',
        tenantId: DEMO_TENANT_ID,
        actorRoleKey: 'business_admin',
        permission: 'office.access',
        audienceScope: 'office',
        subject: 'Kurze Info',
        body: 'ok',
        senderName: 'Admin',
        requireRecipient: true,
        recipientType: 'internal',
        recipientId: 'office-broadcast',
        recipientLabel: 'Büro (alle)',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.body).toBe('ok');
      }
    });
  });

  describe('Live-Persistenz', () => {
    beforeEach(() => {
      stubLiveEnv();
    });

    it('sendDomainMessage nutzt communication_messages im Live-Pfad', () => {
      const source = readSrc('src/lib/communication/domainMessageService.ts');
      expect(source).toContain('messagesSupabaseRepository');
      expect(source).toContain('threadsSupabaseRepository');
      expect(source).not.toContain('guardLiveDemoFeature');
    });

    it('sendDomainMessage meldet fehlende DB-Verbindung ehrlich', async () => {
      const result = await sendDomainMessage({
        wpNumber: 153,
        domain: 'office',
        tenantId: LIVE_TENANT,
        actorRoleKey: 'business_admin',
        permission: 'office.access',
        audienceScope: 'office',
        subject: 'Live Compose Test',
        body: 'ok',
        senderName: 'Admin',
        requireRecipient: true,
        recipientType: 'internal',
        recipientId: 'office-broadcast',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Datenbank|Supabase/i);
      }
    });
  });
});
