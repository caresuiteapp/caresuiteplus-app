import type { ProductKey, RoleKey } from '@/types';
import type {
  ModuleNavState,
  ModuleScopeKey,
  ModuleVisibilityContext,
  ModuleVisibilityStatus,
} from '@/types/modules/visibility';
import { canAccessDeveloperTools } from '@/lib/auth/devAccess';
import { getRouteByPath } from '@/lib/navigation/routes';
import {
  getCatalogEntry,
  isProductScopeKey,
  MODULE_VISIBILITY_STATUS_LABELS,
} from './moduleVisibilityConfig';
import { getTenantModules, hasEffectiveModuleGateAccess } from './moduleAccessService';
import { resolveScopeModuleAccessDecision } from './platformTenantModuleAccess';

function badgeForStatus(status: ModuleVisibilityStatus): string | undefined {
  if (status === 'live') return undefined;
  return MODULE_VISIBILITY_STATUS_LABELS[status];
}

function blockReasonForStatus(
  entry: ReturnType<typeof getCatalogEntry>,
  status: ModuleVisibilityStatus,
): string | undefined {
  switch (status) {
    case 'disabled':
      return `${entry.label} ist derzeit nicht verfügbar.`;
    case 'coming_soon':
      return `${entry.label} ist in Vorbereitung und noch nicht nutzbar.`;
    case 'internal':
      return `${entry.label} ist nur für Administratoren verfügbar.`;
    case 'beta':
      return entry.hint;
    default:
      return undefined;
  }
}

export function resolveModuleScopeFromPath(path: string): ModuleScopeKey | null {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/';

  if (normalized.startsWith('/insight')) return 'insight';
  if (normalized.startsWith('/business/admin')) return 'admin';
  if (normalized.startsWith('/business/ti')) return 'ti';
  if (normalized.startsWith('/business/platform')) return 'platform';
  if (normalized.startsWith('/business/integrations')) return 'integrations';
  if (normalized.startsWith('/business/connect')) return 'connect';
  if (normalized.startsWith('/business/ops')) return 'ops';
  if (normalized.startsWith('/business/reporting')) return 'reporting';
  if (normalized.startsWith('/business/qa')) return 'qa';
  if (normalized.startsWith('/business/security')) return 'security';
  if (normalized.startsWith('/business/release')) return 'release';
  if (normalized.startsWith('/business/roadmap')) return 'roadmap';
  if (normalized.startsWith('/business/messages')) return 'communication';
  if (normalized.startsWith('/business/templates')) return 'templates';
  if (normalized.startsWith('/business/subscription')) return 'subscription';
  if (normalized.startsWith('/business/modules')) return 'modules_hub';
  if (normalized.startsWith('/business/office/qm')) return 'qm';

  const route = getRouteByPath(normalized);
  if (route?.productKey) return route.productKey;

  if (normalized.startsWith('/office') || normalized.startsWith('/business/office')) return 'office';
  if (normalized.startsWith('/assist')) return 'assist';
  if (normalized.startsWith('/pflege')) return 'pflege';
  if (normalized.startsWith('/stationaer')) return 'stationaer';
  if (normalized.startsWith('/beratung')) return 'beratung';
  if (normalized.startsWith('/akademie')) return 'akademie';

  return null;
}

export function resolveModuleNavState(
  scopeKey: ModuleScopeKey,
  context: ModuleVisibilityContext = {},
): ModuleNavState {
  const entry = getCatalogEntry(scopeKey);
  const { tenantId, roleKey } = context;
  const canInternal = canAccessDeveloperTools(roleKey);
  const isAdminRole = roleKey === 'business_admin' || roleKey === 'business_manager';

  let effectiveStatus: ModuleVisibilityStatus = entry.status;

  if (isProductScopeKey(scopeKey) && tenantId?.trim()) {
    const tenantModule = getTenantModules(tenantId).find((m) => m.productKey === scopeKey);
    if (tenantModule?.billingStatus === 'admin_disabled') {
      effectiveStatus = 'disabled';
    }
  }

  const platformScopeDecision =
    isProductScopeKey(scopeKey) && tenantId?.trim()
      ? resolveScopeModuleAccessDecision(tenantId, scopeKey, false)
      : null;
  const platformHardDeny =
    platformScopeDecision !== null &&
    platformScopeDecision.source === 'platform' &&
    !platformScopeDecision.allowed;

  const isTenantActive =
    isProductScopeKey(scopeKey) && tenantId?.trim()
      ? platformHardDeny
        ? false
        : hasEffectiveModuleGateAccess(scopeKey as ProductKey, tenantId)
      : isProductScopeKey(scopeKey)
        ? false
        : true;

  const isDisabled = effectiveStatus === 'disabled';
  const isInternal = effectiveStatus === 'internal';
  const isComingSoon = effectiveStatus === 'coming_soon';

  let isVisible = !isDisabled;
  if (isInternal) {
    isVisible = canInternal;
  }

  let isNavigable = false;
  if (!isDisabled && !isComingSoon) {
    if (isInternal) {
      isNavigable = canInternal;
    } else if (effectiveStatus === 'live' || effectiveStatus === 'beta') {
      if (isProductScopeKey(scopeKey)) {
        isNavigable = platformHardDeny ? false : isTenantActive || isAdminRole;
      } else {
        isNavigable = true;
      }
    }
  }

  return {
    scopeKey,
    catalogStatus: entry.status,
    effectiveStatus,
    isVisible,
    isNavigable,
    isTenantActive,
    badgeLabel: badgeForStatus(effectiveStatus),
    blockReason: blockReasonForStatus(entry, effectiveStatus),
  };
}

export function isModuleScopeVisible(
  scopeKey: ModuleScopeKey,
  context: ModuleVisibilityContext = {},
): boolean {
  return resolveModuleNavState(scopeKey, context).isVisible;
}

export function isModuleScopeNavigable(
  scopeKey: ModuleScopeKey,
  context: ModuleVisibilityContext = {},
): boolean {
  return resolveModuleNavState(scopeKey, context).isNavigable;
}
