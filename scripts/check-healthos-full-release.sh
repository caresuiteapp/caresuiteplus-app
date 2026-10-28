#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
node --test supabase/tests/account_security_platform_sync.test.mjs
npx --no-install vitest run src/__tests__/auth/accountSecurityReceipt.test.ts src/__tests__/auth/accountSessionGate.test.tsx src/__tests__/auth/accountSecurityService.test.ts src/__tests__/auth/mfaSettingsCard.test.tsx src/__tests__/platform/encryptedWorkflowStorage.test.ts src/__tests__/offline/deviceSyncOverview.test.ts --maxWorkers=2
node scripts/verify-healthos-full-production.mjs
node scripts/verify-android-app-icons.mjs
node scripts/port-native-workspaces.mjs --check
npm run typecheck
npx --no-install vitest run src/__tests__/platform/nativeWorkflowEnvironment.test.ts src/__tests__/platform/nativeFileTransport.test.ts src/__tests__/platform/nativePdfModuleBoundary.test.ts src/__tests__/platform/nativeWorkspaceStyles.test.ts src/__tests__/platform/nativeWorkspaceGrid.test.tsx src/__tests__/platform/nativeTextBridge.test.tsx src/__tests__/platform/nativeInlineLinks.test.tsx src/__tests__/platform/nativeRuntimeGlobals.test.ts src/__tests__/platform/nativeReactHosts.test.ts src/__tests__/platform/nativeStyleEmitterScopes.test.tsx src/__tests__/ui/stateViewFeedbackFocus.native.test.tsx src/__tests__/platform/nativeAssistFilterSelect.test.tsx src/__tests__/platform/nativeTextSizeGuide.test.tsx src/__tests__/connect/nativeWorkspacePresentation.test.tsx --maxWorkers=2
npx --no-install vitest run src/__tests__/auth/authServiceTimeout.test.ts src/__tests__/auth/webSessionBootstrap.test.tsx src/__tests__/auth/webSessionAccessRecovery.test.tsx src/__tests__/navigation/webNavigationHydration.test.tsx src/__tests__/offline/offlineIdb.test.ts src/__tests__/office/officeDashboard.test.ts src/__tests__/office/officeDashboardLive.test.ts src/__tests__/dashboard/liveDashboard.test.ts src/__tests__/contentPortal/liveDataProtection.test.ts src/__tests__/realtime/realtimeWiring.test.ts src/__tests__/ui/workflowFeedbackOverlay.test.ts src/__tests__/ui/nativeAppStructure.test.ts --maxWorkers=2
node --experimental-vm-modules --test scripts/verify-platform-observation.test.mjs
# Current reviewed server contracts run only against isolated synthetic PostgreSQL data.
node --test --test-concurrency=1 supabase/tests/workflow_payroll_authorization.test.mjs supabase/tests/workflow_server_repair_authorization_draft.test.mjs supabase/tests/family_portal_access_scope.test.mjs supabase/tests/workflow_current_rls_authorization.test.mjs
npx --no-install vitest run src/__tests__/clients/clientRecordRouteDestinations.test.tsx src/__tests__/clients/clientRecordBudgetNavigationWeb.test.tsx src/__tests__/tenant/tenantServiceCatalogPersistence.test.ts src/__tests__/permissions/runtimePermissionScope.test.tsx src/__tests__/permissions/runtimePermissionRepository.test.ts src/__tests__/portal/employeePayrollScreenInteraction.test.tsx src/__tests__/portal/familyHomeTransportCapabilities.test.ts src/__tests__/portal/employeeMobilityEntry.test.tsx src/__tests__/portal/employeeRemainingWorkflowsInteraction.test.tsx src/__tests__/clients/clientRecordReadScope.test.tsx --maxWorkers=2
npm run audit:portal-update -- --maxWorkers=2
npm run audit:android-update
npm run audit:android-administration
# Unit fixtures select their own edition and service mode; they never inherit the live server connection.
env -u EXPO_PUBLIC_APP_EDITION -u EXPO_PUBLIC_SUPABASE_URL -u EXPO_PUBLIC_SUPABASE_ANON_KEY -u EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY -u EXPO_TOKEN APP_ENV=test npx --no-install vitest run src/__tests__/auth src/__tests__/portal src/__tests__/healthos src/__tests__/inputs src/__tests__/offline src/__tests__/navigation --maxWorkers=2 --testTimeout=15000
npx --no-install vitest run src/__tests__/office/officeNotesNativeInteraction.test.tsx src/__tests__/calendar/calendarEmployeeMultiSelectNative.test.tsx src/__tests__/calendar/nativePortalCalendarPresentation.test.tsx src/__tests__/calendar/calendarMeetingParticipants.test.ts src/__tests__/calendar/officeCalendarFormRecovery.test.tsx --maxWorkers=2
npx --no-install vitest run src/__tests__/platformConsole/tenantDossierModel.test.ts src/__tests__/platformConsole/tenantDossierDatabase.test.ts src/__tests__/platformConsole/tenantDossierInteraction.test.tsx src/__tests__/platformConsole/tenantDossierNativeInteraction.test.tsx --maxWorkers=2
npm run audit:assignment-workflow-gate -- --maxWorkers=2 --testTimeout=15000
node --experimental-vm-modules scripts/optional-visit-tasks.test.mjs
node scripts/store-readiness-check.mjs
node scripts/audit-android-api36.mjs
node scripts/audit-android-release-performance.mjs
node --test scripts/android-agp9-compatibility.test.mjs
node --test scripts/configure-healthos-gradle-memory.test.mjs scripts/build-healthos-full-gitbash.test.mjs scripts/discover-healthos-windows-tools.test.mjs scripts/healthos-gradle-compatibility.test.mjs scripts/prepare-healthos-local-sdk.test.mjs scripts/prepare-healthos-compiler-jdk.test.mjs
npm run healthos-full:export
npm run healthos-full:export:audit

