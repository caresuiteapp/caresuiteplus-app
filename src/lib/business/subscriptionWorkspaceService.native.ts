// Generated native presentation from src/lib/business/subscriptionWorkspaceService.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ProductKey, RoleKey, TenantProduct } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { demoTenant } from '@/data/demo/tenant';
import { demoTenantProducts } from '@/data/demo/products';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import { getRouteByPath } from '@/lib/navigation/routes';
import { FREE_PLATFORM_FEATURE_KEYS, FREE_PLATFORM_PRODUCT_KEYS } from '@/lib/billing/freePlatformService';
import { isUnreleasedModuleKey } from '@/lib/modules/constants';
import { getCatalogEntry } from '@/lib/modules/moduleVisibilityConfig';
import { fetchTenantModulesFromSupabase } from '@/lib/modules/moduleAccessRepository.supabase';
import { evaluatePlatformModuleAccess, parsePlatformModuleList, resolvePlatformModuleKeyFromProduct, type PlatformTenantModuleRecord } from '@/lib/modules/platformModuleKeyMap';
import { getSupabaseClient } from "../supabase/client.ts";
import { isDemoMode } from '@/lib/supabase/config';
import { fetchTenantProfile } from '@/lib/supabase/tenantService';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
export type SubscriptionWorkspaceScope = {
    authUserId: string;
    profileId: string;
    tenantId: string;
    roleKey: RoleKey | null;
};
export type SubscriptionModuleStatus = 'active' | 'inactive' | 'blocked' | 'prepared';
export type SubscriptionModuleState = {
    key: ProductKey;
    status: SubscriptionModuleStatus;
    reason: string;
};
export type SubscriptionWorkspaceModule = SubscriptionModuleState & {
    route: string;
    canOpen: boolean;
};
export type SubscriptionWorkspaceSnapshot = {
    tenantId: string;
    tenantName: string;
    source: 'live' | 'demo';
    loadedAt: string;
    monthlyTotal: 0;
    modules: SubscriptionWorkspaceModule[];
    activeModuleCount: number;
    preparedModuleCount: number;
    inactiveModuleCount: number;
    blockedModuleCount: number;
    totalModuleCount: number;
    platformFeatureCount: number;
};
export type SubscriptionWorkspaceErrorCode = 'identity' | 'permission' | 'unavailable' | 'connection' | 'invalid_response';
export type SubscriptionWorkspaceResult = {
    ok: true;
    data: SubscriptionWorkspaceSnapshot;
} | {
    ok: false;
    error: string;
    code: SubscriptionWorkspaceErrorCode;
};
const IDENTITY_ERROR = 'Das angemeldete Konto oder Unternehmen hat sich geändert. Bitte laden Sie die Übersicht erneut.';
const PERMISSION_ERROR = 'Für die Plattformübersicht fehlt Ihnen die Berechtigung.';
const CONNECTION_ERROR = 'Die Plattformübersicht konnte nicht geladen werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.';
const RESPONSE_ERROR = 'Die Modulfreigaben konnten nicht vollständig geprüft werden. Bitte laden Sie die Übersicht erneut.';
type ReadClient = NonNullable<ReturnType<typeof getSupabaseClient>>;
type RpcReply = {
    data: unknown;
    error: {
        code?: string;
        message?: string;
    } | null;
};
type Failure = Extract<SubscriptionWorkspaceResult, {
    ok: false;
}>;
const failure = (code: SubscriptionWorkspaceErrorCode, error: string): Failure => ({ ok: false, code, error });
const PLATFORM_STATUSES = new Set(['enabled', 'disabled', 'trial', 'scheduled', 'expired', 'locked', 'beta_enabled']);
function validPlatformRecord(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const row = value as Record<string, unknown>;
    const key = row.moduleKey ?? row.module_key;
    if (typeof key !== 'string' || !key.trim() || typeof row.status !== 'string' || !PLATFORM_STATUSES.has(row.status))
        return false;
    for (const [camel, snake] of [['isTrial', 'is_trial'], ['manualOverride', 'manual_override']]) {
        const flag = row[camel] ?? row[snake];
        if (flag != null && typeof flag !== 'boolean')
            return false;
    }
    for (const [camel, snake] of [['startsAt', 'starts_at'], ['endsAt', 'ends_at'], ['trialEndsAt', 'trial_ends_at']]) {
        const date = row[camel] ?? row[snake];
        if (date != null && (typeof date !== 'string' || !Number.isFinite(Date.parse(date))))
            return false;
    }
    return true;
}
/** A read-only projection; viewing this page must never initialize or activate module stores. */
export function buildSubscriptionModuleStates(products: readonly TenantProduct[], platformRecords: readonly PlatformTenantModuleRecord[], settings: Partial<Record<ProductKey, boolean>> = {}, now = Date.now()): SubscriptionModuleState[] {
    const byKey = new Map(products.map(product => [product.productKey, product]));
    const platform = new Map(platformRecords.map(record => [record.moduleKey, record]));
    function resolve(key: ProductKey, officeIncluded = false): SubscriptionModuleState {
        const catalog = getCatalogEntry(key);
        if (isUnreleasedModuleKey(key) || catalog.status === 'coming_soon') {
            return { key, status: 'prepared', reason: 'Noch nicht veröffentlicht. Die Freigabe erfolgt gesondert.' };
        }
        if (catalog.status === 'disabled' || catalog.status === 'internal') {
            return { key, status: 'blocked', reason: 'Dieser Bereich ist derzeit nicht allgemein verfügbar.' };
        }
        const product = byKey.get(key);
        if (product?.billingStatus === 'admin_disabled' || product?.accessType === 'admin_disabled') {
            return { key, status: 'blocked', reason: 'Die Verwaltung hat den Zugriff auf dieses Modul gesperrt.' };
        }
        const configured = settings[key] ?? (product?.isActive === true && product.accessSource !== 'disabled' && product.accessSource !== 'expired');
        const record = platform.get(resolvePlatformModuleKeyFromProduct(key));
        if (record && !validPlatformRecord(record))
            return { key, status: 'blocked', reason: 'Die Plattformfreigabe konnte nicht sicher geprüft werden.' };
        const decision = evaluatePlatformModuleAccess(record, configured || officeIncluded, now);
        if (decision.source === 'platform' && !decision.allowed) {
            return { key, status: 'blocked', reason: 'Die Plattformfreigabe ist gesperrt, abgelaufen oder noch nicht gültig.' };
        }
        return decision.allowed
            ? { key, status: 'active', reason: key === 'office' && officeIncluded ? 'Als Basis zu einem freigegebenen Fachmodul enthalten.' : 'Für Ihr Unternehmen freigegeben. Persönliche Rollenrechte gelten zusätzlich.' }
            : { key, status: 'inactive', reason: 'Für Ihr Unternehmen derzeit nicht aktiviert.' };
    }
    const specialties = FREE_PLATFORM_PRODUCT_KEYS.filter(key => key !== 'office').map(key => resolve(key));
    const office = resolve('office', specialties.some(module => module.status === 'active'));
    const states = new Map([office, ...specialties].map(module => [module.key, module]));
    return FREE_PLATFORM_PRODUCT_KEYS.map(key => states.get(key)!);
}
function snapshot(tenantId: string, tenantName: string, source: SubscriptionWorkspaceSnapshot['source'], modules: SubscriptionModuleState[], roleKey: RoleKey, permissions: readonly PermissionKey[]): SubscriptionWorkspaceSnapshot {
    const navigableModules = modules.map(module => {
        const route = `/${module.key}`;
        const target = getRouteByPath(route);
        const allowedRole = Boolean(target && (!target.allowedRoles || target.allowedRoles.includes(roleKey)));
        const canOpen = module.status === 'active' && allowedRole && permissions.includes(`${module.key}.access` as PermissionKey);
        return { ...module, route, canOpen };
    });
    return {
        tenantId, tenantName, source, loadedAt: new Date().toISOString(), monthlyTotal: 0, modules: navigableModules,
        activeModuleCount: modules.filter(module => module.status === 'active').length,
        preparedModuleCount: modules.filter(module => module.status === 'prepared').length,
        inactiveModuleCount: modules.filter(module => module.status === 'inactive').length,
        blockedModuleCount: modules.filter(module => module.status === 'blocked').length,
        totalModuleCount: modules.length,
        platformFeatureCount: FREE_PLATFORM_FEATURE_KEYS.length,
    };
}
function rpc(client: ReadClient, name: string, args?: Record<string, unknown>): PromiseLike<RpcReply> {
    return (client as unknown as {
        rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcReply>;
    }).rpc(name, args);
}
type ConfirmedScope = {
    ok: true;
    roleKey: RoleKey;
    permissions: readonly PermissionKey[];
};
/** Same role defaults as the application, but fresh reads and no role/tenant cache. */
async function readRuntimePermissions(client: ReadClient, roleKey: RoleKey, tenantId: string): Promise<readonly PermissionKey[] | null> {
    const [role, overrides] = await Promise.all([
        client.from('roles').select('id').eq('key', roleKey).maybeSingle(),
        client.from('role_permission_sets').select('permission_key').eq('tenant_id', tenantId).eq('role_key', roleKey),
    ]);
    if (role.error || overrides.error)
        return null;
    if (overrides.data?.length)
        return [...new Set(overrides.data.map(row => row.permission_key as PermissionKey))];
    // Canonical server roles are mapped to the application's RoleKey at bootstrap.
    // A missing legacy role row uses the same defaults as fetchRuntimePermissions.
    if (!role.data?.id)
        return getPermissionsForRole(roleKey);
    const global = await client.from('role_permissions').select('permission_key').eq('role_id', role.data.id);
    if (global.error)
        return null;
    const permissions = [...new Set((global.data ?? []).map(row => row.permission_key as PermissionKey))];
    return permissions.length ? permissions : getPermissionsForRole(roleKey);
}
async function confirmScope(client: ReadClient, scope: SubscriptionWorkspaceScope): Promise<Failure | ConfirmedScope> {
    const auth = await client.auth.getUser();
    if (auth.error || auth.data.user?.id !== scope.authUserId)
        return failure('identity', IDENTITY_ERROR);
    const [resolved, profile] = await Promise.all([
        resolveAuthenticatedProfileId(scope.tenantId),
        fetchTenantProfile(scope.authUserId),
    ]);
    if (!resolved.ok || resolved.data !== scope.profileId || !profile || profile.id !== scope.profileId || profile.tenantId !== scope.tenantId || !profile.roleKey || profile.roleKey !== scope.roleKey)
        return failure('identity', IDENTITY_ERROR);
    const permissions = await readRuntimePermissions(client, profile.roleKey, scope.tenantId);
    if (!permissions)
        return failure('unavailable', 'Die Berechtigung für die Plattformübersicht konnte nicht geprüft werden. Bitte erneut versuchen.');
    if (!permissions.includes('business.subscription.view'))
        return failure('permission', PERMISSION_ERROR);
    const current = await client.auth.getUser();
    if (current.error || current.data.user?.id !== scope.authUserId)
        return failure('identity', IDENTITY_ERROR);
    return { ok: true, roleKey: profile.roleKey, permissions };
}
function mapSettings(value: unknown): Partial<Record<ProductKey, boolean>> | null {
    if (value == null)
        return {};
    if (typeof value !== 'object' || Array.isArray(value))
        return null;
    const row = value as Record<string, unknown>;
    const mapping = { assist: 'assist_enabled', pflege: 'pflege_enabled', stationaer: 'stationaer_enabled', beratung: 'beratung_enabled' } as const;
    const result: Partial<Record<ProductKey, boolean>> = {};
    for (const key of Object.keys(mapping) as (keyof typeof mapping)[]) {
        const enabled = row[mapping[key]];
        if (enabled != null && typeof enabled !== 'boolean')
            return null;
        if (typeof enabled === 'boolean')
            result[key] = enabled;
    }
    return result;
}
async function loadWorkspace(scope: SubscriptionWorkspaceScope): Promise<SubscriptionWorkspaceResult> {
    if (!scope.authUserId?.trim() || !scope.profileId?.trim() || !scope.tenantId?.trim())
        return failure('identity', IDENTITY_ERROR);
    if (isDemoMode()) {
        if (scope.tenantId !== demoTenant.id)
            return failure('identity', 'Die Demoübersicht ist nur für den Demo-Mandanten verfügbar.');
        const permissions = getPermissionsForRole(scope.roleKey);
        if (!scope.roleKey || !permissions.includes('business.subscription.view'))
            return failure('permission', PERMISSION_ERROR);
        return { ok: true, data: snapshot(demoTenant.id, demoTenant.name, 'demo', buildSubscriptionModuleStates(demoTenantProducts, []), scope.roleKey, permissions) };
    }
    const client = getSupabaseClient();
    if (!client)
        return failure('unavailable', 'Die Verbindung zur Plattform ist nicht verfügbar. Bitte versuchen Sie es später erneut.');
    const before = await confirmScope(client, scope);
    if (!before.ok)
        return before;
    const [tenant, products, platform, settingsResponse] = await Promise.all([
        client.from('tenants').select('id, name').eq('id', scope.tenantId).maybeSingle(),
        fetchTenantModulesFromSupabase(scope.tenantId),
        rpc(client, 'tenant_list_platform_modules', { p_tenant_id: scope.tenantId }),
        fromUnknownTable(client, 'tenant_module_settings').select('assist_enabled, pflege_enabled, stationaer_enabled, beratung_enabled').eq('tenant_id', scope.tenantId).maybeSingle(),
    ]);
    const after = await confirmScope(client, scope);
    if (!after.ok)
        return after;
    if (tenant.error || !products.ok || platform.error || settingsResponse.error)
        return failure('connection', CONNECTION_ERROR);
    if (!tenant.data || tenant.data.id !== scope.tenantId || typeof tenant.data.name !== 'string' || !tenant.data.name.trim())
        return failure('invalid_response', 'Das Unternehmen konnte nicht eindeutig geladen werden. Bitte prüfen Sie die Unternehmensdaten.');
    if (!Array.isArray(platform.data) || !platform.data.every(validPlatformRecord) || products.data.some(product => product.tenantId !== scope.tenantId))
        return failure('invalid_response', RESPONSE_ERROR);
    const records = parsePlatformModuleList(platform.data);
    if (records.length !== platform.data.length || new Set(records.map(record => record.moduleKey)).size !== records.length)
        return failure('invalid_response', RESPONSE_ERROR);
    const settings = mapSettings(settingsResponse.data);
    if (!settings)
        return failure('invalid_response', RESPONSE_ERROR);
    return { ok: true, data: snapshot(scope.tenantId, tenant.data.name.trim(), 'live', buildSubscriptionModuleStates(products.data, records, settings), after.roleKey, after.permissions) };
}
export async function fetchSubscriptionWorkspace(scope: SubscriptionWorkspaceScope): Promise<SubscriptionWorkspaceResult> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            loadWorkspace(scope),
            new Promise<SubscriptionWorkspaceResult>(resolve => {
                timer = setTimeout(() => resolve(failure('connection', 'Die Abfrage dauert zu lange. Bitte versuchen Sie es erneut.')), 30000);
            }),
        ]);
    }
    catch {
        return failure('connection', CONNECTION_ERROR);
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
    }
}
