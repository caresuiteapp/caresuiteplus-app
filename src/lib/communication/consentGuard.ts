import type {
  CommunicationChannel,
  CommunicationConsentGuardCode,
  CommunicationConsentGuardResult,
  CommunicationConsentRecord,
  CommunicationProviderConfig,
  CommunicationUseCase,
  DevicePushTokenRecord,
  PrepareOutboundMessageInput,
} from '@/types/communication/channels';
import { INSECURE_HEALTH_DATA_CHANNELS } from '@/types/communication/channels';

function deny(
  code: CommunicationConsentGuardCode,
  message: string,
): CommunicationConsentGuardResult {
  return { allowed: false, code, message };
}

export function assertCommunicationSendAllowed(
  input: Pick<
    PrepareOutboundMessageInput,
    | 'channel'
    | 'useCase'
    | 'containsHealthData'
    | 'providerConfig'
    | 'consent'
    | 'pushToken'
    | 'directChatBlocked'
  >,
): CommunicationConsentGuardResult {
  if (input.useCase === 'blocked_direct_chat' || input.directChatBlocked) {
    return deny(
      'direct_chat_blocked',
      'Direkter Mitarbeiter-Klienten-Chat ist organisatorisch gesperrt.',
    );
  }

  if (!input.providerConfig) {
    return deny('missing_provider', 'Kein Kommunikations-Provider konfiguriert — Versand blockiert.');
  }

  if (input.providerConfig.status === 'disabled' || input.providerConfig.status === 'error') {
    return deny('missing_provider', 'Provider ist deaktiviert — Versand blockiert.');
  }

  if (input.channel === 'whatsapp_business' && !input.providerConfig.whatsappApproved) {
    return deny(
      'whatsapp_not_approved',
      'WhatsApp Business erfordert explizite Freigabe — Versand blockiert.',
    );
  }

  if (!input.consent) {
    return deny('missing_consent', 'Keine Einwilligung hinterlegt — Versand blockiert.');
  }

  const consentCheck = assertConsentRecordValid(input.consent, input.channel, input.containsHealthData);
  if (!consentCheck.allowed) {
    return consentCheck;
  }

  if (input.channel === 'push') {
    const pushCheck = assertPushDeliveryAllowed(input.pushToken, input.consent);
    if (!pushCheck.allowed) {
      return pushCheck;
    }
  }

  return { allowed: true };
}

export function assertConsentRecordValid(
  consent: CommunicationConsentRecord,
  channel: CommunicationChannel,
  containsHealthData?: boolean,
): CommunicationConsentGuardResult {
  if (consent.revokedAt) {
    return deny('missing_consent', 'Einwilligung wurde widerrufen.');
  }

  if (!consent.proofReference?.trim() || !consent.proofRecordedAt) {
    return deny('missing_proof', 'Einwilligungsnachweis fehlt — Versand blockiert.');
  }

  if (!consent.channelAllowed || consent.channel !== channel) {
    return deny('channel_not_allowed', 'Kanal ist für den Empfänger nicht erlaubt.');
  }

  if (!consent.purposeAllowed) {
    return deny('purpose_not_allowed', 'Zweck ist für den Empfänger nicht erlaubt.');
  }

  if (!consent.recipientAllowed) {
    return deny('recipient_not_allowed', 'Empfänger ist für diesen Kanal nicht freigegeben.');
  }

  if (containsHealthData) {
    if (!consent.healthDataAllowed) {
      return deny('health_data_denied', 'Gesundheitsdaten ohne Einwilligung blockiert.');
    }
    if (INSECURE_HEALTH_DATA_CHANNELS.has(channel)) {
      return deny(
        'health_data_insecure_channel',
        'Gesundheitsdaten auf unsicherem Kanal blockiert.',
      );
    }
  }

  return { allowed: true };
}

export function assertPushDeliveryAllowed(
  pushToken: DevicePushTokenRecord | null | undefined,
  consent: CommunicationConsentRecord,
): CommunicationConsentGuardResult {
  if (!pushToken?.tokenHash?.trim()) {
    return deny('push_no_token', 'Kein Push-Gerätetoken — Versand blockiert.');
  }
  if (pushToken.revokedAt) {
    return deny('push_no_token', 'Push-Gerätetoken widerrufen — Versand blockiert.');
  }
  if (!pushToken.consentRecordedAt) {
    return deny('push_no_consent', 'Geräte-Consent für Push fehlt — Versand blockiert.');
  }
  if (!consent.channelAllowed) {
    return deny('push_no_consent', 'Push-Einwilligung fehlt — Versand blockiert.');
  }
  return { allowed: true };
}

/** Live-Versand bleibt global blockiert (Prepare-Only). */
export function isCommunicationSendLiveReady(): boolean {
  return false;
}

export function assertSendNotBlockedByLiveGate(): CommunicationConsentGuardResult {
  if (!isCommunicationSendLiveReady()) {
    return deny(
      'send_not_live',
      'Versand ist vorbereitet, aber noch nicht freigegeben — keine Nachricht gesendet.',
    );
  }
  return { allowed: true };
}

export function isChannelProviderRequired(channel: CommunicationChannel): boolean {
  return channel !== 'phone_log';
}

export function resolveProviderChannelForUseCase(
  useCase: CommunicationUseCase,
): CommunicationChannel | null {
  if (useCase === 'employee_push') return 'push';
  if (useCase === 'blocked_direct_chat') return null;
  return null;
}
