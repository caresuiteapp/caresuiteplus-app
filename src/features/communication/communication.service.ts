import type { RoleKey, ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { getPortalProfileLink } from '@/lib/portal/portalVisibility';
import { runService } from '@/lib/services/serviceRunner';
import { appendCommunicationAudit } from './communication.audit';
import {
  appendDemoAssignment,
  appendDemoAttachment,
  appendDemoMessage,
  appendDemoNotification,
  appendDemoReaction,
  appendDemoThread,
  getDemoAssignments,
  getDemoAttachments,
  getDemoCommunicationSettings,
  getDemoMessages,
  getDemoParticipants,
  getDemoReactions,
  getDemoThreads,
} from './communication.demoStore';
import {
  canViewPortalThreads,
  enforceCommunicationPermission,
  hasCommunicationPermission,
} from './communication.permissions';
import { filterMessagesForAudience } from './communication.portalFilter';
import type {
  CommunicationAudience,
  CommunicationCenterKpis,
  CommunicationMessage,
  CommunicationSettings,
  CommunicationThread,
  CreateThreadInput,
  SendMessageInput,
  ThreadListFilter,
  ThreadListItem,
} from './communication.types';

function getCommRepos() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./repositories') as typeof import('./repositories');
}

export type ListThreadsOptions = {
  filter?: ThreadListFilter;
  search?: string;
  includeArchived?: boolean;
};

function assertTenant(tenantId: string): ServiceResult<never> | null {
  const err = assertTenantForMode(tenantId);
  if (err) return { ok: false, error: err.error };
  return null;
}

function audienceForRole(roleKey: RoleKey | null | undefined): CommunicationAudience {
  switch (roleKey) {
    case 'employee_portal':
    case 'caregiver':
    case 'nurse':
      return 'employee_portal';
    case 'family_portal':
      return 'relative_portal';
    case 'client_portal':
      return 'client_portal';
    default:
      return 'business';
  }
}

function canViewThreadType(
  roleKey: RoleKey | null | undefined,
  thread: CommunicationThread,
  audience: CommunicationAudience,
): boolean {
  if (audience !== 'business') {
    if (thread.isInternalOnly || !thread.isPortalVisible) return false;
    return true;
  }
  if (thread.threadType === 'internal') {
    return hasCommunicationPermission(roleKey, 'communication.view_internal_threads');
  }
  if (thread.threadType === 'client') {
    return hasCommunicationPermission(roleKey, 'communication.view_client_threads');
  }
  if (thread.threadType === 'employee') {
    return hasCommunicationPermission(roleKey, 'communication.view_employee_threads');
  }
  if (thread.threadType === 'relative') {
    return hasCommunicationPermission(roleKey, 'communication.view_relative_threads');
  }
  return hasCommunicationPermission(roleKey, 'communication.view_center');
}

function filterThreadForPortal(
  thread: CommunicationThread,
  profileId: string | undefined,
  audience: CommunicationAudience,
): boolean {
  if (audience === 'business') return true;
  const link = profileId ? getPortalProfileLink(profileId) : {};
  switch (audience) {
    case 'employee_portal':
      return thread.employeeId !== null && thread.employeeId === link.employeeId;
    case 'client_portal':
      return thread.clientId !== null && thread.clientId === link.clientId && thread.isPortalVisible;
    case 'relative_portal':
      return (
        thread.relativeContactId !== null &&
        thread.clientId === link.clientId &&
        thread.isPortalVisible &&
        thread.allowRelativeReplies
      );
    default:
      return false;
  }
}

function toThreadListItem(thread: CommunicationThread): ThreadListItem {
  const hasAttachments = getDemoAttachments().some((a) => a.threadId === thread.id);
  return {
    id: thread.id,
    threadType: thread.threadType,
    status: thread.status,
    priority: thread.priority,
    title: thread.title,
    previewText: thread.previewText,
    moduleKey: thread.moduleKey,
    lastMessageAt: thread.lastMessageAt,
    lastMessageByDisplayName: thread.lastMessageByDisplayName,
    unreadCountBusiness: thread.unreadCountBusiness,
    isPortalVisible: thread.isPortalVisible,
    clientId: thread.clientId,
    employeeId: thread.employeeId,
    assignmentId: thread.assignmentId,
    updatedAt: thread.updatedAt,
    hasAttachments,
    participantLabel: thread.title,
  };
}

function applyThreadFilter(
  threads: CommunicationThread[],
  filter: ThreadListFilter,
): CommunicationThread[] {
  switch (filter) {
    case 'unread':
      return threads.filter((t) => t.unreadCountBusiness > 0);
    case 'client':
      return threads.filter((t) => t.threadType === 'client');
    case 'employee':
      return threads.filter((t) => t.threadType === 'employee');
    case 'relative':
      return threads.filter((t) => t.threadType === 'relative');
    case 'internal':
      return threads.filter((t) => t.threadType === 'internal');
    case 'module':
      return threads.filter((t) => t.moduleKey !== null && t.moduleKey !== 'core');
    case 'unassigned':
      return threads.filter(
        (t) =>
          !t.clientId &&
          !t.employeeId &&
          !t.assignmentId &&
          !t.documentId &&
          !t.invoiceId &&
          !t.consultationCaseId &&
          !t.courseId,
      );
    case 'archived':
      return threads.filter((t) => t.status === 'archived' || t.archivedAt);
    case 'deleted':
      return threads.filter((t) => t.status === 'deleted' || t.deletedAt);
    case 'high_priority':
      return threads.filter(
        (t) => t.priority === 'high' || t.priority === 'urgent' || t.priority === 'critical',
      );
    default:
      return threads.filter((t) => t.status !== 'archived' && t.status !== 'deleted' && !t.archivedAt);
  }
}

export async function listThreads(
  tenantId: string,
  options: ListThreadsOptions = {},
  actorRoleKey?: RoleKey | null,
  profileId?: string,
): Promise<ServiceResult<ThreadListItem[]>> {
  const audience = audienceForRole(actorRoleKey);
  if (audience === 'business') {
    const denied = enforceCommunicationPermission<ThreadListItem[]>(
      actorRoleKey,
      'communication.view_center',
    );
    if (denied) return denied;
  } else if (!canViewPortalThreads(actorRoleKey, audience)) {
    return { ok: false, error: 'Keine Berechtigung für Portal-Nachrichten.' };
  }

  return runService<ThreadListItem[]>(async () => {
    const tenantErr = assertTenant(tenantId);
    if (tenantErr) return tenantErr;

    if (getServiceMode() === 'supabase') {
      const { threadsSupabaseRepository, attachmentsSupabaseRepository } = getCommRepos();
      const result = await threadsSupabaseRepository.list(tenantId);
      if (!result.ok) return result;
      let threads = result.data;
      threads = threads.filter((t) => canViewThreadType(actorRoleKey, t, audience));
      threads = threads.filter((t) => filterThreadForPortal(t, profileId, audience));
      if (!options.includeArchived) {
        threads = applyThreadFilter(threads, options.filter ?? 'all');
      } else {
        threads = applyThreadFilter(threads, 'archived');
      }
      const search = options.search?.trim().toLowerCase();
      if (search) {
        threads = threads.filter(
          (t) =>
            t.title.toLowerCase().includes(search) ||
            (t.previewText?.toLowerCase().includes(search) ?? false) ||
            (t.subject?.toLowerCase().includes(search) ?? false),
        );
      }
      const attachmentResult = await Promise.all(
        threads.map(async (t) => {
          const att = await attachmentsSupabaseRepository.listByThread(tenantId, t.id);
          return { thread: t, hasAttachments: att.ok && att.data.length > 0 };
        }),
      );
      return {
        ok: true,
        data: attachmentResult
          .map(({ thread, hasAttachments }) => ({
            ...toThreadListItem(thread),
            hasAttachments,
          }))
          .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')),
      };
    }

    await new Promise((r) => setTimeout(r, 120));

    let threads = getDemoThreads().filter((t) => !t.deletedAt);
    threads = threads.filter((t) => canViewThreadType(actorRoleKey, t, audience));
    threads = threads.filter((t) => filterThreadForPortal(t, profileId, audience));

    if (!options.includeArchived) {
      threads = applyThreadFilter(threads, options.filter ?? 'all');
    } else {
      threads = applyThreadFilter(threads, 'archived');
    }

    const search = options.search?.trim().toLowerCase();
    if (search) {
      threads = threads.filter(
        (t) =>
          t.title.toLowerCase().includes(search) ||
          (t.previewText?.toLowerCase().includes(search) ?? false) ||
          (t.subject?.toLowerCase().includes(search) ?? false),
      );
    }

    return {
      ok: true,
      data: threads
        .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
        .map(toThreadListItem),
    };
  });
}

export async function getThread(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
): Promise<ServiceResult<CommunicationThread>> {
  const audience = audienceForRole(actorRoleKey);
  if (audience === 'business') {
    const denied = enforceCommunicationPermission<CommunicationThread>(
      actorRoleKey,
      'communication.view_center',
    );
    if (denied) return denied;
  }

  return runService<CommunicationThread>(async () => {
    const tenantErr = assertTenant(tenantId);
    if (tenantErr) return tenantErr;

    if (getServiceMode() === 'supabase') {
      const { threadsSupabaseRepository } = getCommRepos();
      const result = await threadsSupabaseRepository.getById(tenantId, threadId);
      if (!result.ok) return result;
      const thread = result.data;
      if (!thread || thread.deletedAt) {
        return { ok: false, error: 'Thread nicht gefunden.' };
      }
      if (!canViewThreadType(actorRoleKey, thread, audience)) {
        return { ok: false, error: 'Keine Berechtigung für diesen Thread.' };
      }
      if (!filterThreadForPortal(thread, profileId, audience)) {
        return { ok: false, error: 'Thread nicht verfügbar.' };
      }
      return { ok: true, data: thread };
    }

    const thread = getDemoThreads().find((t) => t.id === threadId);
    if (!thread || thread.deletedAt) {
      return { ok: false, error: 'Thread nicht gefunden.' };
    }
    if (!canViewThreadType(actorRoleKey, thread, audience)) {
      return { ok: false, error: 'Keine Berechtigung für diesen Thread.' };
    }
    if (!filterThreadForPortal(thread, profileId, audience)) {
      return { ok: false, error: 'Thread nicht verfügbar.' };
    }
    return { ok: true, data: thread };
  });
}

export async function listMessages(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
): Promise<ServiceResult<CommunicationMessage[]>> {
  const threadResult = await getThread(tenantId, threadId, actorRoleKey, profileId);
  if (!threadResult.ok) return threadResult;

  return runService(async () => {
    const audience = audienceForRole(actorRoleKey);
    const canViewDeleted = hasCommunicationPermission(
      actorRoleKey,
      'communication.view_deleted_messages',
    );

    if (getServiceMode() === 'supabase') {
      const { messagesSupabaseRepository } = getCommRepos();
      const result = await messagesSupabaseRepository.listByThread(tenantId, threadId);
      if (!result.ok) return result;
      const items = result.data.sort((a, b) =>
        (a.sentAt ?? a.createdAt).localeCompare(b.sentAt ?? b.createdAt),
      );
      return {
        ok: true,
        data: filterMessagesForAudience(items, audience, canViewDeleted),
      };
    }

    const items = getDemoMessages()
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => (a.sentAt ?? a.createdAt).localeCompare(b.sentAt ?? b.createdAt));

    return {
      ok: true,
      data: filterMessagesForAudience(items, audience, canViewDeleted),
    };
  });
}

export async function sendMessage(
  tenantId: string,
  input: SendMessageInput,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
  displayName = 'Nutzer:in',
): Promise<ServiceResult<CommunicationMessage>> {
  const audience = audienceForRole(actorRoleKey);
  const permission = input.isInternalNote
    ? 'communication.send_internal_note'
    : 'communication.send_message';
  const denied = enforceCommunicationPermission<CommunicationMessage>(actorRoleKey, permission);
  if (denied && audience === 'business') return denied;

  const threadResult = await getThread(tenantId, input.threadId, actorRoleKey, profileId);
  if (!threadResult.ok) return threadResult;

  return runService<CommunicationMessage>(async () => {
    const tenantErr = assertTenant(tenantId);
    if (tenantErr) return tenantErr;

    const body = input.bodyText.trim();
    if (!body && input.contentType !== 'voice') {
      return { ok: false, error: 'Nachricht darf nicht leer sein.' };
    }

    const now = new Date().toISOString();
    const messagePayload: Omit<CommunicationMessage, 'id' | 'createdAt' | 'updatedAt'> = {
      tenantId,
      threadId: input.threadId,
      senderType:
        audience === 'employee_portal'
          ? 'employee_portal'
          : audience === 'client_portal'
            ? 'client_portal'
            : audience === 'relative_portal'
              ? 'relative_portal'
              : 'business_user',
      senderUserId: profileId ?? null,
      senderPortalSessionId: null,
      senderDisplayName: displayName,
      contentType: input.isInternalNote ? 'internal_note' : (input.contentType ?? 'text'),
      bodyText: body,
      hasAttachments: false,
      hasVoice: input.contentType === 'voice',
      emojiReactionsCount: 0,
      status: 'sent',
      isInternalNote: !!input.isInternalNote,
      isVisibleToBusiness: true,
      isVisibleToEmployee: !input.isInternalNote && threadResult.data.allowEmployeeReplies,
      isVisibleToClient: !input.isInternalNote && threadResult.data.allowClientReplies,
      isVisibleToRelative: !input.isInternalNote && threadResult.data.allowRelativeReplies,
      sentAt: now,
      deliveredAt: now,
      readAt: null,
      editedAt: null,
      editedBy: null,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      replyToMessageId: input.replyToMessageId ?? null,
    };

    if (getServiceMode() === 'supabase') {
      const { messagesSupabaseRepository, threadsSupabaseRepository } = getCommRepos();
      const created = await messagesSupabaseRepository.create(tenantId, messagePayload);
      if (!created.ok) return created;
      await threadsSupabaseRepository.update(tenantId, input.threadId, {
        last_message_id: created.data.id,
        last_message_at: now,
        last_message_by_display_name: displayName,
        preview_text: body.slice(0, 120),
        updated_at: now,
      });
      appendCommunicationAudit({
        tenantId,
        userId: profileId ?? null,
        action: 'message_sent',
        entityType: 'communication_message',
        entityId: created.data.id,
        threadId: input.threadId,
        messageId: created.data.id,
        result: 'success',
      });
      return { ok: true, data: created.data };
    }

    const message: CommunicationMessage = {
      id: `msg-${Date.now()}`,
      ...messagePayload,
      createdAt: now,
      updatedAt: now,
    };

    appendDemoMessage(message);
    threadResult.data.lastMessageId = message.id;
    threadResult.data.lastMessageAt = now;
    threadResult.data.lastMessageByDisplayName = displayName;
    threadResult.data.previewText = body.slice(0, 120);
    threadResult.data.updatedAt = now;

    appendCommunicationAudit({
      tenantId,
      userId: profileId ?? null,
      action: 'message_sent',
      entityType: 'communication_message',
      entityId: message.id,
      threadId: input.threadId,
      messageId: message.id,
      result: 'success',
    });

    return { ok: true, data: message };
  });
}

export async function createThread(
  tenantId: string,
  input: CreateThreadInput,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
): Promise<ServiceResult<CommunicationThread>> {
  const denied = enforceCommunicationPermission<CommunicationThread>(
    actorRoleKey,
    'communication.create_thread',
  );
  if (denied) return denied;

  return runService(async () => {
    const tenantErr = assertTenant(tenantId);
    if (tenantErr) return tenantErr;

    if (getServiceMode() === 'supabase') {
      const { threadsSupabaseRepository } = getCommRepos();
      const created = await threadsSupabaseRepository.create(tenantId, {
        title: input.title,
        threadType: input.threadType,
        priority: input.priority ?? 'normal',
        subject: input.subject ?? null,
        moduleKey: input.moduleKey ?? 'core',
        clientId: input.clientId ?? null,
        employeeId: input.employeeId ?? null,
        relativeContactId: input.relativeContactId ?? null,
        isInternalOnly: input.isInternalOnly ?? false,
        isPortalVisible: input.isPortalVisible ?? !input.isInternalOnly,
        allowClientReplies: input.threadType === 'client',
        allowEmployeeReplies: input.threadType === 'employee',
        allowRelativeReplies: input.threadType === 'relative',
        createdByUserId: profileId ?? null,
      });
      if (!created.ok) return created;
      appendCommunicationAudit({
        tenantId,
        userId: profileId ?? null,
        action: 'thread_created',
        entityType: 'communication_thread',
        entityId: created.data.id,
        threadId: created.data.id,
        result: 'success',
        metadata: { title: input.title },
      });
      return created;
    }

    const now = new Date().toISOString();
    const id = `thread-${Date.now()}`;
    const created: CommunicationThread = {
      id,
      tenantId,
      threadType: input.threadType,
      status: 'open',
      priority: input.priority ?? 'normal',
      subject: input.subject ?? null,
      title: input.title,
      previewText: null,
      moduleKey: input.moduleKey ?? 'core',
      clientId: input.clientId ?? null,
      employeeId: input.employeeId ?? null,
      relativeContactId: input.relativeContactId ?? null,
      assignmentId: null,
      documentId: null,
      invoiceId: null,
      consultationCaseId: null,
      courseId: null,
      supportTicketId: null,
      createdByUserId: profileId ?? null,
      createdByPortalSessionId: null,
      lastMessageId: null,
      lastMessageAt: null,
      lastMessageByDisplayName: null,
      unreadCountBusiness: 0,
      unreadCountEmployee: 0,
      unreadCountClient: 0,
      unreadCountRelative: 0,
      isInternalOnly: input.isInternalOnly ?? false,
      isPortalVisible: input.isPortalVisible ?? !input.isInternalOnly,
      allowClientReplies: input.threadType === 'client',
      allowEmployeeReplies: input.threadType === 'employee',
      allowRelativeReplies: input.threadType === 'relative',
      archivedAt: null,
      archivedBy: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    appendDemoThread(created);
    appendCommunicationAudit({
      tenantId,
      userId: profileId ?? null,
      action: 'thread_created',
      entityType: 'communication_thread',
      entityId: id,
      threadId: id,
      result: 'success',
      metadata: { title: input.title },
    });

    return { ok: true, data: created };
  });
}

export async function archiveThread(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
): Promise<ServiceResult<CommunicationThread>> {
  const denied = enforceCommunicationPermission<CommunicationThread>(
    actorRoleKey,
    'communication.archive_thread',
  );
  if (denied) return denied;

  const threadResult = await getThread(tenantId, threadId, actorRoleKey, profileId);
  if (!threadResult.ok) return threadResult;

  const now = new Date().toISOString();
  threadResult.data.status = 'archived';
  threadResult.data.archivedAt = now;
  threadResult.data.archivedBy = profileId ?? null;
  threadResult.data.updatedAt = now;

  appendCommunicationAudit({
    tenantId,
    userId: profileId ?? null,
    action: 'thread_archived',
    entityType: 'communication_thread',
    entityId: threadId,
    threadId,
    result: 'success',
  });

  return { ok: true, data: threadResult.data };
}

export async function restoreThread(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
): Promise<ServiceResult<CommunicationThread>> {
  const denied = enforceCommunicationPermission<CommunicationThread>(
    actorRoleKey,
    'communication.restore_thread',
  );
  if (denied) return denied;

  const threadResult = await getThread(tenantId, threadId, actorRoleKey, profileId);
  if (!threadResult.ok) return threadResult;

  threadResult.data.status = 'open';
  threadResult.data.archivedAt = null;
  threadResult.data.archivedBy = null;
  threadResult.data.updatedAt = new Date().toISOString();

  appendCommunicationAudit({
    tenantId,
    userId: profileId ?? null,
    action: 'thread_restored',
    entityType: 'communication_thread',
    entityId: threadId,
    threadId,
    result: 'success',
  });

  return { ok: true, data: threadResult.data };
}

export async function softDeleteThread(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
  reason?: string,
): Promise<ServiceResult<CommunicationThread>> {
  const denied = enforceCommunicationPermission<CommunicationThread>(
    actorRoleKey,
    'communication.delete_any_message',
  );
  if (denied) return denied;

  const threadResult = await getThread(tenantId, threadId, actorRoleKey, profileId);
  if (!threadResult.ok) return threadResult;

  const now = new Date().toISOString();
  threadResult.data.status = 'deleted';
  threadResult.data.deletedAt = now;
  threadResult.data.deletedBy = profileId ?? null;
  threadResult.data.updatedAt = now;

  appendCommunicationAudit({
    tenantId,
    userId: profileId ?? null,
    action: 'message_deleted',
    entityType: 'communication_thread',
    entityId: threadId,
    threadId,
    result: 'success',
    metadata: { reason },
  });

  return { ok: true, data: threadResult.data };
}

export async function softDeleteMessage(
  tenantId: string,
  messageId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
  reason?: string,
): Promise<ServiceResult<CommunicationMessage>> {
  const denied = enforceCommunicationPermission<CommunicationMessage>(
    actorRoleKey,
    'communication.delete_any_message',
  );
  if (denied) return denied;

  const message = getDemoMessages().find((m) => m.id === messageId);
  if (!message) return { ok: false, error: 'Nachricht nicht gefunden.' };

  const now = new Date().toISOString();
  message.status = 'deleted';
  message.deletedAt = now;
  message.deletedBy = profileId ?? null;
  message.deleteReason = reason ?? null;
  message.bodyText = null;
  message.updatedAt = now;

  appendCommunicationAudit({
    tenantId,
    userId: profileId ?? null,
    action: 'message_deleted',
    entityType: 'communication_message',
    entityId: messageId,
    threadId: message.threadId,
    messageId,
    result: 'success',
    metadata: { reason },
  });

  return { ok: true, data: message };
}

export async function markThreadRead(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string,
): Promise<ServiceResult<{ read: true }>> {
  const threadResult = await getThread(tenantId, threadId, actorRoleKey, profileId);
  if (!threadResult.ok) return threadResult;

  threadResult.data.unreadCountBusiness = 0;
  threadResult.data.updatedAt = new Date().toISOString();

  appendCommunicationAudit({
    tenantId,
    userId: profileId ?? null,
    action: 'message_read',
    entityType: 'communication_thread',
    entityId: threadId,
    threadId,
    result: 'success',
  });

  return { ok: true, data: { read: true } };
}

export async function getCommunicationKpis(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CommunicationCenterKpis>> {
  const denied = enforceCommunicationPermission<CommunicationCenterKpis>(
    actorRoleKey,
    'communication.view_center',
  );
  if (denied) return denied;

  return runService<CommunicationCenterKpis>(async () => {
    const tenantErr = assertTenant(tenantId);
    if (tenantErr) return tenantErr;

    if (getServiceMode() === 'supabase') {
      const { threadsSupabaseRepository } = getCommRepos();
      const threadsResult = await threadsSupabaseRepository.list(tenantId);
      if (!threadsResult.ok) return threadsResult;
      const threads = threadsResult.data;
      return {
        ok: true,
        data: {
          unread: threads.reduce((sum, t) => sum + t.unreadCountBusiness, 0),
          openQuestions: threads.filter((t) => t.status === 'waiting_for_business').length,
          unassigned: 0,
          archived: threads.filter((t) => t.archivedAt).length,
          withAttachments: 0,
          failedDeliveries: 0,
        },
      };
    }

    const threads = getDemoThreads();
    const messages = getDemoMessages();
    const assignments = getDemoAssignments();

    return {
      ok: true,
      data: {
        unread: threads.reduce((sum, t) => sum + t.unreadCountBusiness, 0),
        openQuestions: threads.filter((t) => t.status === 'waiting_for_business').length,
        unassigned: assignments.filter((a) => a.status === 'open').length,
        archived: threads.filter((t) => t.archivedAt).length,
        withAttachments: getDemoAttachments().length,
        failedDeliveries: messages.filter((m) => m.status === 'failed').length,
      },
    };
  });
}

export async function getCommunicationSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CommunicationSettings>> {
  const denied = enforceCommunicationPermission<CommunicationSettings>(
    actorRoleKey,
    'communication.manage_settings',
  );
  if (denied) return denied;

  const tenantErr = assertTenant(tenantId);
  if (tenantErr) return tenantErr;

  if (getServiceMode() === 'supabase') {
    const { settingsSupabaseRepository } = getCommRepos();
    const result = await settingsSupabaseRepository.get(tenantId);
    if (!result.ok) return result;
    if (result.data) return { ok: true, data: result.data };
    return { ok: true, data: getDemoCommunicationSettings() };
  }

  return { ok: true, data: getDemoCommunicationSettings() };
}

export async function updateCommunicationSettings(
  tenantId: string,
  patch: Partial<CommunicationSettings>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CommunicationSettings>> {
  const denied = enforceCommunicationPermission<CommunicationSettings>(
    actorRoleKey,
    'communication.manage_settings',
  );
  if (denied) return denied;

  const tenantErr = assertTenant(tenantId);
  if (tenantErr) return tenantErr;

  const settings = getDemoCommunicationSettings();
  Object.assign(settings, patch, { updatedAt: new Date().toISOString() });
  return { ok: true, data: settings };
}
