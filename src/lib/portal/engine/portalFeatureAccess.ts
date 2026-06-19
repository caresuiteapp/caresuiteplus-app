import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import type {
  PortalContext,
  PortalFeature,
  PortalModuleKey,
  PortalVisibilityRule,
} from '@/lib/portal/types';
import type { PortalBudgetType } from '@/types/portal/assist';
import { isFeatureVisible } from './portalVisibility';

export type PortalClientCareProfile = {
  careContexts: ClientCareContext[];
  configuredBudgetTypes: PortalBudgetType[];
  hasBudgetSnapshot: boolean;
};

export const EMPTY_PORTAL_CARE_PROFILE: PortalClientCareProfile = {
  careContexts: [],
  configuredBudgetTypes: [],
  hasBudgetSnapshot: false,
};

/** Assist overview deep-link sections → feature keys in portal_feature_matrix. */
export const ASSIST_PORTAL_SECTIONS: Record<string, string> = {
  betreuung: 'betreuung',
  begleitungen: 'trips',
  budget: 'budget',
  nachweise: 'nachweise',
  aktivitaeten: 'aktivitaeten',
  anfragen: 'anfragen',
  hilfe: 'hilfe',
};

/** Assist overview sections that open glass modals instead of full-page views. */
export const ASSIST_PORTAL_MODAL_SECTIONS = new Set(['anfragen', 'aktivitaeten']);

export function contextHasActiveModule(
  context: Pick<PortalContext, 'activeModuleKeys'>,
  moduleKey: PortalModuleKey,
): boolean {
  return context.activeModuleKeys.includes(moduleKey);
}

export function isFeatureInVisibleList(
  visibleFeatures: PortalFeature[],
  moduleKey: PortalModuleKey,
  featureKey: string,
): boolean {
  return visibleFeatures.some(
    (feature) => feature.moduleKey === moduleKey && feature.featureKey === featureKey,
  );
}

export function resolveBudgetVisibilityRule(
  portalRole: PortalContext['portalRole'],
  rules: PortalVisibilityRule[],
): PortalVisibilityRule | undefined {
  return rules.find(
    (rule) =>
      rule.moduleKey === 'assist' &&
      rule.featureKey === 'budget' &&
      rule.portalRole === portalRole,
  );
}

/** Budget tab/KPI only when assist is active and client data or office release applies. */
export function isPortalBudgetFeatureEnabled(input: {
  activeModuleKeys: PortalModuleKey[];
  portalRole: PortalContext['portalRole'];
  visibilityRules: PortalVisibilityRule[];
  careProfile: PortalClientCareProfile;
  baseVisibleFeatures: PortalFeature[];
}): boolean {
  if (!input.activeModuleKeys.includes('assist')) return false;
  if (!isFeatureInVisibleList(input.baseVisibleFeatures, 'assist', 'budget')) return false;

  const budgetRule = resolveBudgetVisibilityRule(input.portalRole, input.visibilityRules);
  if (budgetRule?.isVisible === false) return false;
  if (budgetRule?.isVisible === true) return true;

  if (input.careProfile.hasBudgetSnapshot) return true;
  if (input.careProfile.configuredBudgetTypes.length > 0) return true;

  return false;
}

export function applyPortalFeatureGates(input: {
  activeModuleKeys: PortalModuleKey[];
  portalRole: PortalContext['portalRole'];
  visibilityRules: PortalVisibilityRule[];
  careProfile: PortalClientCareProfile;
  baseVisibleFeatures: PortalFeature[];
}): PortalFeature[] {
  return input.baseVisibleFeatures.filter((feature) => {
    if (feature.moduleKey === 'assist' && feature.featureKey === 'budget') {
      return isPortalBudgetFeatureEnabled(input);
    }
    return true;
  });
}

export function canAccessPortalFeature(
  context: Pick<
    PortalContext,
    'activeModuleKeys' | 'visibleFeatures' | 'portalRole' | 'visibilityRules' | 'careProfile'
  >,
  moduleKey: PortalModuleKey,
  featureKey: string,
): boolean {
  if (!contextHasActiveModule(context, moduleKey)) return false;
  if (!isFeatureInVisibleList(context.visibleFeatures, moduleKey, featureKey)) return false;
  return isFeatureVisible(
    moduleKey,
    featureKey,
    context.portalRole,
    context.visibilityRules,
  );
}

export function resolveApplicablePortalBudgetTypes(
  careProfile: PortalClientCareProfile,
): PortalBudgetType[] {
  if (careProfile.configuredBudgetTypes.length > 0) {
    return careProfile.configuredBudgetTypes;
  }
  if (careProfile.hasBudgetSnapshot) {
    return ['paragraph_45b'];
  }
  return [];
}
