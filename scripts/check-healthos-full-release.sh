#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
node scripts/verify-healthos-full-production.mjs
npm run typecheck
npx --no-install vitest run src/__tests__/auth/authServiceTimeout.test.ts src/__tests__/auth/webSessionBootstrap.test.tsx src/__tests__/auth/webSessionAccessRecovery.test.tsx src/__tests__/navigation/webNavigationHydration.test.tsx src/__tests__/offline/offlineIdb.test.ts src/__tests__/office/officeDashboard.test.ts src/__tests__/office/officeDashboardLive.test.ts src/__tests__/dashboard/liveDashboard.test.ts src/__tests__/contentPortal/liveDataProtection.test.ts src/__tests__/realtime/realtimeWiring.test.ts src/__tests__/ui/workflowFeedbackOverlay.test.ts src/__tests__/ui/nativeAppStructure.test.ts --maxWorkers=2
node --experimental-vm-modules --test scripts/verify-platform-observation.test.mjs
npm run audit:portal-update -- --maxWorkers=2
npm run audit:android-update
npx --no-install vitest run src/__tests__/platformConsole/tenantDossierModel.test.ts src/__tests__/platformConsole/tenantDossierDatabase.test.ts src/__tests__/platformConsole/tenantDossierInteraction.test.tsx src/__tests__/platformConsole/tenantDossierNativeInteraction.test.tsx --maxWorkers=2
npm run audit:assignment-workflow-gate -- --maxWorkers=2 --testTimeout=15000
node --experimental-vm-modules scripts/optional-visit-tasks.test.mjs
node scripts/store-readiness-check.mjs
node scripts/audit-android-api36.mjs
node scripts/audit-android-release-performance.mjs
node --test scripts/configure-healthos-gradle-memory.test.mjs scripts/build-healthos-full-gitbash.test.mjs scripts/discover-healthos-windows-tools.test.mjs scripts/healthos-gradle-compatibility.test.mjs scripts/prepare-healthos-local-sdk.test.mjs scripts/prepare-healthos-compiler-jdk.test.mjs
npm run healthos-full:export
npm run healthos-full:export:audit
