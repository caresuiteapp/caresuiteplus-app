export function normalizePortalUsername(value: string): string {
  return value.trim().toLowerCase();
}

export type EmployeePortalLoginFailureClass =
  | 'missing_credentials'
  | 'account_not_found'
  | 'invalid_password'
  | 'password_expired'
  | 'password_missing'
  | 'account_blocked'
  | 'account_archived'
  | 'duplicate_accounts'
  | 'tenant_mismatch'
  | 'session_error'
  | 'unknown';

export function classifyEmployeePortalLoginFailure(input: {
  matches: number;
  blocked: boolean;
  archived: boolean;
  duplicateActive: boolean;
  passwordMissing: boolean;
  passwordExpired: boolean;
}): EmployeePortalLoginFailureClass {
  if (input.blocked) return 'account_blocked';
  if (input.archived) return 'account_archived';
  if (input.duplicateActive) return 'duplicate_accounts';
  if (input.matches === 0) return 'account_not_found';
  if (input.passwordMissing) return 'password_missing';
  if (input.passwordExpired) return 'password_expired';
  return 'invalid_password';
}
