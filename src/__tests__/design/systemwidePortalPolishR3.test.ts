import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');

describe('system-wide portal polish R3', () => {
  it('uses runtime light-theme tokens in the shared screen heading hierarchy', () => {
    const header = read('src/components/layout/ScreenHeader.tsx');
    const breadcrumbs = read('src/components/layout/BreadcrumbTrail.tsx');

    expect(header).toContain('const { colors, mode } = useLegacyTheme()');
    expect(header).toContain('color: colors.textPrimary');
    expect(header).toContain('color: colors.textMuted');
    expect(breadcrumbs).toContain('const { colors, mode } = useLegacyTheme()');
    expect(breadcrumbs).toContain('color: colors.textPrimary');
  });

  it('makes payroll typography and borders follow the active workspace theme', () => {
    const payroll = read('src/screens/office/PayrollMonthOverviewScreen.tsx');

    expect(payroll).toContain('const { colors } = useLegacyTheme()');
    expect(payroll).toContain('const styles = useMemo(() => createStyles(colors), [colors])');
    expect(payroll).toContain('const createStyles = (colors: LegacyColors)');
    expect(payroll).not.toContain("import { colors, typography } from '@/theme'");
  });

  it('keeps legacy inverse text readable only inside surfaces repainted light', () => {
    const contractCss = read('src/design/web/healthOSPageContractCss.ts');
    const glassCss = read('src/design/web/lightLiquidGlassSurfaceCss.ts');

    expect(contractCss).toContain('[style*="color: rgb(255, 255, 255)"]');
    expect(contractCss).toContain('color: #061B35 !important');
    expect(contractCss).toContain('[data-cs-healthos-variant="primary"] *');
    expect(glassCss).toContain('[data-cs-llgan-glass="card"] [style*="color: rgba(255, 255, 255"]');
    expect(glassCss).toContain('[data-cs-healthos-variant="secondary"] *');
  });
});
