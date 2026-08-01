import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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

  it('Direktlink und Reload eines Threads bleiben im produktiven Messenger', () => {
    const route = readSrc('app/business/messages/[threadId].tsx');
    const screen = readSrc('src/screens/office/OfficeMessengerScreen.tsx');
    expect(route).toContain('OfficeMessengerScreen');
    expect(screen).toContain('threadId?: string');
    expect(screen).toContain('params.thread ?? params.threadId');
  });

  it('Neu, Archiv und Zuordnungen führen nicht in das alte Datenmodell', () => {
    const create = readSrc('app/business/messages/new.tsx');
    const archive = readSrc('app/business/messages/archived.tsx');
    const assignments = readSrc('app/business/messages/assignments.tsx');
    expect(create).toContain('/business/messages?compose=1');
    expect(archive).toContain('/business/messages?chatAge=old');
    expect(assignments).toContain('/business/messages?chatAge=new');
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
