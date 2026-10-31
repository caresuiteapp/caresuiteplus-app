import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { OfficeMessageThread } from '@/types/office/messaging';
const routeState = vi.hoisted(() => ({ params: {} as Record<string, string | string[]> }));
vi.mock('expo-router', () => ({ Redirect: () => null, useLocalSearchParams: () => routeState.params }));
import BusinessMessageDetailRoute from '../../../app/business/messages/[threadId]';
import CommunicationAssignmentsRoute from '../../../app/business/messages/assignments';
import { parseConversationFilter, selectConversations } from '@/lib/office/messageWorkspace.web';
import { parseConversationFilter as parseNativeFilter, selectConversations as selectNativeConversations } from '@/lib/office/messageWorkspace.native';

const ROOT = resolve(__dirname, '../../..');

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('Kommunikationszentrum R22 – Production Acceptance', () => {
  it('Verwaltungsrouten nutzen denselben produktiven Office-Messenger', () => {
    const business = readSrc('app/business/messages/index.tsx');
    const office = readSrc('app/office/messages/index.tsx');
    expect(business).toContain('OfficeMessengerScreen');
    expect(office).toContain('OfficeMessengerScreen');
    expect(business).not.toContain('CommunicationAdaptiveScreen');
  });

  it.each([
    [{ threadId: 'thread/a & b', audience: 'clients' }, 'thread/a & b'],
    [{ id: 'legacy-id', audience: 'employees' }, 'legacy-id'],
    [{ threadId: 'path-id', thread: 'explicit-id', audience: 'clients' }, 'explicit-id'],
  ] as const)('keeps the exact requested conversation and audience through the canonical redirect', (params, thread) => {
    routeState.params = { ...params };
    const redirected = BusinessMessageDetailRoute();
    expect(redirected.props.href).toEqual({ pathname: '/business/messages', params: { audience: params.audience, thread } });
    for (const suffix of ['web', 'native']) {
      const screen = readSrc(`src/screens/office/OfficeMessengerScreen.${suffix}.tsx`);
      expect(screen).toContain('params.thread ?? params.threadId ?? params.id');
    }
  });

  it('Neu, Archiv und Zuordnungen führen nicht in das alte Datenmodell', () => {
    const create = readSrc('app/business/messages/new.tsx');
    const archive = readSrc('app/business/messages/archived.tsx');
    const assignments = readSrc('app/business/messages/assignments.tsx');
    expect(create).toContain('/business/messages?compose=1');
    expect(archive).toContain('/business/messages?chatAge=old');
    expect(assignments).toContain('/business/messages?filter=mine');
    const href = new URL(CommunicationAssignmentsRoute().props.href, 'https://fixture.invalid');
    const base: OfficeMessageThread = { id: 'owned', tenantId: 'tenant-a', createdAt: '2026-10-26T08:00:00Z', updatedAt: '2026-10-26T08:00:00Z', threadType: 'client_office', status: 'open', priority: 'normal', subject: 'Synthetische Anfrage', categoryId: null, categoryLabel: null, clientId: null, clientName: null, employeeId: null, employeeName: null, participantName: null, lastMessageAt: null, lastMessagePreview: null, unreadCount: 0, archivedAt: null, assignedToUserId: 'profile-a' };
    const threads = [base, { ...base, id: 'foreign', assignedToUserId: 'profile-b' }, { ...base, id: 'unassigned', assignedToUserId: null }];
    for (const [parse, select] of [[parseConversationFilter, selectConversations], [parseNativeFilter, selectNativeConversations]] as const) {
      expect(select(threads, '', parse(href.searchParams.get('filter'), href.searchParams.get('chatAge')), 'profile-a').map(thread => thread.id)).toEqual(['owned']);
    }
    expect(`${create}${archive}${assignments}`).not.toContain('CommunicationAdaptiveScreen');
  });

  it('Desktop und Tablet zeigen Split-View statt automatischem Chat-Modal', () => {
    const screen = readSrc('src/screens/office/OfficeMessengerScreen.tsx');
    expect(screen).toContain('MessengerShell');
    expect(screen).not.toContain('OfficeMessageThreadModal');
    expect(screen).not.toContain('widePresentation="modal"');
  });

  it('Mobilansicht besitzt Vollbild-Chat, Rückweg und Tastaturausgleich', () => {
    const shell = readSrc('src/components/messaging/MessengerShell.tsx');
    const thread = readSrc('src/components/office/officemessagethread.tsx');
    expect(shell).toContain('messenger-mobile-thread');
    expect(shell).toContain('messenger-back-to-list');
    expect(thread).toContain('KeyboardAvoidingView');
  });

  it('Office und Portal halten ihre Scrollbereiche innerhalb des Viewports', () => {
    const officeInbox = readSrc('src/components/office/officemessagesinbox.tsx');
    const portalInbox = readSrc('src/components/portal/portalofficeinbox.tsx');
    const portalThread = readSrc('src/components/portal/portalofficethread.tsx');
    expect(officeInbox).toContain('minHeight: 0');
    expect(portalInbox).toContain('minHeight: 0');
    expect(portalThread).toContain('scrollRegion');
  });

  it('Mitarbeitenden- und Klientenportal rendern nie mehr den Legacy-Messenger', () => {
    const routing = readSrc('src/screens/communication/portalmessagingscreens.tsx');
    expect(routing).toContain('EmployeePortalOfficeMessagesScreen');
    expect(routing).toContain('ClientPortalOfficeMessagesScreen');
    expect(routing).not.toContain('getServiceMode');
    expect(routing).not.toContain('LegacyEmployeePortalMessagesScreen');
  });

  it('Portal-Postfach zeigt exakte ungelesene Zähler und Suchleerzustand', () => {
    const inbox = readSrc('src/components/portal/portalofficeinbox.tsx');
    expect(inbox).toContain('thread.unreadCount > 0');
    expect(inbox).toContain("title=\"Keine Treffer\"");
  });

  it('Realtime hört mandantenbezogen auf Threads und Nachrichten', () => {
    const realtime = readSrc('src/lib/office/officemessagerealtime.ts');
    expect(realtime).toContain("table: 'message_threads'");
    expect(realtime).toContain("table: 'messages'");
    expect(realtime).toContain('filter: `tenant_id=eq.${tenantId}`');
    expect(realtime).toContain('createVisibilityAwareInterval');
  });

  it('Unread-Zähler werden atomar und aus Bestandsdaten repariert', () => {
    const migration = readSrc(
      'supabase/migrations/20260801103000_communication_center_unread_integrity.sql',
    );
    expect(migration).toContain('caresuite_message_unread_counters');
    expect(migration).toContain('sender_employee_id IS NOT NULL');
    expect(migration).toContain('portal_unread_count = GREATEST');
    expect(migration).toContain('Bestehende Zähler einmalig');
  });

  it('Kommunikationseinstellungen werden im Live-Modus tatsächlich gespeichert', () => {
    const service = readSrc('src/features/communication/communication.service.ts');
    expect(service).toContain('settingsSupabaseRepository.upsert');
    expect(service).toContain("assign('realtimeEnabled', 'realtime_enabled')");
    expect(service).toContain("assign('attachmentsEnabled', 'attachments_enabled')");
  });

  it('Mandanten- und Rollenbarrieren bleiben im produktiven Dienst aktiv', () => {
    const office = readSrc('src/lib/office/messageservice.ts');
    const portal = readSrc('src/lib/office/portalofficemessageservice.ts');
    expect(office).toContain('guardServiceTenant');
    expect(office).toContain('enforcePermission');
    expect(portal).toContain('threadBelongsToActor');
    expect(portal).toContain('filterPortalVisibleMessages');
  });

  it('Datenbank trennt Verwaltung, Klient:innen und Mitarbeitende auch innerhalb des Mandanten', () => {
    const migration = readSrc(
      'supabase/migrations/20260801103000_communication_center_unread_integrity.sql',
    );
    expect(migration).toContain("public.has_permission('office.access')");
    expect(migration).toContain('client_id = public.current_client_id()');
    expect(migration).toContain('employee_id = public.resolve_current_employee_id()');
    expect(migration).toContain('message_thread_employee_participants_portal_self');
    expect(migration).toContain('message_attachments_portal_select');
  });

  it('Portalnavigation hält Abmelden auf Desktop und Mobil sichtbar', () => {
    const ownership = readSrc('src/__tests__/portal/portalNavigationOwnership.test.ts');
    expect(ownership).toContain('logout visible in desktop and mobile portal navigation');
    expect(ownership).toContain('Abmelden');
  });
});
