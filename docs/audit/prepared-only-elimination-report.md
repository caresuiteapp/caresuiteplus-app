# CareSuite+ Prepared-Only Elimination Sprint — Audit Report

**Datum:** 2026-06-14  
**Verdict:** Kernmodule sind demo-funktional ohne „In Vorbereitung"-Blocker. Externe Anbindungen (TI, eMP, GPS-Echtzeit, DATEV, Store) bleiben ehrlich als extern gekennzeichnet — nicht als irreführende Vollfunktion.

---

## A. Executive Summary

Der Sprint eliminiert „In Vorbereitung" / `preparedOnly` für alle normalen Kernfunktionen. Pflege P0 (Vitalwerte, Medikation, Wunddokumentation, Pflegedokumentation, Dienstpläne, SIS) ist demo-bedienbar mit Listen, Details, Create/Edit und Demo-CRUD. Assist, Beratung, Stationär, Akademie und Office-Kernscreens sind ebenfalls demo-funktional. Ein `FeatureStatus`-Modell ersetzt pauschale Blocker. Quality Gates (typecheck, test, smoke, prepared-only:audit, content:audit, visual/platform/store/design/responsive) sind grün.

---

## B. Ausgangslage

| Kennzahl | Wert |
|----------|------|
| Gefundene Marker vorher (src/app, alle Varianten) | ~312 Treffer |
| Davon Core-Pfade mit harten UI-Blockern | ~62 Dateien |
| Entfernte/ersetzte Core-Marker | ~58 Dateien bereinigt |
| Verbleibende erlaubte Marker | TI, Insight, Release, Ops, QA, Privacy, Integrations |

---

## C. Status-Modell

**Datei:** `src/lib/status/featureStatus.ts`

| Status | UI-Label |
|--------|----------|
| `available_demo` | Demo-funktional |
| `available_live` | Live angebunden |
| `partial_live` | Teilweise live |
| `requires_external_provider` | Externe Anbindung erforderlich |
| `requires_credentials` | Zugangsdaten erforderlich |
| `disabled_by_admin` | Vom Admin deaktiviert |

Erlaubte `preparedOnly`-Keys: `ti`, `kim`, `epa`, `erezept`, `emp`, `egk_live`, `external_ai_provider`, `push_provider`, `payment_provider`, `datev`, `external_cost_bearer_api`, `store_submission`.

---

## D. Pflege P0 — Umsetzung

| Funktion | Routen | Demo-Daten | CRUD |
|----------|--------|------------|------|
| Vitalwerte | `/pflege/vitalwerte`, `/new`, Klient-Akte | 32 Messungen | `createVitalReading` |
| Medikation | `/pflege/medikation`, `/new` | 15 Verordnungen | Liste/Detail demo |
| Wunddokumentation | `/pflege/wunden`, `/new`, BodyMap | 12 Wundfälle | Liste/Detail demo |
| Pflegedokumentation | `/pflege/berichte` | 25 Nachweise | Sign/PDF demo |
| Dienstpläne | `/pflege/dienstplaene` | 140 Schichten (2×14×10) | Liste demo |
| SIS | `/pflege/sis`, Assessments | 12 Assessments | Form demo-funktional |

**Konfiguration:** `src/lib/pflege/pflegeModuleConfig.ts` — alle Kern-`is*LiveReady()` → `true`, Write-Pfade über `isPflegeDemoFunctional()`.

---

## E. Assist P0

| Funktion | Status |
|----------|--------|
| Einsätze, Aufgaben, Nachweise, Signaturen | Demo-funktional |
| Fahrten, Touren | Live-fähig / Demo-Fallback |
| Kalender | Demo-Platzhalter ohne „Demnächst"-Blocker |
| Live-Status / GPS-Echtzeit | **Extern** (GPS extern Badge) |
| Qualitätsprüfung | Navigierbar über QA-Hub (Ops-Bereich) |

---

## F. Beratung P0

Fälle, Fallakte, Protokolle, Maßnahmen, Wiedervorlagen: demo-funktional. Auswertungen/Einstellungen: `isBeratungExtensionLiveReady() → true`, InfoBanner auf Demo-Copy.

---

## G. Stationär P0

Bewohner, Zimmer, Belegung, Tagesstruktur, Mahlzeiten, Aktivitäten, Übergabe, Risiken: Tiles ohne `preparedOnly`, Wohnbereiche/Übergabe demo-funktional.

---

## H. Akademie P0

Kurse, Lektionen, Teilnehmende, Prüfungen, Zertifikate, Pflichtschulungen: demo-funktional. Extension-Readiness → `true`.

---

## I. Office P0

Klient:innen, Mitarbeitende, Dokumente, Verträge, Einwilligungen, Rechnungen, Vorlagen, QM-Handbuch: bestehende Office-Architektur unverändert nutzbar; Employee-Detail von „Vollprofil in Vorbereitung" → „Teilweise live".

---

## J. Vorlagen-System

Bestehende Template-Routen und Catalog-Integration unverändert; keine neuen Blocker eingeführt.

---

## K. QM-System

Handbuch, Kapitel, Versionen, Maßnahmen, Audit-Pakete: unverändert live-fähig nach Migration 0015; KI/MD-Erweiterungen bleiben extern/prepared in QM-Config.

---

## L. Demo-Datenmengen (neu/erweitert)

| Domäne | Vorher | Nachher |
|--------|--------|---------|
| Vitalwerte | 10 | 32 |
| Medikation | 4 | 15 |
| Wunden | 3 | 12 |
| Pflegeberichte | 2 | 25 |
| Dienstpläne | 5 | 140 |
| SIS | 4 | 12 |

**Generator:** `src/data/demo/generators/pflegeDemoGenerators.ts`

---

## M. Migrationen

**Neu:** `supabase/migrations/0040_prepared_only_elimination.sql`

- Tabelle `care_shift_plans` + RLS
- Indizes auf `client_vital_signs`, `client_medications`
- Non-destructive, idempotent

Bestehend: `0039_client_context_intake_record_locale_catalogs.sql` (client_medications, client_vital_signs).

---

## N. Services

| Service | Änderung |
|---------|----------|
| medicationListService / Detail | Live-Blocker entfernt, Demo-Fallback |
| woundDocumentationService / Detail | Live-Blocker entfernt, Demo-Fallback |
| shiftScheduleService | Live-Blocker entfernt, 140 Demo-Schichten |
| vitalService | `createVitalReading` für Demo-CRUD |
| pflegeModuleConfig | Feature-Status + demo-funktional Gates |

---

## O. Tests

**Neu:** `src/__tests__/preparedOnlyElimination.test.ts` (7 Tests)

Aktualisiert: `pflegeBatch2–5`, Dashboard-Hero-Tests Assist/Beratung/Stationär/Akademie, GPS/Employee-Detail-Tests.

**Ergebnis:** 194 Test-Dateien, 1312 Tests — alle grün.

---

## P. Audit-Scripts

| Script | npm | Ergebnis |
|--------|-----|----------|
| `scripts/prepared-only-audit.mjs` | `prepared-only:audit` | ✓ 0 Core-Verstöße |
| `scripts/content-architecture-audit.mjs` | `content:audit` | ✓ inkl. Pflege-Demo-Minimums |

---

## Q. Quality Gates

| Gate | Status |
|------|--------|
| `npm run typecheck` | ✓ |
| `npm run test` | ✓ 1312/1312 |
| `npm run smoke` | ✓ |
| `npm run prepared-only:audit` | ✓ |
| `npm run content:audit` | ✓ |
| `npm run visual:audit` | ✓ |
| `npm run platform:audit` | ✓ |
| `npm run store:audit` | ✓ (2 Warnungen, erwartet) |
| `npm run design:audit` | ✓ |
| `npm run responsive:audit` | ✓ |

---

## R. Final Verdict

CareSuite+ Kernmodule sind **demo-funktional** und ohne irreführende „In Vorbereitung"-Sperren für Listen, Details, Navigation und Demo-CRUD. Externe Provider (TI/eMP/GPS/DATEV/Store) bleiben **ehrlich extern** gekennzeichnet. Kein Anspruch auf Produktiv-Live-Readiness oder Store-Submission — Pilot-Demo-Mandant bleibt ehrlich als Demo gekennzeichnet.
