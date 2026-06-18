import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CLIENT_CATEGORY_KEYS,
  EMPLOYEE_CATEGORY_KEYS,
  categoryShowsEmergencyDisclaimer,
  PORTAL_EMERGENCY_DISCLAIMER,
} from '@/lib/office/messagecategoryconstants';
import { PORTAL_THREAD_STATUS_LABELS } from '@/lib/office/messagestatuslabels';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const mockSetSession = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: { setSession: mockSetSession },
    from: mockFrom,
  }),
}));

describe('Office Messaging Final Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    mockSetSession.mockResolvedValue({
      data: { session: { access_token: 'at', refresh_token: 'rt', user: { id: 'auth-1' } } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'communication_notifications') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Spec 1: Vollständige Klient:innen-Kategorien laut Abschnitt 4', () => {
    expect(CLIENT_CATEGORY_KEYS).toHaveLength(12);
    expect(CLIENT_CATEGORY_KEYS).toContain('emergency_contact');
    expect(CLIENT_CATEGORY_KEYS).toContain('cancel_assignment');
    expect(CLIENT_CATEGORY_KEYS).toContain('feedback');
  });

  it('Spec 2: Vollständige Mitarbeitenden-Kategorien laut Abschnitt 5', () => {
    expect(EMPLOYEE_CATEGORY_KEYS).toHaveLength(13);
    expect(EMPLOYEE_CATEGORY_KEYS).toContain('sick_leave');
    expect(EMPLOYEE_CATEGORY_KEYS).toContain('travel_logbook');
  });

  it('Spec 3: Notfall-Disclaimer für Notfallkategorien', () => {
    expect(categoryShowsEmergencyDisclaimer({ emergency: true })).toBe(true);
    expect(categoryShowsEmergencyDisclaimer({ show_disclaimer: true })).toBe(true);
    expect(categoryShowsEmergencyDisclaimer({})).toBe(false);
    expect(PORTAL_EMERGENCY_DISCLAIMER).toContain('112');
    expect(readSrc('src/components/portal/PortalNewChatModal.tsx')).toContain('PORTAL_EMERGENCY_DISCLAIMER');
  });

  it('Spec 4: Portal-Statuslabels aus Abschnitt 11', () => {
    expect(PORTAL_THREAD_STATUS_LABELS.received).toBe('Eingegangen');
    expect(PORTAL_THREAD_STATUS_LABELS.in_progress).toBe('In Bearbeitung');
    expect(PORTAL_THREAD_STATUS_LABELS.waiting_for_reply).toBe('Rückmeldung erforderlich');
    expect(PORTAL_THREAD_STATUS_LABELS.resolved).toBe('Erledigt');
    expect(PORTAL_THREAD_STATUS_LABELS.closed).toBe('Abgeschlossen');
  });

  it('Spec 5: Posteingang-Suche nach Name, Kategorie und Inhalt', () => {
    const inbox = readSrc('src/components/office/OfficeMessagesInbox.tsx');
    expect(inbox).toContain('categoryLabel');
    expect(inbox).toContain('lastMessagePreview');
    expect(inbox).toContain('clientName');
  });

  it('Spec 6: Office-Navigation mit Messenger-Filtern und Vorlagen', () => {
    const nav = readSrc('src/lib/navigation/moduleNav/officeNav.ts');
    expect(nav).toContain('/office/messages?filter=inbox');
    expect(nav).toContain('/office/messages?filter=clients');
    expect(nav).toContain('/office/messages/templates');
    expect(nav).not.toContain("label: 'Nachrichten'");
  });

  it('Spec 7: Chat-Export-Stub mit Audit', () => {
    expect(readSrc('src/lib/office/officeMessageExportService.ts')).toContain('office_message_export_requested');
    expect(readSrc('src/components/office/OfficeMessageContextPanel.tsx')).toContain('Chat exportieren');
  });

  it('Spec 8: Benachrichtigungen nutzen office_thread_id statt communication_threads FK', async () => {
    const { notifyOfficeMessageEvent } = await import('@/lib/office/officemessagenotifications');
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation(() => ({ insert }));

    await notifyOfficeMessageEvent({
      tenantId: TENANT_ID,
      type: 'office_message_new',
      threadId: 'msg-thread-1',
      title: 'Neue Nachricht',
      body: 'Neue Nachricht in CareSuite+',
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        office_thread_id: 'msg-thread-1',
        tenant_id: TENANT_ID,
      }),
    );
  });

  it('Portal Auth: mapPortalSupabaseTokensFromEdge mappt Edge-Antwort', () => {
    const src = readSrc('src/lib/auth/portalSupabaseAuth.ts');
    expect(src).toContain('mapPortalSupabaseTokensFromEdge');
    expect(src).toContain('supabaseAccessToken');
    expect(src).toContain('setSession');
  });

  it('Portal Auth: signInWithPortalSupabaseTokens setzt Supabase-Session', () => {
    const src = readSrc('src/lib/auth/portalSupabaseAuth.ts');
    expect(src).toContain('signInWithPortalSupabaseTokens');
    expect(src).toContain('access_token: tokens.accessToken');
  });

  it('Portal Auth: completePortalLogin verknüpft Tokens und Portal-Session', () => {
    const src = readSrc('src/lib/auth/portalLoginFlow.ts');
    expect(src).toContain('signInWithPortalSupabaseTokens');
    expect(src).toContain('portalSession');
  });

  it('Migration 0093: Portal auth linkage und Kategorie-Seeds', () => {
    const sql = readFileSync(
      path.join(root, 'supabase/migrations/0093_office_messaging_final.sql'),
      'utf8',
    );
    expect(sql).toContain('auth_user_id');
    expect(sql).toContain('cancel_assignment');
    expect(sql).toContain('assignment_problem');
    expect(sql).toContain('office_thread_id');
    expect(sql).toContain('current_tenant_id()');
    expect(sql).toContain('auth_user_id = auth.uid()');
  });

  it('Edge Functions: portal auth linkage in Login-Flows', () => {
    expect(readSrc('supabase/functions/client-portal-login/index.ts')).toContain('ensurePortalSupabaseAuth');
    expect(readSrc('supabase/functions/employee-portal-login/index.ts')).toContain('ensurePortalSupabaseAuth');
    expect(readSrc('supabase/functions/portal-code-login/index.ts')).toContain('ensurePortalSupabaseAuth');
    expect(readSrc('supabase/functions/_shared/portalAuth.ts')).toContain('auth_user_id');
  });

  it('Login-Screens: completePortalLogin vor signInPortalSession', () => {
    expect(readSrc('src/screens/auth/PortalCodeLoginScreen.tsx')).toContain('completePortalLogin');
    expect(readSrc('src/screens/auth/EmployeePortalLoginScreen.tsx')).toContain('completePortalLogin');
  });

  it('Admin UI: Vorlagen-Verwaltung vorhanden', () => {
    expect(readSrc('src/screens/office/OfficeMessageTemplatesScreen.tsx')).toContain('Schnellantwort-Vorlagen');
    expect(readSrc('src/lib/office/messageQuickReplyTemplateService.ts')).toContain('deactivateQuickReplyTemplate');
  });
});
