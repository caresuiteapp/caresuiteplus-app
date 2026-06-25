import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfficeMessage } from '@/types/office/messaging';
import { filterActiveMessages } from '@/lib/office/messagebusinessrules';
import {
  archiveOfficeMessage,
  hardDeleteOfficeMessage,
} from '@/lib/office/messagelifecycle';
import { enforcePermission } from '@/lib/permissions';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

const MESSAGE_ID = 'msg-001';
const THREAD_ID = 'thread-client-001';
const LIVE_TENANT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const baseMessage: OfficeMessage = {
  id: MESSAGE_ID,
  tenantId: DEMO_TENANT_ID,
  threadId: THREAD_ID,
  body: 'Testnachricht',
  senderType: 'client_portal',
  senderProfileId: null,
  senderClientId: 'client-001',
  senderEmployeeId: null,
  senderDisplayName: 'Klient:in',
  isInternalNote: false,
  isSystemMessage: false,
  sentAt: '2026-06-25T10:00:00.000Z',
  readAt: null,
  status: 'sent',
  createdAt: '2026-06-25T10:00:00.000Z',
  updatedAt: '2026-06-25T10:00:00.000Z',
};

describe('Office message lifecycle', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('filterActiveMessages excludes archived and deleted messages', () => {
    const messages: OfficeMessage[] = [
      baseMessage,
      { ...baseMessage, id: 'msg-002', status: 'archived' },
      { ...baseMessage, id: 'msg-003', status: 'deleted' },
    ];

    const active = filterActiveMessages(messages);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(MESSAGE_ID);
  });

  it('archiveOfficeMessage requires office.messages.archive permission', async () => {
    expect(enforcePermission(null, 'office.messages.archive')).not.toBeNull();
    expect(enforcePermission('billing', 'office.messages.archive')).not.toBeNull();
    expect(enforcePermission('business_admin', 'office.messages.archive')).toBeNull();
    expect(enforcePermission('dispatch', 'office.messages.archive')).toBeNull();
  });

  it('hardDeleteOfficeMessage requires office.messages.delete permission', async () => {
    expect(enforcePermission(null, 'office.messages.delete')).not.toBeNull();
    expect(enforcePermission('dispatch', 'office.messages.delete')).not.toBeNull();
    expect(enforcePermission('business_admin', 'office.messages.delete')).toBeNull();
  });

  it('archiveOfficeMessage fails without Supabase client', async () => {
    const result = await archiveOfficeMessage(
      LIVE_TENANT_ID,
      MESSAGE_ID,
      'business_admin',
      'profile-001',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Supabase/i);
    }
  });

  it('hardDeleteOfficeMessage fails without Supabase client', async () => {
    const result = await hardDeleteOfficeMessage(
      LIVE_TENANT_ID,
      MESSAGE_ID,
      'business_admin',
      'profile-001',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Supabase/i);
    }
  });
});
