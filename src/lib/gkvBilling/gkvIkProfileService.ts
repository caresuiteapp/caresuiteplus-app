import type { ServiceResult } from '@/types';
import type { GkvBillingProfile, GkvBillingMode, GkvStatutorySector } from '@/types/gkvBilling';
import {
  appendGkvBillingAudit,
  readGkvBillingProfile,
  writeGkvBillingProfile,
} from './gkvBillingStore';
import { isValidIkFormat } from './gkvProductionGuard';

export function getGkvBillingProfile(tenantId: string): GkvBillingProfile | null {
  return readGkvBillingProfile(tenantId);
}

export type UpsertGkvBillingProfileInput = Partial<
  Pick<
    GkvBillingProfile,
    | 'ikNumber'
    | 'bankAccountHolder'
    | 'bankIban'
    | 'bankBic'
    | 'statutorySector'
    | 'billingMode'
    | 'verificationStatus'
    | 'dtaValidatorConfigured'
    | 'notes'
  >
>;

export function upsertGkvBillingProfile(
  tenantId: string,
  input: UpsertGkvBillingProfileInput,
): ServiceResult<GkvBillingProfile> {
  const now = new Date().toISOString();
  const existing = readGkvBillingProfile(tenantId);
  const ikNumber = input.ikNumber ?? existing?.ikNumber ?? null;

  if (ikNumber && !isValidIkFormat(ikNumber)) {
    return { ok: false, error: 'IK-Nummer muss 9 Ziffern haben — ungültiges Format.' };
  }

  const profile: GkvBillingProfile = {
    id: existing?.id ?? `gkv-profile-${tenantId}`,
    tenantId,
    ikNumber,
    bankAccountHolder: input.bankAccountHolder ?? existing?.bankAccountHolder ?? null,
    bankIban: input.bankIban ?? existing?.bankIban ?? null,
    bankBic: input.bankBic ?? existing?.bankBic ?? null,
    statutorySector: input.statutorySector ?? existing?.statutorySector ?? null,
    billingMode: input.billingMode ?? existing?.billingMode ?? 'leistungsnachweise_export',
    verificationStatus: input.verificationStatus ?? existing?.verificationStatus ?? 'unverified',
    verifiedAt:
      input.verificationStatus === 'verified' ? now : existing?.verifiedAt ?? null,
    dtaValidatorConfigured:
      input.dtaValidatorConfigured ?? existing?.dtaValidatorConfigured ?? false,
    notes: input.notes ?? existing?.notes ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  writeGkvBillingProfile(tenantId, profile);
  appendGkvBillingAudit({
    id: `gkv-audit-ik-${Date.now()}`,
    tenantId,
    action: 'gkv.ik_profile_updated',
    entityType: 'gkv_billing_profiles',
    entityId: profile.id,
    summary: profile.ikNumber
      ? 'GKV-IK-Profil aktualisiert (Vorbereitung).'
      : 'GKV-IK-Profil ohne IK gespeichert.',
    createdAt: now,
  });

  return { ok: true, data: profile };
}

export function validateGkvIkProfile(tenantId: string): ServiceResult<{
  profile: GkvBillingProfile | null;
  ikPresent: boolean;
  ikFormatValid: boolean;
  verificationStatus: GkvBillingProfile['verificationStatus'];
  canBill: boolean;
  message: string;
}> {
  const profile = readGkvBillingProfile(tenantId);
  const ikPresent = Boolean(profile?.ikNumber?.trim());
  const ikFormatValid = isValidIkFormat(profile?.ikNumber);
  const verificationStatus = profile?.verificationStatus ?? 'unverified';
  const canBill = ikPresent && ikFormatValid;

  let message = 'IK-Profil unvollständig — Abrechnung blockiert.';
  if (!ikPresent) {
    message = 'Institutionskennzeichen (IK) fehlt — Abrechnung blockiert.';
  } else if (!ikFormatValid) {
    message = 'IK-Format ungültig — Abrechnung blockiert.';
  } else if (verificationStatus === 'unverified') {
    message = 'IK ist hinterlegt, aber nicht verifiziert — nur Vorbereitung möglich.';
  } else {
    message = 'IK-Profil geprüft (Vorbereitung — keine produktive Verifikation).';
  }

  return {
    ok: true,
    data: { profile, ikPresent, ikFormatValid, verificationStatus, canBill, message },
  };
}

export function updateGkvBillingMode(
  tenantId: string,
  billingMode: GkvBillingMode,
): ServiceResult<GkvBillingProfile> {
  return upsertGkvBillingProfile(tenantId, { billingMode });
}

export function updateGkvStatutorySector(
  tenantId: string,
  statutorySector: GkvStatutorySector,
): ServiceResult<GkvBillingProfile> {
  return upsertGkvBillingProfile(tenantId, { statutorySector });
}
