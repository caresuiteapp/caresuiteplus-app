import type { BreadcrumbTrail } from '@/types/navigation/breadcrumbs';
import type { RoleKey } from '@/types';
import {
  UI_AUTH_PREPARED_LABEL,
  UI_PREPARED_LABEL,
  UI_PROTOTYPE_LABEL,
  UI_TENANT_LABEL,
} from '@/design/tokens/uiStatusLabels';
import { canAccessDeveloperTools } from '@/lib/auth/devAccess';
import {
  getMode,
  isProduction as isProductionMode,
} from '@/lib/environment/environmentModeService';
import type { EnvironmentMode } from '@/types/environment';
import { isDemoMode } from '@/lib/supabase/config';

export type UiUserRole =
  | 'public_user'
  | 'registering_user'
  | 'employee_portal'
  | 'client_portal'
  | 'business_user'
  | 'business_admin'
  | 'developer';

export type UiEnvironment = 'demo' | 'production' | 'pilot' | 'sandbox' | 'internal_test';

export type UiFeatureStatus = 'preparedOnly' | 'coming_soon' | 'internal' | 'beta' | 'demoMode';

export type UiVisibility = {
  showDeveloperDiagnostics: boolean;
  showDebugBadges: boolean;
  showDemoModeBanner: boolean;
  showPreparedBadges: boolean;
  showRlsInfo: boolean;
  showPrototypeInfo: boolean;
  showTechnicalSubtitles: boolean;
  allowForbiddenTerms: boolean;
};

/** Forbidden terms that must not appear in normal-user UI (audit + sanitization). */
export const FORBIDDEN_UI_TERMS = [
  'preparedOnly',
  'prepared_only',
  'RLS',
  'Supabase',
  'Prototyp',
  'Prototype',
  'Kein Store-Release',
  'debug',
  'Debug',
  'mock',
  'Mock',
  'demo tenant',
  'feature flag',
  'feature_flag',
  'migration',
  'database',
  'auth provider',
  'sandbox',
  'tenant id',
  'tenant_id',
  'user id',
  'user_id',
  'role key',
  'module key',
  'Free Platform',
  'free platform',
  'INTAKE_NEW_ROUTE',
  'CLIENT_INTAKE_NEW_ROUTE',
] as const;

const FRIENDLY_LABELS: Record<string, string> = {
  preparedOnly: UI_PREPARED_LABEL,
  'preparedOnly Auth': UI_AUTH_PREPARED_LABEL,
  prepared_only: UI_PREPARED_LABEL,
  'Demo / preparedOnly': 'Demo',
  'Provider preparedOnly': 'Provider in Vorbereitung',
  'Portal preparedOnly': 'In Vorbereitung',
  'Buchhaltung preparedOnly': 'Buchhaltung in Vorbereitung',
  coming_soon: 'Demnächst',
  comingSoon: 'Demnächst',
  internal: 'Intern',
  beta: 'Beta',
  disabled: 'Nicht aktiv',
  active: 'Aktiv',
  live: 'Aktiv',
  error: 'Fehler',
  warning: 'Hinweis',
  required: 'Erforderlich',
  demoMode: 'Demo-Modus',
  RLS: 'Mandantentrennung',
  Supabase: 'Cloud-Anbindung',
  'Supabase Auth': 'Sicherer Zugang',
  Prototyp: UI_PROTOTYPE_LABEL,
  'Kein Store-Release': 'In Entwicklung',
  'Demo-Prototyp': 'Demo',
  Mandant: UI_TENANT_LABEL,
};

const LABEL_REPLACEMENTS: [RegExp, string][] = [
  [/demo\s*\/\s*preparedonly/gi, 'Demo'],
  [/preparedonly\s*auth/gi, UI_AUTH_PREPARED_LABEL],
  [/provider\s+preparedonly/gi, 'Provider in Vorbereitung'],
  [/portal\s+preparedonly/gi, 'In Vorbereitung'],
  [/buchhaltung\s+preparedonly/gi, 'Buchhaltung in Vorbereitung'],
  [/connect\s*·\s*preparedonly/gi, 'Connect in Vorbereitung'],
  [/inventar\s+preparedonly/gi, 'Inventar in Vorbereitung'],
  [/qm\s+preparedonly/gi, 'QM in Vorbereitung'],
  [/ti\s+preparedonly/gi, 'TI in Vorbereitung'],
  [/integration\s+preparedonly/gi, 'Integration in Vorbereitung'],
  [/demo-prototyp/gi, 'Demo'],
  [/kein\s+supabase/gi, 'Beispieldaten'],
  [/kein\s+store-release/gi, 'In Entwicklung'],
  [/supabase\s+auth/gi, 'Sicherer Zugang'],
  [/supabase\s+nicht\s+verbunden/gi, 'Offline-Demo'],
  [/an\s+supabase\s+übermittelt/gi, 'gespeichert'],
  [/supabase\s+storage/gi, 'Dokumentenspeicher'],
  [/supabase/gi, 'Cloud'],
  [/\brls\b/gi, 'Mandantentrennung'],
  [/preparedonly/gi, UI_PREPARED_LABEL],
  [/intake_new_route[^\s]*/gi, ''],
  [/\bexport_status\s*:/gi, 'Exportstatus:'],
  [/\bexport_version\s*:/gi, 'Exportversion:'],
  [/\bchanged_after_export\s*:/gi, 'Nach Export geändert:'],
  [/\b[a-z_]+_route\b is not (defined|a valid|supported)[^\n.]*/gi, 'Die Aktion konnte nicht ausgeführt werden.'],
  [/prototyp/gi, 'Vorschau'],
  [/__dev__/gi, 'Entwicklung'],
];

export const PREPARED_UI_LABEL = UI_PREPARED_LABEL;
export const DEMO_UI_LABEL = 'Demo';
export const IN_PREPARATION_LABEL = 'In Vorbereitung';

const PREPARED_LABEL_KEYS = new Set([
  'preparedOnly',
  'prepared_only',
  'preparedOnly Auth',
  'Demo / preparedOnly',
  'Provider preparedOnly',
  'Portal preparedOnly',
  'Buchhaltung preparedOnly',
]);

export function isTechnicalUiTerm(term: string): boolean {
  const lower = term.toLowerCase();
  return FORBIDDEN_UI_TERMS.some((forbidden) => lower.includes(forbidden.toLowerCase()));
}

export function userFriendlyLabel(raw: string): string {
  if (!raw) return raw;
  if (FRIENDLY_LABELS[raw]) return FRIENDLY_LABELS[raw];
  return sanitizeUiText(raw);
}

export function resolveVisibleLabel(raw: string, visibility: UiVisibility): string | null {
  const friendly = userFriendlyLabel(raw);
  const isPrepared = PREPARED_LABEL_KEYS.has(raw) || /preparedonly/i.test(raw);

  if (isPrepared && !visibility.showPreparedBadges) return null;
  if (visibility.allowForbiddenTerms) return raw;
  if (isTechnicalUiTerm(friendly) && !visibility.showTechnicalSubtitles) return null;

  return friendly;
}

export function mapEnvironmentModeToUi(mode: EnvironmentMode): UiEnvironment {
  return mode;
}

export function resolveUiEnvironment(): UiEnvironment {
  return mapEnvironmentModeToUi(getMode());
}

export function isNormalUiRole(role: UiUserRole): boolean {
  return role === 'public_user' || role === 'employee_portal' || role === 'client_portal';
}

export function isInternalUiRole(role: UiUserRole): boolean {
  return role === 'business_user' || role === 'registering_user';
}

export function isAdminUiRole(role: UiUserRole): boolean {
  return role === 'business_admin' || role === 'developer';
}

function baseVisibility(partial: Partial<UiVisibility>): UiVisibility {
  return {
    showDeveloperDiagnostics: false,
    showDebugBadges: false,
    showDemoModeBanner: false,
    showPreparedBadges: false,
    showRlsInfo: false,
    showPrototypeInfo: false,
    showTechnicalSubtitles: false,
    allowForbiddenTerms: false,
    ...partial,
  };
}

export function getUiVisibilityForRole(
  role: UiUserRole = 'public_user',
  environment: UiEnvironment = resolveUiEnvironment(),
): UiVisibility {
  const production = environment === 'production' || isProductionMode();
  const demo = environment === 'demo' || isDemoMode();
  const isDeveloper = role === 'developer' || isAdminUiRole(role);
  const isRegistering = role === 'registering_user';

  if (isDeveloper) {
    return baseVisibility({
      showDeveloperDiagnostics: true,
      showDebugBadges: !production,
      showDemoModeBanner: demo,
      showPreparedBadges: true,
      showRlsInfo: true,
      showPrototypeInfo: !production,
      showTechnicalSubtitles: true,
      allowForbiddenTerms: true,
    });
  }

  if (isRegistering) {
    return baseVisibility({
      showDemoModeBanner: demo,
      showPreparedBadges: true,
      showTechnicalSubtitles: false,
    });
  }

  if (isInternalUiRole(role)) {
    return baseVisibility({
      showDemoModeBanner: demo,
      showPreparedBadges: false,
    });
  }

  return baseVisibility({
    showDemoModeBanner: demo && !production,
  });
}

export function getUiVisibilityForWorkspaceRole(roleKey?: RoleKey | null): UiVisibility {
  if (!roleKey) return defaultPublicVisibility();
  if (canAccessDeveloperTools(roleKey)) {
    return getUiVisibilityForRole('developer');
  }
  if (roleKey === 'employee_portal') return getUiVisibilityForRole('employee_portal');
  if (roleKey === 'client_portal') return getUiVisibilityForRole('client_portal');
  return getUiVisibilityForRole('business_user');
}

export function defaultPublicVisibility(): UiVisibility {
  return getUiVisibilityForRole('public_user');
}

export function defaultRegisteringVisibility(): UiVisibility {
  return getUiVisibilityForRole('registering_user');
}

export function defaultDeveloperVisibility(): UiVisibility {
  return getUiVisibilityForRole('developer');
}

export function shouldShowDebugBadges(roleKey?: RoleKey | null): boolean {
  return getUiVisibilityForWorkspaceRole(roleKey).showDebugBadges;
}

export function shouldShowDemoHints(): boolean {
  return isDemoMode();
}

type SanitizeOptions = {
  allowTechnical?: boolean;
};

/** Snake_case identifiers (table/column keys) must not appear in user-facing UI. */
const SNAKE_CASE_IDENTIFIER = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi;

export function containsSnakeCaseIdentifier(text: string): boolean {
  return /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/i.test(text);
}

/** Returns sanitized subtitle or undefined when nothing user-facing remains. */
export function resolveUserFacingSubtitle(subtitle?: string | null): string | undefined {
  if (!subtitle?.trim()) return undefined;
  const sanitized = sanitizeUiText(subtitle).trim();
  if (!sanitized || containsSnakeCaseIdentifier(sanitized)) return undefined;
  return sanitized;
}

/** Maps internal/dev strings to German user-facing labels. */
export function sanitizeUiText(text: string, options?: SanitizeOptions): string {
  if (!text) return text;
  if (options?.allowTechnical) return text;

  let result = text;
  for (const [pattern, replacement] of LABEL_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  result = result.replace(SNAKE_CASE_IDENTIFIER, '');
  result = result.replace(/\bWP\s*\d+\b/gi, '');
  result = result.replace(/\b[a-z]+_admin\b/gi, 'Geschäftsführung');
  result = result.replace(/\bchanged_after_export\b/gi, 'nach Export geändert');
  result = result.replace(/\bexternal_transfer\s*=\s*true\b/gi, 'ohne externe Übertragung');
  result = result.replace(/\s*\/\s*/g, ' ');
  result = result.replace(/\s{2,}/g, ' ').trim();
  result = result.replace(/^[\s·—-]+|[\s·—-]+$/g, '').trim();
  return result;
}

/** Returns true if text still contains forbidden terms after sanitization. */
export function containsForbiddenUiTerm(text: string): boolean {
  const lower = sanitizeUiText(text).toLowerCase();
  return FORBIDDEN_UI_TERMS.some((term) => lower.includes(term.toLowerCase()));
}

/** Maps technical/dev errors to tenant-safe German messages. */
export function sanitizeUserFacingError(error: string | null | undefined): string {
  if (!error?.trim()) {
    return 'Die Aktion konnte nicht ausgeführt werden.';
  }

  const sanitized = sanitizeUiText(error).trim();
  if (
    !sanitized ||
    containsForbiddenUiTerm(error) ||
    /is not (defined|a valid|supported)/i.test(error) ||
    /intake_new_route/i.test(error)
  ) {
    return 'Die Aktion konnte nicht ausgeführt werden. Bitte versuchen Sie es erneut.';
  }

  return sanitized;
}

/** Mobile: show at most root + parent + current crumb to reduce path noise. */
export function simplifyBreadcrumbTrailForMobile(trail: BreadcrumbTrail): BreadcrumbTrail {
  if (trail.length <= 3) return trail;
  return [trail[0], trail[trail.length - 2], trail[trail.length - 1]];
}
