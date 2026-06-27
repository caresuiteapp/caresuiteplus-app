# Portal M.3 — Abnahmebericht

Stand: 2026-06-27

## Zusammenfassung

Mitarbeiter- und Klient:innenportal wurden an die mobile Office-Shell (sticky Header, fixe Bottom-Nav, scroll-only Content, `100dvh` + Safe-Area) angeglichen. Nach Login erscheint ein Willkommensdialog mit echtem Namen, Mandant und Rolle. Das Mitarbeiter-Dashboard nutzt Einsatz-Projektionen statt des generischen `PortalOverviewTab`. Das Klient:innen-Dashboard wurde für Senior-freundlichere Hierarchie überarbeitet.

## Phasen

| Phase | Status | Kurzbeschreibung |
|-------|--------|------------------|
| 1 Mobile Shell | Erledigt | Shell auf `_layout`-Ebene, 5 Tabs, korrekte Nav-Area |
| 2 Welcome Popup | Erledigt | `PortalWelcomeGate` + Modal nach Login |
| 3 Employee Dashboard | Erledigt | `EmployeePortalDashboardScreen` |
| 4 Client Dashboard | Erledigt | `MobilePortalDashboard` Hierarchie + kein Nested-Scroll |
| 5 Fixes | Teilweise | Einsätze-Texte, Portal-Sicht entfernt; Avatar-Signed-URLs offen |
| 6 AppStart Shell | Offen | Nicht in diesem Durchlauf |
| 7 Tests + Doc | Erledigt | `portalM3MobileLayout.test.ts`, dieser Bericht |

## Checkliste (Abschnitt 15)

- [x] Sticky Header + fixe Bottom-Nav (Employee + Client)
- [x] Nur Content scrollt (`AutoScrollView` in `PortalShellLayout`)
- [x] Safe-Area / `100dvh` über `webSafeArea` + `webDynamicViewportMinHeightStyle`
- [x] Employee-Tabs: Übersicht, Einsätze, Dienstplan, Nachrichten, Profil
- [x] Client-Tabs: Übersicht, Einsätze, Dokumente, Nachrichten, Profil
- [x] Welcome-Modal nach Login (Name, Mandant, Rolle)
- [x] Kein generisches „Portal“-Dummy-Dashboard für Mitarbeitende
- [x] Einsätze leer → „Keine Einsätze geplant.“
- [x] Einsätze Fehler → Retry statt „nicht verfügbar“
- [ ] Profilbilder überall mit Signed-URL-Cache-Bust (Header teilweise über `profile.avatarUrl`)
- [ ] Vollständiges Entfernen aller Demo-/Test-Platzhalter (grep Restbestände)
- [ ] AppStartScreen mobile Shell (Phase 6)

## Geänderte Dateien (Auswahl)

- `src/components/layout/portal/PortalShellLayout.tsx`
- `src/components/layout/portal/PortalTopBar.tsx`
- `app/portal/employee/_layout.tsx`, `app/portal/client/_layout.tsx`
- `app/portal/employee/(tabs)/*`, `app/portal/client/(tabs)/_layout.tsx`
- `src/lib/navigation/shellConfig.ts`, `portalMobileTabs.ts`, `shellMobileTabs.ts`
- `src/lib/auth/portalWelcomeSession.ts`
- `src/components/auth/PortalWelcomeModal.tsx`, `PortalWelcomeGate.tsx`
- `src/screens/portal/EmployeePortalDashboardScreen.tsx`
- `src/hooks/useEmployeePortalDashboard.ts`
- `src/components/portal/assist/MobilePortalDashboard.tsx`
- `src/__tests__/portal/portalM3MobileLayout.test.ts`

## Verifikation auf localhost

1. Dev-Server starten: `npm run web` (oder `npx expo start --web`)
2. **Mitarbeiterportal**: `/auth/employee-login` → Login → Welcome-Modal → `/portal/employee`
   - Bottom-Nav: Übersicht / Einsätze / Dienstplan / Nachrichten / Profil
   - Nur Listenbereich scrollt; Header + Nav bleiben fix
3. **Klient:innenportal**: `/auth/client-login` (Portal-Code) → Welcome → `/portal/client`
   - Hierarchie: Begrüßung → Nächster Einsatz → Wichtig für Sie → Weitere Bereiche
4. Tests: `npx vitest run src/__tests__/portal/portalM3MobileLayout.test.ts`

## Offene Punkte

- Signed-URL-Avatare mit Cache-Bust in Welcome, Nav und Profil vereinheitlichen
- `AppStartScreen` an Portal-Shell anlehnen (Phase 6)
- Verbleibende Platzhalter (`Ihr Mandant` als Live-Fallback in `useTenantDisplayName`) durch echte Mandantennamen ersetzen sobald Tenant geladen
- Detail-Helos (`PortalAppointmentDetailHero` etc.) noch „Portal-Sicht“-Badge prüfen
