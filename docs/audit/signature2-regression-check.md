# SIGNATURE.2 — Signatur-Orientierung im Leistungsnachweis

**Datum:** 2026-07-04  
**Scope:** Gezeichnete Unterschriften im Leistungsnachweis immer horizontal lesbar  
**Ausgeschlossen:** Massen-PDF-Regenerierung, Migrationen, Deploy

---

## Executive Summary

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Root Cause identifiziert | ✅ Capture (Canvas-Buffer), nicht Storage/Render allein |
| Normalisierung bei Erfassung (neu) | ✅ `exportSignatureCanvasPng` |
| Render-Korrektur alte PNGs | ✅ `SignatureDisplay` + PDF/HTML via IHDR-Heuristik |
| SIGNATURE.1 Regression | ✅ 13/13 `signatureDisplay.test.ts` |
| Orientierungstests | ✅ 8/8 `signatureOrientation.test.ts` |
| Koordinaten-Regression | ✅ 9/9 `signatureCanvasCoords.test.ts` |

---

## Root Cause

**Ebene: Capture (primär), Render (sekundär für Altbestand)**

Bei mobiler Querformat-Erfassung (`CareSignatureModal` + `fillAvailable`) kann der HTML-Canvas-Buffer **höher als breit** exportiert werden (Layout/Orientierungswechsel, DPR, ResizeObserver-Race). Die PNG landet korrekt in Storage — aber mit vertikalem Seitenverhältnis. Beim Einbetten in den Leistungsnachweis (querformatiges `<img>`-Fenster 280×120 px) wirkt die Unterschrift gedreht/unleserlich.

- **Storage:** Speichert PNG bytes unverändert (kein EXIF, keine Metadaten-Orientierung).
- **Render (vor Fix):** `<img style="object-fit:contain">` ohne Orientierungskorrektur.
- **EXIF:** Für Canvas-PNG nicht verfügbar → **Dimensionen-Heuristik** (`height > width`).

---

## Implementierte Normalisierung

| Phase | Mechanismus | Datei |
|-------|-------------|-------|
| **Capture** | Bei `height > width`: Canvas −90° rotieren, dann PNG exportieren | `normalizeSignatureCapture.ts`, `CareSignatureCanvas.tsx` |
| **UI-Anzeige** | `SignatureDisplay`: `onLoad` prüft Dimensionen, CSS `rotate(-90deg)` + angepasste maxWidth/maxHeight | `SignatureDisplay.tsx` |
| **PDF / HTML** | IHDR-Dimensionen → `buildSignatureProofImageStyle` → CSS transform, `object-fit:contain` | `signatureOrientation.ts`, `assistProofPdfPayload.ts`, `buildServiceRecordHtml.ts` |
| **Enrichment** | `probeSignatureImageDimensions` für Storage-URLs + inline data URLs | `visitProofSnapshotPreviewService.ts`, `generateServiceRecord.ts` |

**Heuristik:** Nur wenn `height > width` (portrait buffer). Landscape (`width >= height`) bleibt unverändert — kein Beschnitt, kein Stretching, Transparenz erhalten.

---

## Alte vs. neue Signaturen

| Typ | Verhalten nach Fix |
|-----|-------------------|
| **Neue Erfassungen** | PNG wird bei Confirm normalisiert (`width >= height`) → korrekt in Storage + Proof |
| **Alte PNGs in Storage** (height > width) | Korrektur **zur Render-Zeit** in UI/PDF/HTML — **kein Re-Upload**, **keine Massen-PDF-Regenerierung** |
| **Bereits exportierte Legacy-PDFs** | Unverändert (gelb) — nur bei manueller Neugenerierung korrekt |
| **Landscape-korrekte Alt-PNGs** | Keine Änderung |

---

## Testergebnisse

```
npx vitest run signatureDisplay signatureCanvasCoords signatureOrientation
→ 30/30 passed

npx vitest run assistProofPdfPreview visitDispositionExecutionEnrichment
→ 8/8 passed
```

| Szenario | Test | Ergebnis |
|----------|------|----------|
| Portrait-Buffer (240×480) → Proof-PDF | `rotate(-90deg)` in HTML | ✅ |
| Landscape-Buffer (640×320) → Proof-PDF | Kein rotate, max-width 280px | ✅ |
| IHDR-Parsing inline data URL | `readPngDimensionsFromDataUrl` | ✅ |
| Capture-Pipeline | `exportSignatureCanvasPng` wired | ✅ |
| SIGNATURE.1 States A–E + PDF enrichment | `signatureDisplay.test.ts` | ✅ 13/13 |
| Koordinaten SIGNATURE.0/1 | `signatureCanvasCoords.test.ts` | ✅ 9/9 |

---

## Gelbe Punkte (verbleibend)

| Item | Ampel | Hinweis |
|------|-------|---------|
| Legacy-PDFs in Storage (pre-Fix, bereits generiert) | Gelb | Nur bei manueller Neugenerierung korrekt |
| Heuristik `height > width` | Gelb | Sehr seltene echte Portrait-Canvas-Erfassungen (Desktop schmal) würden rotiert — im Produktfluss durch Landscape-Gate abgedeckt |
| SVG-Native-Signatures (non-web) | Info | Separater Pfad, nicht betroffen |
| Signed URL TTL (1h) | Info | Unverändert aus SIGNATURE.1 |

---

## Geänderte Dateien

### Neu
- `src/lib/signatures/signatureOrientation.ts`
- `src/lib/signatures/normalizeSignatureCapture.ts`
- `src/__tests__/signatures/signatureOrientation.test.ts`
- `src/__tests__/signatures/signatureTestFixtures.ts`

### Geändert
- `src/components/inputs/CareSignatureCanvas.tsx`
- `src/components/signatures/SignatureDisplay.tsx`
- `src/lib/assist/assistProofPdfPayload.ts`
- `src/lib/assist/visitProofSnapshotPreviewService.ts`
- `src/features/assistWorkflow/buildServiceRecordHtml.ts`
- `src/features/assistWorkflow/generateServiceRecord.ts`
- `src/__tests__/signatures/signatureDisplay.test.ts`
- `docs/audit/signature2-regression-check.md`

---

## Referenzen

- `docs/audit/signature1-rendering-fix.md`
- `docs/audit/signature1-production-smoke.md`
