import type {
  DocumentExecutionContext,
  DocumentGuardCode,
  DocumentGuardResult,
  OcrProviderKey,
  SignatureProviderKey,
} from '@/types/documents/connect';
import { EXTERNAL_OCR_PROVIDER_KEYS } from '@/types/documents/connect';

function deny(code: DocumentGuardCode, message: string): DocumentGuardResult {
  return { allowed: false, code, message };
}

export function assertTenantScope(
  tenantId: string | null,
  resourceTenantId: string | null | undefined,
): DocumentGuardResult {
  if (!tenantId?.trim()) {
    return deny('missing_tenant', 'Mandant fehlt — Dokumentaktion blockiert.');
  }
  if (resourceTenantId && resourceTenantId !== tenantId) {
    return deny('tenant_mismatch', 'Dokument gehört zu einem anderen Mandanten.');
  }
  return { allowed: true };
}

/** Prüft ob Signatur-Anbieter konfiguriert ist (ohne Live-Freigabe). */
export function validateSigningProviderReady(context: DocumentExecutionContext): DocumentGuardResult {
  const tenantCheck = assertTenantScope(context.tenantId, context.documentTenantId);
  if (!tenantCheck.allowed) return tenantCheck;

  if (!context.signatureProviderKey) {
    return deny('missing_provider', 'Kein Signatur-Anbieter konfiguriert — Signatur blockiert.');
  }
  if (!context.signatureProviderActive) {
    return deny('provider_inactive', 'Signatur-Anbieter ist nicht aktiv.');
  }
  if (context.isArchived) {
    return deny('document_archived', 'Archivierte Dokumente können nicht signiert werden.');
  }
  if (context.environment === 'production' && context.isMockProvider) {
    return deny('signing_blocked', 'Mock-Anbieter in Produktion blockiert — keine echten Signaturen.');
  }
  if (context.environment === 'production' && context.demoMode) {
    return deny('signing_blocked', 'Demo-Modus in Produktion blockiert — keine echten Signaturen.');
  }
  if (context.environment === 'production' && !context.hasCredentialReference) {
    return deny('missing_credential', 'Vault-Referenz für Signatur-Anbieter fehlt.');
  }
  return { allowed: true };
}

/** Signatur nur über konfigurierten Anbieter — kein Live-Versand in Vorbereitung. */
export function assertSigningAllowed(context: DocumentExecutionContext): DocumentGuardResult {
  const ready = validateSigningProviderReady(context);
  if (!ready.allowed) return ready;
  return deny(
    'external_transfer_blocked',
    'Signatur-Versand ist vorbereitet — externer Transfer noch nicht freigegeben.',
  );
}

/** Prüft ob OCR-Anbieter konfiguriert ist (ohne externen Transfer). */
export function validateOcrProviderReady(context: DocumentExecutionContext): DocumentGuardResult {
  const tenantCheck = assertTenantScope(context.tenantId, context.documentTenantId);
  if (!tenantCheck.allowed) return tenantCheck;

  if (!context.ocrProviderKey) {
    return deny('missing_provider', 'Kein OCR-Anbieter konfiguriert — OCR blockiert.');
  }
  if (!context.ocrProviderActive && context.ocrProviderKey !== 'internal') {
    return deny('provider_inactive', 'OCR-Anbieter ist nicht aktiv.');
  }

  const isExternal = isExternalOcrProviderKey(context.ocrProviderKey);
  if (isExternal && !context.ocrExternalApproved) {
    return deny('ocr_approval_required', 'Externe OCR erfordert explizite Administrator-Freigabe.');
  }

  if (context.containsHealthData) {
    const healthCheck = assertHealthDataOcrAllowed(context);
    if (!healthCheck.allowed) return healthCheck;
  }

  if (context.environment === 'production' && context.isMockProvider) {
    return deny('ocr_blocked', 'Mock-OCR in Produktion blockiert.');
  }

  return { allowed: true };
}

/** OCR nur mit konfiguriertem Anbieter — externer Transfer blockiert. */
export function assertOcrAllowed(context: DocumentExecutionContext): DocumentGuardResult {
  const ready = validateOcrProviderReady(context);
  if (!ready.allowed) return ready;
  return deny(
    'external_transfer_blocked',
    'OCR ist vorbereitet — kein Transfer an externe Anbieter ohne Freigabe.',
  );
}

/** Gesundheitsdaten-OCR nur mit expliziter Freigabe. */
export function assertHealthDataOcrAllowed(context: DocumentExecutionContext): DocumentGuardResult {
  if (!context.containsHealthData) return { allowed: true };
  if (!context.healthDataOcrApproved) {
    return deny(
      'health_data_ocr_denied',
      'OCR für Gesundheitsdaten erfordert explizite Freigabe.',
    );
  }
  return { allowed: true };
}

/** Archivierte Dokumente nicht direkt überschreibbar. */
export function assertDocumentWritable(context: DocumentExecutionContext): DocumentGuardResult {
  const tenantCheck = assertTenantScope(context.tenantId, context.documentTenantId);
  if (!tenantCheck.allowed) return tenantCheck;

  if (context.isArchived) {
    return deny(
      'document_archived',
      'Archiviertes Dokument kann nicht überschrieben werden — Korrektur als neue Version.',
    );
  }
  return { allowed: true };
}

/** PDF-Manipulation nur mit Versionierung. */
export function assertPdfManipulationAllowed(
  context: DocumentExecutionContext,
  createsNewVersion: boolean,
): DocumentGuardResult {
  const writable = assertDocumentWritable(context);
  if (!writable.allowed) return writable;

  if (!createsNewVersion) {
    return deny(
      'pdf_without_version',
      'PDF-Änderungen erfordern eine neue Dokumentversion.',
    );
  }
  return { allowed: true };
}

/** GoBD-Claim nur mit aktiver Schutzlogik. */
export function assertGobdArchiveClaimAllowed(context: DocumentExecutionContext): DocumentGuardResult {
  if (!context.gobdProtectionActive) {
    return deny(
      'gobd_claim_blocked',
      'GoBD-konforme Archivierung ist erst nach Freischaltung der Schutzlogik möglich.',
    );
  }
  return { allowed: true };
}

export function maskDocumentCredentialReference(reference: string | null): string {
  if (!reference?.trim()) return 'Nicht konfiguriert';
  const tail = reference.slice(-4);
  return `vault:••••${tail}`;
}

/** Provider-Konfiguration für normale Nutzer — ohne Secrets. */
export function sanitizeDocumentProviderConfigForUser<T extends {
  credentialVaultRef?: string | null;
  hasCredentialReference?: boolean;
}>(config: T): Omit<T, 'credentialVaultRef'> & { credentialDisplay: string } {
  const { credentialVaultRef, ...rest } = config;
  return {
    ...rest,
    credentialDisplay: maskDocumentCredentialReference(credentialVaultRef ?? null),
    hasCredentialReference: !!credentialVaultRef?.trim() || rest.hasCredentialReference === true,
  };
}

export function containsDocumentSecretLiteral(value: string): boolean {
  return (
    /sk_live_|sk_test_|pk_live_|pk_test_/.test(value) ||
    /api[_-]?key\s*[:=]/i.test(value) ||
    /SUPABASE_SERVICE_ROLE|webhook_secret=/.test(value)
  );
}

export function isSignatureProviderKey(key: string): key is SignatureProviderKey {
  return ['docusign', 'adobe_sign', 'skribble', 'fp_sign'].includes(key);
}

export function isExternalOcrProviderKey(key: OcrProviderKey): boolean {
  return EXTERNAL_OCR_PROVIDER_KEYS.includes(key as (typeof EXTERNAL_OCR_PROVIDER_KEYS)[number]);
}
