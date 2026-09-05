import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('R14-D native GPS and logbook lifecycle', () => {
  it('keeps the shared native provider alive for either logbook or Assist tracking', () => {
    const tracking = read('src/lib/employeeLogbook/employeeLogbookTracking.ts');

    expect(tracking).toContain('if (!context && !assistContext) return');
    expect(tracking).toContain('if (context) {');
    expect(tracking).toContain('if (assistContext) {');
    expect(tracking).toContain('stopNativeTaskWhenUnused');
    expect(tracking).toContain('stopNativeAssistBackgroundTracking');
    expect(tracking).not.toContain('await AsyncStorage.removeItem(ASSIST_CONTEXT);\n}');
  });

  it('does not stop live assignment tracking merely because its screen unmounts', () => {
    const hook = read('src/features/liveTracking/useEmployeeGpsTracking.ts');

    expect(hook).toContain('Leaving the execution screen must not stop a still-active assignment');
    expect(hook).toContain('stopAssistBackgroundTracking();');
    expect(hook).toContain('return () => stopWatching();');
  });

  it('restores active trips across the complete employee portal', () => {
    const gate = read('src/components/portal/EmployeeLogbookLifecycleGate.tsx');
    const layout = read('app/portal/employee/_layout.tsx');

    expect(gate).toContain('resumeActiveEmployeeLogbookTracking');
    expect(gate).toContain('AppState.addEventListener');
    expect(gate).toContain('employee-active-logbook-banner');
    expect(gate).toContain("pathname: '/portal/employee/assignments/[id]/execute'");
    expect(layout).toContain('<EmployeeLogbookLifecycleGate />');
  });

  it('reopens a selected but unfinished return trip before evaluating the prompt decision', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const activeTripCheck = screen.indexOf('const activeReturnTrip = await loadUnfinishedEmployeeReturnTrip');
    const promptDecisionCheck = screen.indexOf('const promptDecision = await loadLogbookPromptDecision');

    expect(activeTripCheck).toBeGreaterThan(-1);
    expect(promptDecisionCheck).toBeGreaterThan(activeTripCheck);
    expect(screen).toContain('returnTripDestinationFromTrip(activeReturnTrip)');
  });

  it('freezes trip producers before the final queue flush and distance calculation', () => {
    const automation = read('src/lib/employeeLogbook/employeeLogbookAutomation.ts');
    const returnTrip = read('src/lib/portal/employeePortalReturnTrip.ts');

    expect(automation.indexOf('await stopNativeBackgroundTracking();')).toBeLessThan(
      automation.indexOf('await flushLogbookPointQueue();', automation.indexOf('finishActiveVisitLogbookTrip')),
    );
    expect(returnTrip.indexOf('await stopNativeBackgroundTracking();')).toBeLessThan(
      returnTrip.indexOf('await flushLogbookPointQueue();'),
    );
  });

  it('keeps generated exports and secrets out of future EAS archives', () => {
    const easIgnore = read('.easignore');

    expect(easIgnore).toContain('.expo-*/');
    expect(easIgnore).toContain('dist-*/');
    expect(easIgnore).toContain('.env.*');
    expect(easIgnore).toContain('test-output.txt');
  });
});
