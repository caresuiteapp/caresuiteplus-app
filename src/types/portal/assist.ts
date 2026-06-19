export type PortalRequestType =
  | 'termin_aendern'
  | 'zusatztermin'
  | 'rueckruf'
  | 'nachricht'
  | 'upload'
  | 'nachweise'
  | 'stammdaten'
  | 'beschwerde'
  | 'lob'
  | 'sonstiges';

export type PortalRequestStatus =
  | 'offen'
  | 'in_bearbeitung'
  | 'erledigt'
  | 'abgelehnt'
  | 'zurueckgestellt';

export type PortalActivityType =
  | 'request_created'
  | 'request_updated'
  | 'request_completed'
  | 'document_uploaded'
  | 'message_sent'
  | 'appointment_viewed'
  | 'budget_viewed'
  | 'system';

export type PortalBudgetType = 'paragraph_45b' | 'paragraph_45a';

export type PortalRequest = {
  id: string;
  tenantId: string;
  clientId: string;
  portalUserId: string | null;
  moduleKey: string;
  requestType: PortalRequestType;
  status: PortalRequestStatus;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PortalActivity = {
  id: string;
  tenantId: string;
  clientId: string;
  portalUserId: string | null;
  moduleKey: string;
  activityType: PortalActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type PortalBudgetSnapshot = {
  id: string;
  tenantId: string;
  clientId: string;
  budgetType: PortalBudgetType;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  currency: string;
};

export type PortalNextAppointment = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  status: string;
};

export type AssistDashboardKpis = {
  appointments: number;
  messages: number;
  documents: number;
  proofs: number;
  signatures: number;
  budgetAvailable: boolean;
  openRequests: number;
  activities: number;
  begleitungen: number | null;
};

export type AssistDashboardData = {
  nextAppointment: PortalNextAppointment | null;
  upcomingAppointments: PortalNextAppointment[];
  contactPhone: string | null;
  kpis: AssistDashboardKpis;
  activities: PortalActivity[];
  budget: PortalBudgetSnapshot | null;
  openRequests: PortalRequest[];
};

export type CreatePortalRequestInput = {
  tenantId: string;
  clientId: string;
  portalUserId?: string | null;
  moduleKey?: string;
  requestType: PortalRequestType;
  title: string;
  description?: string | null;
  payload?: Record<string, unknown>;
};
