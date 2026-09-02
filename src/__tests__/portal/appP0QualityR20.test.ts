import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('CareSuite App P0 quality gate R20', () => {
  it('shows only active, non-deleted client records in both loading paths', () => {
    const source = read('src/lib/portal/employeePortalClientRecordsService.ts');
    expect(source.match(/\.eq\('status', 'active'\)/g)).toHaveLength(2);
    expect(source.match(/\.is\('deleted_at', null\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).not.toContain(".or('status.is.null,status.neq.deleted')");
  });

  it('never blocks a new message merely because categories are unavailable', () => {
    const modal = read('src/components/portal/PortalNewChatModal.tsx');
    const service = read('src/lib/office/portalofficemessageservice.ts');
    expect(modal).not.toContain('Boolean(categoryId)');
    expect(modal).toContain('Allgemeines Anliegen');
    expect(modal).toContain('categoryId: categoryId ?? null');
    expect(service).toContain('category_id: input.categoryId ?? null');
    expect(service).toMatch(/\.delete\(\)\s*\.eq\('tenant_id', tenantId\)/);
    expect(service).toContain('const created = mapThreadRow(data as Record<string, unknown>)');
  });

  it('uses a compact period agenda on phones instead of the 1040px desktop canvas', () => {
    const screen = read('src/components/portal/EmployeePortalCalendarScreen.tsx');
    const switcher = read('src/components/calendar/CalendarViewSwitcher.tsx');
    expect(screen).toContain("const needsWideCanvas = !isPhone &&");
    expect(screen).toContain('<CalendarAgendaList events={phoneEvents}');
    expect(screen).toContain('compact={isPhone}');
    expect(switcher).toContain("mode.key !== 'list'");
  });

  it('places work type and primary controls before auxiliary time-account areas', () => {
    const screen = read('src/components/timeTracking/TimeTrackingEmployeeScreen.tsx');
    expect(screen.indexOf("title={sessionActive ? 'Aktuelle Tätigkeit'")).toBeGreaterThan(-1);
    expect(screen.indexOf("title={sessionActive ? 'Aktuelle Tätigkeit'")).toBeLessThan(
      screen.indexOf('<WfmCheckinScanPanel'),
    );
    expect(screen).toContain('formatDuration(session.netMinutes || session.grossMinutes)');
  });

  it('uses the secure system biometric prompt with device fallback', () => {
    const service = read('src/lib/auth/portalBiometricService.ts');
    const gate = read('src/components/auth/PortalBiometricGate.tsx');
    expect(service).toContain('faceSupported || fingerprintSupported');
    expect(service).toContain('disableDeviceFallback: false');
    expect(service).toContain("Platform.OS === 'android' ? 'weak' : 'strong'");
    expect(service).toContain("fallbackLabel: 'Gerätecode verwenden'");
    expect(gate).toContain('Gesicht, Fingerabdruck oder Gerätecode');
  });

  it('opens a useful native text-size guide instead of generic app settings', () => {
    const source = read('src/components/portal/accessibility/PortalTextSizeControls.native.tsx');
    expect(source).toContain("Linking.sendIntent('android.settings.DISPLAY_SETTINGS')");
    expect(source).not.toContain('onPress={() => void Linking.openSettings()}');
    expect(source).toContain('CareSuite übernimmt automatisch die Textgröße Ihres Geräts');
  });

  it('keeps mobility selection and the canonical visit start operable during sync faults', () => {
    const selection = read('src/lib/portal/employeePortalMobilitySelection.ts');
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const hook = read('src/hooks/useEmployeePortalVisitExecution.ts');
    const enRoute = read('src/features/assistWorkflow/startEnRoute.ts');
    expect(selection).toContain('serverSynced: false');
    expect(screen).not.toContain('Die Mobilitätsauswahl muss zuerst dauerhaft gespeichert sein');
    expect(screen).toContain('Die Anfahrt kann beginnen.');
    expect(hook).toContain('const readOnlyExecution = isOffline;');
    expect(enRoute).toMatch(/transitionAssistExecutionStatus\(\s*input\.executionContext,\s*'unterwegs'/);
  });

  it('prevents server refresh loops and normalizes incomplete workflow arrays', () => {
    const hook = read('src/hooks/useEmployeePortalVisitExecution.ts');
    const liveService = read('src/lib/portal/employeePortalExecutionLiveService.ts');
    const enRoute = read('src/features/assistWorkflow/startEnRoute.ts');
    expect(hook).toContain('liveContext: executionContextRef.current?.liveContext ?? null');
    expect(liveService.match(/Array\.isArray\([^)]*\.tasks\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(enRoute).toContain('Array.isArray(input.executionContext.timeEvents)');
  });
});
