/**
 * Tenant branding for Leistungsnachweis PDF/HTML (logo + footer).
 */
import { fetchTenantBrandingLogoUrl } from '@/lib/tenant/tenantBrandingService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type VisitProofBranding = {
  logoUrl: string | null;
  tenantName: string;
  legalName: string | null;
  addressLine: string | null;
  ikNumber: string | null;
  taxId: string | null;
};

export type VisitProofBrandingInput = {
  logoUrl?: string | null;
  tenantName?: string | null;
  legalName?: string | null;
  addressLine?: string | null;
  ikNumber?: string | null;
  taxId?: string | null;
};

function formatAddressLine(
  street?: string | null,
  postalCode?: string | null,
  city?: string | null,
): string | null {
  const parts = [street?.trim(), [postalCode?.trim(), city?.trim()].filter(Boolean).join(' ')].filter(
    Boolean,
  );
  const line = parts.join(', ');
  return line || null;
}

function resolveLogoUrl(
  input: VisitProofBrandingInput,
  snapshot: Record<string, unknown>,
): string | null {
  const candidates = [
    input.logoUrl,
    snapshot.tenantLogoUrl,
    snapshot.logoUrl,
    snapshot.logo_url,
    snapshot.companyLogoUrl,
    snapshot.businessLogoUrl,
    snapshot.organizationLogoUrl,
  ];
  for (const value of candidates) {
    const url = String(value ?? '').trim();
    if (url) return url;
  }
  return null;
}

export function resolveVisitProofBranding(
  snapshot: Record<string, unknown>,
  input: VisitProofBrandingInput = {},
): VisitProofBranding {
  const tenantName =
    String(
      input.tenantName ??
        snapshot.tenantName ??
        snapshot.providerName ??
        snapshot.companyName ??
        snapshot.businessName ??
        '',
    ).trim() || 'CareSuite+ Mandant';

  const legalName =
    String(input.legalName ?? snapshot.legalName ?? snapshot.tenantLegalName ?? '').trim() || null;

  const addressLine =
    input.addressLine ??
    (typeof snapshot.tenantAddress === 'string' ? snapshot.tenantAddress : null) ??
    formatAddressLine(
      snapshot.tenantStreet as string | null,
      snapshot.tenantPostalCode as string | null,
      snapshot.tenantCity as string | null,
    );

  return {
    logoUrl: resolveLogoUrl(input, snapshot),
    tenantName,
    legalName,
    addressLine: addressLine?.trim() || null,
    ikNumber: String(input.ikNumber ?? snapshot.ikNumber ?? snapshot.ik_number ?? '').trim() || null,
    taxId: String(input.taxId ?? snapshot.taxId ?? snapshot.tax_id ?? '').trim() || null,
  };
}

/** Load tenant branding from DB for proof enrichment (non-destructive read). */
export async function loadVisitProofBrandingForTenant(
  tenantId: string,
): Promise<VisitProofBrandingInput> {
  const logoFromBranding = await fetchTenantBrandingLogoUrl(tenantId);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { logoUrl: logoFromBranding || null };
  }

  const { data: tenant } = await fromUnknownTable(supabase, 'tenants')
    .select('name, legal_name, street, postal_code, city, tax_id, ik_number')
    .eq('id', tenantId)
    .maybeSingle();

  const row = tenant as Record<string, unknown> | null;

  const { data: docSettings } = await fromUnknownTable(supabase, 'tenant_document_settings')
    .select('logo_url')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settings = docSettings as Record<string, unknown> | null;

  const logoUrl =
    logoFromBranding ||
    (settings?.logo_url ? String(settings.logo_url).trim() : '') ||
    null;

  return {
    logoUrl,
    tenantName: row?.name ? String(row.name) : null,
    legalName: row?.legal_name ? String(row.legal_name) : row?.name ? String(row.name) : null,
    addressLine: formatAddressLine(
      row?.street as string | null,
      row?.postal_code as string | null,
      row?.city as string | null,
    ),
    ikNumber: row?.ik_number ? String(row.ik_number) : null,
    taxId: row?.tax_id ? String(row.tax_id) : null,
  };
}
