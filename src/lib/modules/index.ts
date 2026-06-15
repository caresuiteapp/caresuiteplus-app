export {
  ALL_PRODUCT_KEYS,
  OFFICE_MODULE_KEY,
  SPECIALTY_MODULE_KEYS,
  isPurchasedAccessSource,
  isSpecialtyModuleKey,
} from './constants';
export {
  ACCESS_SOURCE_LABELS,
  activateFreeModule,
  activatePurchasedModule,
  canAccessModule,
  deactivateModule,
  getEffectiveModuleAccess,
  getModuleAccessSource,
  getTenantModules,
  hasEffectiveModuleGateAccess,
  hasModuleAccess,
  hasOfficeBaseAccess,
  hydrateTenantModulesFromSupabase,
  initializeModuleAccessStore,
  resetModuleAccessStore,
  resolveIncludedModules,
} from './moduleAccessService';
export {
  calculateBillingItems,
  type BillingPreview,
  type BillingPreviewItem,
} from './moduleEntitlementService';
export {
  MODULE_VISIBILITY_CATALOG,
  MODULE_VISIBILITY_STATUS_LABELS,
  getCatalogEntry,
  isProductScopeKey,
} from './moduleVisibilityConfig';
export {
  resolveModuleNavState,
  resolveModuleScopeFromPath,
  isModuleScopeVisible,
  isModuleScopeNavigable,
} from './moduleVisibilityService';
