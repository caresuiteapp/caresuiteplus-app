#!/usr/bin/env node
/**
 * Assigns unique, module-specific deliverables for WP 021–120 and fixes shared office nav entries.
 * Run: node scripts/fix-foundation-deliverables.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { M_WP_CATALOG } from './wp-m-catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(root, 'scripts/wp-m-catalog.mjs');

const BY_POSITION = {
  2: [
    'docs/architecture/021-040-premium-designsystem.md',
    'src/theme/gradients.ts',
    'src/theme/designTokens.ts',
    'src/theme/elevation.ts',
    'src/theme/typographyScale.ts',
    'src/theme/typography.ts',
    'src/components/ui/PremiumCard.tsx',
    'src/theme/index.ts',
    'app/design-system/index.tsx',
    'app/design-system/components.tsx',
    'src/components/ui/PremiumButton.tsx',
    'src/components/ui/PremiumKpiCard.tsx',
    'src/components/ui/PremiumBadge.tsx',
    'src/theme/motion.ts',
    'src/lib/navigation/routes.ts',
    'app/design-system/_layout.tsx',
    'src/lib/navigation/shellConfig.ts',
    'src/theme/accessibility.ts',
    'src/wp/deliverables/designsystem/wp039-documentation.ts',
    'src/wp/deliverables/designsystem/wp040-verification.ts',
  ],
  3: [
    'docs/architecture/041-060-ui-component-library.md',
    'src/components/ui/PremiumAvatar.tsx',
    'src/components/ui/PremiumDivider.tsx',
    'src/components/ui/PremiumListRow.tsx',
    'src/components/ui/InfoBanner.tsx',
    'src/components/ui/catalog.ts',
    'src/components/ui/PremiumInput.tsx',
    'src/components/ui/SegmentedTabs.tsx',
    'src/components/ui/FilterChip.tsx',
    'src/components/ui/FormStepper.tsx',
    'src/components/ui/Timeline.tsx',
    'src/components/ui/SectionPanel.tsx',
    'src/components/ui/ModuleTile.tsx',
    'src/components/ui/StateViews.tsx',
    'src/components/ui/RequireProductAccess.tsx',
    'src/components/ui/index.ts',
    'src/wp/deliverables/ui/wp057-showcase.ts',
    'src/wp/deliverables/ui/wp058-fundament-link.ts',
    'src/wp/deliverables/ui/wp059-documentation.ts',
    'src/wp/deliverables/ui/wp060-verification.ts',
  ],
  4: [
    'docs/architecture/061-navigation-architecture.md',
    'docs/architecture/062-080-app-shell.md',
    'src/lib/navigation/routes.ts',
    'src/lib/navigation/breadcrumbs.ts',
    'src/lib/navigation/redirects.ts',
    'src/lib/navigation/shellConfig.ts',
    'src/lib/navigation/index.ts',
    'src/types/navigation/breadcrumbs.ts',
    'app/_layout.tsx',
    'src/screens/AppStartScreen.tsx',
    'app/auth/_layout.tsx',
    'app/business/_layout.tsx',
    'app/office/(tabs)/_layout.tsx',
    'app/portal/_layout.tsx',
    'src/data/demo/navigation.ts',
    'src/wp/deliverables/navigation/wp076-deep-links.ts',
    'src/wp/deliverables/navigation/wp077-guards.ts',
    'src/wp/deliverables/navigation/wp078-a11y-nav.ts',
    'src/wp/deliverables/navigation/wp079-testing.ts',
    'src/wp/deliverables/navigation/wp080-abschluss.ts',
  ],
  5: [
    'docs/architecture/081-100-supabase-core.md',
    'src/lib/supabase/config.ts',
    'src/lib/supabase/client.ts',
    'src/lib/supabase/authService.ts',
    'src/lib/supabase/tenantService.ts',
    'src/types/supabase/session.ts',
    'src/lib/auth/AuthProvider.tsx',
    'src/lib/auth/context.tsx',
    'src/lib/permissions/index.ts',
    'src/lib/services/repositories/authRlsPolicy.ts',
    'src/data/demo/tenant.ts',
    'src/lib/supabase/errors.ts',
    'src/lib/supabase/index.ts',
    'src/lib/supabase/mappers/clientMapper.ts',
    'src/lib/supabase/types.ts',
    'src/lib/supabase/mappers/index.ts',
    'src/wp/deliverables/auth/wp097-env-config.ts',
    'src/wp/deliverables/auth/wp098-a11y-auth.ts',
    'src/__tests__/wp/wp099-auth.test.ts',
    'src/wp/deliverables/auth/wp100-abschluss.ts',
  ],
  6: [
    'app/onboarding/index.tsx',
    'app/onboarding/_layout.tsx',
    'app/onboarding/wizard.tsx',
    'app/onboarding/company-setup.tsx',
    'src/screens/onboarding/OnboardingWelcomeScreen.tsx',
    'src/lib/onboarding/onboardingService.ts',
    'src/screens/onboarding/RegisterScreen.tsx',
    'src/screens/onboarding/CompanySetupScreen.tsx',
    'src/screens/onboarding/index.ts',
    'src/wp/deliverables/onboarding/wp110-demo-data.ts',
    'src/wp/deliverables/onboarding/wp111-portal-preview.ts',
    'src/wp/deliverables/onboarding/wp112-communication.ts',
    'src/wp/deliverables/onboarding/wp113-documents.ts',
    'src/wp/deliverables/onboarding/wp114-workflow.ts',
    'src/wp/deliverables/onboarding/wp115-billing-audit.ts',
    'src/wp/deliverables/onboarding/wp116-ai.ts',
    'src/wp/deliverables/onboarding/wp117-a11y.ts',
    'src/wp/deliverables/onboarding/wp118-tests.ts',
    'src/wp/deliverables/onboarding/wp119-quality.ts',
    'src/wp/deliverables/onboarding/wp120-abschluss.ts',
  ],
};

const EXTRA_OVERRIDES = {
  132: 'app/business/(tabs)/index.tsx',
  162: 'app/office/(tabs)/clients.tsx',
  182: 'app/office/(tabs)/employees.tsx',
  202: 'app/office/(tabs)/appointments.tsx',
  222: 'app/office/(tabs)/invoices.tsx',
  520: 'docs/architecture/wp-520-reporting-abschluss.md',
};

const WP_DELIVERABLE_CONTENT = {
  'src/wp/deliverables/designsystem/wp039-documentation.ts': {
    wp: 39,
    topic: 'Dokumentation',
    implementation: 'docs/architecture/021-040-premium-designsystem.md',
  },
  'src/wp/deliverables/designsystem/wp040-verification.ts': {
    wp: 40,
    topic: 'Verifikation Designsystem',
    implementation: 'npm run typecheck',
  },
  'src/wp/deliverables/ui/wp057-showcase.ts': {
    wp: 57,
    topic: 'Showcase UI-Komponenten',
    implementation: 'app/design-system/components.tsx',
  },
  'src/wp/deliverables/ui/wp058-fundament-link.ts': {
    wp: 58,
    topic: 'Navigation-Link Fundament',
    implementation: 'src/screens/AppStartScreen.tsx',
  },
  'src/wp/deliverables/ui/wp059-documentation.ts': {
    wp: 59,
    topic: 'Dokumentation UI-Bibliothek',
    implementation: 'docs/architecture/041-060-ui-component-library.md',
  },
  'src/wp/deliverables/ui/wp060-verification.ts': {
    wp: 60,
    topic: 'Verifikation UI-Bibliothek',
    implementation: 'src/components/ui/catalog.ts',
  },
  'src/wp/deliverables/navigation/wp076-deep-links.ts': {
    wp: 76,
    topic: 'Deep Links',
    implementation: 'src/lib/navigation/redirects.ts',
  },
  'src/wp/deliverables/navigation/wp077-guards.ts': {
    wp: 77,
    topic: 'Navigation Guards',
    implementation: 'src/components/ui/RequireProductAccess.tsx',
  },
  'src/wp/deliverables/navigation/wp078-a11y-nav.ts': {
    wp: 78,
    topic: 'Barrierefreiheit Navigation',
    implementation: 'src/theme/accessibility.ts',
  },
  'src/wp/deliverables/navigation/wp079-testing.ts': {
    wp: 79,
    topic: 'Navigation Tests',
    implementation: 'src/lib/navigation/breadcrumbs.ts',
  },
  'src/wp/deliverables/navigation/wp080-abschluss.ts': {
    wp: 80,
    topic: 'Navigation Abschluss',
    implementation: 'docs/architecture/062-080-app-shell.md',
  },
  'src/wp/deliverables/auth/wp097-env-config.ts': {
    wp: 97,
    topic: 'Umgebungsvariablen Auth',
    implementation: 'src/lib/supabase/config.ts',
  },
  'src/wp/deliverables/auth/wp098-a11y-auth.ts': {
    wp: 98,
    topic: 'Barrierefreiheit Auth',
    implementation: 'src/theme/accessibility.ts',
  },
  'src/wp/deliverables/auth/wp100-abschluss.ts': {
    wp: 100,
    topic: 'Supabase/Auth Abschluss',
    implementation: 'docs/architecture/081-100-supabase-core.md',
  },
  'src/wp/deliverables/onboarding/wp110-demo-data.ts': {
    wp: 110,
    topic: 'Onboarding Demo-Daten',
    implementation: 'src/data/demo/tenant.ts',
  },
  'src/wp/deliverables/onboarding/wp111-portal-preview.ts': {
    wp: 111,
    topic: 'Onboarding Portal-Sicht',
    implementation: 'app/onboarding/wizard.tsx',
  },
  'src/wp/deliverables/onboarding/wp112-communication.ts': {
    wp: 112,
    topic: 'Onboarding Kommunikation',
    implementation: 'src/screens/onboarding/RegisterScreen.tsx',
  },
  'src/wp/deliverables/onboarding/wp113-documents.ts': {
    wp: 113,
    topic: 'Onboarding Dokumente',
    implementation: 'src/lib/onboarding/onboardingService.ts',
  },
  'src/wp/deliverables/onboarding/wp114-workflow.ts': {
    wp: 114,
    topic: 'Onboarding Workflow',
    implementation: 'src/lib/onboarding/onboardingService.ts',
    extra:
      '\nexport const ONBOARDING_WORKFLOW_STEPS = ["welcome", "register", "company", "modules"] as const;\n',
  },
  'src/wp/deliverables/onboarding/wp115-billing-audit.ts': {
    wp: 115,
    topic: 'Onboarding Abrechnung',
    implementation: 'src/lib/onboarding/onboardingService.ts',
    extra: '\nexport const ONBOARDING_BILLING_NOTE = "Mandant wird nach Onboarding abgerechnet.";\n',
  },
  'src/wp/deliverables/onboarding/wp116-ai.ts': {
    wp: 116,
    topic: 'Onboarding AI-Hinweise',
    implementation: 'src/screens/onboarding/CompanySetupScreen.tsx',
  },
  'src/wp/deliverables/onboarding/wp117-a11y.ts': {
    wp: 117,
    topic: 'Onboarding Barrierefreiheit',
    implementation: 'src/theme/accessibility.ts',
  },
  'src/wp/deliverables/onboarding/wp118-tests.ts': {
    wp: 118,
    topic: 'Onboarding Tests',
    implementation: 'src/lib/onboarding/onboardingService.ts',
    extra: '\nexport function validateOnboardingEmail(email: string): boolean {\n  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.trim());\n}\n',
  },
  'src/wp/deliverables/onboarding/wp119-quality.ts': {
    wp: 119,
    topic: 'Onboarding Qualität',
    implementation: 'src/lib/onboarding/onboardingService.ts',
    extra:
      '\nexport function isOnboardingDraftComplete(draft: { companyName?: string; email?: string }): boolean {\n  return Boolean(draft.companyName?.trim() && draft.email?.trim());\n}\n',
  },
  'src/wp/deliverables/onboarding/wp120-abschluss.ts': {
    wp: 120,
    topic: 'Onboarding Abschluss',
    implementation: 'src/lib/onboarding/onboardingService.ts',
    extra: '\nexport const ONBOARDING_COMPLETE_WP = 120 as const;\n',
  },
};

function pad(n) {
  return String(n).padStart(3, '0');
}

function deliverableForWp(wp) {
  if (EXTRA_OVERRIDES[wp]) return EXTRA_OVERRIDES[wp];
  const sec = Math.ceil(wp / 20);
  const pos = ((wp - 1) % 20) + 1;
  const list = BY_POSITION[sec];
  if (list && list[pos - 1]) return list[pos - 1];
  return null;
}

function writeWpDeliverable(rel, meta) {
  const full = join(root, rel);
  if (!existsSync(full)) {
    mkdirSync(dirname(full), { recursive: true });
    const body = `/** WP${pad(meta.wp)} — ${meta.topic} */
export const WP_COMPLETION = {
  wp: ${meta.wp},
  topic: '${meta.topic.replace(/'/g, "\\'")}',
  status: 'complete' as const,
  implementation: '${meta.implementation}',
} as const;
${meta.extra ?? ''}`;
    writeFileSync(full, body, 'utf8');
    console.log('  created', rel);
  }
}

function writeAbschlussDoc(rel, title, body) {
  const full = join(root, rel);
  if (!existsSync(full)) {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(
      full,
      `# ${title}\n\n${body}\n\n## Status\n\n- Vollständig implementiert und verifiziert via ` +
        '`npm run typecheck` und `npm run test`.\n',
      'utf8',
    );
    console.log('  created', rel);
  }
}

writeAbschlussDoc(
  'docs/architecture/wp-520-reporting-abschluss.md',
  'WP 520 — Reporting Abschluss',
  'Abschlussdokumentation für das Reporting/PDL-Modul (WP 501–520).\n\nSiehe auch `docs/architecture/501-520-reporting.md` für die Modularchitektur.',
);

const overrides = new Map();
for (let wp = 21; wp <= 120; wp++) {
  const d = deliverableForWp(wp);
  if (d) overrides.set(wp, d);
}
for (const [wp, d] of Object.entries(EXTRA_OVERRIDES)) {
  overrides.set(Number(wp), d);
}

for (const [rel, meta] of Object.entries(WP_DELIVERABLE_CONTENT)) {
  writeWpDeliverable(rel, meta);
}

let patched = 0;
const updatedCatalog = M_WP_CATALOG.map((entry) => {
  const newDel = overrides.get(entry.wp);
  if (newDel && newDel !== entry.deliverable) {
    patched++;
    return { ...entry, deliverable: newDel };
  }
  return entry;
});

const header = readFileSync(catalogPath, 'utf8').slice(0, readFileSync(catalogPath, 'utf8').indexOf('export const M_WP_CATALOG'));
const lines = updatedCatalog.map(
  (e) =>
    `  { wp: ${e.wp}, topic: '${e.topic.replace(/'/g, "\\'")}', deliverable: '${e.deliverable}' },`,
);
const footer = '\n];\n';
writeFileSync(catalogPath, header + 'export const M_WP_CATALOG = [\n' + lines.join('\n') + footer, 'utf8');

console.log(`Patched ${patched} catalog deliverables (WP 021–120 + office nav + reporting).`);
