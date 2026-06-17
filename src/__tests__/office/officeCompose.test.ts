import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  OFFICE_COMPOSE_MIN_BODY_LENGTH,
  validateOfficeComposeMessage,
} from '@/lib/communication/officeComposeValidation';
import {
  buildOfficeThreadPayload,
  canViewOfficeInternalMessages,
  resolveOfficeMessageRecipientName,
} from '@/lib/communication/officeComposeRouting';
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

  describe('Empfänger-Routing', () => {
    it('Team-Nachrichten nutzen employee-Thread für Team-Broadcast', () => {
      const payload = buildOfficeThreadPayload({
        subject: 'Schichtinfo',
        audienceScope: 'office',
        recipientType: 'team',
        recipientId: 'team:allgemein',
        recipientLabel: 'Allgemein',
      });
      expect(payload.threadType).toBe('employee');
      expect(payload.employeeId).toBeNull();
      expect(payload.allowEmployeeReplies).toBe(true);
      expect(payload.isPortalVisible).toBe(true);
      expect(payload.isInternalOnly).toBe(false);
      expect(payload.title).toContain('Allgemein');
    });

    it('Intern-Nachrichten nutzen internal-Thread nur für Büropersonal', () => {
      const payload = buildOfficeThreadPayload({
        subject: 'Abrechnung',
        audienceScope: 'office',
        recipientType: 'internal',
        recipientId: 'office-broadcast',
        recipientLabel: 'Büro (alle)',
      });
      expect(payload.threadType).toBe('internal');
      expect(payload.isInternalOnly).toBe(true);
      expect(payload.isPortalVisible).toBe(false);
      expect(payload.allowEmployeeReplies).toBe(false);
    });

    it('Intern-Threads sind nur für Büropersonal sichtbar', () => {
      expect(canViewOfficeInternalMessages('business_admin')).toBe(true);
      expect(canViewOfficeInternalMessages('billing')).toBe(true);
      expect(canViewOfficeInternalMessages('nurse')).toBe(false);
      expect(canViewOfficeInternalMessages('caregiver')).toBe(false);
    });

    it('Team-Broadcast-Empfänger wird aus Titel aufgelöst', () => {
      const recipient = resolveOfficeMessageRecipientName({
        id: 't1',
        tenantId: 't',
        threadType: 'employee',
        status: 'open',
        priority: 'normal',
        subject: 'Info',
        title: 'Info — Allgemein',
        previewText: null,
        moduleKey: 'office',
        clientId: null,
        employeeId: null,
        relativeContactId: null,
        assignmentId: null,
        documentId: null,
        invoiceId: null,
        consultationCaseId: null,
        courseId: null,
        supportTicketId: null,
        createdByUserId: null,
        createdByPortalSessionId: null,
        lastMessageId: null,
        lastMessageAt: null,
        lastMessageByDisplayName: null,
        unreadCountBusiness: 1,
        unreadCountEmployee: 0,
        unreadCountClient: 0,
        unreadCountRelative: 0,
        isInternalOnly: false,
        isPortalVisible: true,
        allowClientReplies: false,
        allowEmployeeReplies: true,
        allowRelativeReplies: false,
        archivedAt: null,
        archivedBy: null,
        deletedAt: null,
        deletedBy: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      });
      expect(recipient).toBe('Allgemein');
    });
  });

  describe('Produktions-UI', () => {
    beforeEach(() => {
      stubLiveEnv();
    });

    it('ComposeMessageForm enthält keine Kurzantwort-Hinweiszeile', () => {
      const source = readSrc('src/screens/shared/ComposeMessageForm.tsx');
      expect(source).not.toContain('Kurze Antworten');
      expect(source).toContain('OFFICE_RECIPIENT_HINTS');
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
