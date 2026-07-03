/** CareSuiteOfflineDB schema version — bump when store layout changes. */
export const OFFLINE_DB_NAME = 'CareSuiteOfflineDB';
export const OFFLINE_DB_VERSION = 1;

export const OFFLINE_STORE_NAMES = [
  'sync_meta',
  'assignments',
  'visit_execution',
  'outbox',
  'doc_drafts',
  'signature_drafts',
  'gps_buffer',
  'wfm_pending',
] as const;

export type OfflineStoreName = (typeof OFFLINE_STORE_NAMES)[number];

export type OfflineDbHealthStatus = 'available' | 'unavailable' | 'degraded';

export type OfflineDbHealth = {
  status: OfflineDbHealthStatus;
  schemaVersion: number;
  storeCount: number;
  error: string | null;
};

export type SyncMetaRecord = {
  /** Primary key — typically `default` or tenant-scoped key in later phases. */
  key: string;
  lastSyncAt: string | null;
  deviceId: string | null;
  schemaVersion: number;
  tenantId: string | null;
  updatedAt: string;
};

/** Generic envelope for future store payloads (OFFLINE.2+). */
export type OfflineRecordEnvelope<T = Record<string, unknown>> = {
  id: string;
  tenantId: string;
  payload: T;
  updatedAt: string;
};
