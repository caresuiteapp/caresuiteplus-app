import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());

describe('adaptive shell wiring', () => {
  it('ShellLayout delegiert an CareAdaptiveShell', () => {
    const src = readFileSync(join(root, 'src/components/layout/ShellLayout.tsx'), 'utf8');
    expect(src).toContain('CareAdaptiveShell');
    expect(src).not.toMatch(/ResponsiveLayout/);
  });

  it('ResponsiveLayout ist Alias für CareAdaptiveShell', () => {
    const src = readFileSync(join(root, 'src/components/layout/ResponsiveLayout.tsx'), 'utf8');
    expect(src).toContain('CareAdaptiveShell');
  });

  it('CareAdaptiveShell nutzt CompactPlatformShell unter Desktop-Breakpoint', () => {
    const src = readFileSync(join(root, 'src/components/layout/CareAdaptiveShell.tsx'), 'utf8');
    expect(src).toContain('CareDesktopShell');
    expect(src).toContain('CompactPlatformShell');
    expect(src).toContain('isDesktopOrWide');
    expect(src).not.toContain('CareWebShell');
    expect(src).not.toContain('CareTabletShell');
  });

  it('Insight-Layout nutzt CareAdaptiveShell via ShellLayout', () => {
    const src = readFileSync(join(root, 'app/insight/_layout.tsx'), 'utf8');
    expect(src).toContain('ShellLayout');
  });

  it('Assist-Layout nutzt CareAdaptiveShell via ShellLayout', () => {
    const src = readFileSync(join(root, 'app/assist/_layout.tsx'), 'utf8');
    expect(src).toContain('ShellLayout');
    expect(src).toContain('area="assist"');
  });

  it('Akademie-Layout nutzt CareAdaptiveShell via ShellLayout', () => {
    const src = readFileSync(join(root, 'app/akademie/_layout.tsx'), 'utf8');
    expect(src).toContain('ShellLayout');
    expect(src).toContain('area="akademie"');
  });

  it('QM-Layout nutzt Auth-gated Stack ohne ShellLayout (Office-Unterroute)', () => {
    const src = readFileSync(join(root, 'app/business/office/qm/_layout.tsx'), 'utf8');
    expect(src).toContain('RequireAuth');
    expect(src).not.toContain('ShellLayout');
  });
});

describe('ThemeModeProvider', () => {
  it('existiert mit Persistenz und Toggle-Hook', () => {
    const src = readFileSync(join(root, 'src/design/ThemeModeProvider.tsx'), 'utf8');
    expect(src).toContain('ThemeModeProvider');
    expect(src).toContain('useThemeMode');
    expect(src).toContain('AsyncStorage');
    expect(src).toContain('isPartialLightMode');
  });
});

describe('PlanPilotPanel wiring', () => {
  it('AdaptiveModuleDashboard bindet PlanPilotPanel ein', () => {
    const src = readFileSync(
      join(root, 'src/components/adaptive/AdaptiveModuleDashboard.tsx'),
      'utf8',
    );
    expect(src).toContain('PlanPilotPanel');
    expect(src).toContain('planPilotRoutes');
  });
});

describe('Office desktop action bars', () => {
  const listViews = [
    'ClientsListView.tsx',
    'EmployeesListView.tsx',
    'DocumentsListView.tsx',
    'InvoicesListView.tsx',
    'AppointmentsListView.tsx',
    'OfficeMessagesListView.tsx',
  ];

  for (const file of listViews) {
    it(`${file} nutzt AdaptiveActionBar`, () => {
      const path = join(root, `src/components/office/${file}`);
      expect(existsSync(path)).toBe(true);
      const src = readFileSync(path, 'utf8');
      expect(src).toContain('AdaptiveActionBar');
    });
  }
});

describe('Premium theme bridge adoption', () => {
  const themedComponents = [
    'src/components/ui/SectionPanel.tsx',
    'src/components/ui/PremiumKpiCard.tsx',
    'src/components/layout/ScreenShell.tsx',
    'src/components/adaptive/AdaptiveActionBar.tsx',
    'src/components/brand/PlanPilotPanel.tsx',
    'src/components/brand/CareBotCard.tsx',
    'src/components/brand/VoiceFlowPanel.tsx',
  ];

  for (const rel of themedComponents) {
    it(`${rel} nutzt useLegacyTheme`, () => {
      const src = readFileSync(join(root, rel), 'utf8');
      expect(src).toContain('useLegacyTheme');
    });
  }
});
