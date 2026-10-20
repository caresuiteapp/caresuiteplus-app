/** Outbound-Kommunikationskanäle (≠ Chat Communication Center). */
export type CommunicationChannel =
  | 'transactional_email'
  | 'sms'
  | 'whatsapp_business'
  | 'push'
  | 'phone_log'
  | 'video_call_link';

export type CommunicationProviderKey =
  | 'sendgrid'
  | 'mailjet'
  | 'brevo'
  | 'twilio'
  | 'messagebird'
  | 'firebase_fcm'
  | 'apple_apns'
  | 'sip_generic';

export type CommunicationUseCase =
  | 'appointment_reminder'
  | 'assignment_change'
  | 'invoice_send'
  | 'dunning'
  | 'service_proof'
  | 'client_intake_link'
  | 'employee_push'
  | 'relative_info'
  | 'support_message'
  | 'blocked_direct_chat';

export type CommunicationRecipientType =
  | 'client'
  | 'employee'
  | 'relative'
  | 'contact'
  | 'tenant_user';

export type OutboundMessageStatus =
  | 'prepared'
  | 'blocked'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type CommunicationConsentGuardCode =
  | 'missing_provider'
  | 'missing_consent'
  | 'channel_not_allowed'
  | 'purpose_not_allowed'
  | 'recipient_not_allowed'
  | 'health_data_denied'
  | 'health_data_insecure_channel'
  | 'whatsapp_not_approved'
  | 'push_no_token'
  | 'push_no_consent'
  | 'direct_chat_blocked'
  | 'send_not_live'
  | 'missing_proof';

export type CommunicationConsentGuardResult =
  | { allowed: true }
  | { allowed: false; code: CommunicationConsentGuardCode; message: string };

export type CommunicationProviderConfig = {
  id: string;
  tenantId: string;
  providerKey: CommunicationProviderKey;
  channel: CommunicationChannel;
  displayName: string;
  status: 'prepared' | 'configured' | 'sandbox' | 'production' | 'disabled' | 'error';
  credentialReference: string | null;
  sandboxMode: boolean;
  whatsappApproved: boolean;
};

export type CommunicationConsentRecord = {
  tenantId: string;
  recipientType: CommunicationRecipientType;
  recipientId: string;
  channel: CommunicationChannel;
  purpose: string;
  channelAllowed: boolean;
  purposeAllowed: boolean;
  recipientAllowed: boolean;
  healthDataAllowed: boolean;
  revokedAt: string | null;
  proofReference: string | null;
  proofRecordedAt: string | null;
};

export type CommunicationChannelTemplate = {
  id: string;
  tenantId: string;
  templateKey: string;
  name: string;
  channel: CommunicationChannel;
  useCase: CommunicationUseCase;
  subjectTemplate: string | null;
  bodyTemplate: string;
  allowsHealthData: boolean;
  status: 'prepared' | 'active' | 'archived' | 'disabled';
};

export type DevicePushTokenRecord = {
  tenantId: string;
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  tokenHash: string;
  consentRecordedAt: string | null;
  revokedAt: string | null;
};

export type PrepareOutboundMessageInput = {
  tenantId: string;
  actorUserId: string;
  channel: CommunicationChannel;
  useCase: CommunicationUseCase;
  recipientType: CommunicationRecipientType;
  recipientId: string;
  recipientAddress: string;
  subject?: string;
  bodyPreview: string;
  containsHealthData?: boolean;
  purpose: string;
  providerConfig?: CommunicationProviderConfig | null;
  consent?: CommunicationConsentRecord | null;
  pushToken?: DevicePushTokenRecord | null;
  directChatBlocked?: boolean;
};

export type PreparedOutboundMessage = {
  id: string;
  status: OutboundMessageStatus;
  blockedReason: string | null;
  channel: CommunicationChannel;
  useCase: CommunicationUseCase;
  preparedOnly: true;
};

export type CommunicationProviderAuditEntry = {
  id: string;
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  channel: CommunicationChannel | null;
  providerKey: CommunicationProviderKey | null;
  useCase: CommunicationUseCase | null;
  summary: string;
  blocked: boolean;
  demo: boolean;
  createdAt: string;
};

export const COMMUNICATION_CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  transactional_email: 'E-Mail (transaktional)',
  sms: 'SMS',
  whatsapp_business: 'WhatsApp Business',
  push: 'Push-Benachrichtigung',
  phone_log: 'Telefonie-Protokoll',
  video_call_link: 'Video-Anruf-Link',
};

export const COMMUNICATION_USE_CASE_LABELS: Record<CommunicationUseCase, string> = {
  appointment_reminder: 'Terminerinnerung',
  assignment_change: 'Einsatzänderung',
  invoice_send: 'Rechnung versenden',
  dunning: 'Mahnung versenden',
  service_proof: 'Leistungsnachweis versenden',
  client_intake_link: 'Kundenaufnahme-Link',
  employee_push: 'Mitarbeiter-Push',
  relative_info: 'Angehörigeninformation',
  support_message: 'Support-Nachricht',
  blocked_direct_chat: 'Direktchat gesperrt',
};

export const COMMUNICATION_PROVIDER_LABELS: Record<CommunicationProviderKey, string> = {
  sendgrid: 'SendGrid',
  mailjet: 'Mailjet',
  brevo: 'Brevo',
  twilio: 'Twilio',
  messagebird: 'MessageBird',
  firebase_fcm: 'Firebase Cloud Messaging',
  apple_apns: 'Apple Push Notification Service',
  sip_generic: 'SIP / Cloud-Telefonie',
};

/** Kanäle, die keine Gesundheitsdaten tragen dürfen. */
export const INSECURE_HEALTH_DATA_CHANNELS: ReadonlySet<CommunicationChannel> = new Set([
  'sms',
  'whatsapp_business',
  'push',
  'phone_log',
  'video_call_link',
]);
