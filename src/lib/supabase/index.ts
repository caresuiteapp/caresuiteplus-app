export { getSupabaseClient, resetSupabaseClient } from './client';
export {
  isDemoMode,
  isSupabaseConfigured,
  getSupabaseConfig,
  resolveAuthMode,
} from './config';
export type { AuthMode } from './config';
export { toGermanSupabaseError, isSupabaseMissingTableError, isMissingTableServiceError } from './errors';
export {
  DEMO_DATA_BANNER,
  PREVIEW_DATA_BANNER_MESSAGE,
  handleMissingTableQuery,
  isMissingTableError,
  resolveMissingTableList,
} from './missingtablefallback';
export type { PreviewAwareResult } from './missingtablefallback';
export {
  signInWithPassword,
  signOut,
  getSession,
  onAuthStateChange,
  toGermanAuthError,
} from './authService';
export type {
  AuthServiceResult,
  AuthStateChangeCallback,
  AuthStateChangeHandle,
} from './authService';
export { fetchTenantProfile, bootstrapTenantContext } from './tenantService';
export { mapClientDetail, mapClientListItem } from './mappers';
export type { Database } from './types';
export type {
  ClientRow,
  ClientDetailRow,
  EmployeeRow,
  ProfileRow,
  WorkflowStatusDb,
} from './rowTypes';
