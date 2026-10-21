/** Call only with a user returned by auth.getUser(), never decoded unverified claims. */
export function isAcademyOnlyPortal(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.app_metadata?.portal_type === 'academy_family';
}
