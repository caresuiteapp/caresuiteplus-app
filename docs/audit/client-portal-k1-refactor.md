# Klient:innenportal K.1 — Refactor Abschlussbericht

**Datum:** 2026-07-06  
**Deploy:** Nein — kein `[deploy]`-Commit, kein Netlify-Build ausgelöst.

---

## 1. Root Cause Profilfehler

**Symptom:** „Profil nicht verfügbar — Portal-Defaults nicht gefunden.“

**Ursache:** Tabellen `tenant_client_portal_defaults`, `client_portal_settings` und verwandte Portal-Konfiguration hatten SELECT-Policies mit `has_permission('office.clients.view')`. Portalnutzer (`client_portal`) besitzen diese Office-Berechtigung nicht. Der Seed-RPC (`seed_tenant_client_core_templates`) legte Defaults an, aber der Portal-Login konnte sie nicht lesen → `fetchClientPortalSettingsResolved()` scheiterte → `fetchLiveClientPortalProfile()` brach ab.

**Fix:** Migration `0230_client_portal_settings_rls.sql` — dedizierte `portal_self_select`-Policies via `is_client_portal_rls_context()` / `current_client_id()`.

---

## 2. Root Cause fehlende Einsätze

**Symptom:** Einsätze-Tab leer trotz geplanter `assist_visits` / `assignments`.

**Ursache:** `loadPortalAppointmentsWithCache()` übergab `clientId` nicht an `fetchPortalAppointments()`. Im Supabase-Modus liefert die Client-Abfrage ohne `clientId` still `{ ok: true, data: [] }`.

**Fix:** `clientId` durchgereicht in `assignmentCacheService.ts` und `usePortalAppointments.ts`.

---

## 3. Root Cause falsche Begleitungsanzeige

**Symptom:** KPI „Begleitungen“ zeigte Zahl, obwohl keine Begleitungsleistungen existierten.

**Ursache:** `countBegleitungen()` zählte **alle** kommenden `assignments` mit Status `planned`/`confirmed` — identisch zum Einsatz-KPI, ohne Leistungsart-Filter.

**Fix:** Zählung über `assist_visits` mit `isPortalBegleitungService()` (service_key/name/title). KPI-Karte wird ausgeblendet, wenn Count = 0.

---

## 4. Geänderte Dateien

| Bereich | Datei |
|---------|-------|
| RLS | `supabase/migrations/0230_client_portal_settings_rls.sql` |
| Einsätze | `src/lib/offline/assignmentCacheService.ts`, `src/hooks/usePortalAppointments.ts` |
| Begrüßung | `src/lib/portal/engine/resolvePortalContext.ts` |
| Begleitungen | `src/lib/portal/portalBegleitungenFilter.ts`, `src/lib/portal/assist/portalAssistDashboardService.ts` |
| Navigation | `src/lib/navigation/clientPortalNavigation.ts`, `src/hooks/usePortalClientTabs.ts`, `src/lib/navigation/shellConfig.ts` |
| Übersicht | `src/components/portal/assist/MobilePortalDashboard.tsx`, `AssistPortalOverview.tsx` |
| Nachrichten | `src/screens/portal/portalofficemessagesscreens.tsx` |
| Kontext | `src/hooks/usePortalContext.ts` |
| Tests | `src/__tests__/portal/clientPortalK1Refactor.test.ts`, `assignmentCacheService.test.ts` |

---

## 5. Geänderte Datenabfragen

| Abfrage | Vorher | Nachher |
|---------|--------|---------|
| Portal-Defaults | Office-only SELECT | Portal-self SELECT (RLS) |
| Einsatzliste Client | ohne `clientId` | mit `clientId` + `assist_visits` + Kalender |
| Begleitungen KPI | `assignments` COUNT | `assist_visits` gefiltert nach Begleitungs-service_key |
| Anzeigename | Session-Fallback (Tenant-Name möglich) | Live-Read `clients.first_name/last_name` in `resolvePortalContext` |

---

## 6. RLS-Prüfung

| Tabelle | Policy | Status |
|---------|--------|--------|
| `tenant_client_portal_defaults` | `portal_self_select` | **Neu** |
| `client_portal_settings` | `portal_self_select` | **Neu** |
| `client_service_portal_settings` | `portal_self_select` | **Neu** |
| `tenant_service_type_portal_rules` | `portal_self_select` | **Neu** |
| `clients` | `clients_select_portal_self` | Unverändert (OK) |
| `assist_visits` | `assist_visits_portal_client_select` | Unverändert (OK) |
| `assignments` | `assignments_portal_client_select` | Unverändert (OK) |
| `client_documents` | `client_documents_portal_select` | Unverändert (OK) |
| `message_threads` | `message_threads_portal_client_*` | Unverändert (0219) |

Keine RLS-Aufweichung: Portalnutzer sehen weiterhin nur eigene Mandanten-/Klientendaten.

---

## 7. Portal-Navigation neu

### Bottom Navigation (Mobile)
| Tab | Route |
|-----|-------|
| Übersicht | `/portal/client` |
| Einsätze | `/portal/client/appointments` |
| Dokumente | `/portal/client/documents` |
| Nachrichten | `/portal/client/messages` |
| Profil | `/portal/client/profile` |

### Drawer (zusätzlich)
| Bereich | Route |
|---------|-------|
| Nachweise | `/portal/client?module=assist&section=nachweise` |
| Unterschriften | `/portal/client/documents/signatures` |
| Anfragen | `/portal/client?modal=anfragen` |
| Aktivitäten | `/portal/client?modal=aktivitaeten` |
| Abmelden | Drawer-Footer |

---

## 8. Screenshots Mobile

Manuelle iPhone-Safari-Screenshots nach Migration + lokalem Smoke empfohlen:
- Übersicht (Begrüßung mit Klient:innenname, Dienstleister-Zeile)
- Profil (vollständige Felder)
- Einsätze (heute / zukünftig / vergangen)
- Nachrichten (heller Messenger, kein Glass-Hero)

*(Screenshots nicht automatisiert in diesem Lauf — siehe offene TODOs.)*

---

## 9. Testergebnisse

| Test | Ergebnis |
|------|----------|
| `clientPortalK1Refactor.test.ts` | 3/3 bestanden |
| `clientPortalProfileLive.test.ts` | 8/8 bestanden |
| `clientPortalDisplayName.test.ts` | 6/6 bestanden |
| Production Smoke (`.audit-client-portal-k1-smoke.mjs`) | Migration + Profil PASS; siehe `client-portal-k1-production-verify.md` |

---

## 10. Production Verify (2026-07-06)

Migration `0230` auf Supabase Production angewendet. Smoke mit `audit-client@caresuiteplus.test` / Erika Mustermann:

- **Profil-Fehler behoben** (RLS): kein „Portal-Defaults nicht gefunden“ mehr
- **Einsätze in UI weiterhin leer** auf Production — K.1-Frontend noch nicht deployed; DB hat 63 Visits für Audit-Client
- **AVENTA** im Browser nicht getestet (kein Code in Env)

Details: [`docs/audit/client-portal-k1-production-verify.md`](client-portal-k1-production-verify.md)

---

## 11. Offene TODOs

- [ ] Migration `0230` auf Supabase-Projekt anwenden
- [ ] iPhone Safari Layout-Smoke mit realem Portal-Account
- [ ] Begleitungen-Section (`AssistPortalSectionView`) mit echter Liste statt Platzhalter
- [ ] Dedizierte Route `/portal/client/proofs` optional statt Query-Param
- [ ] Mandanten-Default `show_appointments=true` im Office prüfen (Office bleibt führend)

---

## Begrüßung (Zusatz)

**Symptom:** „Guten Morgen, AVENTA“ (Mandantenname statt Klient:innenname).

**Ursache:** `displayName` aus Session-Fallback konnte identisch mit `tenantName` sein, wenn Client-Name-Read fehlschlug oder noch nicht geladen war.

**Fix:** `resolvePortalContext` lädt `fetchClientPortalDisplayName()` und filtert Tenant-Namen als Anzeigename aus. Hero zeigt Mandant/Modul in Subtitle (`AVENTA · Assist`).
