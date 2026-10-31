// Generated native presentation from src/lib/catalog/catalogWorkspaceModel.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ServiceCatalogCategory, ServicePriceUnit, ServiceTaxMode, TenantModuleKey } from '@/types/tenant/tenantCenter';
import { INVOICE_MODULES } from '@/lib/office/invoiceModules';
import { isUnreleasedCatalogModuleKey } from '@/lib/modules/constants';
import { formatServicePriceUnit } from '@/lib/tenant/serviceCatalogLabels';
export type CatalogWorkspaceItem = {
    id: string;
    catalogId: string;
    code: string;
    label: string;
    description: string;
    category: ServiceCatalogCategory;
    unitKey: ServicePriceUnit;
    unit: string;
    isActive: boolean;
    status: 'aktiv' | 'inaktiv';
    priceNet: number | null;
    priceCents: number | null;
    defaultTaxMode: ServiceTaxMode | null;
    validFrom: string | null;
    validUntil: string | null;
    priceState: 'current' | 'future' | 'expired' | 'missing';
    nextPriceNet: number | null;
    nextValidFrom: string | null;
    updatedAt: string | null;
};
export type CatalogWorkspaceCatalog = {
    id: string;
    moduleKey: TenantModuleKey;
    name: string;
    description: string;
    itemCount: number;
    activeCount: number;
    inactiveCount: number;
    missingPriceCount: number;
    status: 'aktiv' | 'inaktiv';
    updatedAt: string | null;
    createdAt: string | null;
    items: CatalogWorkspaceItem[];
};
export type CatalogWorkspaceSnapshot = {
    catalogs: CatalogWorkspaceCatalog[];
    canEdit: boolean;
    asOf: string;
};
export type CatalogWorkspaceRow = {
    id: string;
    module_key: TenantModuleKey;
    service_key: string;
    name: string;
    description: string | null;
    category: ServiceCatalogCategory;
    unit: ServicePriceUnit;
    is_active: boolean;
    sort_order: number;
    created_at: string | null;
    updated_at: string | null;
};
export type CatalogWorkspacePrice = {
    id: string;
    catalog_id: string;
    price_net: number;
    tax_mode: ServiceTaxMode;
    valid_from: string | null;
    valid_to: string | null;
};
export const CATALOG_CATEGORY_LABELS: Record<ServiceCatalogCategory, string> = {
    service: 'Leistungen', travel: 'Fahrtkosten', surcharge: 'Zuschläge',
};
export function catalogBusinessDate(now = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = (kind: string) => parts.find(value => value.type === kind)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
}
export function isCatalogDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
/** Dates are inclusive; a scheduled price never replaces today's amount early. */
export function resolveCatalogPrice(prices: readonly CatalogWorkspacePrice[], asOf: string) {
    const sorted = [...prices].sort((a, b) => (b.valid_from ?? '').localeCompare(a.valid_from ?? '') || a.id.localeCompare(b.id));
    const current = sorted.find(price => (!price.valid_from || price.valid_from <= asOf) && (!price.valid_to || price.valid_to >= asOf)) ?? null;
    const future = [...sorted].reverse().find(price => price.valid_from && price.valid_from > asOf) ?? null;
    const expired = sorted.find(price => price.valid_to && price.valid_to < asOf) ?? null;
    return { current, future, expired, state: current ? 'current' as const : future ? 'future' as const : expired ? 'expired' as const : 'missing' as const };
}
export function buildCatalogWorkspace(rows: readonly CatalogWorkspaceRow[], prices: readonly CatalogWorkspacePrice[], enabledModules: readonly TenantModuleKey[], canEdit: boolean, asOf = catalogBusinessDate()): CatalogWorkspaceSnapshot {
    const pricesByItem = new Map<string, CatalogWorkspacePrice[]>();
    for (const price of prices)
        pricesByItem.set(price.catalog_id, [...(pricesByItem.get(price.catalog_id) ?? []), price]);
    const catalogs = INVOICE_MODULES.filter(module => !isUnreleasedCatalogModuleKey(module.key) && enabledModules.includes(module.key)).map(module => {
        const id = `tenant-service:${module.key}`;
        const catalogRows = rows.filter(row => row.module_key === module.key).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id));
        const items: CatalogWorkspaceItem[] = catalogRows.map(row => {
            const price = resolveCatalogPrice(pricesByItem.get(row.id) ?? [], asOf);
            const displayed = price.current ?? price.future ?? price.expired;
            return {
                id: row.id, catalogId: id, code: row.service_key, label: row.name, description: row.description ?? '',
                category: row.category, unitKey: row.unit, unit: formatServicePriceUnit(row.unit),
                isActive: row.is_active, status: row.is_active ? 'aktiv' : 'inaktiv',
                priceNet: price.current?.price_net ?? null,
                priceCents: price.current && row.unit !== 'percent' ? Math.round(price.current.price_net * 100) : null,
                defaultTaxMode: displayed?.tax_mode ?? null,
                validFrom: displayed?.valid_from ?? null, validUntil: displayed?.valid_to ?? null,
                priceState: price.state, nextPriceNet: price.future?.price_net ?? null, nextValidFrom: price.future?.valid_from ?? null,
                updatedAt: row.updated_at,
            };
        });
        const activeCount = items.filter(item => item.isActive).length;
        const updates = catalogRows.map(row => row.updated_at).filter((value): value is string => !!value).sort();
        const creates = catalogRows.map(row => row.created_at).filter((value): value is string => !!value).sort();
        return {
            id, moduleKey: module.key, name: `${module.label}-Leistungskatalog`,
            description: 'Leistungen, Fahrtkosten und Zuschläge mit Einheiten, Preisen und Gültigkeit.',
            itemCount: items.length, activeCount, inactiveCount: items.length - activeCount,
            missingPriceCount: items.filter(item => item.isActive && item.priceNet == null).length,
            status: activeCount ? 'aktiv' as const : 'inaktiv' as const,
            updatedAt: updates.at(-1) ?? null, createdAt: creates[0] ?? null, items,
        };
    });
    return { catalogs, canEdit, asOf };
}
export function formatWorkspaceCatalogPrice(item: Pick<CatalogWorkspaceItem, 'priceNet' | 'unitKey'>): string {
    if (item.priceNet == null || !Number.isFinite(item.priceNet))
        return 'Kein gültiger Preis';
    const amount = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.priceNet);
    return item.unitKey === 'percent' ? `${amount} %` : `${amount} €`;
}
export function formatCatalogDate(value: string | null | undefined): string {
    if (!value)
        return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !isCatalogDate(value))
        return '—';
    const parsed = new Date(isCatalogDate(value) ? `${value}T12:00:00Z` : value);
    if (!Number.isFinite(parsed.getTime()))
        return '—';
    return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}
