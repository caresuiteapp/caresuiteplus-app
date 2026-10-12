import type { ClientPortalFeatureKey, ClientPortalSettingsResolved } from '@/types/clientCore';

/** Pure release check shared by navigation and data services. */
export function canClientPortalSeeFeature(
  settings: ClientPortalSettingsResolved,
  feature: ClientPortalFeatureKey,
): boolean {
  if (!settings.portalEnabled || feature === 'visit_tracking') return false;
  switch (feature) {
    case 'appointments': return settings.showAppointments;
    case 'messages': return settings.showMessages;
    case 'documents': return settings.showDocuments;
    case 'proofs': return settings.showProofs;
    case 'budget': return settings.showBudget;
    default: return false;
  }
}
