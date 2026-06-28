# LT.GMAPS.1 — Production Abnahmebericht (25-Punkte)

**Datum:** 2026-06-29  
**Migration:** `0199_live_tracking_gmaps_repair.sql` (+ Remote: `live_tracking_gmaps_repair_ddl`)  
**Projekt:** `euagyyztvmemuaiumvxm`

## Zusammenfassung

| Kriterium | Status | Anmerkung |
|-----------|--------|-----------|
| **Production-ready** | **Teilweise — Nein (vollständig)** | Code + DB-Schema bereit; Edge-Function-Deploy + manueller E2E-Flow ausstehend |

---

## 25-Punkte-Checkliste

| # | Akzeptanzkriterium | Status | Evidenz / Ehrliche Bewertung |
|---|-------------------|--------|------------------------------|
| 1 | Employee: Consent speichern ohne „Einsatz nicht gefunden" | **Ja (Code)** | `resolveLiveAssignment` + `assist_visits` Portal-RLS; Prod-E2E nicht live verifiziert |
| 2 | Employee: GPS-Punkte persistieren | **Ja (Code)** | RLS via `assist_visits.employee_id` statt assignments-Zirkel |
| 3 | Employee: Statuswechsel + Tracking-Session | **Ja (Code)** | Bestehende Persistence unverändert, RLS repariert |
| 4 | Office Live-Mitarbeiter: Online > 0 bei aktivem GPS | **Ja (Code)** | `getOfficeLiveEmployees` merged WFM + Assist-Sessions |
| 5 | Assist Live-Status: activeTrackingCount > 0 | **Ja (Code)** | `getAssistLiveStatus` mit `resolveLiveVisitId` |
| 6 | Client: Live-Karte bei aktivem Einsatz | **Ja (Code)** | `getClientLiveVisitLocation` + Demo-Fallback |
| 7 | Client: Zeitfenster-Logik korrekt | **Ja** | Unveränderte Eligibility-Regeln |
| 8 | Google Maps Browser-Key ohne Repo-Secret | **Ja (Code)** | `getGoogleMapsBrowserKey` → Edge Function |
| 9 | Kein EXPO_PUBLIC Key im Repo | **Ja** | Audit-Script LT-07 |
| 10 | Maps-runtime-config Edge Function | **Ja (Code)** | `supabase/functions/maps-runtime-config/index.ts` — **Deploy ausstehend** |
| 11 | Zentraler Assignment-Resolver | **Ja** | `src/features/liveTracking/resolveLiveAssignment.ts` |
| 12 | Migration 0199 additive | **Ja** | Kein DROP/TRUNCATE; Remote DDL angewendet |
| 13 | `tenant_runtime_settings` Tabelle | **Ja** | Remote verifiziert (`has_table=true`) |
| 14 | `resolve_live_assignment` RPC | **Ja** | Remote verifiziert (`has_rpc=true`) |
| 15 | Portal `is_tenant_member` erweitert | **Ja** | Employee + Client Portal Accounts |
| 16 | Realtime auf Tracking-Tabellen | **Ja** | Publication + Presets erweitert |
| 17 | 10s Polling Fallback | **Ja** | `LIVE_TRACKING_POLL_MS = 10_000` |
| 18 | Mobile Safari Geolocation | **Ja (Code)** | User-Gesture + iOS-Fehlermeldung |
| 19 | Kein Success+Error gleichzeitig | **Ja (Code)** | EmployeePortalVisitExecutionScreen |
| 20 | Keine Demo/Fake-Koordinaten | **Ja** | Keine neuen Mock-Positionen |
| 21 | Keine RLS-Deaktivierung | **Ja** | Nur additive Policies |
| 22 | Unit-Tests grün | **Ja** | 7/7 Live-Tracking-Tests bestanden |
| 23 | Audit-Script | **Ja** | `scripts/audit-live-tracking-gmaps.ts` |
| 24 | Preflight-Dokumentation | **Ja** | `docs/audit/live-tracking-gmaps-preflight.md` |
| 25 | Typecheck gesamt | **Teilweise** | Vorbestehende TS-Fehler außerhalb LT.GMAPS.1; neue Module fehlerfrei |

---

## Deploy-Status

| Schritt | Status |
|---------|--------|
| Git commit + push `[deploy]` | Ausstehend (dieser Lauf) |
| Netlify Production Build | Wird durch `[deploy]` ausgelöst |
| Supabase Migration DDL | **Angewendet** (`live_tracking_gmaps_repair_ddl`) |
| Edge Function `maps-runtime-config` | **Nicht deployed** — manuell via `supabase functions deploy maps-runtime-config` |

---

## Offene Punkte vor vollständiger Production-Abnahme

1. **Edge Function deployen** — ohne Deploy liefert Browser-Key nur via EXPO_PUBLIC oder tenant_runtime_settings
2. **GCP Browser-Key** — HTTP-Referrer auf Production-Domain beschränken
3. **Manueller E2E** — Employee Consent → Unterwegs → Office/Assist/Client prüfen
4. **0197/0198 Backfill** — prüfen ob alle bestehenden Visits Assignment-Mirror haben

---

## Production-ready: **Nein (vollständig) / Ja (Code+Schema)**

Code und Datenbank-Schema sind production-tauglich implementiert. Vollständige Production-Abnahme erfordert Edge-Function-Deploy und einen erfolgreichen Live-E2E-Durchlauf mit echtem GPS.
