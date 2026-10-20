# Live-Pilot Runbook — CareSuite+ Version 1.0

Meilenstein **rm-001**: Pilotstart mit 3 ambulanten Pflegediensten in NRW (Q2 2026).

## Pilot-Mandanten

| Mandant | Region | Phase | Go-Live |
|---------|--------|-------|---------|
| SonnenPflege Ambulant Köln | Köln | aktiv | 01.06.2026 |
| Herzlich Zuhause Pflege Düsseldorf | Düsseldorf | onboarding | 15.06.2026 |
| PflegeEngel Bonn | Bonn | vorbereitung | 01.07.2026 |

Konfiguration: `src/lib/pilot/pilotConfig.ts`  
Demo-Daten: `src/data/demo/pilotTenants.ts`

## Rollout-Phasen

1. **Vorbereitung** — Mandanten anlegen, Feature-Flags setzen, Schulung planen
2. **Onboarding** — Klientenimport, Einsatzplan, Auth/RLS prüfen
3. **Aktiver Pilot** — Täglicher Betrieb, Feedback-Kanal, DATEV-Export Smoke
4. **Review** — KPI-Auswertung, Bug-Triage, Release-Gates
5. **Abschluss** — Go/No-Go für Store-Release

## Pilot-Checkliste

Erreichbar unter `/business/ops/pilot-readiness` oder `/business/roadmap/pilot-readiness`.

Pflichtpunkte pro Mandant:

- Authentifizierung (Login, RLS)
- Klientenstamm (>10 Datensätze)
- Einsatzplan Woche 1
- PDL-Cockpit KPIs
- Release-Gates verknüpft
- DATEV-Export Smoke-Test

Status wird in AsyncStorage (`caresuite:pilot-readiness`) persistiert.

## Release-Gates

Release-Checkliste (`/business/release`) enthält Gate **Pilot-Readiness rm-001 ≥ 80%**.  
Verknüpfung über `PilotReadinessScreen` → Release-Hub.

## DATEV-Export Smoke-Pfad

1. Pilot-Mandant in Readiness-Screen wählen
2. „DATEV-Export Smoke-Test“ ausführen
3. Outbox-Eintrag prüfen (`integrations.manage` erforderlich)
4. Checklistenpunkt `release-2` wird automatisch gesetzt

## Support

- **L1**: PDL-Ansprechpartner je Mandant (siehe `pilotTenants.ts`)
- **L2**: Product/QA über QA-Modul (`/business/qa`)
- **L3**: DevOps über Release-Hub

Reaktionszeit Pilot: 4h werktags.

## Rollback

1. Feature-Flag `pilot_tenant` für betroffenen Mandanten deaktivieren
2. Release auf vorherige Staging-Version zurücksetzen
3. AsyncStorage-Checkliste exportieren (Backup vor Reset)
4. Mandanten über Status „vorbereitung“ in Pilot-Config markieren
5. Incident in Security-Modul (`/business/security`) dokumentieren

## Qualitätsgates vor Go-Live

```bash
npm run typecheck
npm run smoke
npm run test
npm run wp-m-verify
node scripts/wp-600-audit.mjs
```

Migration (Remote-DB): alle Dateien in `supabase/migrations/` — siehe [supabase-deployment.md](./supabase-deployment.md) (`0001`–`0013`, inkl. `0011_communication_center.sql`, `0012_communication_rls_and_storage_policies.sql`, `0013_tenant_product_module_access.sql` für Office-Basis-Modul)

### Modul-Abrechnung (Office Basis-Modul)

Sobald ein Fachmodul (Assist, Pflege, Stationär, Beratung, Akademie) aktiv ist, wird CareSuite+ Office automatisch als `included_base` enthalten — ohne Doppelabrechnung. Details: [office-base-module.md](../product/office-base-module.md).

## Live-Pilot-Readiness (P0 Sprint 2026-06-13)

| Bereich | Demo | Live-Pilot | Production |
|---------|------|------------|------------|
| Auth/RLS | D-FULL | P-READY | P-PROD pending |
| Clients | D-FULL | P-READY | P-PROD pending |
| Communication | D-FULL | P-READY (Kern) | P-PROD pending |
| Execution | D-FULL | P-READY (basic) | P-PROD pending |
| Invoices | D-FULL | P-READY (list/create) | P-PROD pending |
| Office Upload | D-FULL | P-READY | P-PROD pending |
| TI | D-DEMO | P-READY (provider check) | P-PROD pending |
