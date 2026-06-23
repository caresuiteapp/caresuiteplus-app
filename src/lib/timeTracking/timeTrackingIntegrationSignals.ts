import type { RoleKey, ServiceResult } from '@/types';
import type { TenantTimeTrackingSettings } from '@/types/modules/timeTracking';
import { ensureTimeTrackingSettings } from './timeTrackingSettingsService';
import { recordTimeActivityEvent } from './timeTrackingActivityBridge';

export type IntegrationSignalSource = 'microsoft' | 'google' | 'phone';

export type IntegrationSignalStub = {
  source: IntegrationSignalSource;
  signalType: string;
  occurredAt: string;
  resourceId: string | null;
};

export function isIntegrationEnabled(
  settings: TenantTimeTrackingSettings,
  source: IntegrationSignalSource,
): boolean {
  if (source === 'microsoft') return settings.integrationMicrosoft;
  if (source === 'google') return settings.integrationGoogle;
  return settings.integrationPhoneMetadata;
}

/** Metadata-only integration stubs — no OAuth wiring in phase 1. */
export function recordIntegrationSignal(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  source: IntegrationSignalSource,
  signalType: string,
  resourceId?: string | null,
): ServiceResult<IntegrationSignalStub> {
  const settingsResult = ensureTimeTrackingSettings(tenantId, actorRoleKey);
  if (!settingsResult.ok) return settingsResult;

  if (!isIntegrationEnabled(settingsResult.data, source)) {
    return { ok: false, error: `Integration ${source} ist nicht aktiviert.` };
  }

  const stub: IntegrationSignalStub = {
    source,
    signalType,
    occurredAt: new Date().toISOString(),
    resourceId: resourceId ?? null,
  };

  recordTimeActivityEvent({
    tenantId,
    userId,
    eventType: 'integration_signal',
    moduleKey: `integration:${source}`,
    resourceId: resourceId ?? signalType,
    metadata: { source, signalType },
  });

  return { ok: true, data: stub };
}

export function countIntegrationSignals(
  tenantId: string,
  source?: IntegrationSignalSource,
): number {
  // Counted via activity events in audit views
  void tenantId;
  void source;
  return 0;
}

/** Offline/reconnect stub — preserves local session id for conflict detection. */
export function handleOfflineReconnect(
  tenantId: string,
  userId: string,
  sessionId: string,
): { reconnected: boolean; sessionId: string } {
  return { reconnected: true, sessionId };
}
