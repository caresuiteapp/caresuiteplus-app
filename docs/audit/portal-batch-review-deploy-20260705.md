# Portal-Batch Review & Deploy — 2026-07-05

## Geprüfte Bereiche

| Bereich | PR | Status Review | Tests | Migration | Deploy |
|---------|-----|---------------|-------|-----------|--------|
| Mitarbeiterportal M.1 + Lesbarkeit | #1 (merged), #4 (auf main) | ✅ GO | 105/105 employeePortal* | 0226 ✅ | ✅ `e0b3d7d6` |
| Einsatzablauf UX | #3 (merged) | ✅ GO | 34/34 Einsatzablauf-Gate | keine neuen | ✅ `26e8dd1d` |
| Dokumente & Unterschriften | #2 → main | ✅ GO | 13/13 signature* + 381/382 portal | 0227–0229 ✅ | ⏳ dieses Release |

## Dokumentenverwaltung — Review-Ergebnis

- **Office Composer**: Vorlage, PDF-Upload, Schreiben mit Signaturfeld-Markern
- **Portal**: Unterschriften-Tab im Drawer, Capture-Panel, PDF-Vorschau via signed URLs
- **RLS**: Tenant-Staff full access; Employee nur eigene Dokumente; Storage unter `office-documents/tenant/{id}/portal/signatures/`
- **Audit-Trail**: Append-only `portal_signature_audit_events`
- **Keine Blocker** — 1 vorbestehender Test-Fail (`clientPortalOverviewLive.test.ts`, Klientenportal, unrelated)

## Migrationen Production (euagyyztvmemuaiumvxm)

| Migration | Angewendet |
|-----------|------------|
| 0226 employee_portal_uploads | ✅ (vorher) |
| 0227 portal_document_signatures | ✅ |
| 0228 portal_signature_storage_rls | ✅ |
| 0229 portal_signature_document_source | ✅ |

## Deploy

Commit auf `main` mit `[deploy]` — Netlify Production-Build für Dokumentenverwaltung + konsolidierter Portal-Stand.
