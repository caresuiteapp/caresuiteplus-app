import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  demoOfficeMessageThreads,
  getDemoOfficeMessages,
  resetDemoOfficeMessaging,
} from '@/data/demo/officemessagethreads';
import {
  assertNoDirectClientEmployeeComms,
  canSendMessageToThread,
  filterPortalVisibleMessages,
  isOfficeModuleThread,
  validateSendMessage,
} from '@/lib/office/messagebusinessrules';
import { sendOfficeMessage } from '@/lib/office/messageservice';
import { fetchOfficeMessageThreads } from '@/lib/office/messagethreadservice';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function stubDemoEnv() {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
}

describe('Office Messaging Business Rules', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetDemoOfficeMessaging();
  });

  beforeEach(() => {
    stubDemoEnv();
  });

  it('Regel 1: Nur Office-Modul-Thread-Typen sind erlaubt', () => {
    expect(isOfficeModuleThread('client_office')).toBe(true);
    expect(isOfficeModuleThread('employee_office')).toBe(true);
    expect(isOfficeModuleThread('internal')).toBe(true);
    for (const thread of demoOfficeMessageThreads) {
      expect(isOfficeModuleThread(thread.threadType)).toBe(true);
    }
  });

  it('Regel 2: Keine direkte Klient:innen↔Mitarbeitende-Kommunikation', () => {
    for (const thread of demoOfficeMessageThreads) {
      expect(assertNoDirectClientEmployeeComms(thread)).toBe(true);
    }
    expect(
      assertNoDirectClientEmployeeComms({
        threadType: 'client_office',
        clientId: 'c1',
        employeeId: 'e1',
      }),
    ).toBe(false);
    expect(
      assertNoDirectClientEmployeeComms({
        threadType: 'employee_office',
        clientId: 'c1',
        employeeId: 'e1',
      }),
    ).toBe(false);
  });

  it('Regel 3: Abgeschlossene Threads können keine neuen Nachrichten empfangen', async () => {
    expect(canSendMessageToThread('open')).toBe(true);
    expect(canSendMessageToThread('waiting')).toBe(true);
    expect(canSendMessageToThread('resolved')).toBe(false);
    expect(canSendMessageToThread('archived')).toBe(false);

    const closedThread = demoOfficeMessageThreads.find((t) => t.status === 'resolved');
    expect(closedThread).toBeTruthy();
    if (!closedThread) return;

    const validation = validateSendMessage(closedThread);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.error).toContain('Abgeschlossene');
    }

    const result = await sendOfficeMessage(
      DEMO_TENANT_ID,
      closedThread.id,
      'Darf nicht gesendet werden',
      'business_admin',
      'profile-dispatch-001',
    );
    expect(result.ok).toBe(false);
  });

  it('Regel 4: Interne Notizen sind im Portal nicht sichtbar', () => {
    const threadMessages = getDemoOfficeMessages().filter(
      (message) => message.threadId === 'thread-client-001',
    );
    expect(threadMessages.some((message) => message.isInternalNote)).toBe(true);

    const portalVisible = filterPortalVisibleMessages(threadMessages);
    expect(portalVisible.every((message) => !message.isInternalNote)).toBe(true);
    expect(portalVisible.length).toBeLessThan(threadMessages.length);
  });

  it('fetchOfficeMessageThreads uses live Supabase path (no demo preview)', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');

    const result = await fetchOfficeMessageThreads(DEMO_TENANT_ID, 'business_admin', 'inbox');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Supabase|Migration|0089/i);
    }
  });

  it('sendOfficeMessage requires live Supabase (no demo append)', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');

    const openThread = demoOfficeMessageThreads.find((t) => t.status === 'open');
    expect(openThread).toBeTruthy();
    if (!openThread) return;

    const result = await sendOfficeMessage(
      DEMO_TENANT_ID,
      openThread.id,
      'Testantwort aus Unit-Test',
      'business_admin',
      'profile-dispatch-001',
    );
    expect(result.ok).toBe(false);
  });

  it('Messenger-Komponenten nutzen ChatBubble und deutsche UI', () => {
    expect(readSrc('src/components/office/OfficeMessageThread.tsx')).toContain('ChatBubble');
    expect(readSrc('src/components/office/OfficeMessageThread.tsx')).toContain('Neuen Chat starten');
    expect(readSrc('src/components/office/OfficeMessagesInbox.tsx')).toContain('Posteingang');
    expect(readSrc('src/lib/navigation/moduleNav/officeNav.ts')).toContain("label: 'Nachrichten'");
  });
});
