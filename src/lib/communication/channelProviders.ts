import type {
  CommunicationChannel,
  CommunicationProviderConfig,
  CommunicationProviderKey,
} from '@/types/communication/channels';

export type ProviderChannelMapping = {
  providerKey: CommunicationProviderKey;
  channel: CommunicationChannel;
  defaultDisplayName: string;
};

/** Vorbereitete Provider — keine Live-Credentials, keine API-Aufrufe. */
export const PREPARED_COMMUNICATION_PROVIDERS: ProviderChannelMapping[] = [
  { providerKey: 'sendgrid', channel: 'transactional_email', defaultDisplayName: 'SendGrid' },
  { providerKey: 'mailjet', channel: 'transactional_email', defaultDisplayName: 'Mailjet' },
  { providerKey: 'brevo', channel: 'transactional_email', defaultDisplayName: 'Brevo' },
  { providerKey: 'twilio', channel: 'sms', defaultDisplayName: 'Twilio SMS' },
  { providerKey: 'messagebird', channel: 'sms', defaultDisplayName: 'MessageBird SMS' },
  { providerKey: 'twilio', channel: 'whatsapp_business', defaultDisplayName: 'Twilio WhatsApp' },
  { providerKey: 'messagebird', channel: 'whatsapp_business', defaultDisplayName: 'MessageBird WhatsApp' },
  { providerKey: 'firebase_fcm', channel: 'push', defaultDisplayName: 'Firebase FCM' },
  { providerKey: 'apple_apns', channel: 'push', defaultDisplayName: 'Apple APNS' },
  { providerKey: 'sip_generic', channel: 'phone_log', defaultDisplayName: 'SIP / Cloud-Telefonie' },
  { providerKey: 'sip_generic', channel: 'video_call_link', defaultDisplayName: 'SIP Video-Link' },
];

export function listPreparedCommunicationProviderKeys(): CommunicationProviderKey[] {
  return [...new Set(PREPARED_COMMUNICATION_PROVIDERS.map((p) => p.providerKey))];
}

export function getProvidersForChannel(channel: CommunicationChannel): ProviderChannelMapping[] {
  return PREPARED_COMMUNICATION_PROVIDERS.filter((p) => p.channel === channel);
}

export function createPlaceholderProviderConfig(
  tenantId: string,
  mapping: ProviderChannelMapping,
): CommunicationProviderConfig {
  return {
    id: `comm-provider-${mapping.providerKey}-${mapping.channel}`,
    tenantId,
    providerKey: mapping.providerKey,
    channel: mapping.channel,
    displayName: mapping.defaultDisplayName,
    status: 'prepared',
    credentialReference: null,
    sandboxMode: true,
    whatsappApproved: false,
  };
}

export function getPlaceholderProviderConfigs(tenantId: string): CommunicationProviderConfig[] {
  return PREPARED_COMMUNICATION_PROVIDERS.map((mapping) =>
    createPlaceholderProviderConfig(tenantId, mapping),
  );
}

export function maskProviderCredentialReference(
  reference: string | null | undefined,
): string {
  if (!reference?.trim()) return 'Nicht konfiguriert';
  if (reference.length <= 4) return '••••';
  return `••••${reference.slice(-4)}`;
}

/** Entfernt Secrets für Nicht-Admin-Ansichten. */
export function sanitizeProviderConfigForRole(
  config: CommunicationProviderConfig,
  isAdmin: boolean,
): Omit<CommunicationProviderConfig, 'credentialReference'> & {
  credentialReference: string | null;
} {
  if (isAdmin) {
    return {
      ...config,
      credentialReference: maskProviderCredentialReference(config.credentialReference),
    };
  }
  return {
    ...config,
    credentialReference: null,
  };
}
