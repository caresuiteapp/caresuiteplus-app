#!/usr/bin/env node
/**
 * Scans src/ and app/ for forbidden light large-surface backgrounds.
 * Fails only when CENTRAL priority paths still use static light surfaces.
 * Usage: node scripts/audit-no-white-backgrounds.js
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SCAN_DIRS = ['src', 'app'];

const FORBIDDEN = [
  { id: 'hex-white', re: /backgroundColor\s*:\s*['"]#(?:fff|ffffff|FFF|FFFFFF)['"]/gi },
  { id: 'hex-f8fafc', re: /backgroundColor\s*:\s*['"]#(?:F8FAFC|f8fafc)['"]/gi },
  { id: 'hex-f1f5f9', re: /backgroundColor\s*:\s*['"]#(?:F1F5F9|f1f5f9)['"]/gi },
  { id: 'bg-white-keyword', re: /backgroundColor\s*:\s*['"]white['"]/gi },
  { id: 'static-bg-surface', re: /backgroundColor\s*:\s*colors\.bgSurface/g },
  { id: 'static-bg-input', re: /backgroundColor\s*:\s*colors\.bgInput/g },
  { id: 'static-bg-base', re: /backgroundColor\s*:\s*colors\.bgBase/g },
  { id: 'static-bg-premium', re: /backgroundColor\s*:\s*colors\.bgPremium/g },
  { id: 'carelight-page', re: /backgroundColor\s*:\s*careLightColors\.page/g },
  { id: 'carelight-surface', re: /backgroundColor\s*:\s*careLightColors\.surface/g },
  { id: 'care-suite-light-bg', re: /<CareSuiteLightBackground/g },
];

/** Desktop aurora central paths — must have zero forbidden hits after patch. */
const PRIORITY_PATHS = [
  'src/components/layout/CareLightPageShell.tsx',
  'src/components/layout/CareLightScreen.tsx',
  'src/components/layout/ScreenShell.tsx',
  'src/components/layout/platform/moduledashboardshell.tsx',
  'src/components/dashboard/OfficeDashboardView.tsx',
  'src/components/office/ClientsListView.tsx',
  'src/components/office/EmployeesListView.tsx',
  'src/components/ui/PremiumDataTable.tsx',
  'src/components/ui/PremiumInput.tsx',
  'src/components/ui/ListFilterSelect.tsx',
  'src/components/ui/FilterChip.tsx',
  'src/components/ui/SegmentedTabs.tsx',
  'src/components/ui/CareLightListHeroFrame.tsx',
  'src/components/ui/StateViews.tsx',
  'src/components/ui/FormStepper.tsx',
  'src/design/routeLayoutStyle.ts',
  'src/design/ThemeModeProvider.tsx',
  'src/design/tokens/auroraGlass.ts',
];

const ALLOWLIST = [
  { file: /src\/design\/tokens\/(colors|lightTheme|carelightadaptive)\.ts$/, reason: 'Token / palette definitions' },
  { file: /src\/theme\/colors\.ts$/, reason: 'Legacy static export (mobile light fallback)' },
  { file: /DocumentHtmlPreview|documentPdfService|CareSignatureCanvas|renderIntakeDocumentPreview/, reason: 'Document/signature white canvas' },
  { file: /CareSuiteLightBackground\.tsx$/, reason: 'Mobile light wrapper — gated by useShellHostsAurora' },
  { file: /CareLight(Screen|PageShell|DesktopShell|TabletShell|MobileShell|BottomNav|Button|ModuleTile|QuickActions)/, reason: 'Mobile/light components — not rendered on aurora desktop' },
  { file: /(DesktopShell|TabletShell|MobileShell|AppTabBar|AppStartScreen)\.tsx$/, reason: 'Non-PlatformShell mobile/tablet layouts' },
  { file: /components\/(billing|accounting)\/connect\//, reason: 'Connect prep panels — mobile/light workflow' },
  { file: /platformtopbar\.tsx$/, reason: 'Topbar — light dropdown surfaces preserved (e675ad0)' },
  { file: /__tests__\//, reason: 'Test fixtures' },
  { file: /GuidedTourOverlay/, reason: 'Tour overlay — future glass pass' },
  { file: /ClientRecord(Hero|OverviewPanel)/, reason: 'Detail record panels — separate pass' },
  { file: /FundamentScreen|design-system/, reason: 'Dev/design-system screens' },
  { file: /onboarding\/CompanySetupScreen/, reason: 'Onboarding mobile flow' },
  { file: /BodyMapScreen/, reason: 'Clinical body map canvas' },
  { file: /marketplace\//, reason: 'Marketplace mobile cards' },
  { file: /OfficeMessageCompactRow|ClientCompactRow|OfficeDocumentCompactRow/, reason: 'Compact list rows — card mode mobile' },
  { file: /ChatComposer|CareAddressSearch|CareCatalogSelect|CareMultiCatalogSelect|CareCostCarrierTemplateSearch/, reason: 'Form widgets — mobile light path' },
  { file: /portalofficemessenger/, reason: 'Portal messenger shell' },
  { file: /inventory\//, reason: 'Inventory module mobile' },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function isAllowlisted(relPath) {
  return ALLOWLIST.some((rule) => rule.file.test(relPath));
}

function isPriority(relPath) {
  return PRIORITY_PATHS.some((p) => relPath.replace(/\\/g, '/') === p);
}

function scanFile(absPath) {
  const relPath = relative(root, absPath).replace(/\\/g, '/');
  const text = readFileSync(absPath, 'utf8');
  const lines = text.split('\n');
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { id, re } of FORBIDDEN) {
      re.lastIndex = 0;
      if (re.test(line)) {
        hits.push({
          file: relPath,
          line: i + 1,
          pattern: id,
          snippet: line.trim(),
          priority: isPriority(relPath),
          allowlisted: isAllowlisted(relPath),
        });
      }
    }
  }
  return hits;
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => {
    const abs = join(root, d);
    try {
      return walk(abs);
    } catch {
      return [];
    }
  });

  const allHits = files.flatMap(scanFile);
  const priorityViolations = allHits.filter((h) => h.priority && !h.allowlisted);
  const allowedHits = allHits.filter((h) => !h.priority || h.allowlisted);
  const otherHits = allHits.filter((h) => !h.priority && !h.allowlisted);

  console.log('=== audit:no-white ===');
  console.log(`Files scanned: ${files.length}`);
  console.log(`Total pattern matches: ${allHits.length}`);
  console.log(`Priority path violations: ${priorityViolations.length}`);
  console.log(`Other (non-allowlisted) hits: ${otherHits.length}`);
  console.log(`Allowlisted / non-priority: ${allowedHits.length}`);

  if (priorityViolations.length) {
    console.log('\n--- PRIORITY VIOLATIONS (must be zero) ---');
    for (const hit of priorityViolations) {
      console.log(`${hit.file}:${hit.line}:${hit.pattern} — ${hit.snippet.slice(0, 100)}`);
    }
  }

  if (process.env.AUDIT_VERBOSE === '1' && otherHits.length) {
    console.log('\n--- Other non-allowlisted hits ---');
    for (const hit of otherHits.slice(0, 40)) {
      console.log(`${hit.file}:${hit.line}:${hit.pattern}`);
    }
    if (otherHits.length > 40) console.log(`… and ${otherHits.length - 40} more`);
  }

  if (priorityViolations.length > 0) {
    process.exitCode = 1;
  }
}

main();
