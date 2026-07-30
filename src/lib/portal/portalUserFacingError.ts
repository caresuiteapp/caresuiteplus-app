const TECHNICAL_ERROR_PATTERNS = [
  /datenbank/i,
  /supabase/i,
  /postgrest/i,
  /pgrst/i,
  /row-level security/i,
  /\brls\b/i,
  /schema/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /permission denied/i,
  /invalid input syntax/i,
  /network request failed/i,
  /failed to fetch/i,
];

/**
 * Prevents database and infrastructure details from reaching portal users.
 * The original error remains available to the calling service for logging.
 */
export function toPortalUserFacingError(
  error: string | null | undefined,
  fallback = 'Die Daten konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
): string {
  const message = error?.trim();
  if (!message) return fallback;
  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}
