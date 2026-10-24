// Generated native presentation from src/lib/catalog/catalogWorkspace.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { PermissionKey, Profile, ServiceResult } from '@/types';
import type { ServiceCatalogCategory, ServicePriceUnit, ServiceTaxMode, TenantModuleKey } from '@/types/tenant/tenantCenter';
import { enforcePermission } from '@/lib/permissions/enforce';
import { resolveEffectivePermissions } from '@/lib/permissions/rbacService';
import { fetchRuntimePermissions } from '@/lib/supabase/permissionRepository';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { loadCompanyAccess } from "../tenant/companyAccessService.ts";
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
import { isUnreleasedCatalogModuleKey } from '@/lib/modules/constants';
import { INVOICE_MODULES, isInvoiceModuleKey } from '@/lib/office/invoiceModules';
import { buildCatalogWorkspace, isCatalogDate, type CatalogWorkspacePrice, type CatalogWorkspaceRow, type CatalogWorkspaceSnapshot } from "./catalogWorkspaceModel.native.ts";
export * from "./catalogWorkspaceModel.native.ts";
type Row = Record<string, unknown>;
const units = new Set<ServicePriceUnit>(['hour', 'visit', 'day', 'flat', 'km', 'percent']);
const categories = new Set<ServiceCatalogCategory>(['service', 'travel', 'surcharge']);
const taxes = new Set<ServiceTaxMode>(['exempt_4_16', 'standard_19', 'kleinunternehmer_19', 'none']);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const timestamp = (value: unknown): string | null => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
function parseCatalogRow(row: Row, tenantId: string): CatalogWorkspaceRow {
    if (row.tenant_id !== tenantId || !text(row.id) || !isInvoiceModuleKey(row.module_key) || !text(row.service_key)
        || !text(row.name) || !units.has(row.unit as ServicePriceUnit) || !categories.has(row.category as ServiceCatalogCategory)
        || typeof row.is_active !== 'boolean' || !Number.isFinite(Number(row.sort_order)))
        throw new Error('Ungültige Katalogdaten.');
    return { id: row.id, module_key: row.module_key, service_key: row.service_key, name: row.name,
        description: row.description == null ? null : String(row.description), unit: row.unit as ServicePriceUnit,
        category: row.category as ServiceCatalogCategory, is_active: row.is_active, sort_order: Number(row.sort_order),
        created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at) };
}
function parsePriceRow(row: Row, tenantId: string, ids: ReadonlySet<string>): CatalogWorkspacePrice {
    const amount = typeof row.price_net === 'number' || typeof row.price_net === 'string' && row.price_net.trim() ? Number(row.price_net) : NaN;
    if (row.tenant_id !== tenantId || !text(row.id) || !text(row.catalog_id) || !ids.has(row.catalog_id) || row.is_default !== true
        || !Number.isFinite(amount) || amount < 0 || !taxes.has(row.tax_mode as ServiceTaxMode)
        || row.valid_from != null && !isCatalogDate(row.valid_from) || row.valid_to != null && !isCatalogDate(row.valid_to)
        || row.valid_from && row.valid_to && String(row.valid_from) > String(row.valid_to))
        throw new Error('Ungültige Preisdaten.');
    return { id: row.id, catalog_id: row.catalog_id, price_net: amount, tax_mode: row.tax_mode as ServiceTaxMode,
        valid_from: row.valid_from as string | null, valid_to: row.valid_to as string | null };
}
/** Stable, counted pages avoid silently reporting the API's first 1,000 rows as a complete catalog. */
async function readPages(load: (from: number, to: number) => PromiseLike<{
    data: unknown;
    error: unknown;
    count: number | null;
}>): Promise<Row[]> {
    const result: Row[] = [], seen = new Set<string>();
    let expected: number | null = null;
    for (let offset = 0; offset < 20000; offset += 250) {
        const page = await load(offset, offset + 249);
        if (page.error)
            throw page.error;
        if (!Array.isArray(page.data) || !Number.isSafeInteger(page.count) || Number(page.count) < 0 || expected != null && page.count !== expected)
            throw new Error('Unvollständige Katalogdaten.');
        expected = page.count;
        for (const value of page.data) {
            if (!value || typeof value !== 'object' || Array.isArray(value) || !text(value.id) || seen.has(value.id))
                throw new Error('Der Katalog wurde während des Ladens geändert.');
            seen.add(value.id);
            result.push(value as Row);
        }
        if (result.length === expected)
            return result;
        if (result.length > Number(expected) || page.data.length < 250)
            throw new Error('Unvollständige Katalogdaten.');
    }
    throw new Error('Der Katalog ist für diese Ansicht zu umfangreich.');
}
/** Read-only Office view: no seeds, no demo fallback, and no migration required. */
export async function fetchCatalogWorkspace(tenantId: string, profile: Profile | null | undefined, runtimePermissions?: readonly PermissionKey[]): Promise<ServiceResult<CatalogWorkspaceSnapshot>> {
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock)
        return tenantBlock;
    if (!profile?.roleKey || profile.tenantId !== tenantId)
        return { ok: false, error: 'Bitte mit einem gültigen Zugang für dieses Unternehmen anmelden.' };
    if (!isLiveServiceMode())
        return { ok: false, error: 'Kataloge benötigen eine aktive Datenverbindung.' };
    if (!hasEffectiveModuleGateAccess('office', tenantId))
        return { ok: false, error: 'Office ist für dieses Unternehmen nicht freigegeben.' };
    try {
        let permissions = runtimePermissions ?? await fetchRuntimePermissions(profile.roleKey, tenantId);
        if (profile.employeeId) {
            const effective = await resolveEffectivePermissions(tenantId, profile.employeeId, profile.roleKey);
            if (!effective.ok)
                return { ok: false, error: 'Die Katalogberechtigungen konnten nicht geprüft werden. Bitte erneut laden.' };
            permissions = permissions.filter(permission => effective.data.permissions.includes(permission));
        }
        const denied = enforcePermission<CatalogWorkspaceSnapshot>(profile.roleKey, 'office.catalogs.view', { effectivePermissions: permissions });
        if (denied)
            return denied;
        const access = await loadCompanyAccess(tenantId);
        if (!access.ok)
            return access;
        if (access.data.scopeLimited)
            return { ok: false, error: 'Für unternehmensweite Kataloge benötigen Sie Zugriff ohne Bereichsbeschränkung.' };
        const canEdit = permissions.includes('business.tenant.manage') && access.data.permissions.includes('business.tenant.manage');
        const enabledModules = INVOICE_MODULES.filter(module => !isUnreleasedCatalogModuleKey(module.key) && hasEffectiveModuleGateAccess(module.key, tenantId)).map(module => module.key);
        const client = getSupabaseClient();
        if (!client)
            return { ok: false, error: 'Die Katalogverbindung ist nicht verfügbar.' };
        if (!enabledModules.length)
            return { ok: true, data: buildCatalogWorkspace([], [], [], canEdit) };
        const catalogData = await readPages((from, to) => fromUnknownTable(client, 'tenant_service_catalog')
            .select('id, tenant_id, module_key, service_key, name, description, unit, category, is_active, sort_order, created_at, updated_at', { count: 'exact' })
            .eq('tenant_id', tenantId).in('module_key', enabledModules).order('id').range(from, to));
        const rows = catalogData.map(row => parseCatalogRow(row, tenantId));
        if (rows.some(row => !enabledModules.includes(row.module_key)))
            throw new Error('Nicht freigegebener Katalog.');
        const prices: CatalogWorkspacePrice[] = [];
        // Keep the filter URL bounded even for large company catalogs.
        for (let offset = 0; offset < rows.length; offset += 150) {
            const ids = rows.slice(offset, offset + 150).map(row => row.id), idSet = new Set(ids);
            const priceData = await readPages((from, to) => fromUnknownTable(client, 'tenant_service_prices')
                .select('id, tenant_id, catalog_id, price_net, tax_mode, valid_from, valid_to, is_default', { count: 'exact' })
                .eq('tenant_id', tenantId).eq('is_default', true).in('catalog_id', ids).order('id').range(from, to));
            prices.push(...priceData.map(row => parsePriceRow(row, tenantId, idSet)));
        }
        return { ok: true, data: buildCatalogWorkspace(rows, prices, enabledModules as TenantModuleKey[], canEdit) };
    }
    catch {
        return { ok: false, error: 'Die Kataloge und Preise konnten nicht vollständig geladen werden. Bitte erneut versuchen.' };
    }
}
