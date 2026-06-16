export { AuthProvider } from './AuthProvider';
export { useAuth, AuthContext, type AuthContextValue, type AuthMode } from './context';
export { RequireAuth } from './RequireAuth';
export { RequireRole } from './RequireRole';
export { RedirectIfAuthenticated } from './RedirectIfAuthenticated';
export { RequireDevOrAdmin } from './RequireDevOrAdmin';
export { canAccessDeveloperTools } from './devAccess';
export { buildDemoSession, getDemoLoginLabel } from './demoSession';

export type {
  AccessCredentialsReveal,
  AuthLoginType,
  BusinessRegistrationInput,
  ClientPortalCode,
  EmployeePortalAccount,
  InternalRoleKey,
  LoginAuditEvent,
  PortalAccessPermissions,
  PortalAccessType,
  PortalCodeStatus,
  RelativePortalCode,
  TenantUser,
  UserAccessStatus,
  UserModulePermission,
} from './auth.types';
export { PORTAL_CODE_CHARSET, PORTAL_CODE_LENGTH, USERNAME_MAX_LENGTH } from './auth.types';

export {
  resolveBlockedAccessMessage,
  resolveFirstLoginRoute,
  resolveInvalidPortalCodeMessage,
  resolveLoginRoute,
  resolveMissingPermissionMessage,
  resolvePostLoginRoute,
  isBusinessLoginIdentifier,
} from './loginRouter';

export { registerBusinessTenant, loginBusinessUser, generateInternalUserAccess } from './businessAuthService';
export {
  generateEmployeeAccess,
  loginEmployeePortal,
  completeFirstLogin,
  resetEmployeePassword,
  blockEmployeeAccess,
  unblockEmployeeAccess,
} from './employeePortalAuthService';
export {
  generateClientPortalCode,
  validatePortalCodeLogin,
  regeneratePortalCode,
  blockPortalCode,
  unblockPortalCode,
} from './clientPortalAuthService';
export {
  generateRelativePortalCode,
  loginRelativePortal,
} from './relativePortalAuthService';

export {
  generateUsername,
  buildUsernameSegments,
  resolveUsernameCollision,
  pickUniqueUsername,
  sanitizeUsername,
  validateUsername,
} from './usernameGenerator';

export {
  generateTemporaryPassword,
  createTemporaryPasswordRecord,
  verifyTemporaryPassword,
  validatePermanentPassword,
  DEFAULT_TEMP_PASSWORD_POLICY,
} from './temporaryPassword';
export type { TemporaryPasswordPolicy, TemporaryPasswordRecord } from './temporaryPassword';

export {
  generatePortalCode,
  normalizePortalCodeInput,
  validatePortalCodeFormat,
  hashPortalCode,
  verifyPortalCode,
  pickUniquePortalCode,
  maskPortalCodeHint,
} from './portalCodeGenerator';

export {
  listInternalUsers,
  listEmployeePortalAccounts,
  listClientPortalCodes,
  listAccessAuditEvents,
  createInternalUser,
  createEmployeePortalAccount,
  createClientPortalAccess,
  resetEmployeePortalPassword,
  setUserModulePermissions,
  getUserModulePermissions,
  getAccessDashboardStats,
} from './accessManagementService';

export {
  getDefaultModulePermissionsForRole,
  roleHasPermission,
  billingCanViewInvoices,
  pdlCanViewCareDocumentation,
  employeeCanViewOnlyOwnAssignments,
} from './permissionService';
export type { AccessDashboardStats } from './permissionService';

export { recordLoginAuditEvent, listLoginAuditEvents } from './loginAuditService';

export { resetDemoAccessStore } from './demoAccessStore';
