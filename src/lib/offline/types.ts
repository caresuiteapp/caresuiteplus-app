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

/** OFFLINE.2 — portal list item with optional stale flag after online refresh. */
export type CachedPortalAppointmentItem =
  import('@/lib/portal/appointmentService').PortalAppointmentItem & {
    /** True when item was cached but missing from last successful online list. */
    cacheStale?: boolean;
  };

/** OFFLINE.2 — assignment list cache in `assignments` store. */
export type AssignmentListCacheRecord = {
  key: string;
  tenantId: string;
  employeeId: string;
  kind: 'list';
  items: CachedPortalAppointmentItem[];
  cachedAt: string;
};

/** OFFLINE.2 — portal appointment detail cache in `assignments` store. */
export type AssignmentPortalDetailCacheRecord = {
  key: string;
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  kind: 'portal_detail';
  payload: import('@/types/portal/employee').PortalAppointmentDetail;
  cachedAt: string;
};

/** OFFLINE.2 — execute-screen assignment detail cache in `assignments` store. */
export type AssignmentExecutionDetailCacheRecord = {
  key: string;
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  kind: 'execution_detail';
  payload: import('@/types/modules/employeePortalExecution').EmployeePortalAssignmentDetail;
  cachedAt: string;
};

export type AssignmentCacheMeta = {
  fromCache: boolean;
  cachedAt: string | null;
};

export type AssignmentCacheLoadOptions = {
  /** Skip network fetch and read IndexedDB only (e.g. MP offline). */
  preferCache?: boolean;
};
