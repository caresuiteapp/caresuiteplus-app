import type {
  MarketplaceCategory,
  MarketplaceCategoryKey,
  MarketplaceCommissionBookingStatus,
  MarketplaceDataCategory,
  MarketplaceDataSharingScope,
  MarketplaceModuleReadiness,
  MarketplacePartner,
  MarketplacePartnerStatus,
  MarketplaceReferralConsent,
  MarketplaceReferralRequest,
  MarketplaceReferralStatus,
} from '@/types/marketplace';

export const MARKETPLACE_MODULE_READINESS: MarketplaceModuleReadiness = 'beta';

export const MARKETPLACE_NO_MEDICAL_NOTICE =
  'Der Partner-Marktplatz stellt keine medizinischen oder therapeutischen Empfehlungen dar. ' +
  'Alle Anfragen sind organisatorische Weiterleitungen — keine Behandlungsentscheidungen.';

export const MARKETPLACE_PREPARED_NOTICE =
  'Partner-Marktplatz in Vorbereitung (Beta). Keine aktiven Partner ohne Vereinbarung. ' +
  'Keine Datenübertragung ohne Einwilligung. Keine Provisionsabrechnung.';

export const MARKETPLACE_CONSENT_REQUIRED_NOTICE =
  'Vor dem Senden ist eine ausdrückliche Einwilligung zur Datenfreigabe erforderlich. ' +
  'Es werden keine sensiblen Kundendaten vorausgefüllt.';

export const MARKETPLACE_SELECTABLE_PARTNER_STATUSES: MarketplacePartnerStatus[] = ['active'];

export const MARKETPLACE_DATA_SHARING_SCOPES: MarketplaceDataSharingScope[] = [
  {
    category: 'tenant_contact',
    label: 'Ansprechpartner Pflegedienst',
    description: 'Name, E-Mail und Telefon des Ansprechpartners im Pflegedienst',
    includesSensitiveData: false,
  },
  {
    category: 'client_initials',
    label: 'Klienten-Initialen',
    description: 'Nur Initialen — kein vollständiger Name',
    includesSensitiveData: true,
  },
  {
    category: 'client_postal_code',
    label: 'Postleitzahl',
    description: 'PLZ des Klienten für regionale Zuordnung',
    includesSensitiveData: true,
  },
  {
    category: 'care_context_summary',
    label: 'Pflegekontext (frei formuliert)',
    description: 'Kurzbeschreibung ohne Diagnosen oder Medikamente',
    includesSensitiveData: true,
  },
  {
    category: 'billing_reference',
    label: 'Interne Referenznummer',
    description: 'Interne Vorgangsnummer ohne Rechnungsdetails',
    includesSensitiveData: false,
  },
];

export const MARKETPLACE_PARTNER_STATUS_LABELS: Record<MarketplacePartnerStatus, string> = {
  draft: 'Entwurf',
  pending_review: 'In Prüfung',
  approved: 'Freigegeben (inaktiv)',
  active: 'Aktiv',
  paused: 'Pausiert',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
};

export const MARKETPLACE_REFERRAL_STATUS_LABELS: Record<MarketplaceReferralStatus, string> = {
  draft: 'Entwurf',
  consent_required: 'Einwilligung erforderlich',
  ready: 'Bereit zum Senden',
  sent: 'Gesendet',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

export const MARKETPLACE_COMMISSION_STATUS_LABELS: Record<MarketplaceCommissionBookingStatus, string> = {
  prepared: 'Vorbereitet',
  pending: 'Ausstehend',
  booked: 'Gebucht',
  cancelled: 'Storniert',
};

export function isMarketplaceLiveReady(): boolean {
  return false;
}

export function isPartnerSelectable(partner: Pick<MarketplacePartner, 'status'>): boolean {
  return MARKETPLACE_SELECTABLE_PARTNER_STATUSES.includes(partner.status);
}

export function isConsentValid(consent: Pick<MarketplaceReferralConsent, 'consentGiven' | 'consentGivenAt' | 'revokedAt'>): boolean {
  return consent.consentGiven && consent.consentGivenAt !== null && consent.revokedAt === null;
}

export function resolveReferralStatusAfterConsent(
  consentValid: boolean,
): MarketplaceReferralStatus {
  return consentValid ? 'ready' : 'consent_required';
}

export function getDataSharingScopeLabel(category: MarketplaceDataCategory): string {
  return MARKETPLACE_DATA_SHARING_SCOPES.find((item) => item.category === category)?.label ?? category;
}

export function buildDefaultDataSharingScope(): MarketplaceDataCategory[] {
  return ['tenant_contact'];
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { id: 'cat-pflegehilfsmittel', categoryKey: 'pflegehilfsmittel', label: 'Pflegehilfsmittelboxen', description: 'Lieferung und Beratung zu Pflegehilfsmittelboxen', icon: '📦', sortOrder: 10, isActive: true },
  { id: 'cat-sanitaetshaus', categoryKey: 'sanitaetshaus', label: 'Sanitätshäuser', description: 'Hilfsmittel, Orthopädie und Sanitätshaus-Services', icon: '🦽', sortOrder: 20, isActive: true },
  { id: 'cat-apotheke', categoryKey: 'apotheke', label: 'Apotheken', description: 'Apotheken- und Medikamentenversorgung', icon: '💊', sortOrder: 30, isActive: true },
  { id: 'cat-wundversorgung', categoryKey: 'wundversorgung', label: 'Wundversorgung', description: 'Wundmanagement und Versorgungsprodukte', icon: '🩹', sortOrder: 40, isActive: true },
  { id: 'cat-hausnotruf', categoryKey: 'hausnotruf', label: 'Hausnotruf', description: 'Notruf- und Telecare-Dienste', icon: '🚨', sortOrder: 50, isActive: true },
  { id: 'cat-essensdienst', categoryKey: 'essensdienst', label: 'Menü-/Essensdienste', description: 'Essenslieferung und Menüplanung', icon: '🍽️', sortOrder: 60, isActive: true },
  { id: 'cat-fahrdienst', categoryKey: 'fahrdienst', label: 'Fahrdienste', description: 'Fahrdienste und Mobilität', icon: '🚗', sortOrder: 70, isActive: true },
  { id: 'cat-reinigungsdienst', categoryKey: 'reinigungsdienst', label: 'Reinigungsdienste', description: 'Haushalts- und Reinigungsdienste', icon: '🧹', sortOrder: 80, isActive: true },
  { id: 'cat-alltagshilfe', categoryKey: 'alltagshilfe', label: 'Alltagshilfe-Anbieter', description: 'Alltagsbegleitung und haushaltsnahe Hilfe', icon: '🤝', sortOrder: 90, isActive: true },
  { id: 'cat-schulungsanbieter', categoryKey: 'schulungsanbieter', label: 'Schulungsanbieter', description: 'Pflege-Schulungen und Fortbildungen', icon: '🎓', sortOrder: 100, isActive: true },
  { id: 'cat-abrechnungszentrum', categoryKey: 'abrechnungszentrum', label: 'Abrechnungszentren', description: 'Abrechnungsdienstleister und Clearing', icon: '🧾', sortOrder: 110, isActive: true },
  { id: 'cat-steuerberater', categoryKey: 'steuerberater', label: 'Steuerberater', description: 'Steuerberatung für Pflegedienste', icon: '📒', sortOrder: 120, isActive: true },
  { id: 'cat-versicherung_beratung', categoryKey: 'versicherung_beratung', label: 'Versicherungs-/Beratungspartner', description: 'Versicherungs- und Beratungspartner', icon: '🛡️', sortOrder: 130, isActive: true },
];

export function getMarketplaceCategories(): MarketplaceCategory[] {
  return MARKETPLACE_CATEGORIES.filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getMarketplaceCategory(categoryKey: MarketplaceCategoryKey): MarketplaceCategory | undefined {
  return MARKETPLACE_CATEGORIES.find((item) => item.categoryKey === categoryKey);
}

/** Demo-Partner — alle in draft/pending, keiner aktiv ohne Admin-Freigabe */
export const DEMO_MARKETPLACE_PARTNERS: MarketplacePartner[] = [
  {
    id: 'partner-demo-pflegebox',
    partnerKey: 'demo_pflegehilfsmittel',
    name: 'Demo Pflegehilfsmittel (Entwurf)',
    categoryKey: 'pflegehilfsmittel',
    status: 'draft',
    shortDescription: 'Platzhalter — nicht aktiv',
    longDescription: 'Dieser Demo-Partner ist nicht aktiv und dient nur der UI-Vorbereitung.',
    websiteUrl: null,
    logoUrl: null,
    isDemo: true,
    onboardingStatus: 'not_started',
    agreementSignedAt: null,
  },
  {
    id: 'partner-demo-sanitaet',
    partnerKey: 'demo_sanitaetshaus',
    name: 'Demo Sanitätshaus (Prüfung)',
    categoryKey: 'sanitaetshaus',
    status: 'pending_review',
    shortDescription: 'In Admin-Prüfung — nicht auswählbar',
    longDescription: 'Partner wartet auf Vereinbarung und Admin-Freigabe.',
    websiteUrl: null,
    logoUrl: null,
    isDemo: true,
    onboardingStatus: 'review',
    agreementSignedAt: null,
  },
  {
    id: 'partner-demo-hausnotruf',
    partnerKey: 'demo_hausnotruf',
    name: 'Demo Hausnotruf (freigegeben, inaktiv)',
    categoryKey: 'hausnotruf',
    status: 'approved',
    shortDescription: 'Freigegeben, aber noch nicht aktiv',
    longDescription: 'Vereinbarung ausstehend — Status approved, nicht active.',
    websiteUrl: null,
    logoUrl: null,
    isDemo: true,
    onboardingStatus: 'ready',
    agreementSignedAt: null,
  },
];

export function getPartnersForCategory(
  categoryKey: MarketplaceCategoryKey,
  includeInactive = false,
): MarketplacePartner[] {
  return DEMO_MARKETPLACE_PARTNERS.filter((partner) => {
    if (partner.categoryKey !== categoryKey) return false;
    if (includeInactive) return true;
    return isPartnerSelectable(partner);
  });
}

export function getPartnerById(partnerId: string): MarketplacePartner | undefined {
  return DEMO_MARKETPLACE_PARTNERS.find((item) => item.id === partnerId);
}

export function getSelectablePartners(): MarketplacePartner[] {
  return DEMO_MARKETPLACE_PARTNERS.filter(isPartnerSelectable);
}

export type MarketplaceGuardResult =
  | { allowed: true }
  | {
      allowed: false;
      code:
        | 'partner_not_active'
        | 'consent_missing'
        | 'consent_revoked'
        | 'referral_not_ready'
        | 'commission_not_completed'
        | 'tenant_mismatch'
        | 'no_data_transfer'
        | 'permission_denied';
      message: string;
    };

export function assertReferralSendAllowed(input: {
  partner: Pick<MarketplacePartner, 'status'>;
  consent: Pick<MarketplaceReferralConsent, 'consentGiven' | 'consentGivenAt' | 'revokedAt'> | null;
  referral: Pick<MarketplaceReferralRequest, 'referralStatus' | 'tenantId'>;
  actorTenantId: string;
}): MarketplaceGuardResult {
  if (input.referral.tenantId !== input.actorTenantId) {
    return {
      allowed: false,
      code: 'tenant_mismatch',
      message: 'Anfrage gehört nicht zum aktuellen Mandanten.',
    };
  }
  if (!isPartnerSelectable(input.partner)) {
    return {
      allowed: false,
      code: 'partner_not_active',
      message: 'Partner ist nicht aktiv — Anfrage kann nicht gesendet werden.',
    };
  }
  if (!input.consent) {
    return {
      allowed: false,
      code: 'consent_missing',
      message: 'Einwilligung zur Datenfreigabe fehlt.',
    };
  }
  if (input.consent.revokedAt) {
    return {
      allowed: false,
      code: 'consent_revoked',
      message: 'Einwilligung wurde widerrufen.',
    };
  }
  if (!isConsentValid(input.consent)) {
    return {
      allowed: false,
      code: 'consent_missing',
      message: 'Ausdrückliche Einwilligung erforderlich.',
    };
  }
  if (input.referral.referralStatus !== 'ready') {
    return {
      allowed: false,
      code: 'referral_not_ready',
      message: 'Anfrage ist nicht bereit zum Senden.',
    };
  }
  return { allowed: true };
}

export function assertCommissionBookingAllowed(input: {
  referralStatus: MarketplaceReferralStatus;
  bookingStatus: MarketplaceCommissionBookingStatus;
}): MarketplaceGuardResult {
  if (input.bookingStatus === 'booked' && input.referralStatus !== 'completed') {
    return {
      allowed: false,
      code: 'commission_not_completed',
      message: 'Provision kann erst nach abgeschlossener Weiterleitung gebucht werden.',
    };
  }
  return { allowed: true };
}

export function assertNoCustomerDataTransfer(input: {
  consentValid: boolean;
  referralSent: boolean;
}): MarketplaceGuardResult {
  if (input.referralSent && !input.consentValid) {
    return {
      allowed: false,
      code: 'no_data_transfer',
      message: 'Kundendaten dürfen ohne Einwilligung nicht übertragen werden.',
    };
  }
  return { allowed: true };
}

export function canAdministerPartners(roleKey: string | null | undefined): boolean {
  return roleKey === 'business_admin';
}

export function stripSensitivePrefill<T extends Record<string, unknown>>(payload: T): T {
  const blocked = ['firstName', 'lastName', 'dateOfBirth', 'diagnosis', 'medication', 'address', 'insuranceNumber'];
  const copy = { ...payload };
  for (const key of blocked) {
    if (key in copy) {
      delete copy[key];
    }
  }
  return copy;
}
