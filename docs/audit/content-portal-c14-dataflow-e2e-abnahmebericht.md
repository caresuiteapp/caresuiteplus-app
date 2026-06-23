# C.14 Data Flow E2E — Abnahmebericht

**Datum:** 2026-06-24  
**Phase:** C.14  
**Bereich:** Datenfluss End-to-End  
**Ergebnis:** BESTANDEN

## Seed-Datenfluss

Der Seed (`contentPortalE2eSeed.mjs`) erstellt idempotent:

| Tabelle | Rows | IDs |
|---|---|---|
| `assist_visits` | 2 | c0e50001 (heute), c0e50002 (morgen) |
| `assignments` | 2 | c0e5a001 (heute, confirmed), c0e5a002 (morgen, planned) |
| `message_threads` | 2 | c0e5c001 (employee), c0e5c002 (client) |
| `messages` | 2 | c0e5d001, c0e5d002 |
| `assist_visit_proofs` | 1 | c0e50003 (pending_review) |
| `client_portal_settings` | 1 | portal_enabled=true |
| `tenant_environment_settings` | 1 | mode=internal_test |
| `employee_portal_accounts` | 1 | repaired via repairEmployeePortalAccount |

## Zuordnung assist_visit ↔ assignment

- Beide referenzieren denselben Tenant, Employee und Client
- `assist_visits`: `planning_status=confirmed`, `documentation_status=in_progress`
- `assignments`: `status=confirmed` (PORTAL_APPOINTMENT_STATUSES)
- Employee Portal liest `assignments` über `portalAppointmentsLiveService`
- Assist-Screens lesen `assist_visits` über `assistVisitService`

## Nachrichtenfluss

- **Business → Employee:** Thread `c0e5c001`, type=`employee`, Nachricht `C14-MA-{timestamp}`
- **Business → Client:** Thread `c0e5c002`, type=`client`, Nachricht `C14-KLIENT-{timestamp}`
- Browser E2E bestätigt: beide Nachrichten erfolgreich gesendet

## Proof Release/Revoke

- Proof `c0e50003` initial: `portal_visible=false`, `portal_release_status=none`
- Release: `portal_visible=true`, `portal_release_status=released` → sichtbar im Klientenportal
- Revoke: `portal_visible=false`, `portal_release_status=none` → verborgen im Klientenportal

## Service Role Grants (einmalig angewendet)

```sql
GRANT SELECT, INSERT, UPDATE ON public.assignments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.message_threads TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.messages TO service_role;
```

## Live Whitelist Protection

- Tenant `56180c22-b894-4fab-b55e-a563c94dd6e7` (Helferhasen+ UG) ist in `LIVE_WHITELIST`
- Seed bricht mit `tenant_is_live_whitelist` ab falls versehentlich ausgewählt
- LiveBackfill --dry-run bestätigt: keine produktiven Daten verändert

## Tests

- 30 Unit-Tests bestanden (16 neue C.14 + 14 bestehende)
- Typecheck-Baseline: 921 Fehler (keine neuen in geänderten Dateien)

## Ergebnis

Datenfluss End-to-End vollständig bestätigt: Seed → Visits + Assignments + Messages + Proofs → Portal-Anzeige → Release/Revoke.
