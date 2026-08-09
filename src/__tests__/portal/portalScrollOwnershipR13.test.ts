import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('portal scroll ownership R13', () => {
  it('bounds the shared Liquid portal route viewport', () => {
    const layout = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    expect(layout).toMatch(/main:\s*\{[\s\S]*minHeight:\s*0[\s\S]*overflow:\s*'hidden'/);
    expect(layout).toMatch(/contentFrame:\s*\{[\s\S]*flex:\s*1[\s\S]*overflow:\s*'hidden'/);
    expect(layout).toMatch(/content:\s*\{[\s\S]*minHeight:\s*0[\s\S]*overflow:\s*'hidden'/);
  });

  it('gives every standard employee portal page one touch scroll owner', () => {
    const tab = read('src/screens/portal/PortalTabScreen.tsx');
    expect(tab).toContain('testID="employee-portal-tab-scroll"');
    expect(tab).toContain('nestedScrollEnabled');
    expect(tab).toContain("touchAction: 'pan-y'");
    expect(tab).toContain("WebkitOverflowScrolling: 'touch'");
    expect(tab).toMatch(/employeePage:\s*\{[\s\S]*flex:\s*1[\s\S]*minHeight:\s*0/);
  });

  it('keeps long employee visit execution independently scrollable', () => {
    const execution = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(execution).toContain('testID="employee-visit-execution-scroll"');
    expect(execution).toContain('style={styles.focusStageViewport}');
    expect(execution).toContain('keyboardShouldPersistTaps="handled"');
    expect(execution).toMatch(/focusStageViewport:\s*\{[\s\S]*flex:\s*1[\s\S]*touchAction:\s*'pan-y'/);
  });

  it('allows the employee page frame to shrink inside the portal viewport', () => {
    const frame = read('src/components/portal/EmployeePortalPageFrame.tsx');
    expect(frame).toMatch(/page:\s*\{[\s\S]*flex:\s*1[\s\S]*minHeight:\s*0/);
    expect(frame).toMatch(/content:\s*\{[\s\S]*flex:\s*1[\s\S]*minHeight:\s*0/);
  });
});
