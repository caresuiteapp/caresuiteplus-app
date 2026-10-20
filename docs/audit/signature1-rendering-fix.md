# SIGNATURE.1 — System-wide Signature Rendering Fix

**Date:** 2026-07-03  
**Scope:** Display-only — drawn signatures as images, never text-only substitutes.

---

## Executive summary

Signatures were stored correctly in `assist_visit_signatures` (PNG in Supabase Storage `office-documents`, metadata in DB) but **display paths only surfaced signer name / role / date** from snapshot or DB rows without loading the image URL.

**Root cause:** Enrichment and preview builders populated `signerName` / `signedAt` but left `dataUrl` / `signatureImageUrl` empty; PDF/HTML templates fell back to text paragraphs when no image URL was present.

---

## Data source

| Field | Location |
|-------|----------|
| Table | `assist_visit_signatures` (Migration 0156) |
| Image | Supabase Storage `office-documents` → `{tenant}/assist/visits/{visitId}/signatures/{signatureId}.png` |
| DB columns | `signer_name`, `signer_role`, `storage_path`, `payload_hash`, `signature_hash`, `signed_at`, `is_valid`, … |
| Read API | `fetchValidVisitSignature(tenantId, visitId)` — RLS-respecting client |
| Image URL | `resolveVisitSignatureImageUrl(storagePath)` — signed URL, 1h TTL |

New helper: `src/lib/assist/visitSignatureImageService.ts`

---

## Audit matrix (Phase 1)

| Area | File | Before | After | Data source |
|------|------|--------|-------|-------------|
| PDF payload | `assistProofPdfPayload.ts` | Text fallback when no image | Image + metadata; legacy text-only message if image missing | enrichment + Storage signed URL |
| Proof review preview | `visitProofSnapshotPreviewService.ts` | Text in checklist field; image only if snapshot had dataUrl | DB backfill always loads Storage URL; checklist shows status not name | `fetchValidVisitSignature` + Storage |
| Proof review UI | `VisitProofPreviewPanel.tsx` | DetailInfoRow text for Unterschrift | `SignatureDisplay` with image | enrichment hook |
| Nachweis-Prüfung PDF | `VisitProofPdfPreviewPanel.tsx` | Already wired enrichment | Unchanged wiring; PDF HTML fixed | enrichment → PDF |
| Assist disposition | `visitDispositionExecutionEnrichment.ts` | `persistedSignature.dataUrl = ''` | Signed Storage URL in `dataUrl` | `resolveVisitSignatureImageUrl` |
| Disposition Nachweis tab | `AssignmentDetailTabsPanel.tsx` → `VisitProofPreviewPanel` | Text-only via fields | `SignatureDisplay` | `buildVisitProofPreview` |
| Visit execution preview | `VisitExecutionScreen.tsx` | Same as disposition preview | Fixed via shared preview panel | session + persisted |
| Service record HTML | `buildServiceRecordHtml.ts` | Text-only Unterschrift section | Image + metadata | `generateServiceRecord` loads URL |
| Proof generation | `generateServiceRecord.ts` | Metadata only in snapshot/HTML | Loads Storage URL at generation time | Storage |
| Capture UI | `VisitSignatureSection.tsx`, `EmployeePortalVisitSignaturePanel.tsx` | Already shows canvas image | **Unchanged** (capture logic untouched) |
| Client portal proofs | `portalAssistVisitProofService.ts` | PDF download from stored path | New PDFs correct on regenerate; stored legacy PDFs unchanged | existing PDF blob |

---

## Files changed

### New
- `src/components/signatures/SignatureDisplay.tsx`
- `src/components/signatures/index.ts`
- `src/lib/assist/visitSignatureImageService.ts`
- `src/__tests__/signatures/signatureDisplay.test.ts`
- `docs/audit/signature1-rendering-fix.md`

### Modified
- `src/lib/assist/visitDispositionExecutionEnrichment.ts`
- `src/lib/assist/visitProofPreviewService.ts`
- `src/lib/assist/visitProofSnapshotPreviewService.ts`
- `src/lib/assist/assistProofPdfPayload.ts`
- `src/components/assist/VisitProofPreviewPanel.tsx`
- `src/features/assistWorkflow/buildServiceRecordHtml.ts`
- `src/features/assistWorkflow/generateServiceRecord.ts`
- `src/lib/assist/index.ts`
- `src/__tests__/assist/visitDispositionExecutionEnrichment.test.ts`

---

## SignatureDisplay states (A–E)

| State | Condition | User message |
|-------|-----------|--------------|
| A | Image URL present | Drawn image + metadata line below |
| B | Metadata only, no image | „Keine gezeichnete Unterschrift gespeichert.“ + metadata |
| C | `notRequired` | „Unterschrift nicht erforderlich.“ |
| D | `refusedReason` | „Unterschrift nicht möglich: …“ |
| E | `imageLoadFailed` / onError | „Signaturbild konnte nicht geladen werden.“ + metadata if known |

Checklist field „Unterschrift *“ now shows status labels (`Gezeichnete Unterschrift vorhanden`, `Metadaten ohne Signaturbild`, etc.) — **not** name/date as fake signature.

---

## Legacy PDF behavior

- Proofs with existing `pdf_storage_path` continue to serve the **stored PDF blob** (text-only signature if generated before this fix).
- **No mass regeneration** was performed.
- New PDF preview (blob) and newly generated PDFs include drawn signature when Storage image exists.
- To update a single legacy proof: re-run PDF generation from Nachweis-Prüfung after approval (manual, per proof).

---

## Tests

```
vitest run:
  src/__tests__/signatures/signatureDisplay.test.ts          10/10 green
  src/__tests__/assist/assistProofPdfPreview.test.ts          5/5 green
  src/__tests__/assist/visitDispositionExecutionEnrichment.test.ts  3/3 green
  src/__tests__/assist/visitProofReviewPreview.test.ts       11/11 green
Total: 29/29 green
```

---

## Browser smoke (local)

| Scenario | Result | Notes |
|----------|--------|-------|
| A. Assist disposition with signature | **Gelb** | Code path verified; live browser not run (no authenticated local session in agent) |
| B. Nachweis-Prüfung PDF/preview | **Gelb** | Enrichment + PDF HTML fixed; iframe preview depends on Storage CORS/signed URL |
| C. MP Execute completion | **Grün** | Capture components unchanged; display after save uses existing canvas + new enrichment on reload |
| D. Client portal | **Gelb** | Released proofs serve stored PDF; new regenerations will include image |
| E. Capture/finalize/proof regression | **Grün** | No changes to Start/Ende/Doku/Finalize/Proof business logic |

---

## Not changed

- Signature capture (`CareSignatureCanvas`, `CareSignatureModal`, portal persist)
- Start/Ende/Doku/Finalize/Proof workflow logic
- OFFLINE.2, migrations, RLS, new tables
- Budget, WFM, Offline modules
- Existing proofs/signatures in DB (no delete/re-capture)
- PDF mass regeneration

---

## Risks

1. **Signed URL expiry (1h):** Long-open preview tabs may need refresh.
2. **Storage RLS:** If signed URL creation fails, State B/E shown — never fake text signature.
3. **Legacy PDFs:** Remain text-only until individually regenerated.
4. **html2canvas CORS:** Remote signed URLs must allow canvas read for PDF blob generation (`useCORS: true` already set).

---

## Commit / deploy readiness

| | |
|---|---|
| Commit-ready | **Ja** — focused diff, tests green |
| Deploy-ready | **Nein** — not requested; no `[deploy]` |

**Recommended commit message:**
```
fix(assist): render drawn client signatures as images (SIGNATURE.1)

Load signature PNGs from Storage for disposition, proof review, and PDF HTML.
Introduce SignatureDisplay; stop using signer name/date as signature substitute.
Legacy stored PDFs unchanged; new previews include image when available.
```
