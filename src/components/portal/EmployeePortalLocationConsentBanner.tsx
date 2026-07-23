import type { EmployeePortalLocationConsent } from '@/types/modules/employeePortalTracking';

type EmployeePortalLocationConsentBannerProps = {
  consent: EmployeePortalLocationConsent | null;
  onAccept: () => void;
  loading?: boolean;
};

export function EmployeePortalLocationConsentBanner({
  consent: _consent,
  onAccept: _onAccept,
  loading: _loading = false,
}: EmployeePortalLocationConsentBannerProps) {
  // Kept as a compatibility export for older screens. Tracking authorization is
  // tenant-policy based, so no employee confirmation UI is rendered.
  return null;
}
