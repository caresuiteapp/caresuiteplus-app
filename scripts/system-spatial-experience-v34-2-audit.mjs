import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (label, ok) => checks.push({ label, ok: Boolean(ok) });

const tokens = read('src/design/tokens/spatialCareSuite.ts');
const liquid = read('src/design/tokens/systemLiquidGlass.ts');
const background = read('src/components/ui/effects/globalanimatedbackground.tsx');
const backgroundBarrel = read('src/components/backgrounds/index.ts');
const card = read('src/design/components/GlassCard.tsx');
const platform = read('src/components/layout/platform/platformshell.tsx');
const portal = read('src/components/layout/portal/PortalShellLayout.tsx');
const auth = read('src/design/components/AuthPageShell.tsx');
const css = read('src/design/web/lightLiquidGlassSurfaceCss.ts');

check('dunkle räumliche Systembühne ist aktiv', tokens.includes("night: '#17182D'") && liquid.includes("page: '#17182D'"));
check('acht eigenständige Modulakzente bleiben erhalten', (tokens.match(/^\s{2}(office|assist|pflege|beratung|stationaer|akademie|qm|insight):/gm) ?? []).length === 8);
check('keine alte dunkle Testkomponente ist verdrahtet', background.includes('SpatialCareBackground') && !background.includes('DarkLiquidGlassBackground'));
check('Background-Barrel verweist nur auf vorhandene Produktionskomponenten', !backgroundBarrel.includes('DarkLiquidGlassBackground'));
check('Karten verwenden dunkles räumliches Glas', card.includes('rgba(72,72,108,0.94)') && !card.includes('rgba(255,255,255,0.94)'));
check('Office und Assist verwenden die gemeinsame Plattformbühne', platform.includes('spatialCare.stage'));
check('Portale verwenden dieselbe räumliche Bühne', portal.includes('spatialCare.stage'));
check('Anmeldung verwendet dieselbe räumliche Bühne', auth.includes('spatialCare.stageStrong'));
check('Web-Wurzel erzwingt die dunkle Systemfläche', css.includes('color-scheme: dark') && css.includes('background: #17182D !important'));
check('Produktions-Bundle besitzt alle Kernrouten', ['app/office', 'app/assist', 'app/portal', 'app/auth'].every((entry) => existsSync(path.join(root, entry))));

console.log('CareSuite+ System Spatial Experience Audit V34.2');
for (const result of checks) console.log(`${result.ok ? '✓' : '✗'} ${result.label}`);
const failed = checks.filter((result) => !result.ok);
if (failed.length) process.exitCode = 1;
