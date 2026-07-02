/**
 * ASSIST.PERMISSIONS.2 — Gate: show central onboarding only when bundle incomplete in Supabase.
 * Internal location consent (DB) and browser permission are separate — browser denied must not re-open onboarding.
 */
import { getEmployeeConsentBundle } from './getEmployeeConsentBundle';

/** True when employee has not completed central permission onboarding for the current bundle version. */
export async function needsPermissionOnboarding(
  tenantId: string,
  employeeId: string,
): Promise<boolean> {
  const snapshot = await getEmployeeConsentBundle(tenantId, employeeId);
  if (!snapshot.ok) {
    return false;
  }
  if (snapshot.data.onboardingCompleted) {
    return false;
  }
  if (snapshot.data.locationInternalConsentGranted) {
    return false;
  }
  return true;
}
