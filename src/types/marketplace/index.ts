export type MarketplaceCategoryKey =
  | 'pflegehilfsmittel'
  | 'sanitaetshaus'
  | 'apotheke'
  | 'wundversorgung'
  | 'hausnotruf'
  | 'essensdienst'
  | 'fahrdienst'
  | 'reinigungsdienst'
  | 'alltagshilfe'
  | 'schulungsanbieter'
  | 'abrechnungszentrum'
  | 'steuerberater'
  | 'versicherung_beratung';

export type MarketplacePartnerStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'active'
  | 'paused'
  | 'rejected'
  | 'archived';

export type MarketplaceReferralStatus =
  | 'draft'
  | 'consent_required'
  | 'ready'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type MarketplaceCommissionBookingStatus = 'prepared' | 'pending' | 'booked' | 'cancelled';

export type MarketplaceOnboardingStatus =
  | 'not_started'
  | 'documents_pending'
  | 'review'
  | 'ready'
  | 'completed';

export type MarketplaceDataCategory =
  | 'tenant_contact'
  | 'client_initials'
  | 'client_postal_code'
  | 'care_context_summary'
  | 'billing_reference';

export type MarketplaceCategory = {
  id: string;
  categoryKey: MarketplaceCategoryKey;
  label: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

export type MarketplacePartner = {
  id: string;
  partnerKey: string;
  name: string;
  categoryKey: MarketplaceCategoryKey;
  status: MarketplacePartnerStatus;
  shortDescription: string;
  longDescription: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  isDemo: boolean;
  onboardingStatus: MarketplaceOnboardingStatus;
  agreementSignedAt: string | null;
};

export type MarketplacePartnerService = {
  id: string;
  partnerId: string;
  serviceKey: string;
  label: string;
  description: string;
  isActive: boolean;
};

export type MarketplacePartnerRegion = {
  id: string;
  partnerId: string;
  regionCode: string;
  regionLabel: string;
};

export type MarketplaceReferralRequest = {
  id: string;
  tenantId: string;
  partnerId: string;
  referralStatus: MarketplaceReferralStatus;
  requestSubject: string;
  requestMessage: string;
  dataSharingScope: MarketplaceDataCategory[];
  clientReference: string | null;
  requestedAt: string | null;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceReferralConsent = {
  id: string;
  tenantId: string;
  referralRequestId: string;
  dataCategories: MarketplaceDataCategory[];
  scopeDescription: string;
  consentTextVersion: string;
  consentGiven: boolean;
  consentGivenAt: string | null;
  revokedAt: string | null;
};

export type MarketplaceCommissionRule = {
  id: string;
  partnerId: string;
  ruleKey: string;
  label: string;
  commissionType: 'percentage' | 'fixed' | 'none';
  rateValue: number | null;
  isActive: boolean;
  requiresCompleted: boolean;
};

export type MarketplaceCommissionEvent = {
  id: string;
  tenantId: string;
  referralRequestId: string;
  commissionRuleId: string | null;
  bookingStatus: MarketplaceCommissionBookingStatus;
  amountCents: number | null;
  bookedAt: string | null;
};

export type MarketplaceAuditEvent = {
  id: string;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
};

export type MarketplaceDataSharingScope = {
  category: MarketplaceDataCategory;
  label: string;
  description: string;
  includesSensitiveData: boolean;
};

export type MarketplaceModuleReadiness = 'coming_soon' | 'beta';
