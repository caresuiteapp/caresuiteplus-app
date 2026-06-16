import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { APP_START_ENTRIES } from '@/data/landing/appStartEntries';
import {
  ACTION_DISABLED_REASONS,
  getActionAvailability,
} from '@/lib/ui/actionAvailability';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function collectScreenSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      collectScreenSources(full, acc);
      continue;
    }
    if (!/\.(tsx?)$/.test(entry)) continue;
    acc.push(rel);
  }
  return acc;
}

const CRITICAL_SCREENS = [
  'src/screens/AppStartScreen.tsx',
  'src/screens/auth/BusinessLoginScreen.tsx',
  'src/screens/auth/EmployeePortalLoginScreen.tsx',
  'src/screens/auth/PortalCodeLoginScreen.tsx',
  'src/screens/auth/BusinessRegisterScreen.tsx',
  'src/screens/onboarding/RegisterScreen.tsx',
  'src/screens/BusinessDashboardScreen.tsx',
  'src/screens/pflege/ShiftScheduleListScreen.tsx',
  'src/screens/assist/AssignmentDetailScreen.tsx',
  'src/screens/assist/AssignmentExecutionScreen.tsx',
  'src/screens/assist/CareRecordDetailScreen.tsx',
  'src/screens/pflege/CareDocumentationDetailScreen.tsx',
  'src/screens/portal/EmployeePortalOverviewScreen.tsx',
  'src/screens/portal/ClientPortalProfileScreen.tsx',
  'src/screens/documents/DocumentTemplateEditorScreen.tsx',
  'src/screens/templates/TemplateCenterScreen.tsx',
  'src/screens/connect/ConnectIntegrationDetailScreen.tsx',
  'src/screens/qm/QmDashboardScreen.tsx',
  'src/screens/reporting/ExecutiveDashboardScreen.tsx',
  'src/screens/office/PersonalComplianceCockpitScreen.tsx',
];

const PRODUCTION_UI_GLOBS = ['src/screens', 'src/components'];
const DEAD_HANDLER_PATTERNS = [
  'onPress={() => undefined}',
  'onPress={() => {}}',
  'onClick={() => undefined}',
  'onClick={() => {}}',
];

function countButtonsInSource(source: string): number {
  const premiumButtons = (source.match(/<PremiumButton\b/g) ?? []).length;
  const portalCards = (source.match(/<PortalCard\b/g) ?? []).length;
  const pressables = (source.match(/onPress=\{/g) ?? []).length;
  return Math.max(premiumButtons + portalCards, pressables);
}

describe('Button & navigation audit (Prompt 109)', () => {
  it('1. start screen has no dead buttons', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    for (const pattern of DEAD_HANDLER_PATTERNS) {
      expect(start).not.toContain(pattern);
    }
    expect(start).toContain('router.push(entry.path');
    expect(APP_START_ENTRIES).toHaveLength(4);
    for (const entry of APP_START_ENTRIES) {
      expect(entry.path).toMatch(/^\//);
      expect(entry.path).not.toBe('');
    }
  });

  it('2. VoiceFlow start is not public on start screen', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).not.toContain('VoiceFlowPanel');
    expect(start).not.toContain('VoiceFlow starten');

    const voiceFlow = getActionAvailability('voiceFlow.start', { roleKey: null });
    expect(voiceFlow.visible).toBe(false);
    expect(voiceFlow.enabled).toBe(false);
  });

  it('3. preparedOnly actions have no active start buttons', () => {
    const prepared = getActionAvailability('module.start', { isPreparedOnly: true });
    expect(prepared.enabled).toBe(false);
    expect(prepared.disabledReason).toBe(ACTION_DISABLED_REASONS.prepared);

    const moduleCard = readSrc('src/components/modules/ModuleCard.tsx');
    expect(moduleCard).toContain('variant="prepared"');
    expect(moduleCard).not.toContain('onPress={() => undefined}');
  });

  it('4. comingSoon actions have no active start buttons', () => {
    const comingSoon = getActionAvailability('module.start', { isComingSoon: true });
    expect(comingSoon.enabled).toBe(false);
    expect(comingSoon.disabledReason).toBe(ACTION_DISABLED_REASONS.comingSoon);

    const qm = readSrc('src/screens/qm/QmDashboardScreen.tsx');
    expect(qm).toContain('preparedOnly={!area.liveReady}');
    expect(qm).toContain('area.liveReady ? () => router.push');
  });

  it('5. export without provider is disabled', () => {
    const blocked = getActionAvailability('export.data', { hasProvider: false });
    expect(blocked.enabled).toBe(false);
    expect(blocked.disabledReason).toBe(ACTION_DISABLED_REASONS.provider);

    const shift = readSrc('src/screens/pflege/ShiftScheduleListScreen.tsx');
    expect(shift).toContain("getActionAvailability('shift.import'");
    expect(shift).not.toContain('onPress={() => undefined}');
  });

  it('6. finalize without required data is blocked', () => {
    const blocked = getActionAvailability('document.finalize', { hasRequiredData: false });
    expect(blocked.enabled).toBe(false);
    expect(blocked.disabledReason).toBe(ACTION_DISABLED_REASONS.validation);

    const panel = readSrc('src/components/documents/DocumentPreviewValidationPanel.tsx');
    expect(panel).toContain("getActionAvailability('document.finalize'");
    expect(panel).toContain('finalizeAvailability.enabled ? onFinalize : undefined');
  });

  it('7. employee portal has no admin actions visible', () => {
    const admin = getActionAvailability('admin.action', { roleKey: 'employee_portal' });
    expect(admin.visible).toBe(false);
    expect(admin.enabled).toBe(false);
    expect(admin.disabledReason).toBe(ACTION_DISABLED_REASONS.role);
  });

  it('8. client portal has no internal actions visible', () => {
    const internal = getActionAvailability('internal.action', { roleKey: 'client_portal' });
    expect(internal.visible).toBe(false);
    expect(internal.enabled).toBe(false);
    expect(internal.disabledReason).toBe(ACTION_DISABLED_REASONS.role);
  });

  it('9. production UI has no fake action handlers', () => {
    const scanRoots = [
      'src/screens',
      'src/components',
    ];
    const offenders: string[] = [];

    for (const dir of scanRoots) {
      const sources = collectScreenSources(path.join(root, dir));
      for (const rel of sources) {
        if (rel.includes('__tests__') || rel.startsWith('app/design-system/')) continue;
        const source = readSrc(rel);
        for (const pattern of DEAD_HANDLER_PATTERNS) {
          if (source.includes(pattern)) offenders.push(`${rel}: ${pattern}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  }, 30_000);

  it('critical screens are audited for navigation wiring', () => {
    let buttonCount = 0;
    for (const screen of CRITICAL_SCREENS) {
      const source = readSrc(screen);
      buttonCount += countButtonsInSource(source);
      for (const pattern of DEAD_HANDLER_PATTERNS) {
        expect(source, `${screen} must not contain ${pattern}`).not.toContain(pattern);
      }
    }
    expect(buttonCount).toBeGreaterThan(40);
  });

  it('connect activate uses prepared variant without dead handler', () => {
    const connect = readSrc('src/screens/connect/ConnectIntegrationDetailScreen.tsx');
    expect(connect).toContain("getActionAvailability('connect.activate'");
    expect(connect).not.toContain('onPress={() => undefined}');
    expect(connect).toContain("variant={activateAvailability.isPreparedOnly ? 'prepared' : 'primary'}");
  });

  it('getActionAvailability is exported from ui barrel', () => {
    const barrel = readSrc('src/lib/ui/index.ts');
    expect(barrel).toContain('getActionAvailability');
  });
});
