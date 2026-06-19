import type { EntityId } from '@/types/core/base';
import type { TenantCenterSnapshot } from '@/types/tenant/tenantCenter';
import { formatHourlyRateDocumentAmount } from '@/lib/formatters/numberFormatters';
import { fetchTenantCustomFieldDefinitions } from './tenantCustomFieldService';
import { fetchTenantServiceCatalog } from './tenantServiceCatalogService';

/** Document/invoice context for templates — extended in later phases. */
export type TenantDocumentContext = {
  company: Record<string, string | null>;
  tax: Record<string, string | boolean | null>;
  register: Record<string, string | null>;
  bank: Record<string, string | null>;
  branding: Record<string, string | null>;
  custom: Record<string, unknown>;
};

export async function getTenantDocumentContext(
  tenantId: EntityId,
  snapshot: TenantCenterSnapshot,
): Promise<TenantDocumentContext> {
  const customFields = await fetchTenantCustomFieldDefinitions(tenantId, 'business_admin');
  const custom: Record<string, unknown> = {};
  if (customFields.ok) {
    for (const field of customFields.data) {
      custom[field.fieldKey] = null;
    }
  }

  return {
    company: {
      name: snapshot.company.name,
      legal_name: snapshot.company.legalName,
      street: snapshot.company.street,
      house_number: snapshot.company.houseNumber,
      postal_code: snapshot.company.zip,
      city: snapshot.company.city,
      country: snapshot.company.country,
      phone: snapshot.company.phone,
      email: snapshot.company.email,
      website: snapshot.company.website,
    },
    tax: {
      tax_number: snapshot.tax.taxNumber,
      vat_id: snapshot.tax.vatId,
      tax_office: snapshot.tax.taxOffice,
      kleinunternehmer: snapshot.tax.kleinunternehmer,
    },
    register: {
      register_court: snapshot.register.registerCourt,
      register_number: snapshot.register.registerNumber,
      ik_number: snapshot.register.ikNumber,
    },
    bank: {
      iban: snapshot.bankAccounts[0]?.iban ?? null,
      bank_name: snapshot.bankAccounts[0]?.bankName ?? null,
      account_holder: snapshot.bankAccounts[0]?.accountHolder ?? null,
    },
    branding: {
      logo_url: snapshot.branding.logoUrl,
      app_name: snapshot.branding.appName,
    },
    custom,
  };
}

export type ResolveServicePriceInput = {
  tenantId: EntityId;
  serviceKey: string;
  clientId?: EntityId;
  date?: string;
};

export type ResolvedServicePrice = {
  serviceKey: string;
  priceNet: number;
  formattedPrice: string;
  taxMode: string;
  source: 'catalog' | 'billing_fallback';
};

/**
 * Resolves a service price from catalog; falls back to tenant_billing_settings.default_hourly_rate.
 * TODO: client-specific overrides and date-effective price versions.
 */
export async function resolveServicePrice(
  input: ResolveServicePriceInput,
  fallbackHourlyRate?: string | null,
): Promise<ResolvedServicePrice | null> {
  const catalog = await fetchTenantServiceCatalog(input.tenantId, 'business_admin');
  if (catalog.ok) {
    const item = catalog.data.items.find(
      (entry) => entry.serviceKey === input.serviceKey && entry.isActive,
    );
    if (item?.defaultPriceNet != null) {
      return {
        serviceKey: input.serviceKey,
        priceNet: item.defaultPriceNet,
        formattedPrice: formatHourlyRateDocumentAmount(item.defaultPriceNet),
        taxMode: item.defaultTaxMode ?? 'exempt_4_16',
        source: 'catalog',
      };
    }
  }

  if (fallbackHourlyRate) {
    const parsed = Number.parseFloat(fallbackHourlyRate.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      return {
        serviceKey: input.serviceKey,
        priceNet: parsed,
        formattedPrice: formatHourlyRateDocumentAmount(parsed),
        taxMode: 'exempt_4_16',
        source: 'billing_fallback',
      };
    }
  }

  return null;
}
