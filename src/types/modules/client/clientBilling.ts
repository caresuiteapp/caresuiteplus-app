import type { TenantScopedEntity } from '../../core/base';
import type { WorkflowStatus } from '../../core/base';

export type BillingType = 'selbstzahler' | 'pflegekasse' | 'beihilfe' | 'kombi' | 'sonstige';

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  selbstzahler: 'Selbstzahler',
  pflegekasse: 'Pflegekasse',
  beihilfe: 'Beihilfe',
  kombi: 'Kombiabrechnung',
  sonstige: 'Sonstige',
};

export type ServiceType = 'sachleistung' | 'verhinderungspflege' | 'betreuung' | 'haushalt' | 'sonstige';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  sachleistung: 'Sachleistung',
  verhinderungspflege: 'Verhinderungspflege',
  betreuung: 'Betreuung',
  haushalt: 'Haushaltshilfe',
  sonstige: 'Sonstige',
};

export type ClientBillingProfile = TenantScopedEntity & {
  clientId: string;
  billingType: BillingType;
  hourlyRateCents: number;
  serviceType: ServiceType;
  invoiceRecipient: string | null;
  paymentTermsDays: number;
  costBearerName: string | null;
  costBearerReference: string | null;
  notes: string | null;
};

export type ClientContract = TenantScopedEntity & {
  clientId: string;
  contractNumber: string;
  contractStart: string;
  contractEnd: string | null;
  serviceType: ServiceType;
  hourlyRateCents: number;
  weeklyHours: number | null;
  status: WorkflowStatus;
  signedAt: string | null;
  documentId: string | null;
  notes: string | null;
};
