import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_START_ENTRIES } from '@/data/landing/appStartEntries';
import { fetchAppStartSnapshot } from '@/lib/landing/appStartService';
import { resolveVoiceFlowVisibility } from '@/lib/ui/voiceFlowVisibility';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const START_FORBIDDEN = [
  'VoiceFlow',
  'VoiceFlow starten',
  'VoiceFlowPanel',
  'CareBotCard',
  'CareBot',
  'KI-Sprachassistenz',
  'Spracheingabe',
  'preparedOnly',
  'ModuleTile',
  'PUBLIC_ENTRIES',
  'Technisches Fundament',
  'RLS',
  'Supabase',
  'Prototyp',
  'Debug',
];

const SPECIALTY_CARD_NEEDLES = [
  'PlanPilotPanel',
  'ModuleTile',
  'CareLightModuleTile',
  'AuthInfoCard',
  'PremiumKpiCard',
  'Demo mit Beispieldaten',
];

describe('Start page cleanup (Prompt 108)', () => {
  it('public start has no VoiceFlow references', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    for (const needle of START_FORBIDDEN) {
      expect(start).not.toContain(needle);
    }
  });

  it('public start has no specialty feature cards', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    for (const needle of SPECIALTY_CARD_NEEDLES) {
      expect(start).not.toContain(needle);
    }
  });

  it('defines exactly four main portal actions', () => {
    expect(APP_START_ENTRIES).toHaveLength(4);
    expect(APP_START_ENTRIES.map((entry) => entry.label)).toEqual([
      'Unternehmen / Verwaltung',
      'Mitarbeiterportal',
      'Klient:innen / Angehörige',
      'Neues Unternehmen registrieren',
    ]);
  });

  it('fetchAppStartSnapshot returns four cards without demo path', async () => {
    const snapshot = await fetchAppStartSnapshot();
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(snapshot.data).toHaveLength(4);
      expect(snapshot.data.some((entry) => entry.path.includes('demo'))).toBe(false);
    }
  });

  it('VoiceFlow is hidden for public_user (unauthenticated)', () => {
    const visibility = resolveVoiceFlowVisibility({
      isAuthenticated: false,
      roleKey: null,
      assignmentId: 'a-1',
      documentationAllowed: true,
    });
    expect(visibility.showPanel).toBe(false);
    expect(visibility.showStartButton).toBe(false);
  });

  it('VoiceFlow is hidden for client portal roles', () => {
    for (const roleKey of ['client_portal', 'family_portal'] as const) {
      const visibility = resolveVoiceFlowVisibility({
        isAuthenticated: true,
        roleKey,
        assignmentId: 'a-1',
        documentationAllowed: true,
      });
      expect(visibility.showPanel).toBe(false);
      expect(visibility.showStartButton).toBe(false);
    }
  });

  it('VoiceFlow is hidden for employee without assignment context', () => {
    const visibility = resolveVoiceFlowVisibility({
      isAuthenticated: true,
      roleKey: 'employee_portal',
      assignmentId: null,
      documentationAllowed: true,
    });
    expect(visibility.showPanel).toBe(false);
    expect(visibility.showStartButton).toBe(false);
  });

  it('VoiceFlow appears in assignment documentation context when feature is active', () => {
    const visibility = resolveVoiceFlowVisibility({
      isAuthenticated: true,
      roleKey: 'caregiver',
      assignmentId: 'a-1',
      tenantId: 'tenant-a',
      sessionTenantId: 'tenant-a',
      documentationAllowed: true,
      featureStatus: 'beta',
    });
    expect(visibility.showPanel).toBe(true);
    expect(visibility.showStartButton).toBe(true);
  });

  it('preparedOnly VoiceFlow shows panel without Start button', () => {
    const visibility = resolveVoiceFlowVisibility({
      isAuthenticated: true,
      roleKey: 'nurse',
      assignmentId: 'a-1',
      tenantId: 'tenant-a',
      sessionTenantId: 'tenant-a',
      documentationAllowed: true,
      featureStatus: 'preparedOnly',
    });
    expect(visibility.showPanel).toBe(true);
    expect(visibility.showStartButton).toBe(false);
  });

  it('all start PortalCard actions navigate via router.push', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('router.push(entry.path');
    expect(start).not.toMatch(/onPress=\{\(\)\s*=>\s*\{\s*\}\}/);
    expect(start).not.toContain('console.log');
    expect(start).not.toContain('TODO');
  });

  it('footer links use real navigation or external URLs', () => {
    const footer = readSrc('src/design/components/FooterLinks.tsx');
    expect(footer).toContain('router.push(DEMO_START_PATH');
    expect(footer).toContain('SUPPORT_LINKS');
    expect(footer).toContain('Demo ansehen');
    expect(footer).toContain('Hilfe & Support');
    expect(footer).toContain('Nutzungsbedingungen');
    expect(footer).toContain('Version');
    expect(footer).not.toMatch(/onPress=\{\(\)\s*=>\s*\{\s*\}\}/);
  });

  it('production start page has no preparedOnly demo cards', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    const entries = readSrc('src/data/landing/appStartEntries.ts');
    expect(start).not.toContain('preparedOnly');
    expect(entries).not.toContain('Demo mit Beispieldaten');
    expect(entries).not.toContain("path: DEMO_START_PATH");
  });

  it('VoiceFlow remains gated in assignment execution documentation only', () => {
    const execution = readSrc('src/screens/assist/AssignmentExecutionScreen.tsx');
    const detail = readSrc('src/screens/portal/PortalAssignmentDetailScreen.tsx');
    expect(execution).toContain('VoiceFlowPanel');
    expect(execution).toContain('resolveVoiceFlowVisibility');
    expect(detail).not.toContain('VoiceFlowPanel');
  });
});
