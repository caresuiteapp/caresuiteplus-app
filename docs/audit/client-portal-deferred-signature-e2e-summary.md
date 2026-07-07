# Client Portal — Deferred Signature E2E (2026-07-07)

## Ergebnis

| Schritt | Status | Anmerkung |
|---------|--------|-----------|
| DB: Nachweis `pending_client_signature` (Audit + Doris) | ✅ | Beide Proofs portal_visible, signature_required, signed_at null |
| DB: Einsatz `abgeschlossen`, signature_complete=false | ✅ | Erwartet vor Klient:innen-Unterschrift |
| Klient:innen-Login (Audit) | ✅ | JWT + Portal-Session |
| Nachweise-Liste zeigt ausstehenden Nachweis | ✅ | Nach Migration 0244 (RLS SELECT) |
| Button „Unterschreiben“ in Nachweise-Liste | ✅ | |
| Detail: Hinweistext Unterschrift | ✅ | |
| Detail: Button „Unterschreiben“ | ❌ **Production** | Bug: `LIST_SELECT` ohne `signature_required`/`signed_at` → `canSign=false` |
| Signatur speichern + Einsatz abschließen | ⏳ | Blockiert bis Code-Deploy |

## Root Causes (behoben im Branch)

1. **`portalDocumentsLiveService.ts`**: Detail-Select ohne Signaturfelder; Assist-Nachweise jetzt über `fetchAssistProofPortalDocumentDetail` bzw. erweitertes `LIST_SELECT`.
2. **RLS Migration 0244**: `assist_visit_proofs_portal_client_select` — auf Production angewendet.
3. **`portalServiceProofService.ts`**: `service_records` Permission-Denied wird nicht mehr als harter Fehler an Klient:innen durchgereicht.

## Doris Niemeyer (Helferhasen)

- Proof: `aebd5bd1-17b2-489b-b436-9d6ba59ef482`
- Titel: „Hauswirtschaftliche Unterstützung — Unterschrift ausstehend“
- DB-Zustand korrekt — nach Code-Deploy sollte Doris unter **Nachweise → Unterschreiben** signieren können.

## Re-Test

```bash
node scripts/audit/clientPortalDeferredSignatureProductionE2e.mjs
```

Nach Deploy: alle Checks grün inkl. Signatur + `signature_complete=true`.
