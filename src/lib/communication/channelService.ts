import type { ServiceResult } from '@/types';
import type {
  CommunicationChannel,
  CommunicationChannelTemplate,
  CommunicationUseCase,
  PrepareOutboundMessageInput,
  PreparedOutboundMessage,
} from '@/types/communication/channels';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { isDemoMode } from '@/lib/supabase/config';
import { runService } from '@/lib/services/serviceRunner';
import {
  assertCommunicationSendAllowed,
  assertSendNotBlockedByLiveGate,
  isCommunicationSendLiveReady,
} from './consentGuard';
import { recordCommunicationProviderAudit } from './channelAudit';
import {
  getPlaceholderProviderConfigs,
  sanitizeProviderConfigForRole,
} from './channelProviders';

const DEFAULT_TEMPLATES: Omit<CommunicationChannelTemplate, 'id' | 'tenantId'>[] = [
  {
    templateKey: 'appointment_reminder_email',
    name: 'Terminerinnerung (E-Mail)',
    channel: 'transactional_email',
    useCase: 'appointment_reminder',
    subjectTemplate: 'Terminerinnerung: {{appointment_date}}',
    bodyTemplate: 'Guten Tag {{recipient_name}}, Ihr Termin am {{appointment_date}} um {{appointment_time}}.',
    allowsHealthData: false,
    status: 'prepared',
  },
  {
    templateKey: 'assignment_change_sms',
    name: 'Einsatzänderung (SMS)',
    channel: 'sms',
    useCase: 'assignment_change',
    subjectTemplate: null,
    bodyTemplate: 'Einsatzänderung: {{assignment_date}} — Details im Portal.',
    allowsHealthData: false,
    status: 'prepared',
  },
  {
    templateKey: 'invoice_send_email',
    name: 'Rechnung versenden',
    channel: 'transactional_email',
    useCase: 'invoice_send',
    subjectTemplate: 'Ihre Rechnung {{invoice_number}}',
    bodyTemplate: 'Im Anhang finden Sie Ihre Rechnung {{invoice_number}}.',
    allowsHealthData: false,
    status: 'prepared',
  },
  {
    templateKey: 'dunning_email',
    name: 'Mahnung versenden',
    channel: 'transactional_email',
    useCase: 'dunning',
    subjectTemplate: 'Zahlungserinnerung {{invoice_number}}',
    bodyTemplate: 'Bitte begleichen Sie den offenen Betrag bis {{due_date}}.',
    allowsHealthData: false,
    status: 'prepared',
  },
  {
    templateKey: 'service_proof_email',
    name: 'Leistungsnachweis',
    channel: 'transactional_email',
    useCase: 'service_proof',
    subjectTemplate: 'Leistungsnachweis {{period}}',
    bodyTemplate: 'Anbei der Leistungsnachweis für {{period}}.',
    allowsHealthData: false,
    status: 'prepared',
  },
  {
    templateKey: 'client_intake_link_email',
    name: 'Kundenaufnahme-Link',
    channel: 'transactional_email',
    useCase: 'client_intake_link',
    subjectTemplate: 'Ihr Aufnahme-Link',
    bodyTemplate: 'Bitte nutzen Sie folgenden Link: {{intake_url}}',
    allowsHealthData: false,
    status: 'prepared',
  },
  {
    templateKey: 'employee_push',
    name: 'Mitarbeiter-Push',
    channel: 'push',
    useCase: 'employee_push',
    subjectTemplate: '{{title}}',
    bodyTemplate: '{{body}}',
    allowsHealthData: false,
    status: 'prepared',
  },
  {
    templateKey: 'relative_info_email',
    name: 'Angehörigeninformation',
    channel: 'transactional_email',
    useCase: 'relative_info',
    subjectTemplate: 'Information zu {{client_name}}',
    bodyTemplate: 'Allgemeine Information ohne Gesundheitsdaten: {{message}}',
    allowsHealthData: false,
    status: 'prepared',
  },
  {
    templateKey: 'support_message_email',
    name: 'Support-Nachricht',
    channel: 'transactional_email',
    useCase: 'support_message',
    subjectTemplate: 'Support: {{ticket_id}}',
    bodyTemplate: 'Ihre Anfrage {{ticket_id}}: {{message}}',
    allowsHealthData: false,
    status: 'prepared',
  },
];

export function isCommunicationChannelLiveReady(): boolean {
  return isCommunicationSendLiveReady();
}

/** Mandant für Template-Vorschau — kein Demo-Fallback im Production Mode. */
export function resolveCommunicationTemplateTenantId(tenantId: string): string | null {
  const trimmed = tenantId.trim();
  if (trimmed) return trimmed;
  if (isDemoMode()) return DEMO_TENANT_ID;
  return null;
}

export function getPreparedChannelTemplates(tenantId: string): CommunicationChannelTemplate[] {
  const resolved = resolveCommunicationTemplateTenantId(tenantId);
  if (!resolved) return [];
  return DEFAULT_TEMPLATES.map((template, index) => ({
    ...template,
    id: `comm-tpl-${template.templateKey}`,
    tenantId: resolved,
  }));
}

export function getPreparedTemplatesForUseCase(
  tenantId: string,
  useCase: CommunicationUseCase,
): CommunicationChannelTemplate[] {
  return getPreparedChannelTemplates(tenantId).filter((t) => t.useCase === useCase);
}

export function renderChannelTemplatePreview(
  template: CommunicationChannelTemplate,
  placeholders: Record<string, string> = {},
): { subject: string | null; body: string; preparedOnly: true } {
  const replace = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => placeholders[key] ?? `{{${key}}}`);

  return {
    subject: template.subjectTemplate ? replace(template.subjectTemplate) : null,
    body: replace(template.bodyTemplate),
    preparedOnly: true,
  };
}

export async function prepareOutboundMessage(
  input: PrepareOutboundMessageInput,
): Promise<ServiceResult<PreparedOutboundMessage>> {
  return runService<PreparedOutboundMessage>(async () => {
    const consentGuard = assertCommunicationSendAllowed(input);
    const liveGuard = assertSendNotBlockedByLiveGate();

    const blocked = !consentGuard.allowed ? consentGuard : !liveGuard.allowed ? liveGuard : null;

    const messageId = `comm-out-${Date.now()}`;

    recordCommunicationProviderAudit({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: 'prepare_outbound_message',
      entityType: 'communication_outbound_message',
      entityId: messageId,
      channel: input.channel,
      providerKey: input.providerConfig?.providerKey ?? null,
      useCase: input.useCase,
      summary: blocked
        ? blocked.message
        : `Nachricht vorbereitet (${input.channel}/${input.useCase}) — kein Versand.`,
      blocked: Boolean(blocked),
      demo: input.tenantId === DEMO_TENANT_ID,
    });

    if (blocked) {
      return {
        ok: true,
        data: {
          id: messageId,
          status: 'blocked' as const,
          blockedReason: blocked.message,
          channel: input.channel,
          useCase: input.useCase,
          preparedOnly: true as const,
        },
      };
    }

    return {
      ok: true,
      data: {
        id: messageId,
        status: 'prepared' as const,
        blockedReason: null,
        channel: input.channel,
        useCase: input.useCase,
        preparedOnly: true as const,
      },
    };
  });
}

/** Versand-Funktion — bleibt bewusst blockiert. */
export async function sendOutboundMessage(
  _messageId: string,
): Promise<ServiceResult<{ sent: false; blocked: true; reason: string }>> {
  return runService(async () => {
    const guard = assertSendNotBlockedByLiveGate();
    return {
      ok: true,
      data: {
        sent: false,
        blocked: true,
        reason: guard.allowed
          ? 'Versand nicht implementiert.'
          : guard.message,
      },
    };
  });
}

export function getCommunicationProviderConfigsForTenant(
  tenantId: string,
  isAdmin: boolean,
) {
  return getPlaceholderProviderConfigs(tenantId).map((config) =>
    sanitizeProviderConfigForRole(config, isAdmin),
  );
}

export function listSupportedChannels(): CommunicationChannel[] {
  return [
    'transactional_email',
    'sms',
    'whatsapp_business',
    'push',
    'phone_log',
    'video_call_link',
  ];
}

export const COMMUNICATION_PREPARED_NOTICE =
  'Kommunikationskanäle sind vorbereitet. Es werden keine Nachrichten an externe Provider übertragen.';
