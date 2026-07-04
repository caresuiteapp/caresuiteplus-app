# SIGNATURE.2 — Mini-Regression Check (Drawn Signatures as Images)

**Datum:** 2026-07-04  
**Basis-HEAD:** `7b47c82b`  
**Scope:** Verifizierung Signatur/Proof-Anzeige — gezeichnete Unterschriften als Bild  
**Ausgeschlossen:** Legacy-PDF-Massenfix, Migrationen, Deploy

---

## Executive Summary

SIGNATURE.1 (2026-07-03) adressierte die Root Cause: Metadaten ohne Bild-URL. **SIGNATURE.2** bestätigt per Unit-Tests und Source-Wiring, dass die Fix-Pfade **intakt** sind — keine Regression in S1.

| Prüfpunkt | Ergebnis |
|-----------|----------|
| `pickSignatureImageUrl` bevorzugt Storage-URL | ✅ |
| `SignatureDisplay` rendert `<Image>` bei URI | ✅ |
| Metadaten-only → ehrliche Meldung, kein Text-as-Signature | ✅ |
| PDF-Payload embeds `<img>` bei enrichment URL | ✅ |
| Vitest `signatureDisplay.test.ts` | **10/10 grün** |

---

## Test-Lauf (S1)

```
npx vitest run src/__tests__/signatures/signatureDisplay.test.ts
→ 10/10 passed
```

Abgedeckte Szenarien:

| Test | Verhalten |
|------|-----------|
| A | Explizite Image-URL > inline data URL |
| B | Metadaten ohne Bild → „Metadaten ohne Signaturbild“ |
| C | `notRequired` → „Nicht erforderlich“ |
| D | `refusedReason` → „Nicht möglich (begründet)“ |
| E | Gezeichnetes Bild → „Gezeichnete Unterschrift vorhanden“ |
| Component wiring | `SignatureDisplay.tsx` enthält Image + Fehlertexte |
| VisitProofPreviewPanel | Nutzt `SignatureDisplay`, kein Text-only Row |
| PDF enrichment | `<img>` mit data URL embedded |
| PDF legacy | Kein `<img>`, Meldung „Keine gezeichnete Unterschrift gespeichert“ |

---

## Display-Pfad Matrix

| Surface | Komponente / Service | Bildquelle |
|---------|---------------------|------------|
| Proof Review UI | `VisitProofPreviewPanel` → `SignatureDisplay` | `pickSignatureImageUrl(storage, dataUrl)` |
| Disposition / Execution | Shared preview panels | `visitProofSnapshotPreviewService` + Storage |
| PDF Generation | `buildAssistProofPdfPayload` | enrichment `signatureImageUrl` |
| Service Record HTML | `buildServiceRecordHtml` | `generateServiceRecord` lädt URL |
| Capture (unverändert) | Canvas → Storage PNG | Schreibpfad unberührt |

**Kern-Service:** `src/lib/assist/visitSignatureImageService.ts`

---

## Bekannte Grenzen (gelb, nicht S1)

| Item | Ampel | Hinweis |
|------|-------|---------|
| Legacy PDFs in Storage (pre-SIGNATURE.1) | Gelb | Regenerate erforderlich — kein Mass-Fix |
| Signed URL TTL (1h) | Info | Refresh bei langem Review |
| RLS auf `assist_visit_signatures` | Grün | `fetchValidVisitSignature` respektiert Policies |

---

## Regression gegen SIGNATURE.1

Keine Code-Änderungen in S1. Alle SIGNATURE.1-Dateien unverändert seit Fix-Commit.

**Verdict SIGNATURE.2:** **Grün** — Mini-Regression bestanden.

---

## Referenzen

- `docs/audit/signature1-rendering-fix.md`
- `docs/audit/signature1-production-smoke.md`
- `src/__tests__/signatures/signatureDisplay.test.ts`
