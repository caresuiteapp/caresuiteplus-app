import type { ClientDetail } from '../../detail';
import type { ClientAddress } from './clientAddress';
import type { ClientBillingProfile, ClientContract } from './clientBilling';
import type { ClientBudget } from './clientBudget';
import type { ClientCareLevel } from './clientCareLevel';
import type { ClientConsentRecord } from './clientConsents';
import type { ClientContactRecord } from './clientContact';
import type { ClientCore, ClientLifecycleStatus } from './clientCore';
import type { ClientDocumentRecord } from './clientDocuments';
import type { ClientPortalAccess } from './clientPortal';
import type { ClientPreferences } from './clientPreferences';
import type { ClientEmergencyPlan, ClientRisk } from './clientRisks';
import type { ClientTask } from './clientTasks';
import type { ClientInternalNote, ClientTimelineEvent } from './clientTimeline';
import type { ClientSchedulingWishes } from './clientSchedulingWishes';

export * from './clientCore';
export * from './clientContact';
export * from './clientAddress';
export * from './clientCareLevel';
export * from './clientBudget';
export * from './clientBilling';
export * from './clientPreferences';
export * from './clientRisks';
export * from './clientConsents';
export * from './clientPortal';
export * from './clientDocuments';
export * from './clientTasks';
export * from './clientTimeline';
export * from './clientSchedulingWishes';

/** Vollständige digitale Klient:innen-Akte */
export type ClientFullDetail = Omit<ClientDetail, 'contacts' | 'consents'> & {
  core: ClientCore;
  lifecycleStatus: ClientLifecycleStatus;
  addresses: ClientAddress[];
  contacts: ClientContactRecord[];
  careLevels: ClientCareLevel[];
  budgets: ClientBudget[];
  billingProfile: ClientBillingProfile | null;
  contracts: ClientContract[];
  preferences: ClientPreferences | null;
  risks: ClientRisk[];
  emergencyPlan: ClientEmergencyPlan | null;
  consents: ClientConsentRecord[];
  portalAccess: ClientPortalAccess[];
  documents: ClientDocumentRecord[];
  tasks: ClientTask[];
  timeline: ClientTimelineEvent[];
  /** Nur Office — niemals Portal */
  internalNotes: ClientInternalNote[];
  schedulingWishes?: ClientSchedulingWishes | null;
};

/** Portal-sichtbare Teilmenge — ohne interne Notizen */
export type ClientPortalView = Omit<ClientFullDetail, 'internalNotes'> & {
  internalNotes?: never;
};
