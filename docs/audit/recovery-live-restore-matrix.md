# Recovery Live Restore Matrix

**Branch:** `recovery/hybrid-live-restore` (base `8f334a3`)  
**Date:** 2026-06-18  
**Status legend:** OK | REGRESSION | FEHLT | STUB/FALLBACK | FALSCH GEROUTET | AUS MAIN ÜBERNEHMEN | AUS RECOVERY BEHALTEN | AUS STASH PRÜFEN | AUS DANGLING COMMIT PRÜFEN | NICHT RECOVERBAR

| Bereich | Datei/Funktion | aktueller Status | beste Quelle | Aktion | Commit-Paket |
|---------|----------------|------------------|--------------|--------|----------------|
| **Dashboard** | `officeDashboardService.ts` / `buildLiveOfficeDashboardSnapshot` | OK (restored) | main | Checkout from main | `fix: restore live office dashboard data flow` |
| **Dashboard** | `dashboardService.ts` / `fetchDashboardSnapshot(tenantId,…)` | OK (restored) | main | Checkout from main | same |
| **Dashboard** | `useDashboard.ts` / `useServiceTenantId` | OK (restored) | main | Checkout from main | same |
| **Dashboard** | `liveDashboardSnapshot.ts` | OK | both identical | none | — |
| **Dashboard** | `officeDashboardRepository.supabase.ts` | OK | both identical | none | — |
| **Clients** | `src/lib/clients/*` (intake, edit, record, portal access) | OK (restored) | main | Checkout tree from main | `fix: restore recovered client data flows` |
| **Clients** | `clientListService`, `clientDetailService` | OK (restored) | main | Checkout from main | same |
| **Clients** | `ClientRecordScreen`, hooks (`useClientList`, etc.) | OK (restored) | main | Checkout from main | same |
| **Clients** | `clientcreateservice.ts` | STUB/FALLBACK | recovery-only | Keep (thin wrapper); not on main | same |
| **Clients** | `documentPdfService.ts` / html2canvas | FEHLT dep | main (9943849) | package.json missing `html2canvas`, `jspdf` | blocked — see bundle |
| **Employees** | `employeePersonnelFileService`, mappers, screens | OK (restored) | main | Checkout from main | `fix: restore recovered employee data flows` |
| **Employees** | `employeePersonnelFileLiveLoader.ts` | OK | main (already on branch) | none | — |
| **Employees** | dangling `73a2021` | OK | incorporated in main | no action | — |
| **Office modules** | `moduleAssignmentService`, billing/visibility | OK (restored) | main | Checkout from main | `fix: restore recovered office module data flows` |
| **Office nav** | `officeNavigation.ts` | OK (restored) | stash@{2} | Checkout from stash | same |
| **Office nav** | `shellConfig.ts` | OK (restored) | main | Checkout from main | same |
| **Messenger** | `messageservice.ts`, thread/read/attachment services | AUS RECOVERY BEHALTEN | recovery | Keep recovery versions | `fix: restore recovered messaging and broadcast services` |
| **Messenger** | `officemessagesinbox.tsx` empty state | OK | recovery | Title "Keine Chats", message mentions Nachrichten | — |
| **Broadcast** | `officebroadcastslist.tsx` | AUS RECOVERY BEHALTEN | recovery | Keep | same |
| **Portals** | `clientPortalAuthService.ts` | OK (restored) | main | Checkout from main | `fix: restore recovered portal communication flows` |
| **Portals** | `ClientPortalCodesScreen.tsx` | OK (restored) | stash@{3} | Checkout from stash | same |
| **Portals** | `portalloginflow.ts`, `portalsupabaseauth.ts` | AUS RECOVERY BEHALTEN | recovery | Keep recovery portal auth additions | same |
| **Auth live** | `BusinessLoginScreen` / `signInWithSupabaseSession` | OK (restored) | main | Checkout from main | `fix: restore live auth and tenant office route` |
| **Auth live** | `config.ts` / `getAuthRedirectBaseUrl` | OK (restored) | main | Checkout from main | same |
| **Auth live** | `tenantService.ts` | OK (restored) | main | Checkout from main | same |
| **Auth live** | `passwordResetService.ts` | OK (restored) | main | Checkout from main | same |
| **Auth live** | `AuthProvider.tsx` | AUS RECOVERY BEHALTEN | recovery | Recovery has `updateProfile`, profile repair | keep |
| **Migrations** | 0088–0097 | OK (read-only audit) | recovery branch | Document only; do not push | — |
| **Bundle** | `expo export --platform web` | FEHLT | main deps | html2canvas/jspdf missing in package.json | blocked |
| **Git commits** | all packages | FEHLT | — | git user.name/email not configured | user action required |
| **Lost work** | `fb0df00` uncommitted state | AUS STASH PRÜFEN | stash@{0} | Parked dirty tree from line-2503 branch | review manually |

## Dangling commits (fsck)

| Commit | Content | Action |
|--------|---------|--------|
| `9943849` | Client edit wizard, document PDF/delivery | Mostly in main already |
| `73a2021` | Employee personnel file live | Incorporated in main |

## Stash inventory

| Stash | Branch | Notes |
|-------|--------|-------|
| `stash@{0}` | recovery/line-2503-stabilisierung | Parked dirty pre-restore (auth, migrations, scripts) |
| `stash@{1}` | main | wip-before-audit-cherrypick |
| `stash@{2}` | main | office nav + dashboard + migration 0067 |
| `stash@{3}` | main | ClientPortalCodesScreen + clientExtended repo |
| `stash@{4}` | main | pre-merge-local-wip |
