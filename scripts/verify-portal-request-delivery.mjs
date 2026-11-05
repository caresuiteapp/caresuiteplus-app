import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const suites = [
  'src/__tests__/portal/portalRequestDeliverySql.test.ts',
  'src/__tests__/portal/portalRequestActorIntegrity.test.ts',
  'src/__tests__/portal/portalRequestInbox.test.ts',
  'src/__tests__/portal/assistPortalWorkflow.test.ts',
  'src/__tests__/office/portalRequestPanel.test.tsx',
  'src/__tests__/office/messageInboxPagination.test.ts',
  'src/__tests__/office/officeMessageNavBadges.test.ts',
  'src/__tests__/office/officemessagingportal.test.ts',
  'src/__tests__/office/messageWorkspaceRecovery.test.ts',
];
const result = spawnSync(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=2', ...suites,
], { cwd, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' } });
if (result.error || result.status !== 0) {
  console.error('Portal request delivery verification failed.', result.error?.message ?? '');
  process.exit(result.status || 1);
}
console.log('Portal request delivery verified: transactional receipt, recovery, identity, pagination and Office entry. No live data changed.');
