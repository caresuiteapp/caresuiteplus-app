import type { TenantScopedEntity } from '../../core/base';

export type ContactRelation =
  | 'angehoerige'
  | 'ehepartner'
  | 'kind'
  | 'nachbar'
  | 'betreuer'
  | 'arzt'
  | 'sonstige';

export const CONTACT_RELATION_LABELS: Record<ContactRelation, string> = {
  angehoerige: 'Angehörige:r',
  ehepartner: 'Ehepartner:in',
  kind: 'Kind',
  nachbar: 'Nachbar:in',
  betreuer: 'Betreuer:in',
  arzt: 'Arzt / Ärztin',
  sonstige: 'Sonstige',
};

export type ClientContactPortalPermissions = {
  canViewAppointments: boolean;
  canViewDocuments: boolean;
  canViewCarePlan: boolean;
  canSendMessages: boolean;
  canViewBilling: boolean;
};

export type ClientContactRecord = TenantScopedEntity & {
  clientId: string;
  firstName: string;
  lastName: string;
  relationship: ContactRelation;
  relationshipLabel: string | null;
  phone: string | null;
  email: string | null;
  isEmergency: boolean;
  isPortalUser: boolean;
  portalPermissions: ClientContactPortalPermissions;
  notes: string | null;
};
