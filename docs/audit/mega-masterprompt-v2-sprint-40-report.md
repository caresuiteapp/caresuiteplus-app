# MEGA Masterprompt v2 — Sprint 40 Report

**Datum:** 2026-06-14  
**Scope:** View-Präferenz Durchführung + Fahrten + Store/EAS-Audit  
**Verdict:** UX-Persistenz + Audit-Dokumentation — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 40 schloss die **View-Toggle-Persistenz-Lücke** für Assist (Sprint 35/38 hatten Toggle ohne AsyncStorage für Durchführung/Fahrten) und dokumentierte **Store/EAS-Audit**-Ergebnisse. Keine P0-Fixes nötig — alle Audit-Warnungen sind erwartete Platzhalter.

---

## 2. Implementiert

| Modul | Route | Änderung |
|-------|-------|----------|
| Durchführung | `/assist/(tabs)/durchfuehrung` | `useDesktopListViewPreference('assist.executions')` |
| Fahrten | `/assist/(tabs)/fahrten` | `useDesktopListViewPreference('assist.trips')` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/components/assist/ExecutionsListView.tsx` | Persistierter View-Modus |
| `src/components/assist/TripsListView.tsx` | Persistierter View-Modus |
| `src/__tests__/office/officeDesktopListViewPreference.test.ts` | +2 Wiring-Tests Assist |

**UX:** Desktop-Umschalter Karten/Tabelle überlebt App-Neustart für alle vier View-Toggle-Listen (Klient:innen, MA, Durchführung, Fahrten).

---

## 3. Store/EAS-Audit (2026-06-14)

| Audit | Ergebnis |
|-------|----------|
| `npm run platform:audit` | ✅ **PASS** — 22 Plattform-Dateien, app.config.ts, eas.json Profile |
| `npm run store:audit` | ✅ **PASS** (Exit 0) — **4 Warnungen** |

**store:audit Warnungen (nicht blockierend, kein P0-Fix):**

| Warnung | Status |
|---------|--------|
| EAS_PROJECT_ID Platzhalter | Erwartet — `eas project:init` vor Build |
| Apple-Credentials Platzhalter | Erwartet — vor iOS Submit |
| Google Play Service-Account fehlt | Erwartet — vor Android Submit |
| DataRequestScreen / AccountDeletionRequestScreen fehlen | DSGVO-Screens offen — supportLinks vorhanden |

**store:audit Bestanden:**

- 13 Store-/Deployment-Dokumente
- App-Identität konsistent (CareSuite+, caresuiteplus)
- Bundle-ID `de.caresuiteplus.app`
- Store-Assets nicht Platzhalter-Größe
- Android permissions nur INTERNET
- privacy-data-map.md + supportLinks.ts vorhanden

---

## 4. Verhalten

| Aspekt | Detail |
|--------|--------|
| Storage-Keys | `assist.executions`, `assist.trips` |
| Default | `table` auf Desktop |
| Migrationen | Keine — UI-only |

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **619** passed (+2 zu Sprint 39) |
| `npm run smoke` | ✅ 253 routes |
| `npm run platform:audit` | ✅ PASS |
| `npm run store:audit` | ✅ PASS (4 Warnungen) |

---

## 6. Deferred to Sprint 41+

| Priorität | Item |
|-----------|------|
| P2 | QM Dokumente Live-Repository |
| P2 | Bewohner/Kurse View-Präferenz (Desktop-Toggle ohne Persistenz) |
| P2 | Remote-Migrationen 0021–0030 anwenden + Live-Pilot-Seed |
| P3 | DSGVO DataRequest/AccountDeletion Screens |
| P3 | EAS project:init + Preview Builds |

---

## 7. Verdict

Assist Desktop-Listen merken sich jetzt Karten/Tabelle — alle vier View-Toggle-Module haben Persistenz. Store-Audit bestätigt Build-Vorbereitung OK, Submission noch nicht ready (4 erwartete Warnungen).
