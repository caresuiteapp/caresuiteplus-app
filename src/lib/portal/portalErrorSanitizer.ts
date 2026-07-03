const TECHNICAL_ERROR_MARKERS = ['employee_id', 'auth_user', 'tenant_id'] as const;

/** Detect backend/technical error tokens — never show raw values in portal UI. */
export function isTechnicalPortalErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return TECHNICAL_ERROR_MARKERS.some((marker) => lower.includes(marker));
}
