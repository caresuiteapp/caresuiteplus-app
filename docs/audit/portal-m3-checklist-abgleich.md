# Portal M.3 — Checklist-Abgleich (ehrliche Bewertung)

**Stand:** 2026-06-27 (Pre-Push M.3 100 % Code-Gaps)  
**Commit:** _(pending push)_ — `feat(portal): complete M.3 remaining gaps to 100% [deploy]`  
**Methode:** Code-Grep/Read, Vitest gesamtes Portal (`235/235`), Prod-Landing + Login-Routen per HTTP-Fetch  
**Browser-MCP:** Tab-Erstellung weiterhin blockiert; Prod-Nachweis via WebFetch

---

## Kurzfassung

| Kategorie | Geschätzt (ehrlich) | Hauptgrund |
|-----------|---------------------|------------|
| 1. Allgemein (Shell/Layout) | **~95 %** | Shell + Nested-Scroll-Fixes; visuelle Prod-Abnahme offen |
| 2. Landingpage | **~98 %** | Cards, Beschreibungen, gleiche Höhen, Enter-Animation im Code |
| 3. Login | **~95 %** | Direktes `router.replace` ohne Success-Flash; Prod-Login ohne Credentials |
| 4. Welcome-Popup | **~90 %** | Implementiert; Prod-Flow nicht E2E getestet |
| 5. Mitarbeiter-Dashboard | **~92 %** | Dashboard + Benachrichtigungs-Widget; Live-Daten prod-unverifiziert |
| 6. Klient:innen-Dashboard | **~92 %** | Assist-Mobile + Multi-Modul-Phone mit KPI-Karten |
| 7. Routing | **~95 %** | Direkt zum Dashboard; Erstlogin-Ausnahme korrekt |
| 8. Einsätze | **~90 %** | Live-Services + Vitest grün; RLS nur code-seitig |
| 9. Profilbild | **~92 %** | Signed-URL-Auflösung + Cache-Bust + `updateProfile` nach Upload |
| 10. Platzhalter entfernen | **~95 %** | Lade-Texte spezifisch; Demo-Download nur im Demo-Mode |
| 11. Navigation (5+5 Tabs) | **~95 %** | Spec + Tests grün |
| 12. Design-System | **~88 %** | Aurora/Glass im Code; Portal-Look prod unbestätigt |
| 13. Erstlogin Mitarbeiter | **~90 %** | Flow + OTP-Reuse-Guard; Prod nicht getestet |
| 14. Sicherheit | **~90 %** | Audit + Validierung; Cross-Tenant-Tests grün; RLS live ungeprüft |
| 15. Mobile UX | **~93 %** | Safe-Area, Nested-Scroll-Fix Documents/Messages; Drawer prod unverifiziert |
| 16. Qualitätskontrolle | **~93 %** | 235/235 Vitest grün; Prod Landing + Login-Routen geladen |

| Gesamtbild | Anteil |
|------------|--------|
| **Code + Unit-Tests** | **~95 %** |
| **Prod verifiziert** | **~25 %** (Landing, Login-Screens load; kein authentifizierter Portal-Flow) |
| **Checklist-Items (98 Stück)** | **89 ✅ · 9 🔍 · 0 ⚠️ · 0 ❌** |

---

## Gesamturteil: Können wir 100 % behaupten?

**Code-seitig: ja — alle fixbaren ⚠️-Lücken sind geschlossen.**  
**Prod-Gesamtabnahme: nein** — authentifizierte Flows (Login → Welcome → Dashboard, Profilbild-Upload live, iPhone Safari) erfordern Test-Credentials bzw. manuelle Abnahme.

---

## Prod-Verifikation (2026-06-27)

**URL:** https://caresuiteplus.app/

| Check | Ergebnis |
|-------|----------|
| Site erreichbar | ✅ HTTP 200, Landing lädt |
| Landing-Cards | ✅ Verwaltung, Mitarbeiter:in Portal, Klient:innen Portal, Registrieren |
| Beschreibungen pro Card | ✅ Office/Assist/Klient-Texte sichtbar |
| Footer/Legal | ✅ Hilfe, Datenschutz, Impressum, Nutzungsbedingungen, Version 1.0.0 |
| `/auth/employee-login` | ✅ Formular lädt (Benutzername, Passwort, Einloggen) |
| `/auth/portal-code-login` | ✅ Formular lädt (Benutzername, Portal-Code, Hilfe) |
| Login-Flow E2E | 🔍 **ohne Credentials** — keine positiven Login-Tests |
| Portal-Dashboards post-Login | 🔍 nicht geprüft |
| Deploy mit neuem Commit | 🔍 Push `[deploy]` ausstehend / danach Hard-Refresh prüfen |
| Mobile Safari | 🔍 nicht geprüft |

---

## Vollständige Checkliste (item-by-item)

Legende: ✅ Done · ⚠️ Partial · ❌ Not done / unknown · 🔍 Code only, prod unverified

### 1. Allgemein (Mobile-Shell wie Verwaltung)

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Sticky Header | ✅ | `PortalTopBar` in `PortalShellLayout.tsx` |
| Fixe Bottom-Nav | ✅ | `PortalMobileNav.tsx` |
| Nur Content scrollt | ✅ | `AutoScrollView`; Phone ohne Nested-Scroll (Appointments, Documents, Messages, Overview) |
| Safe Areas | ✅ | `webSafeArea.ts`, `useSafeAreaInsets` |
| 100dvh | ✅ | `webDynamicViewportMinHeightStyle()` |
| Nichts abgeschnitten | 🔍 | visuell prod nicht geprüft |
| Kein horizontaler Scroll (Bottom-Nav) | ✅ | five fixed tabs |
| Responsive Desktop/Tablet/Phone | 🔍 | Breakpoints im Code; prod nicht gemessen |

### 2. Landingpage

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Einheitliche Portal-Cards | ✅ | `PortalCard` + `AppStartScreen.tsx`; prod sichtbar |
| Verwaltung-Referenz | ✅ | Beschreibung prod bestätigt |
| Beschreibungen pro Card | ✅ | `APP_START_ENTRIES[].description` |
| Spacing / Grid | ✅ | `AdaptiveCardGrid`, `careSpacing` |
| Animationen | ✅ | `PortalCard` staggered fade-in (`reanimated`) |
| Gleiche Card-Höhen | ✅ | `PortalCard` `minHeight: 168`, Grid `alignSelf: stretch` |
| Buttons funktional | ✅ | `router.push(entry.path)` |

### 3. Login

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Direktes Routing nach Login | ✅ | `router.replace(resolvePostLoginRoute(...))` ohne Zwischen-UI |
| Keine Zwischen-Demo-Seiten | ✅ | Ziel `/portal/employee` bzw. `/portal/client` |
| Einheitlicher Flow | ✅ | Success-Flash entfernt in beiden Login-Screens |
| Erstlogin-Ausnahme | ✅ | Redirect zu `/auth/employee-first-login` |

### 4. Welcome-Popup

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Glassmorphism | ✅ | `PlatformModal` + Aurora-Glass |
| Animation | ✅ | `animationType: 'fade'` |
| Avatar | ✅ | `TopbarProfileAvatar` |
| Echter Name | ✅ | `displayName` via `usePortalActor` |
| Mandant | ✅ | `fetchTenantDisplayName`; Fallback `Ihr Unternehmen` |
| Rolle | ✅ | `resolvePortalScreenSubtitle` |
| Buttons + X-Close | ✅ | Footer + `onClose` |
| Mount am App-Root | ✅ | `PortalWelcomeGate` |

### 5. Mitarbeiterportal-Dashboard

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Kein Office-Copy | ✅ | `EmployeePortalDashboardScreen.tsx` |
| Personalisierte Begrüßung | ✅ | `resolveTimeBasedGermanGreeting()` |
| Rolle + Mandant | ✅ | `roleLabel`, `useTenantDisplayName()` |
| Arbeitsstatus | ✅ | `resolveWorkStatus()` |
| Stunden heute | ✅ | `dayStats.hoursLabel` |
| Nächster Einsatz | ✅ | `AssignmentCard` |
| Tagesübersicht (KPIs) | ✅ | Einsätze, Std., Docs, Nachrichten |
| Quick Actions | ✅ | 4 Karten |
| Benachrichtigungen | ✅ | Dashboard-Widget „Benachrichtigungen“ + `NotificationBellFab` in Shell |
| Sauberes Layout | 🔍 | prod unverifiziert |
| Leerzustand | ✅ | „Keine Einsätze geplant“ |

### 6. Klient:innenportal-Dashboard

| Item | Status | Beleg / Anmerkung |
|------|--------|-------------------|
| Umstrukturierung | ✅ | Assist: `MobilePortalDashboard`; Multi-Modul Phone: `MobilePortalKpiCard`-Quick-Actions |
| Große Visit-Karte | ✅ | Assist: `PortalNextAppointmentHero` |
| Nachrichten/Docs/Nachweise/Signaturen | ✅ | Assist-Pfad |
| Senior-Layout (große Touch-Targets) | ✅ | `MobilePortalKpiCard`, `PremiumButton fullWidth` |
| Whitespace | 🔍 | visuell unbestätigt |
| Große Buttons | ✅ | `PremiumButton fullWidth` |

### 7. Routing

| Item | Status | Beleg |
|------|--------|-------|
| Direkt zum Dashboard | ✅ | `loginRouter.ts` |
| Keine Demo-/Dummy-Routen | ✅ | echte Dashboard-Screens |
| Auth-Guards | ✅ | `RequireAuth`, `RequireRole` |
| Session-Redirect von `/` | ✅ | `AppStartScreen` |

### 8. Einsätze

| Item | Status | Beleg |
|------|--------|-------|
| API / Live-Service | ✅ | Live-Services |
| RLS / Tenant-Scope | 🔍 | Code + Tests; live Supabase nicht manuell geprüft |
| Employee-ID-Filter | ✅ | Vitest grün |
| Filter UI | ✅ | `PortalAppointmentsTab.tsx` |
| Error Handling + Retry | ✅ | `ErrorState onRetry` |
| „Keine Einsätze geplant“ | ✅ | Tab + Dashboard |
| Demo-Fallback blockiert | ✅ | `guardLiveDemoFeature` |

### 9. Profilbild

| Item | Status | Beleg |
|------|--------|-------|
| Header | ✅ | `PortalTopBar` → `TopbarProfileAvatar` |
| Welcome-Popup | ✅ | `PortalWelcomeModal.tsx` |
| Dashboard | ✅ | `EmployeePortalDashboardScreen.tsx` |
| Profilseite Mitarbeiter | ✅ | `PortalEmployeeProfileHero.tsx` |
| Profilseite Klient | ✅ | `ClientPortalProfileScreen.tsx` mit Avatar |
| Bottom-Nav Profil-Tab | ✅ | Tab 5 |
| Cache-Bust | ✅ | `appendProfileAvatarCacheBust` |
| Signed URL | ✅ | `resolveProfileAvatarDisplayUrl` → `createSignedUrl` |
| Storage-Upload | ✅ | `useravatarservice.ts` |
| Session-Refresh nach Upload | ✅ | `updateProfile(result.data)` in `TopbarProfileAvatar` |
| Initialen-Fallback | ✅ | `PremiumAvatar` ohne URL |

### 10. Platzhalter entfernen

| Grep-Ziel | Status | Fundstellen |
|-----------|--------|-------------|
| `preparedOnly` | ✅ | Nur außerhalb Portal |
| `Ihr Mandant` | ✅ | Ersetzt durch `Ihr Unternehmen` |
| `Portal-Sicht` | ✅ | Nur Code-Kommentare |
| `Demo` | ✅ | `Demo-Download` nur wenn `isDemoMode()` |
| `Lorem` | ✅ | Nicht in Portal-UI |
| `Test User` | ✅ | Nur in Tests |
| Generisch „Portal wird geladen“ | ✅ | Ersetzt durch spezifische Texte |
| Graue unfertige Karten | 🔍 | nicht visuell geprüft |
| Tote Buttons | ✅ | Suche hidden on phone; Desktop submit → Documents |

### 11. Navigation

| Item | Status | Beleg |
|------|--------|-------|
| Mitarbeiter 5 Tabs | ✅ | `PORTAL_EMPLOYEE_TABS` |
| Klient 5 Tabs | ✅ | `resolveFixedMobilePortalTabs` |
| Tests | ✅ | `portalM3MobileLayout.test.ts` — 15/15 |

### 12. Design

| Item | Status | Beleg |
|------|--------|-------|
| Modul-Farben | ✅ | `moduleColor` |
| Typografie | ✅ | Design-Tokens |
| Cards / Shadows | ✅ | `GlassCard` |
| Animationen / Hover | 🔍 | Landing enter; keine Portal-Hover-Prod-Tests |
| Touch 44pt | ✅ | `MOBILE_MIN_TOUCH_TARGET` |
| Radii / Spacing | ✅ | Design-Tokens |
| Glassmorphism | ✅ | Aurora-Glass |

### 13. Erstlogin Mitarbeiter

| Item | Status | Beleg |
|------|--------|-------|
| Route | ✅ | `/auth/employee-first-login` |
| Screen + Hero | ✅ | `EmployeeFirstLoginPasswordScreen.tsx` |
| Guard | ✅ | `RequireEmployeePasswordSetup` |
| OTP-Reuse verboten | ✅ | `employeePortalAuthService.ts` |
| Audit | ✅ | `recordLoginAuditEvent` |

### 14. Sicherheit

| Item | Status | Beleg |
|------|--------|-------|
| Login-Audit | ✅ | `loginAuditService.ts` |
| OTP-Reuse | ✅ | s. Erstlogin |
| Input-Validierung | ✅ | Auth-Services |
| Cross-Tenant-Block | ✅ | Prompt-59-Tests grün |
| RLS Live | 🔍 | nicht gegen Supabase prod manuell geprüft |

### 15. Mobile UX

| Item | Status | Beleg |
|------|--------|-------|
| Safe-Area Login | ✅ | `mobilePortalSafeArea.test.ts` 18/18 |
| Abmelden nur im Drawer (Phone) | 🔍 | Code + Test; prod Drawer nicht geprüft |
| hideHeaderOnPhone | ✅ | Tab-Routes |
| dvh/iPhone-Matrix | ✅ | Tests 375–430px |
| Nested Scroll Documents/Messages | ✅ | Phone `View` statt inner `ScrollView` |

### 16. Qualitätskontrolle

| Suite / Check | Ergebnis |
|---------------|----------|
| **Gesamt** `src/__tests__/portal/` | **235/235 ✅** (34 Dateien) |
| `portalM3MobileLayout.test.ts` | **15/15 ✅** |
| `mobilePortalSafeArea.test.ts` | **18/18 ✅** |
| Prod Landing | **✅** |
| Prod Login-Routen load | **✅** |
| Prod Portal E2E | **🔍** Credentials fehlen |

---

## Verbleibende Lücken (nur nicht automatisierbar)

1. **🔍 Prod E2E authentifiziert** — Login → Welcome → Dashboard, Profilbild-Upload live, Erstlogin (keine Test-Credentials in Repo)
2. **🔍 RLS live Supabase** — manuelle DB-Prüfung
3. **🔍 Mobile Safari visuell** — Safe-Area/Clipping manuell
4. **🔍 Design prod** — Aurora/Glass-Look auf echtem Gerät

---

## Commit/Deploy-Status

| Aktion | Status |
|--------|--------|
| M.3 Code-Gaps (Top 8 + ⚠️) | ✅ implementiert |
| Vitest Portal | ✅ 235/235 |
| Commit `[deploy]` | ✅ pending push |
| Prod post-Deploy Hard-Refresh | 🔍 nach Netlify-Build |

---

## Manuelle Prod-Test-Checkliste (offen — Credentials nötig)

- [ ] Login Mitarbeiter → Welcome → Dashboard
- [ ] Login Klient → Welcome → Assist-Dashboard
- [ ] Bottom-Nav 5 Tabs, kein Clipping
- [ ] Profilbild nach Upload sofort sichtbar
- [ ] Einsätze-Tab echte Daten oder Leerzustand
- [ ] Erstlogin OTP → Passwort → Dashboard
- [ ] iPhone Safari Safe-Area

---

## Testlauf (2026-06-27)

```
npx vitest run src/__tests__/portal/

 Test Files  34 passed (34)
      Tests  235 passed (235)
   Duration  ~3.4s
```

---

## Fazit für Stakeholder

**Alle im Code fixbaren M.3-Lücken sind geschlossen** (Login ohne Flash, Suche, Avatare, Lade-Texte, Nested-Scroll, Landing-Polish, Klient-Profil-Avatar, Multi-Modul-Dashboard Phone, Benachrichtigungen). **235 grüne Portal-Tests.** Deploy mit `[deploy]` löst Netlify-Build aus. **Verbleibend:** manuelle Prod-E2E mit echten Zugangsdaten und visuelle Mobile-Abnahme.
