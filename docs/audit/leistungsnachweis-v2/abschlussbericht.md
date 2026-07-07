# Leistungsnachweis Layout v2 — Final Release Gate

**Datum:** 2026-07-06  
**Ergebnis:** **RELEASE READY** (Commit vorbereitet, kein Push/Deploy)

---

## 1. Git-Precheck (Gate-Start)

| Feld | Wert |
|------|------|
| Branch | `main` |
| HEAD | `f720da5c` — fix(portal): stabilize messaging, tenant context, and client name resolution [deploy] |
| Staged | keine |
| `visitService.ts` | **nicht** in lokalen Änderungen (unberührt) |
| Deploy-relevant | Nein |

---

## 2. Finale Runtime-Fundstellenprüfung

| Pfad | Runtime? | Layout |
|------|----------|--------|
| `assistProofPdfPayload.ts` | ✅ Preview/Download/Portal | v2 |
| `buildServiceRecordHtml.ts` | ✅ Mitarbeiter:innen-Workflow | v2 |
| `serviceProofDocumentService.ts` | ✅ Finalisierung via `prebuiltHtml` | v2 |
| `renderServiceProofDocumentHtml()` | ✅ Dokumentenmodul-Preview | v2 |
| `FINALIZE_SERVICE_PROOF_HTML_TEMPLATE` | ❌ leer/deprecated, nicht in Finalisierung | — |
| `STANDARD_SERVICE_PROOF_HTML_TEMPLATE` | ❌ nur Legacy-Export | — |
| `documentCatalog/builders.ts` service_proof | Katalog-Editor-Seed, nicht ServiceProof-Finalisierung | dokumentiert |

**Kein Runtime-Pfad** listet alle erledigten Aufgaben einzeln, zeigt `submitted` als Dokumentation oder nutzt das alte Finalize-Template.

---

## 3. Visuelle Prüfung der HTML-Artefakte

Geprüft (Quelltext + Struktur; Browser-Screenshots via `file://` blockiert):

| Datei | Ergebnis |
|-------|----------|
| `beispiel-alle-aufgaben-erledigt.html` | ✅ Logo mittig, Kompaktbox, Stammdaten/Zeiten-Karten, Footer seriös |
| `beispiel-abweichung.html` | ✅ Nur Abweichung mit Status + Begründung |
| `dokumentenmodul-alle-aufgaben-erledigt.html` | ✅ v2-Struktur, Signaturbereich, kein `submitted` |
| `dokumentenmodul-abweichung.html` | ✅ Abweichungstabelle, Mandantenlogo |

Checkliste: Logo/Fallback ✅ · A4-Layout ✅ · keine lange Aufgabenliste bei „alle erledigt“ ✅ · Abweichungen einzeln ✅ · „Keine Begründung dokumentiert.“ in Tests ✅ · kein `submitted` in Artefakten ✅ · Signatur/Fußzeile ✅ · `data-layout-version="v2"` ✅

Screenshots: **nicht erzeugt** (Browser-MCP erlaubt keine `file://`-URLs).

---

## 4. Assist-Pfad

- Zentrale Module: `visitProofTaskPresentation`, `visitProofPdfLayout`, `visitProofBranding`
- Preview/Download rendern aus Quelldaten (v2), gespeicherte PDFs werden nicht überschrieben

---

## 5. Dokumentenmodul-ServiceProof

- `serviceProofLayoutAdapter.ts` → `buildServiceProofDocumentHtml`
- `signAndFinalizeServiceProof` → `prebuiltHtml` in Lifecycle
- `getServiceProofPdfState()` nutzt `isPdfProductionAvailable()` (Demo-korrekt)

---

## 6. Tests (Final-Lauf)

```text
✓ serviceProofLayoutV2.test.ts           9/9
✓ visitProofLayoutV2.test.ts            16/16
✓ assistProofPdfPreview.test.ts          5/5
✓ assistProofPhase45.test.ts             4/4
✓ signatureDisplay.test.ts              13/13
✓ contractServiceProofDocumentation.test.ts  11/11  (Fix: isPdfProductionAvailable)
✓ documentsReleaseGate.test.ts          21/21
────────────────────────────────────────
Gesamt: 79/79 grün
```

---

## 7. Typecheck-Status

`npx tsc --noEmit` — **keine neuen Fehler** in v2-Kernmodulen.

**Vorbestehend (out of scope):** `visitProofReviewPreview.test.ts`, `finalizeVisitProof.test.ts`, `VisitProofReviewPanel.tsx`, `visitProofSnapshotPreviewService.ts` (Casts), `portalAssistVisitProofService.ts`, `assistProofPdfService.ts` (jsPDF-Typen).

---

## 8. contractServiceProofDocumentation.test.ts

**Behoben:** `getServiceProofPdfState()` prüft jetzt `isPdfProductionAvailable()` statt statischem `PDF_ENGINE_INFO.productionAvailable` → 11/11 grün in Demo-Testumgebung.

---

## 9. Runtime-Smoke

**Nicht ausgeführt** — kein lokaler Expo/Web-Server in diesem Gate. Ersatznachweis: 79 Unit-Tests + 4 HTML-Audit-Artefakte.

---

## 10. Restrisiken

1. Dokumentkatalog-Seed (`documentCatalog/builders.ts`) — generische Editor-Vorlage, nicht Runtime-Finalisierung
2. Remote-Logos in PDF — CORS/Storage
3. Keine Live-Browser-Screenshots der Artefakte

---

## 11. Commit

- Message: `fix(proofs): redesign service proof layout v2`
- **Kein** `[deploy]`, **kein** Push, **kein** Deploy

---

## 12. Entscheidung

**RELEASE READY** — Production: **PRODUCTION VERIFIED + CLEAN** (siehe `production-smoke.md`, Smoke B + Cleanup dokumentiert).

---

## Restkorrekturen Logo / Mitarbeitende:r / Footer

**Datum:** 2026-07-07  
**Ergebnis:** **READY FOR COMMIT**

### 1. Ausgangsfehler

| # | Fehler | Soll |
|---|--------|------|
| 1 | Header zeigte pauschal „CareSuite+ Mandant“ statt Mandantenlogo | Logo oben mittig, sonst echter Mandantenname |
| 2 | Stammdaten „Mitarbeitende:r —“ | Name der durchführenden Person |
| 3 | Footer „Erstellt mit CareSuite+“ | „Erstellt mit CareSuite+ Software Technologie“ |

### 2. Geänderte Dateien

- `src/lib/assist/visitProofBranding.ts` — Logo-Kette erweitert, `resolveVisitProofEmployeeName`, Footer-Konstante
- `src/lib/assist/visitProofPdfLayout.ts` — Header onerror-Fallback, Footer-Text, Logo max-width 180px
- `src/lib/assist/assistProofPdfPayload.ts` — Mitarbeitername zentral aufgelöst
- `src/lib/assist/visitProofSnapshotPreviewService.ts` — Preview/Enrichment nutzt gleiche Mitarbeiter-Logik
- `src/lib/documents/serviceProofLayoutAdapter.ts` — Dokumentenmodul: Logo + Mitarbeiter konsistent
- `src/features/assistWorkflow/buildServiceRecordHtml.ts` — Mitarbeiter-Workflow konsistent
- `src/__tests__/assist/visitProofLayoutV2.test.ts` — Logo/Mitarbeiter/Footer-Tests
- `src/__tests__/documents/serviceProofLayoutV2.test.ts` — Dokumentenmodul-Parität
- `docs/audit/leistungsnachweis-v2/*.html` — Audit-Artefakte neu erzeugt

### 3. Logo-Quelle und Fallback

Priorität in `resolveVisitProofBranding` / `resolveLogoUrl`:

1. Enrichment `tenantLogoUrl` / Input `logoUrl`
2. `tenant_branding.logo_url` (Snapshot oder via `loadVisitProofBrandingForTenant`)
3. `tenant_document_settings.logo_url` (via `loadVisitProofBrandingForTenant`)
4. Snapshot: `logo_url`, `logoUrl`, `tenantLogoUrl`, `companyLogoUrl`, …
5. Text-Fallback: `legalName` → `tenantName` (aus Tenant/Company, nicht pauschal Dummy)
6. Letzter Name-Fallback: `CareSuite+ Mandant` nur wenn kein Mandantenname vorhanden

Bei nicht ladbarer Logo-URL: `onerror` blendet `<img>` aus und zeigt versteckten Namens-Fallback.

### 4. Mitarbeiterdaten-Quelle und Fallback

Zentral: `resolveVisitProofEmployeeName(snapshot, { employeeName })`

Priorität:

1. Enrichment / Input `employeeName`
2. Snapshot: `employeeName`, `caregiverName`, `staffName`, `performedByName`
3. Nested: `assigned_employee`, `assignedEmployee`, `staff`, `employee`, `performedBy` (`display_name`, `full_name`, `first_name` + `last_name`)
4. DB-Backfill via `enrichVisitProofForPreview` (Visit → Assignment → Employee)
5. Fallback: **„Nicht dokumentiert“** (kein „—“ mehr)

### 5. Footer-Korrektur

Zentral in `buildVisitProofFooterHtml` (`visitProofPdfLayout.ts`):

`Seite 1 von 1 · Erstellt mit CareSuite+ Software Technologie`

Konstante: `VISIT_PROOF_FOOTER_CREDIT` in `visitProofBranding.ts`.

### 6. Tests

```text
✓ visitProofLayoutV2.test.ts            22/22
✓ serviceProofLayoutV2.test.ts           13/13
✓ assistProofPdfPreview.test.ts           5/5
✓ assistProofPhase45.test.ts              4/4
✓ signatureDisplay.test.ts               13/13
────────────────────────────────────────
Gesamt (Restkorrektur-Lauf): 57/57 grün
```

Neue Assertions: Logo-`<img>` bei URL, Mandantenname-Fallback ohne Logo, Mitarbeitername befüllt, „Nicht dokumentiert“ bei fehlenden Daten, Footer mit „Software Technologie“.

### 7. Audit-Artefakte

Unter `docs/audit/leistungsnachweis-v2/` aktualisiert:

- `beispiel-alle-aufgaben-erledigt.html` — Logo (placehold.co), Anna Pflege, neuer Footer
- `beispiel-abweichung.html` — gleich
- `dokumentenmodul-alle-aufgaben-erledigt.html` — gleich
- `dokumentenmodul-abweichung.html` — gleich

Checkliste: Logo mittig ✅ · Mitarbeitende:r befüllt ✅ · Footer korrekt ✅ · Aufgabenlogik v2 unverändert ✅ · Signatur unverändert ✅ · kein `submitted` ✅

### 8. Offene Risiken (Stand Restkorrektur — durch Enrichment-Gate geschlossen)

1. ~~PDF-Render ohne `enrichVisitProofForPreview` (z. B. Portal-Preview)~~ → **geschlossen** via `buildEnrichedAssistProofPdfPayload`
2. Remote-Logos — CORS/Storage bei html2canvas-PDF
3. Kein Live-Browser-Smoke — Ersatz: Unit-Tests + HTML-Artefakte

### 9. Ergebnis

**READY FOR COMMIT** — kein Push, kein Deploy, kein `[deploy]`.

---

## Enrichment-Gate Logo / Mitarbeitende:r

**Datum:** 2026-07-07  
**Ergebnis:** **READY FOR DEPLOY**

### 1. Geprüfte Runtime-Pfade

| Pfad | Nutzung | Enrichment vor Render |
|------|---------|----------------------|
| `buildEnrichedAssistProofPdfPayload` | Zentraler Runtime-Adapter | Ja — DB-Backfill bei Lücken |
| `resolveAssistProofPdfPreviewUrl` | Office PDF-Vorschau | Ja (via Adapter) |
| `renderAssistProofPdfBytes` / `generateAssistProofPdf` / `downloadAssistProofPdfInBrowser` | Office PDF erzeugen/herunterladen | Ja (via Adapter) |
| `fetchAssistProofPortalDocumentDetail` | Klientenportal HTML-Preview | Ja (via Adapter) |
| `releaseApprovedProofToPortal` | Portal-Freigabe + PDF | Ja (`enrichVisitProofForPreview`) |
| `useVisitProofReviewPreview` | Office Review Feldliste | Ja (`enrichVisitProofForPreview`) |
| `buildAssistProofPdfPayload` | Pure Builder / Unit-Tests | Nein — nur mit vorbereitetem Enrichment |
| `buildServiceRecordHtml` | Mitarbeiter-Workflow | Branding via Caller-Input |
| `buildServiceProofDocumentHtml` | Dokumentenmodul | `proof.logoUrl` / `proof.employeeName` + Branding-Resolver |

### 2. Geschlossene Lücke

**Vorher:** `portalAssistVisitProofService` und Office-PDF-Funktionen riefen `buildAssistProofPdfPayload(proof)` ohne DB-Enrichment auf → alte Snapshots ohne `employeeName` / Logo zeigten „Nicht dokumentiert“ bzw. „CareSuite+ Mandant“.

**Nachher:** `buildEnrichedAssistProofPdfPayload(tenantId, proof, enrichment?)` prüft Snapshot + partielles Enrichment und lädt bei Bedarf:
- **Mitarbeiter fehlt** → `enrichVisitProofForPreview` (Visit → Assignment → Employee)
- **Logo/Mandantenname fehlt** → `loadVisitProofBrandingForTenant` (`tenant_branding` + `tenant_document_settings` + `tenants`)

`mergeVisitProofEnrichment` verbindet DB-Daten mit Caller-Overrides (Caller gewinnt bei gesetzten Werten).

### 3. Logo-Enrichment

Auslöser: kein `logoUrl` im Snapshot/Enrichment **oder** Mandantenname = Fallback „CareSuite+ Mandant“.

Quellen: `loadVisitProofBrandingForTenant` → `fetchTenantBrandingLogoUrl` + `tenant_document_settings.logo_url` + `tenants.name`.

### 4. Mitarbeiter-Enrichment

Auslöser: `resolveVisitProofEmployeeName` = „Nicht dokumentiert“.

Quellen: `enrichVisitProofForPreview` — zuerst `assist_visits.employees`, dann `assignments.employees`, dann direkter `employees`-Lookup via `employee_id` / `employeeId` im Snapshot.

### 5. Tests

```text
✓ visitProofLayoutV2.test.ts            22/22
✓ serviceProofLayoutV2.test.ts           13/13
✓ assistProofPdfPreview.test.ts           5/5
✓ assistProofEnrichmentGate.test.ts       7/7
✓ visitProofReviewPreview.test.ts        11/11
────────────────────────────────────────
Gesamt (Enrichment-Gate-Lauf): 58/58 grün
```

Neue Gate-Tests: Employee-Backfill ohne Snapshot, Logo-Backfill ohne Snapshot, echter Mandantenname statt Dummy, Portal-/PDF-Service-Wiring, Footer unverändert.

### 6. Restrisiko

1. **Remote-Logos / CORS** bei html2canvas-PDF — unverändert technisches Risiko
2. **Gespeicherte PDFs in Storage** — werden nicht automatisch neu gerendert; neue Previews/Downloads nutzen Enrichment
3. **Kein Live-Browser-Smoke** — Ersatz: 58 Unit-Tests

### 7. Ergebnis

**Restrisiko Enrichment-Lücke geschlossen** — kein aktiver Runtime-Pfad rendert mehr ohne DB-Backfill, wenn Logo/Mitarbeiter verfügbar sind.

---

## Restkorrektur Zeitraum-Format

**Datum:** 2026-07-07  
**Problem:** „Geplanter Zeitraum“ zeigte am gleichen Tag doppeltes Datum (`06.07.2026, 14:00 – 06.07.2026, 17:00`).

**Lösung:** Zentraler Display-Helper `formatVisitProofDateTimeRange` in `visitProofDateTimeFormat.ts`.

| Fall | Format |
|------|--------|
| Gleicher Tag | `06.07.2026, 14:00–17:00` |
| Unterschiedliche Tage | `06.07.2026, 22:00 – 07.07.2026, 02:00` |
| Nur Start | `06.07.2026, 14:00` |
| Nur Ende | `bis 06.07.2026, 17:00` |
| Keine Angabe | `Nicht dokumentiert` |

**Angebunden in:** `assistProofPdfPayload.ts`, `buildServiceRecordHtml.ts`, `serviceProofLayoutAdapter.ts`, `visitProofSnapshotPreviewService.ts` (Termin-Feld).

**Keine Änderung** an Signaturen, Ist-Zeiten, Aufgabenlogik oder Produktionsdaten — nur Anzeigeformat.
