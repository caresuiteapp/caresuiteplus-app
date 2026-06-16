import type { EnvironmentMode, EnvironmentModeRecord } from '@/types/environment';

export const ENVIRONMENT_MODE_LABELS: Record<EnvironmentMode, string> = {
  demo: 'Demo',
  sandbox: 'Sandbox',
  pilot: 'Pilot',
  internal_test: 'Interner Test',
  production: 'Produktion',
};

export const ENVIRONMENT_MODE_RULES: Record<
  EnvironmentMode,
  Pick<
    EnvironmentModeRecord,
    'allowsRealData' | 'allowsMockProviders' | 'allowsDemoFallback' | 'requiresBanner'
  >
> = {
  demo: {
    allowsRealData: false,
    allowsMockProviders: true,
    allowsDemoFallback: true,
    requiresBanner: true,
  },
  sandbox: {
    allowsRealData: false,
    allowsMockProviders: true,
    allowsDemoFallback: false,
    requiresBanner: true,
  },
  pilot: {
    allowsRealData: true,
    allowsMockProviders: false,
    allowsDemoFallback: false,
    requiresBanner: true,
  },
  internal_test: {
    allowsRealData: false,
    allowsMockProviders: true,
    allowsDemoFallback: false,
    requiresBanner: true,
  },
  production: {
    allowsRealData: true,
    allowsMockProviders: false,
    allowsDemoFallback: false,
    requiresBanner: false,
  },
};

export const ENVIRONMENT_MODES: EnvironmentModeRecord[] = (
  Object.keys(ENVIRONMENT_MODE_LABELS) as EnvironmentMode[]
).map((modeKey, index) => ({
  id: `env-mode-${index + 1}`,
  modeKey,
  label: ENVIRONMENT_MODE_LABELS[modeKey],
  description:
    modeKey === 'demo'
      ? 'Nur synthetische Demo-Daten, keine echten Anbieter.'
      : modeKey === 'sandbox'
        ? 'Provider-Sandbox und Testdaten — nicht als Produktion darstellen.'
        : modeKey === 'pilot'
          ? 'Begrenzter Rollout mit echten Daten und sichtbaren Risiken.'
          : modeKey === 'internal_test'
            ? 'Interne Tests ohne Vermischung mit Live-Daten.'
            : 'Produktivbetrieb ohne Demo-Fallbacks und Mock-Anbieter.',
  ...ENVIRONMENT_MODE_RULES[modeKey],
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}));

export function isValidEnvironmentMode(value: string | null | undefined): value is EnvironmentMode {
  return (
    value === 'demo' ||
    value === 'sandbox' ||
    value === 'pilot' ||
    value === 'internal_test' ||
    value === 'production'
  );
}
