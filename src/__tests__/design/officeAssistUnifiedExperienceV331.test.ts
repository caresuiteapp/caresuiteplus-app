import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

describe('Office + Assist unified experience V33.1', () => {
  it('wird durch die gemeinsame räumliche V34-Designwelt abgelöst', () => {
    const background = read('src/components/ui/effects/globalanimatedbackground.tsx');
    const css = read('src/design/web/lightLiquidGlassSurfaceCss.ts');
    const html = read('app/+html.tsx');

    expect(background).toContain('SpatialCareBackground');
    expect(background).not.toContain('DarkLiquidGlassBackground');
    expect(css).toContain('color-scheme: dark light');
    expect(css).not.toContain('background: #030A18');
    expect(html).toContain('content="#17182D"');
  });

  it('setzt auf beiden Startseiten dieselbe Seitenschale ein', () => {
    expect(read('src/screens/office/OfficeIndexScreen.tsx')).toContain('<ScreenShell');
    expect(read('src/screens/assist/AssistIndexScreen.tsx')).toContain('<ScreenShell');
    expect(read('src/components/layout/C14vSubpageShell.tsx')).toContain('<ScreenShell');
  });

  it('hält Shell, Hintergrund und Seitentokens hell und lesbar', () => {
    const tokens = read('src/design/tokens/systemLiquidGlass.ts');
    expect(tokens).toContain("page: '#F7FAFF'");
    expect(tokens).toContain("primary: '#10233F'");
    expect(tokens).toContain("onAccent: '#FFFFFF'");
  });

  it('filtert unqualifizierte Vertretungsvorschläge aus', () => {
    const service = read('src/lib/assist/routePlanningService.ts');
    expect(service).toContain('!qualification.data.qualificationOk');
    expect(service.match(/qualifications:\s*file\.qualifications/g)).toHaveLength(1);
  });
});
