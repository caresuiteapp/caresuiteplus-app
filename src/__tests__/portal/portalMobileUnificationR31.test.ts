import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('portal mobile unification R31', () => {
  it('uses one portal chrome for start pages and subpages', () => {
    const shell = readSrc('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    const employeeHome = readSrc('app/portal/employee/(tabs)/index.tsx');

    expect(shell).toContain('let content: ReactNode = <PortalChrome kind={kind} overlay={overlay} />;');
    expect(shell).toContain('ownerPath={Platform.OS === \'web\' ? undefined : liquidPortalRoots[kind]}');
    expect(shell).not.toContain('pathname === liquidPortalRoots');
    expect(employeeHome).toContain('EmployeePortalOverviewScreen');
    expect(employeeHome).not.toContain('PortalHomeScreen');
  });

  it('keeps exactly five bottom slots inside the phone width', () => {
    const shell = readSrc('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');

    expect(shell).toContain("maxWidth: '20%'");
    expect(shell).toContain('flexBasis: 0');
    expect(shell).toContain('minWidth: 0');
    const footerStart = shell.indexOf('testID="portal-bottom-navigation"');
    const footer = shell.slice(footerStart, shell.indexOf('<Modal', footerStart));
    expect(footer.match(/numberOfLines=\{2\}/g)).toHaveLength(2);
    expect(footer).not.toContain('minimumFontScale');
    expect(footer).not.toContain('adjustsFontSizeToFit');
    expect(shell).toMatch(/bottomLabel:\s*\{[\s\S]*?color: '#48627C',[\s\S]*?fontSize: webScaledFontMetric\(13\)/);
  });

  it('uses compact bottom sheets for both appointment previews on phones', () => {
    for (const file of [
      'src/components/portal/ClientPortalAssignmentPreviewSheet.tsx',
      'src/components/portal/EmployeePortalAssignmentPreviewSheet.tsx',
    ]) {
      const preview = readSrc(file);
      expect(preview, file).toContain("variant={isPhone ? 'bottomSheet' : 'center'}");
      expect(preview, file).toContain("animationType={isPhone ? 'slide' : 'fade'}");
      expect(preview, file).toContain('modalBodyPhone');
    }
  });

  it('removes duplicated employee profile metadata and compacts the phone hero', () => {
    const profile = readSrc('src/screens/portal/EmployeeProfileScreen.tsx');
    const hero = readSrc('src/components/portal/PortalEmployeeProfileHero.tsx');

    expect(profile).not.toContain('<GlassCard>');
    expect(profile).not.toContain('WORKFLOW_STATUS_LABELS');
    expect(profile).toContain('isPhone');
    expect(hero).toContain("size={isPhone ? 'lg' : 'xl'}");
    expect(hero).toContain('contactLine');
    expect(hero).toContain('frameStyles.phone');
  });
});
