import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const gates = [
  {
    label: 'Liquid-Command-Masterspezifikation',
    command: npm,
    args: ['run', 'liquid-command:audit'],
  },
  {
    label: 'Responsive und Formfaktoren',
    command: npm,
    args: ['run', 'responsive:audit'],
  },
  {
    label: 'Office-Datenintegrität',
    command: npm,
    args: ['run', 'office:integrity:audit'],
  },
  {
    label: 'Navigation und Zielrouten',
    command: npm,
    args: ['run', 'navigation:audit'],
  },
  {
    label: 'Funktionale Realität',
    command: npm,
    args: ['run', 'functional:audit'],
  },
  {
    label: 'Differenzielle R5-TypeScript-Prüfung',
    command: npm,
    args: ['run', 'liquid-command:r5:typecheck'],
  },
  {
    label: 'R5-Quellcode-Lint',
    command: npx,
    args: [
      '--no-install',
      'eslint',
      'src/liquid-command',
      'src/design/tokens/themeBridge.ts',
      'src/design/tokens/spatialCareSuite.ts',
      'src/design/tokens/systemLiquidGlass.ts',
      'src/design/components/GlassCard.tsx',
      'src/hooks/useDomainComposeMessage.ts',
      'src/lib/communication/domainMessageService.ts',
      'src/lib/services/liveServiceGuard.ts',
      'src/lib/services/clients/clientService.ts',
      'src/screens/shared/ComposeMessageForm.tsx',
      'src/screens/shared/MessageComposeScreenShell.tsx',
      'src/screens/office/OfficeMessageTemplatesScreen.tsx',
      'src/components/office/OfficeMessageContextPanel.tsx',
      'src/lib/office/messageQuickReplyTemplateService.ts',
      'src/lib/auth/portalLoginFlow.ts',
      'src/lib/auth/portalSupabaseAuth.ts',
      'scripts/liquid-command-r5-acceptance.mjs',
      'scripts/liquid-command-visual-qa.mjs',
      'scripts/liquid-command-masterspec-audit.mjs',
      'scripts/responsive-audit.mjs',
      'scripts/navigation-duplicate-audit.mjs',
    ],
  },
  {
    label: 'R5-Workflow-Regressionen',
    command: npx,
    args: [
      '--no-install',
      'vitest',
      'run',
      'src/__tests__/liquidCommand/liquidCommandFoundation.test.ts',
      'src/__tests__/liquidCommand/liquidCommandRouteIntegrity.test.ts',
      'src/__tests__/office/officeCompose.test.ts',
      'src/__tests__/office/officemessagingfinal.test.ts',
      'src/__tests__/office/officeClientsList.test.ts',
      'src/__tests__/office/officeEmployeesList.test.ts',
      'src/__tests__/portal/clientPortalPrompt59.test.ts',
      'src/__tests__/portal/portalVerwaltungMessaging.test.ts',
      'src/__tests__/stationaer/stationaerBodyMapIntegration.test.ts',
    ],
  },
];

console.log('======================================================');
console.log('CARESUITE LIQUID COMMAND R5 – VERBINDLICHE ABNAHME');
console.log('======================================================');

for (const [index, gate] of gates.entries()) {
  console.log(`\n[${index + 1}/${gates.length}] ${gate.label}`);
  const result = spawnSync(gate.command, gate.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`\nABBRUCH: ${gate.label}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nABBRUCH: ${gate.label} (Exit ${result.status ?? 'unbekannt'})`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n======================================================');
console.log('R5-ABNAHME ERFOLGREICH');
console.log('======================================================');
