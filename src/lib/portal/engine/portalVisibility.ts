import type {
  PortalActorRole,
  PortalFeature,
  PortalModuleKey,
  PortalVisibilityRule,
} from '@/lib/portal/types';
import { getFeaturesForModules } from './portalFeatureMatrix';

/** Default visibility when no tenant rules exist — all module features visible. */
export function filterVisibleFeatures(
  modules: PortalModuleKey[],
  portalRole: PortalActorRole,
  rules: PortalVisibilityRule[] = [],
): PortalFeature[] {
  const candidates = getFeaturesForModules(modules);
  if (rules.length === 0) return candidates;

  const ruleIndex = new Map<string, PortalVisibilityRule>();
  for (const rule of rules) {
    if (rule.portalRole !== portalRole) continue;
    ruleIndex.set(`${rule.moduleKey}:${rule.featureKey}`, rule);
  }

  return candidates.filter((feature) => {
    const rule = ruleIndex.get(`${feature.moduleKey}:${feature.featureKey}`);
    if (!rule) return true;
    return rule.isVisible;
  });
}

export function isFeatureVisible(
  moduleKey: PortalModuleKey,
  featureKey: string,
  portalRole: PortalActorRole,
  rules: PortalVisibilityRule[] = [],
): boolean {
  const rule = rules.find(
    (r) =>
      r.moduleKey === moduleKey &&
      r.featureKey === featureKey &&
      r.portalRole === portalRole,
  );
  if (!rule) return true;
  return rule.isVisible;
}

export function resolvePortalActorRole(roleKey: string | null): PortalActorRole {
  switch (roleKey) {
    case 'family_portal':
      return 'relative';
    case 'client_portal':
    default:
      return 'client';
  }
}
