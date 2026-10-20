import type {
  BillingRecipientProfile,
  BillingRecipientResolution,
  BillingRecipientType,
  CostCarrierProfile,
} from '@/types/careBilling';

export const RECIPIENT_RESOLUTION_MESSAGES = {
  unclear: 'Rechnungsempfänger unklar — Abrechnung blockiert.',
  missingProfile: 'Kein Rechnungsempfänger hinterlegt.',
  pflegekasseOk: 'Rechnungsempfänger: Pflegekasse.',
  selfPayerOk: 'Rechnungsempfänger: Selbstzahler.',
  guardianOk: 'Rechnungsempfänger: Gesetzlicher Betreuer.',
  relativeOk: 'Rechnungsempfänger: Angehöriger.',
} as const;

export function resolveBillingRecipient(
  profiles: BillingRecipientProfile[],
  costCarriers: CostCarrierProfile[],
  options: {
    billingType: 'pflegekasse' | 'selbstzahler' | 'kombi' | 'beihilfe' | 'sonstige';
    preferredRecipientId?: string | null;
    hasSelfPayerPortion?: boolean;
  },
): BillingRecipientResolution {
  const primary =
    profiles.find((p) => p.id === options.preferredRecipientId) ??
    profiles.find((p) => p.isPrimary) ??
    profiles[0] ??
    null;

  if (!primary) {
    if (options.billingType === 'pflegekasse') {
      const carrier = costCarriers.find((c) => c.isPrimary) ?? costCarriers[0];
      if (carrier) {
        return {
          resolved: true,
          recipientType: 'pflegekasse',
          profile: {
            id: `derived-${carrier.id}`,
            tenantId: carrier.tenantId,
            clientId: carrier.clientId,
            recipientType: 'pflegekasse',
            fullName: carrier.name,
            street: '',
            zip: '',
            city: '',
            email: null,
            phone: null,
            isPrimary: true,
            costCarrierProfileId: carrier.id,
            notes: null,
            createdAt: carrier.createdAt,
            updatedAt: carrier.updatedAt,
          },
          blockedReason: null,
        };
      }
    }
    return {
      resolved: false,
      recipientType: 'unclear',
      profile: null,
      blockedReason: RECIPIENT_RESOLUTION_MESSAGES.missingProfile,
    };
  }

  if (primary.recipientType === 'unclear') {
    return {
      resolved: false,
      recipientType: 'unclear',
      profile: primary,
      blockedReason: RECIPIENT_RESOLUTION_MESSAGES.unclear,
    };
  }

  if (primary.recipientType === 'pflegekasse' && options.billingType === 'selbstzahler') {
    if (options.hasSelfPayerPortion) {
      const selfPayer = profiles.find((p) => p.recipientType === 'self_payer');
      if (selfPayer) {
        return {
          resolved: true,
          recipientType: 'self_payer',
          profile: selfPayer,
          blockedReason: null,
        };
      }
    }
  }

  return {
    resolved: true,
    recipientType: primary.recipientType,
    profile: primary,
    blockedReason: null,
  };
}

export function getRecipientTypeLabel(type: BillingRecipientType): string {
  switch (type) {
    case 'pflegekasse':
      return RECIPIENT_RESOLUTION_MESSAGES.pflegekasseOk;
    case 'self_payer':
      return RECIPIENT_RESOLUTION_MESSAGES.selfPayerOk;
    case 'legal_guardian':
      return RECIPIENT_RESOLUTION_MESSAGES.guardianOk;
    case 'relative':
      return RECIPIENT_RESOLUTION_MESSAGES.relativeOk;
    default:
      return RECIPIENT_RESOLUTION_MESSAGES.unclear;
  }
}

export function validateRecipientForBilling(
  resolution: BillingRecipientResolution,
): string | null {
  if (!resolution.resolved) {
    return resolution.blockedReason ?? RECIPIENT_RESOLUTION_MESSAGES.unclear;
  }
  const profile = resolution.profile;
  if (!profile?.fullName?.trim()) {
    return 'Rechnungsempfänger ohne Namen.';
  }
  if (resolution.recipientType === 'self_payer' || resolution.recipientType === 'relative') {
    if (!profile.street?.trim() || !profile.city?.trim() || !profile.zip?.trim()) {
      return 'Empfängeradresse unvollständig.';
    }
  }
  return null;
}
