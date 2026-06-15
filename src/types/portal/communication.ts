import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity } from './visibility';

export type MessageChannel = 'portal' | 'email' | 'sms' | 'push';

export type MessageDirection = 'inbound' | 'outbound';

export type MessageAudienceScope = 'portal' | 'office';

export type PortalMessage = TenantScopedEntity &
  PortalScopedEntity & {
    subject: string;
    body: string;
    channel: MessageChannel;
    direction: MessageDirection;
    senderName: string;
    recipientName: string;
    readAt: string | null;
    status: WorkflowStatus;
    audienceScope: MessageAudienceScope;
  };

export type NotificationType =
  | 'appointment_reminder'
  | 'document_shared'
  | 'message_received'
  | 'invoice_due'
  | 'system';

export type PortalNotification = TenantScopedEntity &
  PortalScopedEntity & {
    type: NotificationType;
    title: string;
    body: string;
    readAt: string | null;
    actionRoute: string | null;
    status: WorkflowStatus;
  };

export type MessageListItem = Pick<
  PortalMessage,
  | 'id'
  | 'subject'
  | 'body'
  | 'senderName'
  | 'recipientName'
  | 'direction'
  | 'readAt'
  | 'status'
  | 'updatedAt'
  | 'visibility'
  | 'sensitivity'
>;

export type MessageDetail = MessageListItem & {
  channel: MessageChannel;
  createdAt: string;
  canReply: boolean;
};
