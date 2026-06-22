import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  defaultDeveloperVisibility,
  defaultPublicVisibility,
  defaultRegisteringVisibility,
  FORBIDDEN_UI_TERMS,
  getUiVisibilityForRole,
  resolveVisibleLabel,
  sanitizeUiText,
  simplifyBreadcrumbTrailForMobile,
  userFriendlyLabel,
} from '@/lib/ui/uiVisibility';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function collectUiSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      collectUiSourceFiles(full, acc);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
    if (rel.includes('/__tests__/')) continue;
    if (rel.startsWith('src/lib/') && !rel.includes('/ui/')) continue;
    if (rel.startsWith('src/types/')) continue;
    if (rel.startsWith('src/data/')) continue;
    if (rel.startsWith('app/design-system/')) continue;
    acc.push(rel);
  }
  return acc;
}

const FORBIDDEN_IN_NORMAL_UI = [
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
  'feature flag',
  'feature_flag',
  'migration',
  'tenant_id',
  'user_id',
  'user_id',
  'role key',
  'module key',
  '__DEV__',
] as const;

const DEVELOPER_ONLY_PATHS = [
  'src/screens/admin/DeveloperHubScreen.tsx',
  'src/components/admin/DeveloperHubHero.tsx',
  'src/screens/FundamentScreen.tsx',
  'src/components/auth/AuthInfoCard.tsx',
];

const PUBLIC_UI_PATHS = [
  'src/screens/AppStartScreen.tsx',
  'src/screens/auth/BusinessLoginScreen.tsx',
  'src/screens/auth/ForgotPasswordScreen.tsx',
  'src/screens/auth/EmployeePortalLoginScreen.tsx',
  'src/screens/auth/PortalCodeLoginScreen.tsx',
  'src/screens/onboarding/RegisterScreen.tsx',
  'src/components/auth/AuthLoginHero.tsx',
  'src/components/auth/EmployeeFirstLoginHero.tsx',
];

const PORTAL_UI_PATHS = [
  'src/components/portal/PortalClientProfileHero.tsx',
  'src/components/portal/PortalEmployeeProfileHero.tsx',
  'src/components/portal/PortalAnnouncementsHero.tsx',
];

function extractStringLiterals(source: string): string[] {
  const literals: string[] = [];
  const patterns = [/label="([^"]+)"/g, /title="([^"]+)"/g, /message="([^"]+)"/g, /subtitle="([^"]+)"/g];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      literals.push(match[1]);
    }
  }
  return literals;
}

function hasForbiddenLiteral(literals: string[]): string | null {
  for (const literal of literals) {
    const sanitized = sanitizeUiText(literal);
    const lower = sanitized.toLowerCase();
    for (const term of FORBIDDEN_IN_NORMAL_UI) {
      if (lower.includes(term.toLowerCase())) {
        return `${literal} → ${sanitized} (contains ${term})`;
      }
    }
  }
  return null;
}

describe('Visibility audit — uiVisibility utility', () => {
  it('maps preparedOnly to German label for public users', () => {
    expect(userFriendlyLabel('preparedOnly')).toBe('Vorbereitet');
    expect(resolveVisibleLabel('preparedOnly Auth', defaultPublicVisibility())).toBeNull();
    expect(resolveVisibleLabel('preparedOnly', defaultRegisteringVisibility())).toBe('Vorbereitet');
  });

  it('allows technical terms in developer visibility', () => {
    const dev = defaultDeveloperVisibility();
    expect(dev.showDeveloperDiagnostics).toBe(true);
    expect(dev.allowForbiddenTerms).toBe(true);
    expect(resolveVisibleLabel('preparedOnly', dev)).toBe('preparedOnly');
  });

  it('sanitizes Supabase and Prototyp for normal UI', () => {
    expect(sanitizeUiText('Supabase Auth')).toBe('Sicherer Zugang');
    expect(sanitizeUiText('Demo-Prototyp')).toBe('Demo');
    expect(sanitizeUiText('Kein Store-Release')).toBe('In Entwicklung');
  });

  it('hides debug badges in production for normal roles', () => {
    const publicVis = getUiVisibilityForRole('public_user', 'production');
    expect(publicVis.showDebugBadges).toBe(false);
    expect(publicVis.showDeveloperDiagnostics).toBe(false);
  });

  it('simplifies mobile breadcrumbs to root + parent + current', () => {
    const trail = [
      { path: '/', label: 'Start' },
      { path: '/business', label: 'Business' },
      { path: '/business/office', label: 'Office' },
      { path: '/business/office/clients', label: 'Klient:innen' },
      { path: '/business/office/clients/abc', label: 'Detail', isCurrent: true },
    ];
    const mobile = simplifyBreadcrumbTrailForMobile(trail);
    expect(mobile).toHaveLength(3);
    expect(mobile[0]?.label).toBe('Start');
    expect(mobile[2]?.label).toBe('Detail');
  });
});

describe('Visibility audit — public auth screens', () => {
  for (const relPath of PUBLIC_UI_PATHS) {
    it(`${relPath} has no forbidden literals in display strings`, () => {
      const source = readSrc(relPath);
      const hit = hasForbiddenLiteral(extractStringLiterals(source));
      expect(hit, hit ?? undefined).toBeNull();
    });
  }

  it('Business login has no technical KPI status cards', () => {
    const hero = readSrc('src/components/auth/AuthLoginHero.tsx');
    const login = readSrc('src/screens/auth/BusinessLoginScreen.tsx');
    expect(hero).not.toContain('PremiumKpiCard');
    expect(hero).not.toContain('RLS');
    expect(hero).not.toContain('Supabase Auth');
    expect(login).not.toContain('PremiumKpiCard');
    expect(login).not.toContain('preparedOnly');
  });

  it('Registration uses friendly prepared notice not raw key', () => {
    const register = readSrc('src/screens/auth/BusinessRegisterScreen.tsx');
    expect(register).toContain('PremiumPreparedNotice');
    expect(register).not.toMatch(/label="preparedOnly"/);
  });
});

describe('Visibility audit — employee/client portals', () => {
  for (const relPath of PORTAL_UI_PATHS) {
    it(`${relPath} has no forbidden literals after sanitization path`, () => {
      const source = readSrc(relPath);
      const hit = hasForbiddenLiteral(extractStringLiterals(source));
      expect(hit, hit ?? undefined).toBeNull();
    });
  }
});

describe('Visibility audit — developer diagnosis area', () => {
  it('Developer hub may contain technical terms', () => {
    const hero = readSrc('src/components/admin/DeveloperHubHero.tsx');
    expect(hero).toContain('allowTechnical');
    expect(hero).toContain('__DEV__');
  });

  it('AuthInfoCard is gated by showDeveloperDiagnostics', () => {
    const card = readSrc('src/components/auth/AuthInfoCard.tsx');
    expect(card).toContain('showDeveloperDiagnostics');
    expect(card).toContain('Systemdiagnose');
  });
});

describe('Visibility audit — PremiumBadge and InfoBanner sanitization', () => {
  it('PremiumBadge sanitizes labels at render', () => {
    const badge = readSrc('src/components/ui/PremiumBadge.tsx');
    expect(badge).toContain('sanitizeUiText');
  });

  it('InfoBanner sanitizes title and message', () => {
    const banner = readSrc('src/components/ui/InfoBanner.tsx');
    expect(banner).toContain('sanitizeUiText');
  });
});

describe('Visibility audit — no duplicate register CTAs on start', () => {
  it('App start has no duplicate register CTAs', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    const registerMatches = (start.match(/Registrieren/g) ?? []).length;
    expect(registerMatches).toBeLessThanOrEqual(1);
  });
});

describe('Visibility audit — broad UI scan', () => {
  it('normal UI files do not expose raw forbidden terms in string literals', () => {
    const uiRoots = [
      path.join(root, 'src/components'),
      path.join(root, 'src/screens'),
      path.join(root, 'app'),
    ];
    const offenders: string[] = [];

    for (const uiRoot of uiRoots) {
      for (const rel of collectUiSourceFiles(uiRoot)) {
        if (DEVELOPER_ONLY_PATHS.some((p) => rel.endsWith(p.replace(/^src\//, '')) || rel === p)) {
          continue;
        }
        const hit = hasForbiddenLiteral(extractStringLiterals(readSrc(rel)));
        if (hit) offenders.push(`${rel}: ${hit}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('FORBIDDEN_UI_TERMS list covers audit terms', () => {
    for (const term of FORBIDDEN_IN_NORMAL_UI) {
      expect(FORBIDDEN_UI_TERMS.map((t) => t.toLowerCase())).toContain(term.toLowerCase());
    }
  });
});
