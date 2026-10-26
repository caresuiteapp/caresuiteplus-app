# Native Portal-Routeninventur

Der Android-Dateibaum enthält **692 ausgewählte Seiten** und **44 Layouts**. Die tatsächliche Expo-Android-Dateiauswahl und der installierte Linking-Parser wurden synthetisch geprüft. Das belegt weder eine benutzbare App noch die Ausführung der Seiten, Formulare oder Backendaktionen.

Die drei sichtbaren Zugänge heißen **Verwaltung**, **Mitarbeiter** und **Klient** (AccessHubScreen.tsx). Zum Klientenzugang gehören Familien-/Angehörigenrollen und der Akademie-Familienzweig. Plattformkonsole und gemeinsame Zugänge werden zusätzlich erfasst.

## Zählung

| Bereich | Seiten |
|---|---:|
| administration | 563 |
| client_and_family | 18 |
| employee | 34 |
| platform_operator | 20 |
| shared_access | 23 |
| shared_or_system | 34 |

- Aliasseiten: 102
- Nur gruppenqualifiziert auflösbare Schattenvarianten: 5
- Native Weiterleitung im übergeordneten Layout: 22
- Weiterhin global gesperrte Modulseiten: 176
- Ohne statischen Navigations-/Eingangslinkbeleg: 269
- Ohne passende Registryregel: 48
- Vorbereitungs-/Platzhaltersignale: 65
- Nicht sicher auswertbare Redirectketten: 31
- Strukturelle Dateiauswahl-/Parameterfehler: 0
- Nicht aufgelöste Quell-Navigationausdrücke: 461

## Beleggrenze und offene Abnahme

- Every selected native page needs per-page Android lifecycle, record/tenant/role, design/large-font/keyboard, load/empty/error/retry and meaningful action evidence. Test references are not test pass claims.
- Runtime-dependent redirects and source navigation expressions are explicitly listed and have not been executed.
- Nav visibility uses catalogue definitions and an upper-bound desktop permission fixture, not live customer permissions.
- Locked products remain locked; selected files are not evidence of product release.

**Für jede unten aufgeführte Seite bleiben Android-Gerätelauf, fachliche Daten-/Schreibverträge und visuelle Abnahme offen.** Die vollständige JSON-Matrix enthält Empfängergraph, Guard-/Berechtigungsreferenzen, Registryvertrag, Navigationsursprung, Redirectausdrücke mit Query-/Recordbezug und Testreferenzen. Fehlende Referenzen bedeuten nicht automatisch, dass eine Seite unbenutzbar oder obsolet ist. Vorbereitungsstrings sind Prüfsignale.

## Ausführbare Prüfung

`node scripts/audit-native-portal-route-matrix.mjs --write` erzeugt Matrix und diesen Bericht.
`node scripts/audit-native-portal-route-matrix.mjs --check` prüft den aktuellen Quellstand und die strukturellen Linkingverträge. Eine grüne Strukturprüfung erteilt **keine** Funktions- oder Releasefreigabe.

## Sämtliche ausgewählten Seiten

| Route | Bereich | Status | Registry | Android-Datei |
|---|---|---|---|---|
| `/` | shared_access | Laufzeit ungeprüft | / | `app/index.tsx` |
| `/+not-found` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/+not-found.tsx` |
| `/admin` | administration | Alias / Redirect | FEHLT | `app/admin/index.tsx` |
| `/akademie` | administration | gesperrt: akademie | /akademie | `app/akademie/(tabs)/index.native.tsx` |
| `/akademie` | administration | gesperrt: akademie | /akademie | `app/akademie/index.native.tsx` |
| `/akademie/auswertungen` | administration | gesperrt: akademie | /akademie/auswertungen | `app/akademie/auswertungen.native.tsx` |
| `/akademie/calendar` | administration | gesperrt: akademie | /akademie/calendar | `app/akademie/calendar/index.native.tsx` |
| `/akademie/courses` | administration | gesperrt: akademie | /akademie/courses | `app/akademie/(tabs)/courses.native.tsx` |
| `/akademie/courses/[id]` | administration | gesperrt: akademie | /akademie/courses | `app/akademie/courses/[id]/index.native.tsx` |
| `/akademie/dozenten` | administration | gesperrt: akademie | /akademie | `app/akademie/dozenten.native.tsx` |
| `/akademie/einstellungen` | administration | gesperrt: akademie | /akademie | `app/akademie/einstellungen.native.tsx` |
| `/akademie/fortschritt` | administration | gesperrt: akademie | /akademie | `app/akademie/fortschritt.native.tsx` |
| `/akademie/kalender` | administration | gesperrt: akademie | /akademie/kalender | `app/akademie/kalender.native.tsx` |
| `/akademie/kurse` | administration | gesperrt: akademie | /akademie | `app/akademie/kurse/index.native.tsx` |
| `/akademie/kurse/[id]` | administration | gesperrt: akademie | /akademie | `app/akademie/kurse/[id]/index.native.tsx` |
| `/akademie/kurse/new` | administration | gesperrt: akademie | /akademie | `app/akademie/kurse/new.native.tsx` |
| `/akademie/lektionen` | administration | gesperrt: akademie | /akademie | `app/akademie/lektionen.native.tsx` |
| `/akademie/mediathek` | administration | gesperrt: akademie | /akademie | `app/akademie/mediathek.native.tsx` |
| `/akademie/pflichtschulungen` | administration | gesperrt: akademie | /akademie | `app/akademie/pflichtschulungen.native.tsx` |
| `/akademie/portal-preview` | administration | gesperrt: akademie | /akademie | `app/akademie/portal-preview.native.tsx` |
| `/akademie/pruefungen` | administration | gesperrt: akademie | /akademie | `app/akademie/pruefungen.native.tsx` |
| `/akademie/reports` | administration | gesperrt: akademie | /akademie | `app/akademie/reports.native.tsx` |
| `/akademie/schulungsplan` | administration | gesperrt: akademie | /akademie | `app/akademie/schulungsplan.native.tsx` |
| `/akademie/settings` | administration | gesperrt: akademie | /akademie/settings | `app/akademie/settings.native.tsx` |
| `/akademie/teilnehmende` | administration | gesperrt: akademie | /akademie | `app/akademie/teilnehmende.native.tsx` |
| `/akademie/teilnehmer` | administration | gesperrt: akademie | /akademie/teilnehmer | `app/akademie/teilnehmer/index.native.tsx` |
| `/akademie/teilnehmer/[id]` | administration | gesperrt: akademie | /akademie/teilnehmer | `app/akademie/teilnehmer/[id].native.tsx` |
| `/akademie/vorlagen` | administration | gesperrt: akademie | /akademie | `app/akademie/vorlagen.native.tsx` |
| `/akademie/zertifikate` | administration | gesperrt: akademie | /akademie/zertifikate | `app/akademie/zertifikate/index.native.tsx` |
| `/akademie/zertifikate/[id]` | administration | gesperrt: akademie | /akademie/zertifikate | `app/akademie/zertifikate/[id].native.tsx` |
| `/assist` | administration | Laufzeit ungeprüft | /assist | `app/assist/index.native.tsx` |
| `/assist-shell-preview` | shared_or_system | Alias / Redirect | FEHLT | `app/assist-shell-preview.tsx` |
| `/assist/abrechnungsquellen` | administration | Laufzeit ungeprüft | /assist | `app/assist/abrechnungsquellen.native.tsx` |
| `/assist/assignments` | administration | Laufzeit ungeprüft | /assist/assignments | `app/assist/(tabs)/assignments.native.tsx` |
| `/assist/assignments/[id]` | administration | Laufzeit ungeprüft | /assist/assignments | `app/assist/assignments/[id]/index.native.tsx` |
| `/assist/assignments/[id]/edit` | administration | Laufzeit ungeprüft | /assist/assignments | `app/assist/assignments/[id]/edit.native.tsx` |
| `/assist/assignments/[id]/execute` | administration | Laufzeit ungeprüft | /assist/assignments | `app/assist/assignments/[id]/execute.native.tsx` |
| `/assist/assignments/new` | administration | Alias / Redirect | /assist/assignments | `app/assist/assignments/new.tsx` |
| `/assist/aufgaben` | administration | Laufzeit ungeprüft | /assist | `app/assist/aufgaben.tsx` |
| `/assist/calendar` | administration | Laufzeit ungeprüft | /assist/calendar | `app/assist/(tabs)/calendar.native.tsx` |
| `/assist/durchfuehrung` | administration | Laufzeit ungeprüft | /assist/durchfuehrung | `app/assist/(tabs)/durchfuehrung.tsx` |
| `/assist/durchfuehrung/[id]` | administration | Alias / Redirect | /assist/durchfuehrung | `app/assist/durchfuehrung/[id].tsx` |
| `/assist/einsaetze` | administration | Alias / Redirect | /assist | `app/assist/einsaetze/index.tsx` |
| `/assist/einsaetze/[id]` | administration | Alias / Redirect | /assist | `app/assist/einsaetze/[id].tsx` |
| `/assist/einsaetze/[id]/edit` | administration | Alias / Redirect | /assist | `app/assist/einsaetze/[id]/edit.tsx` |
| `/assist/einsaetze/new` | administration | Alias / Redirect | /assist | `app/assist/einsaetze/new.tsx` |
| `/assist/einstellungen` | administration | Laufzeit ungeprüft | /assist | `app/assist/einstellungen.tsx` |
| `/assist/execution/portal-preview` | administration | Laufzeit ungeprüft | /assist | `app/assist/execution/portal-preview.tsx` |
| `/assist/fahrten` | administration | Laufzeit ungeprüft | /assist/fahrten | `app/assist/(tabs)/fahrten.native.tsx` |
| `/assist/fahrten/[id]` | administration | Laufzeit ungeprüft | /assist/fahrten | `app/assist/fahrten/[id]/index.native.tsx` |
| `/assist/fahrten/portal-preview` | administration | Laufzeit ungeprüft | /assist/fahrten | `app/assist/fahrten/portal-preview.tsx` |
| `/assist/kalender` | administration | Alias / Redirect | /assist | `app/assist/kalender.tsx` |
| `/assist/live-status` | administration | Laufzeit ungeprüft | /assist | `app/assist/live-status.native.tsx` |
| `/assist/nachweise` | administration | Laufzeit ungeprüft | /assist/nachweise | `app/assist/(tabs)/nachweise.native.tsx` |
| `/assist/nachweise/[id]` | administration | Laufzeit ungeprüft | /assist/nachweise | `app/assist/nachweise/[id]/index.tsx` |
| `/assist/nachweise/portal-preview` | administration | Laufzeit ungeprüft | /assist/nachweise | `app/assist/nachweise/portal-preview.tsx` |
| `/assist/nachweise/review` | administration | Laufzeit ungeprüft | /assist/nachweise | `app/assist/nachweise/review.native.tsx` |
| `/assist/portal-preview` | administration | Vorbereitungssignal | /assist | `app/assist/portal-preview.tsx` |
| `/assist/portale` | administration | Vorbereitungssignal | /assist | `app/assist/portale.tsx` |
| `/assist/qualitaet` | administration | Laufzeit ungeprüft | /assist | `app/assist/qualitaet.tsx` |
| `/assist/signaturen` | administration | Laufzeit ungeprüft | /assist | `app/assist/signaturen.tsx` |
| `/assist/touren` | administration | Laufzeit ungeprüft | /assist | `app/assist/touren.native.tsx` |
| `/assist/touren-vertretung` | administration | Laufzeit ungeprüft | /assist | `app/assist/touren-vertretung.native.tsx` |
| `/assist/zugeordnete-klienten` | administration | Alias / Redirect | /assist | `app/assist/zugeordnete-klienten.tsx` |
| `/auth` | shared_access | Laufzeit ungeprüft | FEHLT | `app/auth/index.tsx` |
| `/auth/business-login` | shared_access | Laufzeit ungeprüft | /auth/business-login | `app/auth/business-login.tsx` |
| `/auth/client-login` | shared_access | Laufzeit ungeprüft | /auth/client-login | `app/auth/client-login.tsx` |
| `/auth/employee-first-login` | shared_access | Laufzeit ungeprüft | /auth/employee-first-login | `app/auth/employee-first-login.tsx` |
| `/auth/employee-login` | shared_access | Laufzeit ungeprüft | /auth/employee-login | `app/auth/employee-login.tsx` |
| `/auth/employee-portal-login` | shared_access | Laufzeit ungeprüft | /auth/employee-portal-login | `app/auth/employee-portal-login.tsx` |
| `/auth/forgot-password` | shared_access | Laufzeit ungeprüft | /auth/forgot-password | `app/auth/forgot-password.tsx` |
| `/auth/login` | shared_access | Alias / Redirect | FEHLT | `app/auth/login.tsx` |
| `/auth/portal-code-login` | shared_access | Laufzeit ungeprüft | /auth/portal-code-login | `app/auth/portal-code-login.tsx` |
| `/auth/recovery-bridge` | shared_access | Laufzeit ungeprüft | FEHLT | `app/auth/recovery-bridge.tsx` |
| `/auth/register` | shared_access | Laufzeit ungeprüft | /auth/register | `app/auth/register.tsx` |
| `/auth/register-business` | shared_access | Laufzeit ungeprüft | /auth/register-business | `app/auth/register-business.tsx` |
| `/auth/reset-password` | shared_access | Laufzeit ungeprüft | FEHLT | `app/auth/reset-password.tsx` |
| `/beratung` | administration | gesperrt: beratung | /beratung | `app/beratung/(tabs)/index.tsx` |
| `/beratung` | administration | gesperrt: beratung | /beratung | `app/beratung/index.native.tsx` |
| `/beratung/abrechnungsquellen` | administration | gesperrt: beratung | /beratung | `app/beratung/abrechnungsquellen.native.tsx` |
| `/beratung/angehoerige` | administration | gesperrt: beratung | /beratung | `app/beratung/angehoerige.tsx` |
| `/beratung/arbeitsplatz` | administration | gesperrt: beratung | /beratung | `app/beratung/arbeitsplatz/index.native.tsx` |
| `/beratung/arbeitsplatz/[id]` | administration | gesperrt: beratung | /beratung | `app/beratung/arbeitsplatz/[id].native.tsx` |
| `/beratung/auswertungen` | administration | gesperrt: beratung | /beratung/auswertungen | `app/beratung/auswertungen.tsx` |
| `/beratung/berichte` | administration | gesperrt: beratung | /beratung | `app/beratung/berichte.tsx` |
| `/beratung/calendar` | administration | gesperrt: beratung | /beratung/calendar | `app/beratung/calendar/index.tsx` |
| `/beratung/cases` | administration | gesperrt: beratung | /beratung/cases | `app/beratung/(tabs)/cases.tsx` |
| `/beratung/cases/[id]` | administration | gesperrt: beratung | /beratung/cases | `app/beratung/cases/[id]/index.tsx` |
| `/beratung/einstellungen` | administration | gesperrt: beratung | /beratung | `app/beratung/einstellungen.tsx` |
| `/beratung/erstgespraech` | administration | gesperrt: beratung | /beratung | `app/beratung/erstgespraech.tsx` |
| `/beratung/faelle` | administration | gesperrt: beratung | /beratung | `app/beratung/faelle/index.tsx` |
| `/beratung/faelle/[id]` | administration | gesperrt: beratung | /beratung | `app/beratung/faelle/[id].tsx` |
| `/beratung/faelle/[id]/edit` | administration | gesperrt: beratung | /beratung | `app/beratung/faelle/[id]/edit.tsx` |
| `/beratung/faelle/new` | administration | gesperrt: beratung | /beratung | `app/beratung/faelle/new.tsx` |
| `/beratung/kalender` | administration | gesperrt: beratung | /beratung/kalender | `app/beratung/kalender.tsx` |
| `/beratung/kontaktverlauf` | administration | gesperrt: beratung | /beratung | `app/beratung/kontaktverlauf.tsx` |
| `/beratung/leistungsberatung` | administration | gesperrt: beratung | /beratung | `app/beratung/leistungsberatung.tsx` |
| `/beratung/massnahmen` | administration | gesperrt: beratung | /beratung | `app/beratung/massnahmen.tsx` |
| `/beratung/portal-preview` | administration | gesperrt: beratung | /beratung | `app/beratung/portal-preview.tsx` |
| `/beratung/protokolle` | administration | gesperrt: beratung | /beratung/protokolle | `app/beratung/protokolle/index.tsx` |
| `/beratung/protokolle/[id]` | administration | gesperrt: beratung | /beratung/protokolle | `app/beratung/protokolle/[id].tsx` |
| `/beratung/protokolle/new` | administration | gesperrt: beratung | /beratung/protokolle | `app/beratung/protokolle/new.tsx` |
| `/beratung/settings` | administration | gesperrt: beratung | /beratung/settings | `app/beratung/settings.tsx` |
| `/beratung/wiedervorlagen` | administration | gesperrt: beratung | /beratung/wiedervorlagen | `app/beratung/wiedervorlagen/index.tsx` |
| `/beratung/wiedervorlagen/[id]` | administration | gesperrt: beratung | /beratung/wiedervorlagen | `app/beratung/wiedervorlagen/[id].tsx` |
| `/beratung/zugeordnete-klienten` | administration | gesperrt: beratung | /beratung | `app/beratung/zugeordnete-klienten.tsx` |
| `/bodymap-mesh-workbench` | shared_or_system | Alias / Redirect | FEHLT | `app/bodymap-mesh-workbench.tsx` |
| `/bodymap-visual-qa` | shared_or_system | Alias / Redirect | FEHLT | `app/bodymap-visual-qa.tsx` |
| `/business` | administration | Laufzeit ungeprüft | /business | `app/business/(tabs)/index.native.tsx` |
| `/business/admin/architecture` | administration | Laufzeit ungeprüft | /business/admin/architecture | `app/business/admin/architecture/index.tsx` |
| `/business/admin/design-system` | administration | Alias / Redirect | /business/admin/design-system | `app/business/admin/design-system/index.tsx` |
| `/business/admin/developer` | administration | Laufzeit ungeprüft | /business/admin/developer | `app/business/admin/developer/index.tsx` |
| `/business/connect` | administration | Vorbereitungssignal | /business/connect | `app/business/(tabs)/connect.tsx` |
| `/business/connect/[category]` | administration | Vorbereitungssignal | /business/connect | `app/business/connect/[category]/index.tsx` |
| `/business/connect/[category]/[integrationKey]` | administration | Vorbereitungssignal | /business/connect | `app/business/connect/[category]/[integrationKey].native.tsx` |
| `/business/connect/[category]/[integrationKey]/configure` | administration | Vorbereitungssignal | /business/connect | `app/business/connect/[category]/[integrationKey]/configure.tsx` |
| `/business/connect/accounting/prepare` | administration | Vorbereitungssignal | /business/connect | `app/business/connect/accounting/prepare.tsx` |
| `/business/connect/billing/prepare` | administration | Vorbereitungssignal | /business/connect | `app/business/connect/billing/prepare.tsx` |
| `/business/connect/google-workspace` | administration | Laufzeit ungeprüft | /business/connect/google-workspace | `app/business/connect/google-workspace.native.tsx` |
| `/business/connect/marketplace` | administration | Laufzeit ungeprüft | /business/connect | `app/business/connect/marketplace/index.tsx` |
| `/business/connect/marketplace/[category]` | administration | Laufzeit ungeprüft | /business/connect | `app/business/connect/marketplace/[category]/index.tsx` |
| `/business/connect/marketplace/[category]/[partnerId]` | administration | Laufzeit ungeprüft | /business/connect | `app/business/connect/marketplace/[category]/[partnerId].tsx` |
| `/business/connect/marketplace/[category]/[partnerId]/request` | administration | Laufzeit ungeprüft | /business/connect | `app/business/connect/marketplace/[category]/[partnerId]/request.tsx` |
| `/business/connect/marketplace/admin` | administration | Laufzeit ungeprüft | /business/connect | `app/business/connect/marketplace/admin.tsx` |
| `/business/connect/providers` | administration | Laufzeit ungeprüft | /business/connect/providers | `app/business/connect/providers/index.tsx` |
| `/business/dashboard` | administration | Alias / Redirect | /business | `app/business/dashboard.tsx` |
| `/business/documents` | administration | Laufzeit ungeprüft | /business | `app/business/documents.native.tsx` |
| `/business/insight` | administration | Vorbereitungssignal | /business | `app/business/insight.tsx` |
| `/business/integrations` | administration | Vorbereitungssignal | /business/integrations | `app/business/(tabs)/integrations.native.tsx` |
| `/business/integrations/[id]` | administration | Vorbereitungssignal | /business/integrations | `app/business/integrations/[id]/index.native.tsx` |
| `/business/integrations/outbox` | administration | Laufzeit ungeprüft | /business/integrations | `app/business/integrations/outbox/index.tsx` |
| `/business/integrations/payroll` | administration | Laufzeit ungeprüft | /business/integrations | `app/business/integrations/payroll/index.tsx` |
| `/business/integrations/portal-preview` | administration | Laufzeit ungeprüft | /business/integrations | `app/business/integrations/portal-preview.tsx` |
| `/business/messages` | administration | Laufzeit ungeprüft | /business/messages | `app/business/messages/index.native.tsx` |
| `/business/messages/[threadId]` | administration | Alias / Redirect | /business/messages | `app/business/messages/[threadId].native.tsx` |
| `/business/messages/archived` | administration | Alias / Redirect | /business/messages | `app/business/messages/archived.tsx` |
| `/business/messages/assignments` | administration | Alias / Redirect | /business/messages | `app/business/messages/assignments.native.tsx` |
| `/business/messages/channels` | administration | Laufzeit ungeprüft | /business/messages | `app/business/messages/channels.native.tsx` |
| `/business/messages/new` | administration | Alias / Redirect | /business/messages | `app/business/messages/new.tsx` |
| `/business/messages/settings` | administration | Laufzeit ungeprüft | /business/messages/settings | `app/business/messages/settings.native.tsx` |
| `/business/modules` | administration | Alias / Redirect | /business/modules | `app/business/(tabs)/modules.tsx` |
| `/business/office/access` | administration | Laufzeit ungeprüft | /business/office/access | `app/business/office/access/index.tsx` |
| `/business/office/access/client-portal` | administration | Vorbereitungssignal | /business/office/access/client-portal | `app/business/office/access/client-portal/index.tsx` |
| `/business/office/access/employee-portal` | administration | Vorbereitungssignal | /business/office/access/employee-portal | `app/business/office/access/employee-portal/index.tsx` |
| `/business/office/access/employee-portal/[id]` | administration | Laufzeit ungeprüft | /business/office/access/employee-portal | `app/business/office/access/employee-portal/[id].tsx` |
| `/business/office/access/employee-portal/new` | administration | Laufzeit ungeprüft | /business/office/access/employee-portal | `app/business/office/access/employee-portal/new.tsx` |
| `/business/office/access/internal-users` | administration | Vorbereitungssignal | /business/office/access/internal-users | `app/business/office/access/internal-users/index.tsx` |
| `/business/office/access/internal-users/[id]` | administration | Laufzeit ungeprüft | /business/office/access/internal-users | `app/business/office/access/internal-users/[id].tsx` |
| `/business/office/access/internal-users/new` | administration | Laufzeit ungeprüft | /business/office/access/internal-users | `app/business/office/access/internal-users/new.tsx` |
| `/business/office/access/login-audit` | administration | Vorbereitungssignal | /business/office/access/login-audit | `app/business/office/access/login-audit/index.tsx` |
| `/business/office/access/module-permissions` | administration | Laufzeit ungeprüft | /business/office/access/module-permissions | `app/business/office/access/module-permissions/index.tsx` |
| `/business/office/access/roles` | administration | Vorbereitungssignal | /business/office/access/roles | `app/business/office/access/roles/index.tsx` |
| `/business/office/access/tasks` | administration | Laufzeit ungeprüft | /business/office/access | `app/business/office/access/tasks/index.tsx` |
| `/business/office/admin/data-quality` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/admin/data-quality/index.tsx` |
| `/business/office/admin/onboarding` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/admin/onboarding/index.tsx` |
| `/business/office/admin/operations-monitoring` | administration | Vorbereitungssignal | /business/office | `app/business/office/admin/operations-monitoring/index.tsx` |
| `/business/office/admin/services` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/admin/services/index.tsx` |
| `/business/office/audit-log` | administration | Alias / Redirect | /business/office | `app/business/office/audit-log.tsx` |
| `/business/office/billing/kassenabrechnung` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/billing/kassenabrechnung.tsx` |
| `/business/office/clients` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/clients/index.native.tsx` |
| `/business/office/clients/[id]` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id].native.tsx` |
| `/business/office/clients/[id]/billing` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/billing.native.tsx` |
| `/business/office/clients/[id]/bodymap` | administration | Alias / Redirect | /business/office/clients/[id] | `app/business/office/clients/[id]/bodymap.tsx` |
| `/business/office/clients/[id]/care` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/care.native.tsx` |
| `/business/office/clients/[id]/communication` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/communication.native.tsx` |
| `/business/office/clients/[id]/consents` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/consents.tsx` |
| `/business/office/clients/[id]/contracts` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/contracts.tsx` |
| `/business/office/clients/[id]/documents` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/documents.tsx` |
| `/business/office/clients/[id]/edit` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/edit.tsx` |
| `/business/office/clients/[id]/medical` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/medical.native.tsx` |
| `/business/office/clients/[id]/medication` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/medication.native.tsx` |
| `/business/office/clients/[id]/modules` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/modules.native.tsx` |
| `/business/office/clients/[id]/portal` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/portal.native.tsx` |
| `/business/office/clients/[id]/service-records` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/service-records.native.tsx` |
| `/business/office/clients/[id]/timeline` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/timeline.native.tsx` |
| `/business/office/clients/[id]/vitals` | administration | Laufzeit ungeprüft | /business/office/clients/[id] | `app/business/office/clients/[id]/vitals.native.tsx` |
| `/business/office/clients/new` | administration | Laufzeit ungeprüft | /business/office/clients/new | `app/business/office/clients/new.native.tsx` |
| `/business/office/dashboard` | administration | Alias / Redirect | /business/office | `app/business/office/dashboard.native.tsx` |
| `/business/office/document-catalog` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/document-catalog/index.native.tsx` |
| `/business/office/documents` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/documents/index.native.tsx` |
| `/business/office/documents/[id]` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/documents/[id].native.tsx` |
| `/business/office/documents/categories` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/documents/categories.native.tsx` |
| `/business/office/documents/signatures` | administration | Laufzeit ungeprüft | /business/office/documents/signatures | `app/business/office/documents/signatures/index.native.tsx` |
| `/business/office/documents/signatures/[id]` | administration | Laufzeit ungeprüft | /business/office/documents/signatures/[id] | `app/business/office/documents/signatures/[id].native.tsx` |
| `/business/office/documents/upload` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/documents/upload.native.tsx` |
| `/business/office/employees` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/employees/index.tsx` |
| `/business/office/employees/[id]` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/employees/[id].native.tsx` |
| `/business/office/employees/[id]/edit` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/employees/[id]/edit.native.tsx` |
| `/business/office/employees/[id]/personnel` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/employees/[id]/personnel.native.tsx` |
| `/business/office/employees/hr-cases` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/employees/hr-cases/index.tsx` |
| `/business/office/employees/new` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/employees/new.native.tsx` |
| `/business/office/fahrtenbuch` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/fahrtenbuch/index.tsx` |
| `/business/office/inventory` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/index.native.tsx` |
| `/business/office/inventory/assignments` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/assignments.native.tsx` |
| `/business/office/inventory/audit` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/audit.native.tsx` |
| `/business/office/inventory/barcode` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/barcode.native.tsx` |
| `/business/office/inventory/categories` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/categories.native.tsx` |
| `/business/office/inventory/damage` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/damage.native.tsx` |
| `/business/office/inventory/employees` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/employees.native.tsx` |
| `/business/office/inventory/items` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/items.native.tsx` |
| `/business/office/inventory/locations` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/locations.native.tsx` |
| `/business/office/inventory/mdm` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/mdm.native.tsx` |
| `/business/office/inventory/offboarding` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/offboarding.native.tsx` |
| `/business/office/inventory/protocols` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/protocols.native.tsx` |
| `/business/office/inventory/returns` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/returns.native.tsx` |
| `/business/office/inventory/settings` | administration | Alias / Redirect | /business/office | `app/business/office/inventory/settings.native.tsx` |
| `/business/office/invoices` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/invoices/index.native.tsx` |
| `/business/office/invoices/[id]` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/invoices/[id].native.tsx` |
| `/business/office/invoices/[id]/edit` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/invoices/[id]/edit.native.tsx` |
| `/business/office/invoices/dunning` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/invoices/dunning.native.tsx` |
| `/business/office/invoices/inbox` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/invoices/inbox.native.tsx` |
| `/business/office/invoices/month-end` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/invoices/month-end.native.tsx` |
| `/business/office/invoices/new` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/invoices/new.native.tsx` |
| `/business/office/invoices/payments` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/invoices/payments.native.tsx` |
| `/business/office/invoices/runs` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/invoices/runs.native.tsx` |
| `/business/office/modules` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/modules/index.native.tsx` |
| `/business/office/modules/billing` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/modules/billing/index.native.tsx` |
| `/business/office/modules/clients` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/modules/clients/index.native.tsx` |
| `/business/office/modules/documents` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/modules/documents/index.native.tsx` |
| `/business/office/modules/employees` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/modules/employees/index.native.tsx` |
| `/business/office/modules/permissions` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/modules/permissions/index.native.tsx` |
| `/business/office/modules/services` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/modules/services/index.native.tsx` |
| `/business/office/modules/templates` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/modules/templates/index.native.tsx` |
| `/business/office/payments/settings` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/payments/settings.tsx` |
| `/business/office/payroll` | administration | Laufzeit ungeprüft | /business/office/payroll | `app/business/office/payroll/index.native.tsx` |
| `/business/office/permissions` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/permissions.native.tsx` |
| `/business/office/personal/compliance` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/personal/compliance.tsx` |
| `/business/office/personal/training` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/personal/training/index.native.tsx` |
| `/business/office/personal/work-times` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/personal/work-times/index.tsx` |
| `/business/office/personal/workforce` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/personal/workforce/index.native.tsx` |
| `/business/office/portals` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/portals/index.tsx` |
| `/business/office/portals/access-codes` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/portals/access-codes.tsx` |
| `/business/office/portals/clients` | administration | Vorbereitungssignal | /business/office | `app/business/office/portals/clients.tsx` |
| `/business/office/portals/employees` | administration | Vorbereitungssignal | /business/office | `app/business/office/portals/employees.tsx` |
| `/business/office/privacy` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/privacy/index.tsx` |
| `/business/office/qm` | administration | Alias / Redirect | /business/office/qm | `app/business/office/qm/index.tsx` |
| `/business/office/qm/ai-assistant` | administration | Vorbereitungssignal | /business/office/qm | `app/business/office/qm/ai-assistant.native.tsx` |
| `/business/office/qm/audit-packages` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/audit-packages.native.tsx` |
| `/business/office/qm/audits` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/audits.native.tsx` |
| `/business/office/qm/changes` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/changes.native.tsx` |
| `/business/office/qm/compliance` | administration | Vorbereitungssignal | /business/office/qm | `app/business/office/qm/compliance.native.tsx` |
| `/business/office/qm/documents` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/documents/index.native.tsx` |
| `/business/office/qm/documents/[id]` | administration | Vorbereitungssignal | /business/office/qm | `app/business/office/qm/documents/[id].native.tsx` |
| `/business/office/qm/exports` | administration | Vorbereitungssignal | /business/office/qm | `app/business/office/qm/exports.native.tsx` |
| `/business/office/qm/handbook` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/handbook/index.native.tsx` |
| `/business/office/qm/handbook/[id]` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/handbook/[id].native.tsx` |
| `/business/office/qm/legal-references` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/legal-references.native.tsx` |
| `/business/office/qm/manual` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/manual/index.native.tsx` |
| `/business/office/qm/manual/[id]` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/manual/[id].native.tsx` |
| `/business/office/qm/md-audit` | administration | Vorbereitungssignal | /business/office/qm | `app/business/office/qm/md-audit/index.native.tsx` |
| `/business/office/qm/md-audit/[id]` | administration | Vorbereitungssignal | /business/office/qm | `app/business/office/qm/md-audit/[id].native.tsx` |
| `/business/office/qm/md-check` | administration | Vorbereitungssignal | /business/office/qm | `app/business/office/qm/md-check.native.tsx` |
| `/business/office/qm/measures` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/measures.native.tsx` |
| `/business/office/qm/policies` | administration | Vorbereitungssignal | /business/office/qm | `app/business/office/qm/policies.native.tsx` |
| `/business/office/qm/settings` | administration | Vorbereitungssignal | /business/office/qm | `app/business/office/qm/settings.native.tsx` |
| `/business/office/qm/templates` | administration | Laufzeit ungeprüft | /business/office/qm | `app/business/office/qm/templates.native.tsx` |
| `/business/office/recruiting` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/recruiting/index.tsx` |
| `/business/office/reporting` | administration | Alias / Redirect | /business/office | `app/business/office/reporting.tsx` |
| `/business/office/settings` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/settings/index.tsx` |
| `/business/office/settings/assist-catalogs` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/settings/assist-catalogs.tsx` |
| `/business/office/settings/csv-import-export` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/settings/csv-import-export.tsx` |
| `/business/office/settings/time-tracking` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/settings/time-tracking.native.tsx` |
| `/business/office/templates` | administration | Alias / Redirect | /business/office | `app/business/office/templates/index.native.tsx` |
| `/business/office/templates/[id]` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/templates/[id].native.tsx` |
| `/business/office/templates/categories` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/templates/categories.native.tsx` |
| `/business/office/templates/new` | administration | Laufzeit ungeprüft | /business/office | `app/business/office/templates/new.native.tsx` |
| `/business/office/time-tracking` | administration | Alias / Redirect | /business/office/time-tracking | `app/business/office/time-tracking/index.tsx` |
| `/business/office/time-tracking/abwesenheiten` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/abwesenheiten.native.tsx` |
| `/business/office/time-tracking/audit` | administration | Alias / Redirect | /business/office/time-tracking/audit | `app/business/office/time-tracking/audit.tsx` |
| `/business/office/time-tracking/eigene-erfassung` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/eigene-erfassung.native.tsx` |
| `/business/office/time-tracking/einstellungen` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/einstellungen.native.tsx` |
| `/business/office/time-tracking/export` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/export.native.tsx` |
| `/business/office/time-tracking/fahrzeitregeln` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/fahrzeitregeln.native.tsx` |
| `/business/office/time-tracking/historie` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/historie.native.tsx` |
| `/business/office/time-tracking/live` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/live.native.tsx` |
| `/business/office/time-tracking/live-map` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/live-map.native.tsx` |
| `/business/office/time-tracking/nachtraege` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/nachtraege.native.tsx` |
| `/business/office/time-tracking/pruefqueue` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/pruefqueue.native.tsx` |
| `/business/office/time-tracking/requests` | administration | Alias / Redirect | /business/office/time-tracking | `app/business/office/time-tracking/requests.tsx` |
| `/business/office/time-tracking/team` | administration | Alias / Redirect | /business/office/time-tracking | `app/business/office/time-tracking/team.tsx` |
| `/business/office/time-tracking/team-meetings` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/team-meetings.native.tsx` |
| `/business/office/time-tracking/zeitkonten` | administration | Laufzeit ungeprüft | /business/office/time-tracking | `app/business/office/time-tracking/zeitkonten.native.tsx` |
| `/business/ops` | administration | Gruppen-/Schattenvariante | /business/ops | `app/business/(tabs)/ops.tsx` |
| `/business/ops` | administration | Vorbereitungssignal | /business/ops | `app/business/ops/index.tsx` |
| `/business/ops/pilot-readiness` | administration | Laufzeit ungeprüft | /business/ops | `app/business/ops/pilot-readiness.tsx` |
| `/business/platform` | administration | Laufzeit ungeprüft | /business/platform | `app/business/(tabs)/platform.tsx` |
| `/business/platform/ai` | administration | Laufzeit ungeprüft | /business/platform/ai | `app/business/platform/ai/index.tsx` |
| `/business/platform/ai/[id]` | administration | Laufzeit ungeprüft | /business/platform/ai | `app/business/platform/ai/[id]/index.tsx` |
| `/business/platform/ocr` | administration | Laufzeit ungeprüft | /business/platform/ocr | `app/business/platform/ocr/index.tsx` |
| `/business/platform/ocr/[id]` | administration | Laufzeit ungeprüft | /business/platform/ocr | `app/business/platform/ocr/[id]/index.tsx` |
| `/business/platform/portal-preview` | administration | Laufzeit ungeprüft | /business/platform | `app/business/platform/portal-preview.tsx` |
| `/business/platform/telemedicine` | administration | Laufzeit ungeprüft | /business/platform | `app/business/platform/telemedicine/index.tsx` |
| `/business/qa` | administration | Vorbereitungssignal | /business/qa | `app/business/qa/index.tsx` |
| `/business/qa/[id]` | administration | Laufzeit ungeprüft | /business/qa | `app/business/qa/[id]/index.tsx` |
| `/business/qa/create` | administration | Laufzeit ungeprüft | /business/qa | `app/business/qa/create.tsx` |
| `/business/qa/list` | administration | Vorbereitungssignal | /business/qa | `app/business/qa/list.tsx` |
| `/business/qa/portal-preview` | administration | Laufzeit ungeprüft | /business/qa | `app/business/qa/portal-preview.tsx` |
| `/business/qm` | administration | Laufzeit ungeprüft | /business | `app/business/qm.native.tsx` |
| `/business/release` | administration | Vorbereitungssignal | /business/release | `app/business/release/index.tsx` |
| `/business/release/[id]` | administration | Vorbereitungssignal | /business/release | `app/business/release/[id]/index.tsx` |
| `/business/release/create` | administration | Laufzeit ungeprüft | /business/release | `app/business/release/create.tsx` |
| `/business/release/list` | administration | Vorbereitungssignal | /business/release | `app/business/release/list.tsx` |
| `/business/release/portal-preview` | administration | Laufzeit ungeprüft | /business/release | `app/business/release/portal-preview.tsx` |
| `/business/reporting` | administration | Vorbereitungssignal | /business/reporting | `app/business/reporting/index.tsx` |
| `/business/reporting/[id]` | administration | Laufzeit ungeprüft | /business/reporting | `app/business/reporting/[id]/index.tsx` |
| `/business/reporting/create` | administration | Laufzeit ungeprüft | /business/reporting | `app/business/reporting/create.tsx` |
| `/business/reporting/dashboard` | administration | Laufzeit ungeprüft | /business/reporting | `app/business/reporting/dashboard.tsx` |
| `/business/reporting/list` | administration | Laufzeit ungeprüft | /business/reporting | `app/business/reporting/list.tsx` |
| `/business/reporting/portal-preview` | administration | Laufzeit ungeprüft | /business/reporting | `app/business/reporting/portal-preview.tsx` |
| `/business/roadmap` | administration | Vorbereitungssignal | /business/roadmap | `app/business/roadmap/index.tsx` |
| `/business/roadmap/[id]` | administration | Vorbereitungssignal | /business/roadmap | `app/business/roadmap/[id]/index.tsx` |
| `/business/roadmap/create` | administration | Laufzeit ungeprüft | /business/roadmap | `app/business/roadmap/create.tsx` |
| `/business/roadmap/list` | administration | Vorbereitungssignal | /business/roadmap | `app/business/roadmap/list.tsx` |
| `/business/roadmap/pilot-readiness` | administration | Laufzeit ungeprüft | /business/roadmap | `app/business/roadmap/pilot-readiness.tsx` |
| `/business/roadmap/portal-preview` | administration | Laufzeit ungeprüft | /business/roadmap | `app/business/roadmap/portal-preview.tsx` |
| `/business/security` | administration | Vorbereitungssignal | /business/security | `app/business/security/index.tsx` |
| `/business/security/[id]` | administration | Laufzeit ungeprüft | /business/security | `app/business/security/[id]/index.tsx` |
| `/business/security/create` | administration | Laufzeit ungeprüft | /business/security | `app/business/security/create.tsx` |
| `/business/security/data-requests` | administration | Laufzeit ungeprüft | /business/security | `app/business/security/data-requests.native.tsx` |
| `/business/security/list` | administration | Vorbereitungssignal | /business/security | `app/business/security/list.tsx` |
| `/business/security/portal-preview` | administration | Laufzeit ungeprüft | /business/security | `app/business/security/portal-preview.tsx` |
| `/business/settings` | administration | Vorbereitungssignal | /business | `app/business/settings.native.tsx` |
| `/business/subscription` | administration | Vorbereitungssignal | /business | `app/business/(tabs)/subscription.native.tsx` |
| `/business/templates` | administration | Alias / Redirect | /business/templates | `app/business/templates/index.tsx` |
| `/business/templates/[id]` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/[id]/index.tsx` |
| `/business/templates/[id]/edit` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/[id]/edit.tsx` |
| `/business/templates/academy-templates` | administration | Alias / Redirect | /business/templates | `app/business/templates/academy-templates.tsx` |
| `/business/templates/billing-templates` | administration | Alias / Redirect | /business/templates | `app/business/templates/billing-templates.tsx` |
| `/business/templates/care-templates` | administration | Alias / Redirect | /business/templates | `app/business/templates/care-templates.tsx` |
| `/business/templates/catalogs` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/catalogs.tsx` |
| `/business/templates/categories` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/categories.tsx` |
| `/business/templates/ci-layout` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/ci-layout.native.tsx` |
| `/business/templates/consent-templates` | administration | Alias / Redirect | /business/templates | `app/business/templates/consent-templates.tsx` |
| `/business/templates/counseling-templates` | administration | Alias / Redirect | /business/templates | `app/business/templates/counseling-templates.tsx` |
| `/business/templates/create` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/create.tsx` |
| `/business/templates/document-editor/[id]` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/document-editor/[id].native.tsx` |
| `/business/templates/document-inbox` | administration | Alias / Redirect | /business/templates | `app/business/templates/document-inbox.native.tsx` |
| `/business/templates/document-templates` | administration | Alias / Redirect | /business/templates | `app/business/templates/document-templates.tsx` |
| `/business/templates/document-templates-html` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/document-templates-html.native.tsx` |
| `/business/templates/documents-hub` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/documents-hub.native.tsx` |
| `/business/templates/live-preview` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/live-preview.native.tsx` |
| `/business/templates/message-templates` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/message-templates.tsx` |
| `/business/templates/placeholders` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/placeholders.native.tsx` |
| `/business/templates/settings` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/settings.tsx` |
| `/business/templates/system` | administration | Alias / Redirect | /business/templates | `app/business/templates/system.tsx` |
| `/business/templates/tenant` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/tenant.tsx` |
| `/business/templates/text-blocks` | administration | Laufzeit ungeprüft | /business/templates | `app/business/templates/text-blocks.tsx` |
| `/business/ti` | administration | Vorbereitungssignal | /business/ti | `app/business/ti/index.tsx` |
| `/business/ti/audit` | administration | Vorbereitungssignal | /business/ti | `app/business/ti/audit/index.tsx` |
| `/business/ti/consent` | administration | Vorbereitungssignal | /business/ti | `app/business/ti/consent/index.tsx` |
| `/business/ti/documents` | administration | Laufzeit ungeprüft | /business/ti | `app/business/ti/documents/index.tsx` |
| `/business/ti/egk` | administration | Vorbereitungssignal | /business/ti | `app/business/ti/egk/index.tsx` |
| `/business/ti/emp` | administration | Vorbereitungssignal | /business/ti | `app/business/ti/emp/index.tsx` |
| `/business/ti/epa` | administration | Vorbereitungssignal | /business/ti | `app/business/ti/epa/index.tsx` |
| `/business/ti/erezept` | administration | Vorbereitungssignal | /business/ti | `app/business/ti/erezept/index.tsx` |
| `/business/ti/kim` | administration | Vorbereitungssignal | /business/ti | `app/business/ti/kim/index.tsx` |
| `/business/ti/kim/[id]` | administration | Vorbereitungssignal | /business/ti | `app/business/ti/kim/[id].tsx` |
| `/business/ti/providers` | administration | Laufzeit ungeprüft | /business/ti | `app/business/ti/providers/index.tsx` |
| `/command-center` | shared_or_system | Alias / Redirect | FEHLT | `app/command-center.tsx` |
| `/communication/einstellungen` | shared_or_system | Alias / Redirect | /communication/einstellungen | `app/communication/einstellungen.tsx` |
| `/communication/settings` | shared_or_system | Alias / Redirect | /communication/settings | `app/communication/settings.tsx` |
| `/datenschutz` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/datenschutz.tsx` |
| `/design-system` | shared_or_system | Laufzeit ungeprüft | /design-system | `app/design-system/index.tsx` |
| `/design-system/components` | shared_or_system | Laufzeit ungeprüft | /design-system | `app/design-system/components.tsx` |
| `/Desktop` | shared_or_system | Laufzeit ungeprüft | /Desktop | `app/Desktop.native.tsx` |
| `/device/confirm` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/device/confirm.native.tsx` |
| `/device/tv` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/device/tv.native.tsx` |
| `/employee-portal-shell-preview` | shared_or_system | Alias / Redirect | FEHLT | `app/employee-portal-shell-preview.tsx` |
| `/fundament` | shared_or_system | Alias / Redirect | /fundament | `app/fundament.tsx` |
| `/hilfe` | shared_or_system | Laufzeit ungeprüft | /hilfe | `app/hilfe.tsx` |
| `/insight` | administration | Vorbereitungssignal | /insight | `app/insight/index.tsx` |
| `/insight/data-sources` | administration | Vorbereitungssignal | /insight/data-sources | `app/insight/data-sources/index.tsx` |
| `/insight/data-sources/[id]` | administration | Vorbereitungssignal | /insight/data-sources | `app/insight/data-sources/[id].tsx` |
| `/insight/exports` | administration | Vorbereitungssignal | /insight/exports | `app/insight/exports/index.tsx` |
| `/insight/exports/[id]` | administration | Vorbereitungssignal | /insight/exports | `app/insight/exports/[id].tsx` |
| `/insight/snapshots` | administration | Vorbereitungssignal | /insight/snapshots | `app/insight/snapshots/index.tsx` |
| `/insight/snapshots/[id]` | administration | Vorbereitungssignal | /insight/snapshots | `app/insight/snapshots/[id].tsx` |
| `/liquid-command` | shared_or_system | Owner leitet nativ um | FEHLT | `app/liquid-command/index.tsx` |
| `/liquid-command/access` | shared_access | Owner leitet nativ um | FEHLT | `app/liquid-command/access/index.tsx` |
| `/liquid-command/access/business` | shared_access | Owner leitet nativ um | FEHLT | `app/liquid-command/access/business.tsx` |
| `/liquid-command/access/client` | shared_access | Owner leitet nativ um | FEHLT | `app/liquid-command/access/client.tsx` |
| `/liquid-command/access/employee` | shared_access | Owner leitet nativ um | FEHLT | `app/liquid-command/access/employee.tsx` |
| `/liquid-command/access/employee-first-login` | shared_access | Owner leitet nativ um | FEHLT | `app/liquid-command/access/employee-first-login.tsx` |
| `/liquid-command/access/family` | shared_access | Owner leitet nativ um | FEHLT | `app/liquid-command/access/family.tsx` |
| `/liquid-command/access/recovery` | shared_access | Owner leitet nativ um | FEHLT | `app/liquid-command/access/recovery.tsx` |
| `/liquid-command/access/register` | shared_access | Owner leitet nativ um | FEHLT | `app/liquid-command/access/register.tsx` |
| `/liquid-command/access/reset-password` | shared_access | Owner leitet nativ um | FEHLT | `app/liquid-command/access/reset-password.tsx` |
| `/liquid-command/akademie` | administration | Owner leitet nativ um | FEHLT | `app/liquid-command/akademie/index.tsx` |
| `/liquid-command/assist` | administration | Owner leitet nativ um | FEHLT | `app/liquid-command/assist/index.tsx` |
| `/liquid-command/beratung` | administration | Owner leitet nativ um | FEHLT | `app/liquid-command/beratung/index.tsx` |
| `/liquid-command/office` | administration | Owner leitet nativ um | FEHLT | `app/liquid-command/office/index.tsx` |
| `/liquid-command/pflege` | administration | Owner leitet nativ um | FEHLT | `app/liquid-command/pflege/index.tsx` |
| `/liquid-command/platform` | platform_operator | Owner leitet nativ um | FEHLT | `app/liquid-command/platform/index.tsx` |
| `/liquid-command/portal/client` | client_and_family | Owner leitet nativ um | FEHLT | `app/liquid-command/portal/client.tsx` |
| `/liquid-command/portal/employee` | employee | Owner leitet nativ um | FEHLT | `app/liquid-command/portal/employee.tsx` |
| `/liquid-command/portal/family` | client_and_family | Owner leitet nativ um | FEHLT | `app/liquid-command/portal/family.tsx` |
| `/liquid-command/robotics` | administration | Owner leitet nativ um | FEHLT | `app/liquid-command/robotics/index.tsx` |
| `/liquid-command/settings` | shared_or_system | Owner leitet nativ um | FEHLT | `app/liquid-command/settings/index.tsx` |
| `/liquid-command/stationaer` | administration | Owner leitet nativ um | FEHLT | `app/liquid-command/stationaer/index.tsx` |
| `/medical` | administration | Laufzeit ungeprüft | /medical | `app/medical/index.tsx` |
| `/medical/icd` | administration | Laufzeit ungeprüft | /medical/icd | `app/medical/icd.tsx` |
| `/office` | administration | Alias / Redirect | /office | `app/office/index.native.tsx` |
| `/office/appointments` | administration | Laufzeit ungeprüft | /office/appointments | `app/office/(tabs)/appointments.tsx` |
| `/office/appointments/[id]` | administration | Laufzeit ungeprüft | /office/appointments | `app/office/appointments/[id]/index.tsx` |
| `/office/appointments/create` | administration | Alias / Redirect | /office/appointments | `app/office/appointments/create.tsx` |
| `/office/appointments/portal-preview` | administration | Laufzeit ungeprüft | /office/appointments | `app/office/appointments/portal-preview.tsx` |
| `/office/audit-log` | administration | Laufzeit ungeprüft | /office | `app/office/audit-log.tsx` |
| `/office/billing-preparation` | administration | Laufzeit ungeprüft | /office | `app/office/billing-preparation.native.tsx` |
| `/office/budgets/[id]` | administration | Laufzeit ungeprüft | /office/budgets | `app/office/budgets/[id]/index.tsx` |
| `/office/calendar` | administration | Alias / Redirect | /office/calendar | `app/office/calendar/index.tsx` |
| `/office/calendar/templates` | administration | Laufzeit ungeprüft | /office/calendar | `app/office/calendar/templates/index.native.tsx` |
| `/office/catalogs` | administration | Laufzeit ungeprüft | /office/catalogs | `app/office/catalogs/index.native.tsx` |
| `/office/catalogs/[id]` | administration | Laufzeit ungeprüft | /office/catalogs | `app/office/catalogs/[id]/index.native.tsx` |
| `/office/catalogs/create` | administration | Laufzeit ungeprüft | /office/catalogs/create | `app/office/catalogs/create.native.tsx` |
| `/office/catalogs/portal-preview` | administration | Alias / Redirect | /office/catalogs | `app/office/catalogs/portal-preview.native.tsx` |
| `/office/catalogs/workflow-builder` | administration | Alias / Redirect | /office/catalogs/workflow-builder | `app/office/catalogs/workflow-builder.native.tsx` |
| `/office/clients` | administration | Laufzeit ungeprüft | /office/clients | `app/office/(tabs)/clients.tsx` |
| `/office/clients/[id]` | administration | Alias / Redirect | /office/clients | `app/office/clients/[id]/index.tsx` |
| `/office/clients/[id]/clinical-history` | administration | Laufzeit ungeprüft | /office/clients | `app/office/clients/[id]/clinical-history.native.tsx` |
| `/office/clients/[id]/edit` | administration | Laufzeit ungeprüft | /office/clients | `app/office/clients/[id]/edit.tsx` |
| `/office/clients/[id]/offboarding` | administration | Laufzeit ungeprüft | /office/clients | `app/office/clients/[id]/offboarding.native.tsx` |
| `/office/clients/create` | administration | Alias / Redirect | /office/clients/create | `app/office/clients/create.tsx` |
| `/office/clients/portal-preview` | administration | Laufzeit ungeprüft | /office/clients | `app/office/clients/portal-preview.tsx` |
| `/office/document-catalog` | administration | Laufzeit ungeprüft | /office | `app/office/document-catalog.native.tsx` |
| `/office/documents` | administration | Laufzeit ungeprüft | /office/documents | `app/office/(tabs)/documents.native.tsx` |
| `/office/documents-signatures` | administration | Alias / Redirect | /office/documents-signatures | `app/office/documents-signatures.tsx` |
| `/office/documents/[id]` | administration | Laufzeit ungeprüft | /office/documents | `app/office/documents/[id].native.tsx` |
| `/office/documents/upload` | administration | Laufzeit ungeprüft | /office/documents | `app/office/documents/upload.native.tsx` |
| `/office/employees` | administration | Laufzeit ungeprüft | /office/employees | `app/office/(tabs)/employees.tsx` |
| `/office/employees/[id]` | administration | Laufzeit ungeprüft | /office/employees | `app/office/employees/[id]/index.native.tsx` |
| `/office/employees/[id]/edit` | administration | Laufzeit ungeprüft | /office/employees | `app/office/employees/[id]/edit.native.tsx` |
| `/office/employees/[id]/offboarding` | administration | Laufzeit ungeprüft | /office/employees | `app/office/employees/[id]/offboarding.tsx` |
| `/office/employees/create` | administration | Laufzeit ungeprüft | /office/employees/create | `app/office/employees/create.native.tsx` |
| `/office/employees/portal-preview` | administration | Laufzeit ungeprüft | /office/employees | `app/office/employees/portal-preview.tsx` |
| `/office/inventory` | administration | Alias / Redirect | /office | `app/office/inventory/index.native.tsx` |
| `/office/inventory/assignments` | administration | Alias / Redirect | /office | `app/office/inventory/assignments.native.tsx` |
| `/office/inventory/audit` | administration | Alias / Redirect | /office | `app/office/inventory/audit.native.tsx` |
| `/office/inventory/barcode` | administration | Alias / Redirect | /office | `app/office/inventory/barcode.native.tsx` |
| `/office/inventory/categories` | administration | Alias / Redirect | /office | `app/office/inventory/categories.native.tsx` |
| `/office/inventory/damage` | administration | Alias / Redirect | /office | `app/office/inventory/damage.native.tsx` |
| `/office/inventory/employees` | administration | Alias / Redirect | /office | `app/office/inventory/employees.native.tsx` |
| `/office/inventory/items` | administration | Alias / Redirect | /office | `app/office/inventory/items.native.tsx` |
| `/office/inventory/locations` | administration | Alias / Redirect | /office | `app/office/inventory/locations.native.tsx` |
| `/office/inventory/mdm` | administration | Alias / Redirect | /office | `app/office/inventory/mdm.native.tsx` |
| `/office/inventory/offboarding` | administration | Alias / Redirect | /office | `app/office/inventory/offboarding.native.tsx` |
| `/office/inventory/protocols` | administration | Alias / Redirect | /office | `app/office/inventory/protocols.native.tsx` |
| `/office/inventory/returns` | administration | Alias / Redirect | /office | `app/office/inventory/returns.native.tsx` |
| `/office/inventory/settings` | administration | Alias / Redirect | /office | `app/office/inventory/settings.native.tsx` |
| `/office/invoices` | administration | Laufzeit ungeprüft | /office/invoices | `app/office/(tabs)/invoices.native.tsx` |
| `/office/invoices/[id]` | administration | Laufzeit ungeprüft | /office/invoices | `app/office/invoices/[id]/index.native.tsx` |
| `/office/invoices/create` | administration | Laufzeit ungeprüft | /office/invoices | `app/office/invoices/create.native.tsx` |
| `/office/invoices/portal-preview` | administration | Laufzeit ungeprüft | /office/invoices | `app/office/invoices/portal-preview.tsx` |
| `/office/kalender` | administration | Alias / Redirect | /office/kalender | `app/office/kalender.tsx` |
| `/office/messages` | administration | Laufzeit ungeprüft | /office/messages | `app/office/messages/index.native.tsx` |
| `/office/messages/[id]` | administration | Alias / Redirect | /office/messages | `app/office/messages/[id].native.tsx` |
| `/office/messages/compose` | administration | Alias / Redirect | /office/messages/compose | `app/office/messages/compose.tsx` |
| `/office/messages/settings` | administration | Laufzeit ungeprüft | /office/messages/settings | `app/office/messages/settings.tsx` |
| `/office/messages/templates` | administration | Laufzeit ungeprüft | /office/messages/templates | `app/office/messages/templates.native.tsx` |
| `/office/notizen` | administration | Laufzeit ungeprüft | /office/notizen | `app/office/notizen.native.tsx` |
| `/office/portal-preview` | administration | Laufzeit ungeprüft | /office | `app/office/portal-preview.tsx` |
| `/office/qm` | administration | Laufzeit ungeprüft | /office | `app/office/qm/index.native.tsx` |
| `/office/qm/ai-assistant` | administration | Vorbereitungssignal | /office | `app/office/qm/ai-assistant.tsx` |
| `/office/qm/audits` | administration | Laufzeit ungeprüft | /office | `app/office/qm/audits.tsx` |
| `/office/qm/changes` | administration | Laufzeit ungeprüft | /office | `app/office/qm/changes.tsx` |
| `/office/qm/compliance` | administration | Vorbereitungssignal | /office | `app/office/qm/compliance.tsx` |
| `/office/qm/documents` | administration | Laufzeit ungeprüft | /office | `app/office/qm/documents/index.tsx` |
| `/office/qm/exports` | administration | Vorbereitungssignal | /office | `app/office/qm/exports.tsx` |
| `/office/qm/handbook` | administration | Laufzeit ungeprüft | /office | `app/office/qm/handbook/index.tsx` |
| `/office/qm/md-audit` | administration | Vorbereitungssignal | /office | `app/office/qm/md-audit/index.tsx` |
| `/office/qm/measures` | administration | Laufzeit ungeprüft | /office | `app/office/qm/measures.tsx` |
| `/office/qm/settings` | administration | Vorbereitungssignal | /office | `app/office/qm/settings.tsx` |
| `/office/qm/templates` | administration | Laufzeit ungeprüft | /office | `app/office/qm/templates.tsx` |
| `/office/reporting` | administration | Laufzeit ungeprüft | /office | `app/office/reporting.tsx` |
| `/onboarding` | shared_or_system | Laufzeit ungeprüft | /onboarding | `app/onboarding/index.tsx` |
| `/onboarding/company-setup` | shared_or_system | Alias / Redirect | /onboarding/company-setup | `app/onboarding/company-setup.tsx` |
| `/onboarding/wizard` | shared_or_system | Alias / Redirect | /onboarding | `app/onboarding/wizard.tsx` |
| `/pflege` | administration | gesperrt: pflege | /pflege | `app/pflege/(tabs)/index.tsx` |
| `/pflege` | administration | gesperrt: pflege | /pflege | `app/pflege/index.tsx` |
| `/pflege/abrechnung` | administration | gesperrt: pflege | /pflege/abrechnung | `app/pflege/abrechnung.tsx` |
| `/pflege/abrechnungsfall` | administration | gesperrt: pflege | /pflege | `app/pflege/abrechnungsfall.tsx` |
| `/pflege/abweichung-new` | administration | gesperrt: pflege | /pflege | `app/pflege/abweichung-new.tsx` |
| `/pflege/abweichung-workflow` | administration | gesperrt: pflege | /pflege | `app/pflege/abweichung-workflow.tsx` |
| `/pflege/abweichungen` | administration | gesperrt: pflege | /pflege | `app/pflege/abweichungen.tsx` |
| `/pflege/assessments` | administration | gesperrt: pflege | /pflege | `app/pflege/assessments.tsx` |
| `/pflege/aufgaben` | administration | gesperrt: pflege | /pflege | `app/pflege/aufgaben.tsx` |
| `/pflege/aufnahme` | administration | gesperrt: pflege | /pflege | `app/pflege/aufnahme.tsx` |
| `/pflege/auswertungen` | administration | gesperrt: pflege | /pflege | `app/pflege/auswertungen.tsx` |
| `/pflege/behandlungspflege` | administration | gesperrt: pflege | /pflege | `app/pflege/behandlungspflege/index.native.tsx` |
| `/pflege/behandlungspflege/new` | administration | gesperrt: pflege | /pflege | `app/pflege/behandlungspflege/new.native.tsx` |
| `/pflege/berichte` | administration | gesperrt: pflege | /pflege | `app/pflege/berichte/index.native.tsx` |
| `/pflege/berichte/[id]` | administration | gesperrt: pflege | /pflege | `app/pflege/berichte/[id].native.tsx` |
| `/pflege/berichte/new` | administration | gesperrt: pflege | /pflege | `app/pflege/berichte/new.native.tsx` |
| `/pflege/bodymap` | administration | gesperrt: pflege | /pflege | `app/pflege/bodymap.tsx` |
| `/pflege/calendar` | administration | gesperrt: pflege | /pflege/calendar | `app/pflege/calendar/index.tsx` |
| `/pflege/diagnosen` | administration | gesperrt: pflege | /pflege/diagnosen | `app/pflege/diagnosen.native.tsx` |
| `/pflege/dienstplaene` | administration | gesperrt: pflege | /pflege | `app/pflege/dienstplaene/index.tsx` |
| `/pflege/dienstplaene/new` | administration | gesperrt: pflege | /pflege | `app/pflege/dienstplaene/new.tsx` |
| `/pflege/dokumentation` | administration | gesperrt: pflege | /pflege | `app/pflege/dokumentation/index.native.tsx` |
| `/pflege/dokumentation/[id]` | administration | gesperrt: pflege | /pflege | `app/pflege/dokumentation/[id]/index.native.tsx` |
| `/pflege/einsatz` | administration | gesperrt: pflege | /pflege | `app/pflege/einsatz.native.tsx` |
| `/pflege/einstellungen` | administration | gesperrt: pflege | /pflege | `app/pflege/einstellungen.tsx` |
| `/pflege/evaluation` | administration | gesperrt: pflege | /pflege | `app/pflege/evaluation/index.native.tsx` |
| `/pflege/evaluation/new` | administration | gesperrt: pflege | /pflege | `app/pflege/evaluation/new.tsx` |
| `/pflege/fuhrpark` | administration | gesperrt: pflege | /pflege | `app/pflege/fuhrpark.tsx` |
| `/pflege/gesamtabnahme` | administration | gesperrt: pflege | /pflege/gesamtabnahme | `app/pflege/gesamtabnahme.tsx` |
| `/pflege/informationssammlung` | administration | gesperrt: pflege | /pflege | `app/pflege/informationssammlung/index.tsx` |
| `/pflege/informationssammlung/[id]` | administration | gesperrt: pflege | /pflege | `app/pflege/informationssammlung/[id].tsx` |
| `/pflege/informationssammlung/new` | administration | gesperrt: pflege | /pflege | `app/pflege/informationssammlung/new.tsx` |
| `/pflege/inventar` | administration | gesperrt: pflege | /pflege | `app/pflege/inventar/index.native.tsx` |
| `/pflege/inventar/assignments` | administration | gesperrt: pflege | /pflege | `app/pflege/inventar/assignments.tsx` |
| `/pflege/inventar/categories` | administration | gesperrt: pflege | /pflege | `app/pflege/inventar/categories.tsx` |
| `/pflege/inventar/damage` | administration | gesperrt: pflege | /pflege | `app/pflege/inventar/damage.tsx` |
| `/pflege/inventar/employees` | administration | gesperrt: pflege | /pflege | `app/pflege/inventar/employees.tsx` |
| `/pflege/inventar/items` | administration | gesperrt: pflege | /pflege | `app/pflege/inventar/items.tsx` |
| `/pflege/inventar/returns` | administration | gesperrt: pflege | /pflege | `app/pflege/inventar/returns.tsx` |
| `/pflege/kalender` | administration | gesperrt: pflege | /pflege/kalender | `app/pflege/kalender.tsx` |
| `/pflege/klienten` | administration | gesperrt: pflege | /pflege | `app/pflege/klienten.native.tsx` |
| `/pflege/klienten/[id]` | administration | gesperrt: pflege | /pflege | `app/pflege/klienten/[id].native.tsx` |
| `/pflege/leistungskatalog` | administration | gesperrt: pflege | /pflege | `app/pflege/leistungskatalog.tsx` |
| `/pflege/leistungsnachweis-new` | administration | gesperrt: pflege | /pflege | `app/pflege/leistungsnachweis-new.native.tsx` |
| `/pflege/leistungsnachweis-workflow` | administration | gesperrt: pflege | /pflege | `app/pflege/leistungsnachweis-workflow.native.tsx` |
| `/pflege/leistungsnachweise` | administration | gesperrt: pflege | /pflege/leistungsnachweise | `app/pflege/leistungsnachweise.tsx` |
| `/pflege/massnahme-review` | administration | gesperrt: pflege | /pflege | `app/pflege/massnahme-review.tsx` |
| `/pflege/massnahmen` | administration | gesperrt: pflege | /pflege | `app/pflege/massnahmen.native.tsx` |
| `/pflege/md-pruefbereitschaft` | administration | gesperrt: pflege | /pflege | `app/pflege/md-pruefbereitschaft.tsx` |
| `/pflege/medikation` | administration | gesperrt: pflege | /pflege | `app/pflege/medikation/index.native.tsx` |
| `/pflege/medikation/[id]` | administration | gesperrt: pflege | /pflege | `app/pflege/medikation/[id]/index.native.tsx` |
| `/pflege/medikation/[id]/gabe` | administration | gesperrt: pflege | /pflege | `app/pflege/medikation/[id]/gabe.tsx` |
| `/pflege/medikation/new` | administration | gesperrt: pflege | /pflege | `app/pflege/medikation/new.native.tsx` |
| `/pflege/personal` | administration | gesperrt: pflege | /pflege | `app/pflege/personal.native.tsx` |
| `/pflege/plans` | administration | gesperrt: pflege | /pflege/plans | `app/pflege/(tabs)/plans.tsx` |
| `/pflege/plans/[id]` | administration | gesperrt: pflege | /pflege/plans | `app/pflege/plans/[id]/index.tsx` |
| `/pflege/plans/create` | administration | gesperrt: pflege | /pflege/plans | `app/pflege/plans/create.tsx` |
| `/pflege/planung` | administration | gesperrt: pflege | /pflege | `app/pflege/planung/index.tsx` |
| `/pflege/planung/[id]` | administration | gesperrt: pflege | /pflege | `app/pflege/planung/[id].tsx` |
| `/pflege/planung/[id]/edit` | administration | gesperrt: pflege | /pflege | `app/pflege/planung/[id]/edit.tsx` |
| `/pflege/planung/new` | administration | gesperrt: pflege | /pflege | `app/pflege/planung/new.tsx` |
| `/pflege/portal-preview` | administration | gesperrt: pflege | /pflege | `app/pflege/portal-preview.tsx` |
| `/pflege/rechnungsgrundlage` | administration | gesperrt: pflege | /pflege | `app/pflege/rechnungsgrundlage.tsx` |
| `/pflege/rechnungsgrundlage-new` | administration | gesperrt: pflege | /pflege | `app/pflege/rechnungsgrundlage-new.tsx` |
| `/pflege/rechnungsgrundlagen` | administration | gesperrt: pflege | /pflege/rechnungsgrundlagen | `app/pflege/rechnungsgrundlagen.tsx` |
| `/pflege/reports` | administration | gesperrt: pflege | /pflege | `app/pflege/reports.tsx` |
| `/pflege/risiken` | administration | gesperrt: pflege | /pflege | `app/pflege/risiken.native.tsx` |
| `/pflege/risiko-review` | administration | gesperrt: pflege | /pflege | `app/pflege/risiko-review.native.tsx` |
| `/pflege/settings` | administration | gesperrt: pflege | /pflege | `app/pflege/settings.tsx` |
| `/pflege/sis` | administration | gesperrt: pflege | /pflege | `app/pflege/sis/index.tsx` |
| `/pflege/sis/[id]` | administration | gesperrt: pflege | /pflege | `app/pflege/sis/[id]/index.tsx` |
| `/pflege/sis/[id]/edit` | administration | gesperrt: pflege | /pflege | `app/pflege/sis/[id]/edit.tsx` |
| `/pflege/sis/create` | administration | gesperrt: pflege | /pflege | `app/pflege/sis/create.tsx` |
| `/pflege/sis/new` | administration | gesperrt: pflege | /pflege | `app/pflege/sis/new.tsx` |
| `/pflege/tourenplanung` | administration | gesperrt: pflege | /pflege | `app/pflege/tourenplanung.native.tsx` |
| `/pflege/uebergaben` | administration | gesperrt: pflege | /pflege | `app/pflege/uebergaben/index.native.tsx` |
| `/pflege/uebergaben/new` | administration | gesperrt: pflege | /pflege | `app/pflege/uebergaben/new.native.tsx` |
| `/pflege/verordnungen` | administration | gesperrt: pflege | /pflege/verordnungen | `app/pflege/verordnungen.tsx` |
| `/pflege/versorgungsuebersicht` | administration | gesperrt: pflege | /pflege | `app/pflege/versorgungsuebersicht.tsx` |
| `/pflege/visiten` | administration | gesperrt: pflege | /pflege | `app/pflege/visiten/index.native.tsx` |
| `/pflege/visiten/new` | administration | gesperrt: pflege | /pflege | `app/pflege/visiten/new.tsx` |
| `/pflege/vitalwerte` | administration | gesperrt: pflege | /pflege/vitalwerte | `app/pflege/(tabs)/vitalwerte.native.tsx` |
| `/pflege/vitalwerte/[id]` | administration | gesperrt: pflege | /pflege/vitalwerte | `app/pflege/vitalwerte/[id]/index.native.tsx` |
| `/pflege/vitalwerte/create` | administration | gesperrt: pflege | /pflege/vitalwerte | `app/pflege/vitalwerte/create.native.tsx` |
| `/pflege/vitalwerte/new` | administration | gesperrt: pflege | /pflege/vitalwerte | `app/pflege/vitalwerte/new.native.tsx` |
| `/pflege/wunddokumentation` | administration | gesperrt: pflege | /pflege | `app/pflege/wunddokumentation/index.native.tsx` |
| `/pflege/wunddokumentation/[id]` | administration | gesperrt: pflege | /pflege | `app/pflege/wunddokumentation/[id]/index.native.tsx` |
| `/pflege/wunden` | administration | gesperrt: pflege | /pflege | `app/pflege/wunden/index.native.tsx` |
| `/pflege/wunden/[id]` | administration | gesperrt: pflege | /pflege | `app/pflege/wunden/[id].native.tsx` |
| `/pflege/wunden/[id]/assessment` | administration | gesperrt: pflege | /pflege | `app/pflege/wunden/[id]/assessment.native.tsx` |
| `/pflege/wunden/new` | administration | gesperrt: pflege | /pflege | `app/pflege/wunden/new.native.tsx` |
| `/pflege/zugeordnete-klienten` | administration | gesperrt: pflege | /pflege | `app/pflege/zugeordnete-klienten.tsx` |
| `/platform` | platform_operator | Laufzeit ungeprüft | /platform | `app/platform/index.tsx` |
| `/platform/addons` | platform_operator | Laufzeit ungeprüft | /platform | `app/platform/(console)/addons/index.tsx` |
| `/platform/audit` | platform_operator | Laufzeit ungeprüft | /platform/audit | `app/platform/(console)/audit/index.tsx` |
| `/platform/billing` | platform_operator | Laufzeit ungeprüft | /platform/billing | `app/platform/(console)/billing/index.tsx` |
| `/platform/bodymap-review` | platform_operator | Alias / Redirect | /platform | `app/platform/(console)/bodymap-review/index.tsx` |
| `/platform/dashboard` | platform_operator | Laufzeit ungeprüft | /platform/dashboard | `app/platform/(console)/dashboard/index.tsx` |
| `/platform/discounts` | platform_operator | Laufzeit ungeprüft | /platform/discounts | `app/platform/(console)/discounts/index.tsx` |
| `/platform/feature-flags` | platform_operator | Laufzeit ungeprüft | /platform/feature-flags | `app/platform/(console)/feature-flags/index.tsx` |
| `/platform/forbidden` | platform_operator | Laufzeit ungeprüft | /platform/forbidden | `app/platform/forbidden.tsx` |
| `/platform/login` | platform_operator | Laufzeit ungeprüft | /platform/login | `app/platform/login.tsx` |
| `/platform/modules` | platform_operator | Laufzeit ungeprüft | /platform/modules | `app/platform/(console)/modules/index.tsx` |
| `/platform/payments` | platform_operator | Laufzeit ungeprüft | /platform/payments | `app/platform/(console)/payments/index.tsx` |
| `/platform/plans` | platform_operator | Laufzeit ungeprüft | /platform/plans | `app/platform/(console)/plans/index.tsx` |
| `/platform/releases` | platform_operator | Laufzeit ungeprüft | /platform/releases | `app/platform/(console)/releases/index.tsx` |
| `/platform/support` | platform_operator | Laufzeit ungeprüft | /platform/support | `app/platform/(console)/support/index.tsx` |
| `/platform/system` | platform_operator | Laufzeit ungeprüft | /platform/system | `app/platform/(console)/system/index.tsx` |
| `/platform/tenants` | platform_operator | Laufzeit ungeprüft | /platform/tenants | `app/platform/(console)/tenants/index.tsx` |
| `/platform/tenants/[tenantId]` | platform_operator | Laufzeit ungeprüft | /platform/tenants | `app/platform/(console)/tenants/[tenantId]/index.tsx` |
| `/platform/users` | platform_operator | Laufzeit ungeprüft | /platform | `app/platform/(console)/users/index.tsx` |
| `/portal-shell-preview` | shared_or_system | Alias / Redirect | FEHLT | `app/portal-shell-preview.tsx` |
| `/portal/client` | client_and_family | Laufzeit ungeprüft | /portal/client | `app/portal/client/(tabs)/index.tsx` |
| `/portal/client/akademie` | client_and_family | Laufzeit ungeprüft | /portal/client | `app/portal/client/akademie/index.native.tsx` |
| `/portal/client/announcements` | client_and_family | Laufzeit ungeprüft | /portal/client/announcements | `app/portal/client/announcements/index.tsx` |
| `/portal/client/appointments` | client_and_family | Laufzeit ungeprüft | /portal/client/appointments | `app/portal/client/(tabs)/appointments.tsx` |
| `/portal/client/appointments/[id]` | client_and_family | Laufzeit ungeprüft | /portal/client/appointments | `app/portal/client/appointments/[id]/index.tsx` |
| `/portal/client/budget` | client_and_family | Laufzeit ungeprüft | /portal/client | `app/portal/client/budget/index.native.tsx` |
| `/portal/client/documents` | client_and_family | Laufzeit ungeprüft | /portal/client/documents | `app/portal/client/(tabs)/documents.tsx` |
| `/portal/client/documents/[id]` | client_and_family | Laufzeit ungeprüft | /portal/client/documents | `app/portal/client/documents/[id]/index.native.tsx` |
| `/portal/client/documents/signatures` | client_and_family | Laufzeit ungeprüft | /portal/client/documents | `app/portal/client/documents/signatures/index.native.tsx` |
| `/portal/client/documents/signatures/[id]` | client_and_family | Laufzeit ungeprüft | /portal/client/documents | `app/portal/client/documents/signatures/[id].native.tsx` |
| `/portal/client/help` | client_and_family | Laufzeit ungeprüft | /portal/client | `app/portal/client/help/index.tsx` |
| `/portal/client/live` | client_and_family | Laufzeit ungeprüft | /portal/client | `app/portal/client/live.tsx` |
| `/portal/client/messages` | client_and_family | Laufzeit ungeprüft | /portal/client/messages | `app/portal/client/messages/index.tsx` |
| `/portal/client/messages/[threadId]` | client_and_family | Laufzeit ungeprüft | /portal/client/messages | `app/portal/client/messages/[threadId].tsx` |
| `/portal/client/profile` | client_and_family | Laufzeit ungeprüft | /portal/client | `app/portal/client/(tabs)/profile.tsx` |
| `/portal/client/proofs` | client_and_family | Laufzeit ungeprüft | /portal/client | `app/portal/client/proofs/index.tsx` |
| `/portal/employee` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/(tabs)/index.tsx` |
| `/portal/employee/akademie` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/akademie/index.native.tsx` |
| `/portal/employee/announcements` | employee | Laufzeit ungeprüft | /portal/employee/announcements | `app/portal/employee/announcements/index.tsx` |
| `/portal/employee/arbeitszeit` | employee | Laufzeit ungeprüft | /portal/employee/arbeitszeit | `app/portal/employee/arbeitszeit/index.tsx` |
| `/portal/employee/arbeitszeit/abwesenheiten` | employee | Laufzeit ungeprüft | /portal/employee/arbeitszeit/abwesenheiten | `app/portal/employee/arbeitszeit/abwesenheiten/index.tsx` |
| `/portal/employee/arbeitszeit/urlaub` | employee | Laufzeit ungeprüft | /portal/employee/arbeitszeit/urlaub | `app/portal/employee/arbeitszeit/urlaub/index.tsx` |
| `/portal/employee/assignments` | employee | Laufzeit ungeprüft | /portal/employee/assignments | `app/portal/employee/(tabs)/assignments.tsx` |
| `/portal/employee/assignments/[id]` | employee | Laufzeit ungeprüft | /portal/employee/assignments | `app/portal/employee/assignments/[id]/index.tsx` |
| `/portal/employee/assignments/[id]/execute` | employee | Laufzeit ungeprüft | /portal/employee/assignments | `app/portal/employee/assignments/[id]/execute.native.tsx` |
| `/portal/employee/beratung` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/beratung/index.native.tsx` |
| `/portal/employee/beratung/[id]` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/beratung/[id].native.tsx` |
| `/portal/employee/calendar` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/(tabs)/calendar.tsx` |
| `/portal/employee/clients` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/clients/index.tsx` |
| `/portal/employee/clients/[id]` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/clients/[id].tsx` |
| `/portal/employee/documents` | employee | Laufzeit ungeprüft | /portal/employee/documents | `app/portal/employee/(tabs)/documents.tsx` |
| `/portal/employee/documents/[id]` | employee | Laufzeit ungeprüft | /portal/employee/documents | `app/portal/employee/documents/[id]/index.tsx` |
| `/portal/employee/documents/signatures` | employee | Laufzeit ungeprüft | /portal/employee/documents/signatures | `app/portal/employee/documents/signatures/index.tsx` |
| `/portal/employee/documents/signatures/[id]` | employee | Laufzeit ungeprüft | /portal/employee/documents/signatures/[id] | `app/portal/employee/documents/signatures/[id].native.tsx` |
| `/portal/employee/execution` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/execution/index.tsx` |
| `/portal/employee/fahrtenbuch` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/fahrtenbuch/index.tsx` |
| `/portal/employee/help` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/help/index.tsx` |
| `/portal/employee/messages` | employee | Laufzeit ungeprüft | /portal/employee/messages | `app/portal/employee/messages/index.tsx` |
| `/portal/employee/messages/[threadId]` | employee | Laufzeit ungeprüft | /portal/employee/messages | `app/portal/employee/messages/[threadId].tsx` |
| `/portal/employee/mobilitaet` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/mobilitaet/index.tsx` |
| `/portal/employee/offene-einsaetze` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/offene-einsaetze.tsx` |
| `/portal/employee/payroll` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/payroll/index.tsx` |
| `/portal/employee/profile` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/(tabs)/profile.tsx` |
| `/portal/employee/schedule` | employee | Alias / Redirect | /portal/employee | `app/portal/employee/(tabs)/schedule.tsx` |
| `/portal/employee/signatures` | employee | Alias / Redirect | /portal/employee | `app/portal/employee/signatures/index.tsx` |
| `/portal/employee/signatures/[id]` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/signatures/[id]/index.tsx` |
| `/portal/employee/tasks` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/tasks/index.native.tsx` |
| `/portal/employee/times` | employee | Laufzeit ungeprüft | /portal/employee/times | `app/portal/employee/times/index.tsx` |
| `/portal/employee/uploads` | employee | Laufzeit ungeprüft | /portal/employee | `app/portal/employee/uploads/index.native.tsx` |
| `/public/md-share/[token]` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/public/md-share/[token].tsx` |
| `/robotics` | administration | Laufzeit ungeprüft | FEHLT | `app/robotics/index.tsx` |
| `/settings` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/settings/index.tsx` |
| `/settings/account-deletion` | shared_or_system | Vorbereitungssignal | /settings/account-deletion | `app/settings/account-deletion.tsx` |
| `/settings/appearance` | shared_or_system | Laufzeit ungeprüft | /settings/appearance | `app/settings/appearance.tsx` |
| `/settings/data-request` | shared_or_system | Laufzeit ungeprüft | /settings/data-request | `app/settings/data-request.tsx` |
| `/settings/profile` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/settings/profile.native.tsx` |
| `/settings/tenant` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/settings/tenant/index.tsx` |
| `/settings/tenant/client-budget` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/settings/tenant/client-budget.native.tsx` |
| `/settings/tenant/client-service-types` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/settings/tenant/client-service-types.native.tsx` |
| `/settings/tenant/notifications` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/settings/tenant/notifications.tsx` |
| `/shell-preview` | shared_or_system | Alias / Redirect | FEHLT | `app/shell-preview.tsx` |
| `/stationaer` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/(tabs)/index.tsx` |
| `/stationaer` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/index.tsx` |
| `/stationaer/aktivitaeten` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/aktivitaeten.tsx` |
| `/stationaer/assessment` | administration | gesperrt: stationaer | /stationaer/assessment | `app/stationaer/assessment/index.tsx` |
| `/stationaer/assessment/[id]` | administration | gesperrt: stationaer | /stationaer/assessment | `app/stationaer/assessment/[id].tsx` |
| `/stationaer/assessment/new` | administration | gesperrt: stationaer | /stationaer/assessment | `app/stationaer/assessment/new.tsx` |
| `/stationaer/auswertungen` | administration | gesperrt: stationaer | /stationaer/auswertungen | `app/stationaer/auswertungen.tsx` |
| `/stationaer/belegung` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/belegung.tsx` |
| `/stationaer/bewohner` | administration | gesperrt: stationaer | /stationaer/bewohner | `app/stationaer/(tabs)/bewohner.tsx` |
| `/stationaer/bewohner/[id]` | administration | gesperrt: stationaer | /stationaer/bewohner | `app/stationaer/bewohner/[id]/index.tsx` |
| `/stationaer/bewohner/[id]/bodymap` | administration | gesperrt: stationaer | /stationaer/bewohner | `app/stationaer/bewohner/[id]/bodymap.tsx` |
| `/stationaer/bewohnerplanung` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/bewohnerplanung.tsx` |
| `/stationaer/bodymap` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/bodymap.tsx` |
| `/stationaer/calendar` | administration | gesperrt: stationaer | /stationaer/calendar | `app/stationaer/calendar/index.tsx` |
| `/stationaer/einstellungen` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/einstellungen.tsx` |
| `/stationaer/kalender` | administration | gesperrt: stationaer | /stationaer/kalender | `app/stationaer/kalender.tsx` |
| `/stationaer/mahlzeiten` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/mahlzeiten.tsx` |
| `/stationaer/portal-preview` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/portal-preview.tsx` |
| `/stationaer/reports` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/reports.tsx` |
| `/stationaer/risiken` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/risiken.tsx` |
| `/stationaer/settings` | administration | gesperrt: stationaer | /stationaer/settings | `app/stationaer/settings.tsx` |
| `/stationaer/tagesstruktur` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/tagesstruktur.tsx` |
| `/stationaer/uebergabe` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/uebergabe.tsx` |
| `/stationaer/uebergabebericht` | administration | gesperrt: stationaer | /stationaer/uebergabebericht | `app/stationaer/uebergabebericht/index.tsx` |
| `/stationaer/uebergabebericht/[id]` | administration | gesperrt: stationaer | /stationaer/uebergabebericht | `app/stationaer/uebergabebericht/[id].tsx` |
| `/stationaer/wohnbereiche` | administration | gesperrt: stationaer | /stationaer/wohnbereiche | `app/stationaer/wohnbereiche/index.tsx` |
| `/stationaer/wohnbereiche/[id]` | administration | gesperrt: stationaer | /stationaer/wohnbereiche | `app/stationaer/wohnbereiche/[id].tsx` |
| `/stationaer/zimmer` | administration | gesperrt: stationaer | /stationaer | `app/stationaer/zimmer.tsx` |
| `/support` | shared_or_system | Laufzeit ungeprüft | FEHLT | `app/support/index.native.tsx` |
| `/unternehmen` | administration | Laufzeit ungeprüft | /unternehmen | `app/unternehmen.native.tsx` |
| `/unternehmen/abteilungen` | administration | Laufzeit ungeprüft | /unternehmen/abteilungen | `app/unternehmen/abteilungen.native.tsx` |
| `/unternehmen/franchise` | administration | Laufzeit ungeprüft | /unternehmen/franchise | `app/unternehmen/franchise.native.tsx` |
| `/unternehmen/fuhrpark` | administration | Laufzeit ungeprüft | /unternehmen/fuhrpark | `app/unternehmen/fuhrpark.native.tsx` |
| `/unternehmen/gesellschaften` | administration | Laufzeit ungeprüft | /unternehmen/gesellschaften | `app/unternehmen/gesellschaften.native.tsx` |
| `/unternehmen/inventar` | administration | Laufzeit ungeprüft | /unternehmen/inventar | `app/unternehmen/inventar.native.tsx` |
| `/unternehmen/personalzuordnung` | administration | Laufzeit ungeprüft | /unternehmen/personalzuordnung | `app/unternehmen/personalzuordnung.native.tsx` |
| `/unternehmen/ressourcen` | administration | Laufzeit ungeprüft | /unternehmen/ressourcen | `app/unternehmen/ressourcen.native.tsx` |
| `/unternehmen/standorte` | administration | Laufzeit ungeprüft | /unternehmen/standorte | `app/unternehmen/standorte.native.tsx` |
| `/unternehmen/versicherungen` | administration | Laufzeit ungeprüft | /unternehmen/versicherungen | `app/unternehmen/versicherungen.native.tsx` |
| `/unternehmen/vertraege` | administration | Laufzeit ungeprüft | /unternehmen/vertraege | `app/unternehmen/vertraege.native.tsx` |
| `/unternehmen/zugriffe` | administration | Laufzeit ungeprüft | /unternehmen/zugriffe | `app/unternehmen/zugriffe.native.tsx` |
| `/unternehmen/zuordnungen` | administration | Laufzeit ungeprüft | /unternehmen/zuordnungen | `app/unternehmen/zuordnungen.native.tsx` |
| `/zentrale` | administration | Alias / Redirect | FEHLT | `app/zentrale/index.tsx` |
