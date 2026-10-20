# Abnahmebericht — Klient:innenakte Leistungen, Budgets, Vorlagen 2026

**Datum:** 2026-06-25 (Update: Budget-Lifecycle + Pflegegrad-Sync)  
**Projekt:** CareSuite+ (`euagyyztvmemuaiumvxm`)  
**Scope:** Migration 0175/0176/0177, Service-Layer, RBAC, Klient:innenakte-Tabs, Einsatz/Nachweis-Budget, Tests 1–37

---

## Ergebnis

| Phase | Status | Anmerkung |
|-------|--------|-----------|
| A — Database 0175+ | ✅ Angewendet | Remote via Supabase MCP (DDL + Seeds verifiziert) |
| A2 — Database 0177 | ✅ Angewendet | `lifecycle_status`, `invoice_id`, Backfill-Funktion |
| B — Service layer | ✅ | Profil + Transaktionen + Pflegegrad-Sync |
| C — Permissions 0176 | ✅ Angewendet | 8 neue Permission-Keys |
| D — UI Tabs | ✅ Kern-Tabs | 5 voll implementiert, 3 verlinkt |
| E — Einsatz/Nachweis Budget | ✅ | Reservierung → Durchführung → Verbrauch bei Freigabe |
| F — Pflegegrad-Sync Legacy | ✅ | Load/Save/Backfill → `client_care_entitlement` |
| G — Tests | ✅ 34/34 grün | Spec-Tests 1–37 abgedeckt |
| H — Abnahmebericht | ✅ | Dieses Dokument |

---

## Migration angewendet?

**Ja** — auf Projekt `euagyyztvmemuaiumvxm`:

- `0175_client_billing_budget_catalog_2026` — 8 Tabellen + Katalog 2026
- `0176_client_billing_rbac_permissions` — Permission-Katalog + Rollen
- `0177_client_billing_transaction_lifecycle` — Lifecycle-Spalten + `backfill_client_care_entitlement_from_legacy()`

Verifikation (Live):

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'client_budget_transactions'
  AND column_name IN ('lifecycle_status', 'invoice_id');

SELECT proname FROM pg_proc WHERE proname = 'backfill_client_care_entitlement_from_legacy';
```

Backfill (einmalig pro Mandant optional):

```sql
SELECT * FROM public.backfill_client_care_entitlement_from_legacy(NULL);
```

---

## Implementiert vs. Spec-Lücken

### Vollständig (Foundation + Core UI + Lifecycle)

- Versionierter `budget_template_catalog` mit exakten 2026-Cent-Werten
- PG-Regeln: PG1 ohne auto-Umwandlung; PG2–5 mit Umwandlungs-Templates
- Individuelle Budget-Overrides (`is_individual_override`) — kein Überschreiben bei Auto-Generate / PG-Sync
- **Pflegegrad-Sync** aus `client_care_levels`, `clients.care_level`, `client_insurance_profiles` → `client_care_entitlement` (Load, Save, Backfill)
- **Budget-Lifecycle** auf `client_budget_accounts` + `client_budget_transactions`:
  - **Plan/Reserve:** Einsatz-Anlage (nicht Entwurf) → `reservation` / `geplant`
  - **Execute:** Einsatz beendet/abgeschlossen → `durchgefuehrt` (kein Finalverbrauch)
  - **Proof:** Nachweis freigegeben → `usage` / `nachgewiesen` (Finalverbrauch)
  - **Storno:** Einsatz storniert → `release` + Reservierung freigegeben
  - **Rechnung:** optionales `invoice_id` auf Transaktion (`linkTransactionToInvoice`)
- `getClientAssistBillingProfile` mit `canUseBudgetByCatalogKey` (Reservierungen + PG1-Regeln)
- Warnungen nach Verbrauch/Reservierung (`budget_exhausted`, `budget_over_plan`)
- Audit-Log in `client_billing_audit_log`
- Klient:innenakte-Tabs + readonly Profil in `AssignmentCreateForm`

### Bewusste Lücken / Folge-Phasen

| Spec-Bereich | Gap |
|--------------|-----|
| 0160 `client_budget_settings` Kandidaten-Pfad | Parallel weiterhin vorhanden; schrittweise Abschaltung möglich |
| System-UI Budget-Vorlagen-Admin | Nur DB + Permission |
| Test E2E Browser | Nicht in dieser Session |
| Rechnungsfinalisierung | Preview-only; `invoice_id`-Link vorbereitet |
| Kulanz/Ungeklärt UI-Anlage | Katalog vorhanden, manuelle Konto-Anlage UI minimal |

---

## Dateien (neu/geändert)

### Migration
- `supabase/migrations/0175_client_billing_budget_catalog_2026.sql`
- `supabase/migrations/0176_client_billing_rbac_permissions.sql`
- `supabase/migrations/0177_client_billing_transaction_lifecycle.sql`

### Types & Services
- `src/types/assist/clientAssistBilling.ts` — `canUseBudgetByCatalogKey` auf Profil
- `src/lib/assist/clientCareEntitlementSyncService.ts` **neu**
- `src/lib/assist/clientBudgetTransactionService.ts` **neu**
- `src/lib/assist/clientAssistBillingProfileService.ts`
- `src/lib/assist/clientBillingWarningsService.ts`
- `src/lib/assist/clientBudgetAccountService.ts` (unverändert Kern)
- `src/lib/assist/assistProofApprovalService.ts` — Verbrauch bei Freigabe
- `src/lib/assist/repositories/visitRepository.supabase.ts` — Reservierung/Storno/Execute
- `src/lib/clients/clientEditPersistence.ts` — PG-Sync nach Save
- `src/lib/clients/clientIntakePersistence.ts` — PG-Sync nach Aufnahme/Edit
- `src/lib/clients/repositories/clientExtendedRepository.supabase.ts` — PG-Sync on Load

### UI
- `src/components/office/ClientAssistBillingPanels.tsx` — canUse-Anzeige im Einsatz-Profil

### Tests & Doku
- `src/__tests__/assist/clientAssistBilling.test.ts` — Tests 30–37
- `docs/audit/klientinnenakte-budget-leistungen-abnahmebericht.md`

---

## Verify-Pfad in der App

1. **Office → Klient:innen → Akte öffnen** — Pflegegrad-Tab speichern → Entitlement + Budgetkonten aktualisiert (Individual-Overrides bleiben)
2. **Assist → Neuer Einsatz** — Budgetbetrag setzen → Reservierung in Budgetverlauf (`Reservierung`, Status geplant)
3. **Einsatz beenden** — Lifecycle `durchgefuehrt`, noch kein Verbrauch
4. **Nachweis freigeben** — `Verbrauch` / `nachgewiesen`, verfügbares Budget reduziert
5. **Einsatz stornieren** (vor Freigabe) — Reservierung freigegeben
6. **Warnungen-Tab** — erschöpft / über Plan nach Verbrauch

SQL-Check:

```sql
SELECT transaction_type, lifecycle_status, amount_cents, reference_type
FROM client_budget_transactions
WHERE client_id = '<client-uuid>'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Tests

```
npx vitest run src/__tests__/assist/clientAssistBilling.test.ts
→ 34 passed
```

Abgedeckt: Katalog, PG-Regeln, Individual-Override, Priorität, Warnungen, Profil, **Reservierung/Storno/Proof-Verbrauch**, **Legacy-PG-Sync**, **canUse-Flags**.

---

## Abnahme-Empfehlung

**Foundation + Core UI + Budget-Lifecycle: abnahmefähig** für interne Pilotierung und Assist-Einsätze mit Budgetvorschau.

Vor Produktiv-Abrechnung: 0160-Kandidaten-Pfad auf neues Ledger migrieren oder abschalten; optional `backfill_client_care_entitlement_from_legacy()` auf Produktivdaten ausführen.
