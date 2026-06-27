# Portal M.3 — Checklist-Abgleich (ehrliche Bewertung)

**Stand:** 2026-06-27  
**Methode:** Code-Grep/Read pro Unterpunkt, Vitest-Lauf (4 Portal-Suites), **kein** Prod-Check auf `caresuiteplus.app` in dieser Session  
**Uncommitted Fixes (Agent 546afeb9):** siehe Abschnitt [Lokale Änderungen](#lokale-änderungen-noch-nicht-committed)

---

## Kurzfassung

| Kategorie | Geschätzt (ehrlich) | Hauptgrund |
|-----------|---------------------|------------|
| 1. Allgemein (Shell/Layout) | **~82 %** | Code vollständig; Prod + visuelle Abnahme fehlen |
| 2. Landingpage | **~88 %** | Cards + Beschreibungen da; Animationen/Höhen nicht browser-verifiziert |
| 3. Login | **~85 %** | Direktes `router.replace`; kurzer Success-Flash bleibt sichtbar |
| 4. Welcome-Popup | **~85 %** | Implementiert; Animation/Glass nur code-seitig |
| 5. Mitarbeiter-Dashboard | **~80 %** | Dediziertes Dashboard; Live-Daten prod-unverifiziert |
| 6. Klient:innen-Dashboard | **~75 %** | Assist-Mobile stark; Multi-Modul-Pfad schwächer |
| 7. Routing | **~88 %** | Direkt zum Dashboard; Erstlogin-Ausnahme korrekt |
| 8. Einsätze | **~68 %** | Live-Services vorhanden; Vitest-Prompt-58/59 rot |
| 9. Profilbild | **~72 %** | Cache-Bust ja; Avatare Public-URL, kein Signed-URL-Flow |
| 10. Platzhalter entfernen | **~78 %** | Helos bereinigt; Rest „Portal wird geladen“, Demo-Download |
| 11. Navigation (5+5 Tabs) | **~92 %** | Spec + Tests grün |
| 12. Design-System | **~80 %** | Aurora/Glass im Code; Prod-Look unbestätigt |
| 13. Erstlogin Mitarbeiter | **~85 %** | Flow + OTP-Reuse-Guard; Prod nicht getestet |
| 14. Sicherheit | **~72 %** | Audit + Validierung im Code; Cross-Tenant-Test rot |
| 15. Mobile UX | **~78 %** | Safe-Area/dvh solide; 1 Layout-Test rot |
| 16. Qualitätskontrolle | **~55 %** | M.3-Layout grün; Execution/Prompt59 stark rot |

**Gesamt (Code-only): ~78 %**  
**Gesamt (inkl. Prod + alle Tests grün): ~55 %**

---

## Gesamturteil: Können wir 100 % behaupten?

**Nein — ausdrücklich nicht.**

Begründung in drei Sätzen:

1. **Production (`caresuiteplus.app`) wurde in keiner Session dieser Prüfung verifiziert** — alle Layout-, Dashboard- und Avatar-Befunde sind Code-only (🔍).
2. **Vitest:** 42/59 Tests grün in den 4 relevanten Suites; **17 Fehler** in `employeePortalExecution`, `clientPortalPrompt59`, `mobilePortalSafeArea` (Details unten).
3. **Rest-Platzhalter und Demo-Pfade** (z. B. `Demo-Download`, generische Lade-Texte, Public-Avatar-URLs) sind nicht vollständig eliminiert.

---

## Vollständige Checkliste (item-by-item)

Legende: ✅ Done · ⚠️ Partial · ❌ Not done / unknown · 🔍 Code only, prod unverified

### 1. Allgemein (Mobile-Shell wie Verwaltung)

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Sticky Header | ✅ | `PortalTopBar` in `PortalShellLayout.tsx` (zIndex 10, borderBottom) |
| Fixe Bottom-Nav | ✅ | `bottomNavHost` position absolute, `PortalMobileNav.tsx` |
| Nur Content scrollt | ✅ | `AutoScrollView` in `PortalShellLayout.tsx`; Phone ohne Nested-Scroll in `MobilePortalDashboard.tsx`, `AdaptivePortalOverview.tsx` (isPhone-Branch) |
| Safe Areas | ✅ | `webSafeArea.ts`, `useSafeAreaInsets`, `resolvePortalMobileContentPaddingBottom` |
| 100dvh | ✅ | `webDynamicViewportMinHeightStyle()`, CSS in `webSafeArea.ts` |
| Nichts abgeschnitten | 🔍 | `overflow: 'hidden'` auf Shell-Root; visuell prod nicht geprüft |
| Kein horizontaler Scroll (Bottom-Nav) | ✅ | `PortalMobileNav`: „five fixed tabs — no horizontal scroll“ |
| Responsive Desktop/Tablet/Phone | 🔍 | Breakpoints in `PortalShellLayout`; Desktop Left-Nav + optional Right-Sidebar |

### 2. Landingpage

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Einheitliche Portal-Cards | ✅ | `PortalCard` in `AppStartScreen.tsx` |
| Verwaltung-Referenz | ✅ | `appStartEntries.ts`: „Office, Personal, Abrechnung…“ |
| Beschreibungen pro Card | ✅ | `APP_START_ENTRIES[].description` |
| Spacing / Grid | ✅ | `AdaptiveCardGrid`, `careSpacing` |
| Animationen | ⚠️ | Keine dedizierten Card-Enter-Animationen gefunden |
| Gleiche Card-Höhen | 🔍 | `PortalCard` — nicht visuell gemessen |
| Buttons funktional | ✅ | `onPress={() => router.push(entry.path)}` |

### 3. Login

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Direktes Routing nach Login | ✅ | `EmployeePortalLoginScreen.tsx`: `router.replace(resolvePostLoginRoute(...))` |
| Keine Zwischen-Demo-Seiten | ✅ | Ziel `/portal/employee` bzw. `/portal/client` |
| Einheitlicher Flow | ⚠️ | Kurzer `SuccessState` „Weiterleitung…“ auf Login-Route vor Replace |
| Erstlogin-Ausnahme | ✅ | Redirect zu `/auth/employee-first-login` wenn `mustChangePassword` |

### 4. Welcome-Popup

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Glassmorphism | ✅ | `PlatformModal` + Aurora-Glass (`platformmodal.tsx`) |
| Animation | ✅ | Default `animationType: 'fade'` |
| Avatar | ✅ | `TopbarProfileAvatar` in `PortalWelcomeModal.tsx` |
| Echter Name | ✅ | `displayName` via `usePortalActor` / `getUserDisplayName` |
| Mandant | ✅ | `fetchTenantDisplayName` in `PortalWelcomeGate.tsx` |
| Rolle | ✅ | `ROLE_LABELS` + Fallback `resolvePortalScreenSubtitle` (uncommitted) |
| Buttons + X-Close | ✅ | Footer „Weiter zur Übersicht“, `onClose` + `dismissOnBackdrop` |
| Mount am App-Root | ✅ | `app/_layout.tsx` → `PortalWelcomeGate` |

### 5. Mitarbeiterportal-Dashboard

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Kein Office-Copy | ✅ | `EmployeePortalDashboardScreen.tsx` (nicht `PortalOverviewTab`) |
| Personalisierte Begrüßung | ✅ | `resolveTimeBasedGermanGreeting()` + `displayName` |
| Rolle + Mandant | ✅ | `roleLabel`, `useTenantDisplayName()` |
| Arbeitsstatus | ✅ | `resolveWorkStatus()` → „Im Einsatz“ / „Keine Einsätze heute“ |
| Stunden heute | ✅ | `dayStats.hoursLabel` aus geplanten Zeiten |
| Nächster Einsatz | ✅ | `currentAssignment` + `AssignmentCard` |
| Tagesübersicht (KPIs) | ✅ | Einsätze, Std., Docs, Nachrichten |
| Quick Actions | ✅ | 4 Karten: Einsätze, Dienstplan, Nachrichten, Profil |
| Benachrichtigungen | ⚠️ | `NotificationBellFab` in Shell; kein Dashboard-Widget |
| Sauberes Layout | 🔍 | Aurora Glass Cards — prod unverifiziert |
| Leerzustand | ✅ | „Keine Einsätze geplant“ |

### 6. Klient:innenportal-Dashboard

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Umstrukturierung | ⚠️ | Assist: `MobilePortalDashboard.tsx`; andere Module: `AdaptivePortalOverview` |
| Große Visit-Karte | ✅ | `PortalNextAppointmentHero` in Assist-Pfad |
| Nachrichten/Docs/Nachweise/Signaturen | ✅ | „Wichtig für Sie“, Modals, Sidebar-Cards |
| Senior-Layout (große Touch-Targets) | 🔍 | KPI-Cards + Buttons; prod nicht gemessen |
| Whitespace | 🔍 | `careSpacing` — visuell unbestätigt |
| Große Buttons | ✅ | `PremiumButton fullWidth` in mehreren Portal-Screens |

### 7. Routing

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Direkt zum Dashboard | ✅ | `loginRouter.ts` → `/portal/employee`, `/portal/client` |
| Keine Demo-/Dummy-Routen als Ziel | ✅ | Tab-Index nutzt echte Dashboard-Screens |
| Auth-Guards | ✅ | `RequireAuth`, `RequireRole`, `RequireEmployeePasswordSetup` in `_layout.tsx` |
| Session-Redirect von `/` | ✅ | `AppStartScreen` → `resolveAuthSessionTarget` |

### 8. Einsätze

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| API / Live-Service | ✅ | `portalAppointmentsLiveService.ts`, `employeePortalExecutionService.ts` |
| RLS / Tenant-Scope | 🔍 | Code + Migrationen; Prompt-59 Cross-Tenant-Test **rot** |
| Employee-ID-Filter | ⚠️ | Implementiert; Vitest Prompt 58 Test 1 **rot** (overview.ok false) |
| Filter UI | ✅ | `PortalAppointmentsTab.tsx` |
| Error Handling + Retry | ✅ | `ErrorState onRetry={refresh}` |
| „Keine Einsätze geplant“ | ✅ | `PortalAppointmentsTab`, Dashboard, `MobilePortalDashboard` |
| Demo-Fallback in Production blockiert | ✅ | `guardLiveDemoFeature` — Test 14 teils rot wegen Demo-Setup |

### 9. Profilbild

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Header | ✅ | `PortalTopBar.tsx` → `TopbarProfileAvatar` |
| Welcome-Popup | ✅ | `PortalWelcomeModal.tsx` |
| Dashboard | ✅ | `EmployeePortalDashboardScreen.tsx` |
| Profilseite | ✅ | `PortalEmployeeProfileHero.tsx` mit Avatar (uncommitted Pfad) |
| Bottom-Nav Profil-Tab | ✅ | Tab 5 in beiden Portalen |
| Cache-Bust | ✅ | `appendProfileAvatarCacheBust` in `TopbarProfileAvatar.tsx` |
| Signed URL | ⚠️ | Avatare: `resolveUserAvatarPublicUrl` (Public); Docs: `createSignedUrl` |
| Storage-Upload | ✅ | `useravatarservice.ts` |
| Session-Refresh nach Upload | ⚠️ | Cache-Bust hilft; kein expliziter Session-Refresh-Hook dokumentiert |
| Initialen-Fallback | ✅ | `TopbarProfileAvatar` ohne URL |

### 10. Platzhalter entfernen

| Grep-Ziel | Status | Fundstellen (Portal-relevant) |
|-----------|--------|-------------------------------|
| `preparedOnly` | ✅ (Portal) | Nur außerhalb Portal (Office/Admin); Portal-Helos bereinigt |
| `Ihr Mandant` | ⚠️ | Fallback → `Ihr Unternehmen` in uncommitted `tenantDisplayMeta.ts`; `BusinessWelcomeGate.tsx` noch `Ihr Mandant` (nicht Portal) |
| `Portal-Sicht` | ✅ UI | Aus Helos entfernt; nur noch Code-Kommentare in Announcement-Screens |
| `Demo` | ⚠️ | `PortalDocumentDetailHero.tsx`: `Demo-Download` wenn `isDemoMode()` |
| `Lorem` | ✅ | Nicht in Portal-UI |
| `Test User` | ✅ | Nur in Tests |
| Generisch „Portal“ | ⚠️ | Lade-Texte: `EmployeePortalOverviewScreen` (tot), `AssistPortalOverview` „Assist-Portal wird geladen“ |
| Graue unfertige Karten | 🔍 | Nicht systematisch visuell geprüft |
| Tote Buttons | ⚠️ | `PortalTopBar` Suche ohne Handler (UI-only) |

### 11. Navigation

| Item | Status | Beleg |
|------|--------|-------|
| Mitarbeiter 5 Tabs | ✅ | `PORTAL_EMPLOYEE_TABS`: Übersicht, Einsätze, Dienstplan, Nachrichten, Profil |
| Klient 5 Tabs (Mobile) | ✅ | `resolveFixedMobilePortalTabs`: Übersicht + 4 aus `PORTAL_MOBILE_TAB_KEYS` |
| Tests | ✅ | `portalM3MobileLayout.test.ts` — 13/13 grün |

### 12. Design

| Item | Status | Beleg |
|------|--------|-------|
| Modul-Farben | ✅ | `moduleColor('assist')`, Accent pro Portal |
| Typografie | ✅ | `resolveGalaxyTypography`, `careTypography` |
| Cards / Shadows | ✅ | `GlassCard`, `PremiumListHeroFrame` |
| Animationen / Hover | 🔍 | Web-Cursor-Styles; keine Portal-spezifischen Hover-Tests |
| Touch 44pt | ✅ | `MOBILE_MIN_TOUCH_TARGET` in Nav + TopBar |
| Radii / Spacing | ✅ | Design-Tokens |
| Glassmorphism | ✅ | Aurora-Glass-Token-Pipeline |

### 13. Erstlogin Mitarbeiter

| Item | Status | Beleg |
|------|--------|-------|
| Route | ✅ | `/auth/employee-first-login` |
| Screen + Hero | ✅ | `EmployeeFirstLoginPasswordScreen.tsx` |
| Guard im Portal-Layout | ✅ | `RequireEmployeePasswordSetup` |
| OTP-Reuse verboten | ✅ | `employeePortalAuthService.ts` Zeile 323–328 |
| Audit nach Passwort-Wechsel | ✅ | `recordLoginAuditEvent` |

### 14. Sicherheit

| Item | Status | Beleg |
|------|--------|-------|
| Login-Audit | ✅ | `loginAuditService.ts` → `login_audit_events` |
| OTP-Reuse-Validierung | ✅ | s. Erstlogin |
| Input-Validierung Portal-Login | ✅ | Auth-Services mit Fehlermeldungen |
| Cross-Tenant-Block | ⚠️ | Test 11 Prompt 59 **rot** (`tenantGuard` null) |
| RLS Live | 🔍 | Nicht in dieser Session gegen Supabase geprüft |

### 15. Mobile UX

| Item | Status | Beleg |
|------|--------|-------|
| Safe-Area Login | ✅ | `mobilePortalSafeArea.test.ts` (17/18) |
| Abmelden nur im Drawer (Phone) | ⚠️ | Test erwartet altes Ternary-Muster; Code nutzt `profileMenuItems` Array — **Test veraltet oder Refactor unvollständig** |
| hideHeaderOnPhone | ✅ | Tab-Routes + `PortalTabScreen` |
| dvh/iPhone-Matrix dokumentiert | ✅ | Tests für 375–430px Viewports |

### 16. Qualitätskontrolle

| Suite | Ergebnis |
|-------|----------|
| `portalM3MobileLayout.test.ts` | **13/13 ✅** |
| `mobilePortalSafeArea.test.ts` | **17/18** (PortalTopBar Profilmenü) |
| `employeePortalExecution.test.ts` | **4/14** (Demo/Production-Guard-Konflikt) |
| `clientPortalPrompt59.test.ts` | **8/14** |
| Browser E2E Prod | **❌ nicht ausgeführt** |

---

## Top 10 verbleibende Lücken (priorisiert)

1. **🔴 Prod-Abnahme `caresuiteplus.app`** — kein visueller/ funktionaler Nachweis in dieser Session  
2. **🔴 Vitest Prompt 58/59** — Einsätze, Nachrichten, Signaturen, Cross-Tenant (17 failing tests)  
3. **🟠 Live-Daten Einsätze** — Employee-Overview schlägt in Tests fehl (`overview.ok === false`)  
4. **🟠 Uncommitted Fixes committen** — Tenant-Fallback, Welcome-Rolle, AppointmentsTab (s. unten)  
5. **🟠 Profilbild Signed-URL / Upload-Refresh** — Public URL + Cache-Bust only; hartes Reload evtl. nötig  
6. **🟡 PortalTopBar-Suche** — UI ohne Such-Logik (wirkt wie tote Funktion)  
7. **🟡 Demo-Download Label** — `PortalDocumentDetailHero` in Demo-Mode  
8. **🟡 Generische Lade-Texte** — „Assist-Portal wird geladen“, legacy Overview-Screens  
9. **🟡 Klient Multi-Modul-Dashboard** — schwächer als Assist-`MobilePortalDashboard`  
10. **🟡 Login Success-Flash** — kurzer Zwischenzustand trotz `router.replace`

---

## Lokale Änderungen (noch nicht committed)

Agent **546afeb9** — relevante unstaged Dateien:

| Datei | Änderung |
|-------|----------|
| `src/lib/tenant/tenantDisplayMeta.ts` | `Ihr Mandant` → `Ihr Unternehmen` |
| `src/hooks/useTenantDisplayMeta.ts` | Angepasst an neues Fallback |
| `src/components/auth/PortalWelcomeGate.tsx` | Rollen-Fallback `Portalzugang` → `resolvePortalScreenSubtitle` |
| `src/components/portal/PortalAnnouncementsHero.tsx` | Scope-Labels statt Platzhalter |
| `src/components/portal/PortalAppointmentsTab.tsx` | Scroll/Empty-State-Fixes |
| `src/components/portal/PortalClientProfileHero.tsx` | Hero-Bereinigung |
| `app/portal/client/(tabs)/appointments.tsx` | Route-Anpassung |
| `app/portal/employee/(tabs)/assignments.tsx` | `scroll={false}` + Tab-Screen |

**Empfehlung:** Commit als M.3-Nachzügler **vor** Deploy; allein reicht nicht für 100 %-Behauptung.

---

## Was braucht Commit/Deploy?

| Aktion | Warum |
|--------|-------|
| **Commit** der 8 Portal-Dateien oben | Tenant-Fallback + Welcome-Rolle + Appointments live |
| **Deploy mit `[deploy]`** (nur auf explizite Anfrage) | Prod currently unverified |
| **Kein Deploy** ohne Prod-Testplan | Risiko: erneute Nutzer-Abnahme negativ |

---

## Was braucht manuellen Prod-Test?

Checkliste für `https://caresuiteplus.app` (iPhone Safari + Desktop):

- [ ] Login Mitarbeiter → Welcome → Dashboard ohne Office-Layout
- [ ] Login Klient → Welcome → Assist-Dashboard mit großer Termin-Karte
- [ ] Bottom-Nav 5 Tabs, kein Clipping, Safe-Area unten
- [ ] Profilbild nach Upload sofort sichtbar (Header + Welcome + Profil)
- [ ] Einsätze-Tab: echte Daten oder „Keine Einsätze geplant“
- [ ] Erstlogin: OTP → neues Passwort → Dashboard
- [ ] Kein „Portal-Sicht“, „Ihr Mandant“, „Demo-Download“ sichtbar
- [ ] Horizontalscroll / abgeschnittene Header prüfen

---

## Testlauf (diese Session)

```
npx vitest run \
  src/__tests__/portal/portalM3MobileLayout.test.ts \
  src/__tests__/portal/mobilePortalSafeArea.test.ts \
  src/__tests__/portal/employeePortalExecution.test.ts \
  src/__tests__/portal/clientPortalPrompt59.test.ts

Ergebnis: 42 passed | 17 failed (59 total)
```

---

## Fazit für Stakeholder

Die **M.3-Architektur (Shell, 5+5 Tabs, dedizierte Dashboards, Welcome-Gate, Platzhalter-Bereinigung)** ist im Code **weitgehend umgesetzt (~78 %)**.  
**100 % Abnahme ist nicht vertretbar** ohne: (1) Prod-Verifikation, (2) grüne Prompt-58/59-Tests, (3) Commit der lokalen Fixes, (4) manuelle Mobile-Safari-Abnahme.
