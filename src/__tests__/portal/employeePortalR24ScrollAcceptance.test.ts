import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('portal R24 scroll and messaging acceptance', () => {
  it('keeps the complete team month reachable vertically and horizontally', () => {
    const route = read('app/portal/employee/(tabs)/calendar.tsx');
    const calendar = read('src/components/portal/EmployeePortalCalendarScreen.tsx');

    expect(route).not.toContain('scroll={false}');
    expect(calendar).toContain('horizontal');
    expect(calendar).toContain('nestedScrollEnabled');
    expect(calendar).toContain('showsHorizontalScrollIndicator');
    expect(calendar).toContain('testID="employee-calendar-horizontal-scroll"');
    expect(calendar).toMatch(/wideCanvas:\s*\{[\s\S]*minWidth:\s*1040/);
  });

  it('keeps vertical page reachability without accidental horizontal portal drift', () => {
    const screen = read('src/screens/portal/PortalTabScreen.tsx');

    expect(screen.match(/overflowY:\s*'auto'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(screen.match(/overflowX:\s*'hidden'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(screen).toContain("touchAction: 'pan-y'");
  });

  it('does not query the non-existent deleted_at thread column', () => {
    const messages = read('src/lib/office/portalofficemessageservice.ts');

    expect(messages).toContain(".neq('status', 'deleted')");
    expect(messages).toContain("thread.status !== 'deleted'");
    expect(messages).not.toContain(".is('deleted_at', null)");
  });

  it('reserves enough space for the logo beside the portal heading', () => {
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    const primitives = read('src/liquid-command/components/LiquidPrimitives.tsx');

    expect(primitives).toMatch(/brandImageCompact:\s*\{[\s\S]*width:\s*224/);
    expect(shell).toMatch(/rail:\s*\{[\s\S]*width:\s*252/);
  });
});
