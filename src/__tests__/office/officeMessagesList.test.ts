import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildOfficeMessageListKpis } from '@/data/demo/officeMessageListStats';
import { demoPortalMessages } from '@/data/demo/messages';
import { sendDomainMessage } from '@/lib/communication/domainMessageService';
import {
  fetchOfficeMessages,
  fetchOfficeMessageDetail,
  replyToOfficeMessage,
} from '@/lib/portal/messageService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { OFFICE_MESSAGE_STATUS_FILTERS, OFFICE_MESSAGE_SORT_OPTIONS } from '@/hooks/useOfficeMessages';
import type { MessageListItem } from '@/types/portal/communication';

const root = path.join(__dirname, '..', '..', '..');
const LIVE_TENANT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const DEMO_SUBJECTS = ['MDK-Anfrage', 'Rechnungsfreigabe', 'Neue Klient:in'];

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

const officeMessages: MessageListItem[] = demoPortalMessages
  .filter((m) => m.audienceScope === 'office')
  .map((m) => ({
    id: m.id,
    subject: m.subject,
    body: m.body,
    senderName: m.senderName,
    recipientName: m.recipientName,
    direction: m.direction,
    readAt: m.readAt,
    status: m.status,
    updatedAt: m.updatedAt,
    visibility: m.visibility,
    sensitivity: m.sensitivity,
  }));

describe('Office Nachrichten list', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('enforcePermission schützt Office-Messages-Service', () => {
    expect(enforcePermission(null, 'office.messages.view' as never)).not.toBeNull();
  });

  describe('Demo-Modus', () => {
    beforeEach(() => {
      stubDemoEnv();
    });

    it('fetchOfficeMessages liefert Demo-Office-Nachrichten', async () => {
      const result = await fetchOfficeMessages(DEMO_TENANT_ID, 'business_admin');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data[0]?.subject).toBeTruthy();
      }
    });

    it('fetchOfficeMessageDetail liefert Demo-Detail', async () => {
      const result = await fetchOfficeMessageDetail('msg-007', DEMO_TENANT_ID, 'business_admin');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.subject).toContain('MDK-Anfrage');
      }
    });

    it('sendDomainMessage persistiert Office-Nachricht', async () => {
      const result = await sendDomainMessage({
        wpNumber: 153,
        domain: 'office',
        tenantId: DEMO_TENANT_ID,
        actorRoleKey: 'business_admin',
        permission: 'office.access',
        audienceScope: 'office',
        subject: 'Test Office Compose',
        body: 'Dies ist eine Testnachricht für Sprint 24.',
        senderName: 'Admin',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const list = await fetchOfficeMessages(DEMO_TENANT_ID, 'business_admin');
        expect(list.ok).toBe(true);
        if (list.ok) {
          expect(list.data.some((m) => m.subject === 'Test Office Compose')).toBe(true);
        }
      }
    });

    it('replyToOfficeMessage sendet Demo-Antwort', async () => {
      const detail = await fetchOfficeMessageDetail('msg-007', DEMO_TENANT_ID, 'business_admin');
      expect(detail.ok).toBe(true);
      if (!detail.ok) return;

      const reply = await replyToOfficeMessage(
        'msg-007',
        DEMO_TENANT_ID,
        'business_admin',
        'Vielen Dank für die Rückmeldung — wir bearbeiten die Anfrage.',
        'Office Admin',
      );
      expect(reply.ok).toBe(true);
      if (reply.ok) {
        expect(reply.data.body).toContain('Vielen Dank');
        expect(reply.data.canReply).toBe(true);
      }
    });
  });

  describe('Live-Modus (Supabase)', () => {
    beforeEach(() => {
      stubLiveEnv();
    });

    it('fetchOfficeMessages liefert keine Demo-Nachrichten', async () => {
      const result = await fetchOfficeMessages(LIVE_TENANT, 'business_admin');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([]);
        for (const subject of DEMO_SUBJECTS) {
          expect(result.data.some((m) => m.subject.includes(subject))).toBe(false);
        }
      }
    });

    it('fetchOfficeMessageDetail findet keine Demo-Nachricht', async () => {
      const result = await fetchOfficeMessageDetail('msg-007', LIVE_TENANT, 'business_admin');
      expect(result.ok).toBe(false);
    });

    it('sendDomainMessage ist im Live-Modus blockiert', async () => {
      const result = await sendDomainMessage({
        wpNumber: 153,
        domain: 'office',
        tenantId: LIVE_TENANT,
        actorRoleKey: 'business_admin',
        permission: 'office.access',
        audienceScope: 'office',
        subject: 'Live Compose Test',
        body: 'Dies ist eine Testnachricht im Live-Modus.',
        senderName: 'Admin',
      });
      expect(result.ok).toBe(false);
    });

    it('messageService nutzt getServiceMode für Live-Pfad', () => {
      const source = readSrc('src/lib/portal/messageService.ts');
      expect(source).toContain('getServiceMode');
      expect(source).toContain('usesDemoMessageStore');
    });

    it('OfficeMessageDetailSummaryPanel zeigt keinen Demo-Versand-Text im Live-Pfad', () => {
      const source = readSrc('src/components/office/OfficeMessageDetailSummaryPanel.tsx');
      expect(source).toContain('isLiveServiceMode');
      expect(source).not.toMatch(/subtitle="Demo-Versand mit Persistenz"/);
    });

    it('ComposeMessageForm blendet Demo-Hinweis im Live-Pfad aus', () => {
      const source = readSrc('src/screens/shared/ComposeMessageForm.tsx');
      expect(source).toContain('isLiveServiceMode');
    });
  });

  it('buildOfficeMessageListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const kpis = buildOfficeMessageListKpis(officeMessages);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'messages-kpi-unread')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(OFFICE_MESSAGE_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(OFFICE_MESSAGE_SORT_OPTIONS.some((o) => o.key === 'updated_desc')).toBe(true);
  });

  it('OfficeMessagesListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/office/OfficeMessagesListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('OfficeMessagesAdaptiveScreen nutzt AdaptiveListDetail mit Summary-Panel', () => {
    const source = readSrc('src/screens/office/OfficeMessagesAdaptiveScreen.tsx');
    expect(source).toContain('AdaptiveListDetail');
    expect(source).toContain('OfficeMessageDetailSummaryPanel');
  });

  it('OfficeMessageCompactRow unterstützt Auswahlzustand für List-Detail', () => {
    const source = readSrc('src/components/office/OfficeMessageCompactRow.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('rowSelected');
  });

  it('messageService fetchOfficeMessages nutzt guardServiceTenant und getServiceMode', () => {
    const source = readSrc('src/lib/portal/messageService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getServiceMode');
  });

  it('OfficeMessagesListView bietet Compose-Navigation', () => {
    const source = readSrc('src/components/office/OfficeMessagesListView.tsx');
    expect(source).toContain('Neue Nachricht');
    expect(source).toContain('/office/messages/compose');
  });

  it('OfficeMessageDetailSummaryPanel unterstützt Antwort-Flow', () => {
    const source = readSrc('src/components/office/OfficeMessageDetailSummaryPanel.tsx');
    expect(source).toContain('Antwort senden');
    expect(source).toContain('useOfficeMessageDetail');
    expect(source).toContain('isLiveServiceMode');
  });

  it('Compose-Route nutzt OfficeComposeMessageScreen', () => {
    const source = readSrc('app/office/messages/compose.tsx');
    expect(source).toContain('OfficeComposeMessageScreen');
  });
});
