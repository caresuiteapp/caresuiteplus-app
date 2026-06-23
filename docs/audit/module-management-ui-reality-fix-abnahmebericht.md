# Module & Lizenzen UI Reality Fix — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** `/business/modules` — Lesbarkeit, Mandanten-Texte, Modulstatus, kein K.6, kein Deploy  
**Commit-Message:** `fix(modules): improve license management readability`

---

## 1. Ausgangsbefund

Die Seite „Module verwalten“ wirkte wie ein internes Feature-Flag-Dashboard:

- Hero mit „BUSINESS · FREE PLATFORM“, „0 € — kein Abo“, dominanter Aurora-Gradient
- Sichtbares Badge `preparedOnly`
- Redundante Statuschips (Aktiv + Freigeschaltet + Kostenlos aktiv)
- Technischer Dev-Toast „INTAKE_NEW_ROUTE is not …“ (LogBox, unten links)
- Breadcrumb „Module verwalten“ statt fachlicher Office-Navigation

---

## 2. Lesbarkeitsprobleme (behoben)

| Problem | Fix |
|---------|-----|
| Blasse Texte auf Glas | KPI `variant="light"`, adaptive Text-Tokens in Hero-Intro |
| Dominanter Pink/Türkis-Hero | `PremiumListHeroFrame` entfernt → kompaktes `SectionPanel surface="open"` |
| Redundante Chips | Max. 3 Chips via `buildModuleStatusChips` |
| Große Deaktivieren-Buttons | Primär „Modul öffnen“, Deaktivieren als Ghost mit Confirm |

---

## 3. Entfernte interne Texte

- `Free Platform`, `BUSINESS · FREE PLATFORM`, `0 € / Monat — kostenlos`
- `preparedOnly` → „In Vorbereitung“ / „Noch nicht buchbar“
- Technische Office-Hinweise („erscheint in Navigation…“)
- Route-/Debug-Fehler via `sanitizeUserFacingError` und LogBox-Filter

---

## 4. Neue Seitenstruktur

| Element | Wert |
|---------|------|
| Breadcrumb | Start › Office › Module & Lizenzen |
| Titel | Module & Lizenzen |
| Untertitel | Module verwalten, freischalten und Mandantenfunktionen steuern |
| KPI | Aktive Module · Verfügbare Module · Enthaltene Basismodule · Erweiterungen |
| Sektion Module | „Aktive und verfügbare Module“ |
| Erweiterungen | „Erweiterungen in Vorbereitung“ |

Header-/Toolbar-Aktionen: Verfügbare Module, Aktive Module, Erweiterungen ansehen, Hilfe zu Modulen.

---

## 5. Modulstatuslogik

Neue Mapping-Schicht `moduleManagementLabels.ts`:

1. **Aktivität:** Aktiv · Verfügbar · In Vorbereitung · Gesperrt  
2. **Typ:** Basismodul · Fachmodul  
3. **Kosten:** Kostenlos enthalten · Kostenlos aktivierbar · Noch nicht buchbar  

Office: Basismodul, kein Deaktivieren, Hinweis „Office ist das Basismodul der Plattform.“

---

## 6. Premium-/Erweiterungen

- Titel: **Erweiterungen in Vorbereitung**
- Status-Chips: In Vorbereitung · Noch nicht buchbar · Nicht aktiv
- Connectors: DATEV, KIM/TI, TI-Connector, E-Rezept (deutsche Labels)

---

## 7. Button-/Aktionslogik

| Zustand | Primär | Sekundär |
|---------|--------|----------|
| Aktiv | Modul öffnen | Einstellungen · Deaktivieren (Confirm) |
| Verfügbar | Kostenlos aktivieren (Confirm) | Mehr Informationen |
| Vorbereitet | In Vorbereitung (disabled) | Mehr erfahren |

---

## 8. Toast-/Fehlertext-Fix

- `INTAKE_NEW_ROUTE` Legacy-Alias in `clientRoutes.ts`
- `sanitizeUserFacingError()` für Mandanten-UI
- Dev-LogBox filtert `INTAKE_NEW_ROUTE`-Meldungen (Web-Dev)

---

## 9. Tests / Typecheck

| Log | Ergebnis |
|-----|----------|
| `.audit-test-module-management-ui-reality-fix.log` | ✅ 14/14 |
| `.audit-typecheck-module-management-ui-reality-fix.log` | ⚠️ Repo-weite vorbestehende TS-Fehler; geänderte Module-Dateien ohne neue Fehler |

---

## 10. Browser-Abnahme

**Status:** BLOCKED — Dev-Server/Auth in dieser Session nicht für `/business/modules` verifiziert.

Empfohlene Checks nach Login:

1. Titel „Module & Lizenzen“, kein „Free Platform“
2. Kein `preparedOnly`, kein technischer Toast
3. Office als Basismodul, Assist mit „Modul öffnen“ primär
4. Erweiterungen „In Vorbereitung“

---

## 11. Nicht ausgeführt

- Kein K.6 / keine finale Rechnung / keine Rechnungsnummern
- Kein Deploy, keine Migration, keine produktiven Datenänderungen

---

## 12. Geänderte Dateien

- `src/screens/ModuleOverviewScreen.tsx`
- `src/components/modules/BusinessModuleHubHero.tsx`
- `src/components/modules/ModuleCard.tsx`
- `src/components/billing/PremiumPreparedNotice.tsx`
- `src/lib/modules/moduleManagementLabels.ts` (neu)
- `src/lib/modules/moduleHubStats.ts`
- `src/lib/navigation/breadcrumbs.ts`, `routes.ts`, `clientRoutes.ts`
- `src/data/navigation/moduleNavConfig.ts`
- `src/lib/ui/uiVisibility.ts`
- `src/devtools/registerDevAudit.ts`
- `src/__tests__/modules/moduleManagementUiRealityFix.test.ts` (neu)
- `src/__tests__/modules/businessModuleHubHero.test.ts`

---

## 13. Checkliste §18 (17 Punkte)

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Lesbarkeit korrigiert | ✅ |
| 2 | Hero-Bereich reduziert | ✅ |
| 3 | `Free Platform` entfernt | ✅ |
| 4 | `preparedOnly` entfernt | ✅ |
| 5 | `INTAKE_NEW_ROUTE` Toast entfernt | ✅ |
| 6 | Statuschips vereinfacht | ✅ |
| 7 | Office als Basismodul korrekt | ✅ |
| 8 | Assist als Fachmodul korrekt | ✅ |
| 9 | Premium-Erweiterungen verständlich | ✅ |
| 10 | Deaktivieren entschärft | ✅ |
| 11 | Technische Texte entfernt | ✅ |
| 12 | Browser-Abnahme durchgeführt | ⚠️ BLOCKED (Auth) |
| 13 | Tests | ✅ 14/14 |
| 14 | Typecheck geänderte Dateien | ✅ keine neuen Fehler |
| 15 | Commit Hash | siehe Git |
| 16 | Push erfolgreich | siehe Git |
| 17 | Berichtspfad | `docs/audit/module-management-ui-reality-fix-abnahmebericht.md` |
