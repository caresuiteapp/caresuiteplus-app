import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePortalActor } from '@/lib/office/portalofficemessageservice';

const ROOT = resolve(__dirname, '../../..');

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const CLIENT_ID = 'client-ellen';

describe('Portal Verwaltung messaging', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('client messages tab uses glass Verwaltung messenger with MessengerShell', () => {
    const route = readSrc('app/portal/client/(tabs)/messages.tsx');
    const screen = readSrc('src/screens/portal/portalofficemessagesscreens.tsx');
    const messenger = readSrc('src/components/portal/portalofficemessenger.tsx');

    expect(route).toContain('PortalTabScreen');
    expect(screen).toContain('variant="glass"');
    expect(screen).toContain('Verwaltung');
    expect(messenger).toContain('MessengerShell');
    expect(messenger).toContain('Verwaltung anschreiben');
  });

  it('empty inbox offers Verwaltung compose CTA', () => {
    const inbox = readSrc('src/components/portal/portalofficeinbox.tsx');
    expect(inbox).toContain('Verwaltung anschreiben');
    expect(inbox).toContain('PortalEmptyState');
  });

  it('resolvePortalActor links client portal session to client_office audience', () => {
    const actorResult = resolvePortalActor('client_portal', {
      sessionToken: 'tok',
      tenantId: TENANT_ID,
      loginType: 'client_portal',
      roleKey: 'client_portal',
      expiresAt: '2099-01-01T00:00:00.000Z',
      accountId: 'acc-ellen',
      clientId: CLIENT_ID,
      displayName: 'Frau Ellen Zacharias',
    });
    expect(actorResult.ok).toBe(true);
    if (!actorResult.ok) return;
    expect(actorResult.data.audience).toBe('client');
    expect(actorResult.data.clientId).toBe(CLIENT_ID);
  });

  it('communication index routes portal tabs through live Verwaltung messenger', () => {
    const index = readSrc('src/screens/communication/index.ts');
    expect(index).toContain('./portalmessagingscreens');
    expect(index).not.toMatch(/ClientPortalMessagesScreen[\s\S]*PortalMessagesScreens/);
  });

  it('overview KPI deep-links to compose modal', () => {
    const overview = readSrc('src/components/portal/assist/AssistPortalOverview.tsx');
    expect(overview).toContain("'/portal/client/messages?compose=1'");
  });

  it('employee portal inbox shows group badge labels', () => {
    const inbox = readSrc('src/components/portal/portalofficeinbox.tsx');
    expect(inbox).toContain('👥 Gruppe');
    expect(inbox).toContain('Mitglieder');
    expect(inbox).toContain('isEmployeeGroupChatThread');
  });

  it('employee portal thread header uses group labels', () => {
    const threadView = readSrc('src/components/portal/portalofficethread.tsx');
    expect(threadView).toContain('resolveOfficeThreadParticipantName');
    expect(threadView).toContain('resolveOfficeThreadHeaderSubtitle');
    expect(threadView).toContain('isEmployeeGroupChatThread');
  });
});
