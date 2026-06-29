# ASSIST.STABILIZE.3 — Abnahmebericht (Pause / End Service)

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Kevin visit:** `3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a`  
**Production:** https://caresuiteplus.app

## Zusammenfassung

STABILIZE.3 behebt drei P0-Probleme nach STABILIZE.2 (StartService):

1. **Pause stoppt Service-Timer nicht** — `pause_start`-Event + Readback; Service-Zeit friert bei offener Pause ein
2. **Service-Zeit verschwindet nach Beenden** — `service_end`-Verifikation; Upsert mit frischen `visitTimes` inkl. `serviceEndedAt`
3. **End Service aus Pause** — `pause_end` vor `service_end`; kein doppeltes `service_start` beim Fortsetzen

## Root Causes (bestätigt)

| ID | Ursache | Fix |
|----|---------|-----|
| RC-1 | `startPause`/`endPause` nur Status-Transition ohne Event-Readback | STABILIZE.2-Muster in allen drei Workflow-Funktionen |
| RC-2 | Service-Timer lief während Pause weiter ohne `pause_start` | `ensureOpenPauseStartEvent` + `calculateVisitTimes` Freeze |
| RC-3 | `endService` upsert mit stale `ctx.visitTimes` | Reload + `verifyEndServiceReadback` |
| RC-4 | `service_start` bei `pausiert→gestartet` | Event-Mapping nur bei `angekommen→gestartet` |

## Migration 0215

Nicht erforderlich — keine Schema-Änderung.

## Tests

- `vitest`: `assistStabilize3PauseEndService.test.ts` (7/7), `calculateVisitTimes.test.ts` (5/5)
- Audit: `scripts/audit-assist-stabilize-3-pause-endservice.ts` (13/13 nach Abnahmebericht)

## Production-Verifikation

| Check | Ergebnis |
|-------|----------|
| Supabase MCP Kevin-Visit | Keine Zeilen für UUID in Prod-DB (Tenant leer oder Visit-ID lokal) — Reparatur via App-Backfill bei nächstem Test |
| Browser-Smoke Pause/End | Nach Deploy manuell / Kevin-Test empfohlen |
| Netlify Deploy | Siehe Commit-Hash unten |
| Bundle STABILIZE.3 Marker | `verifyStartPauseReadback`, `verifyEndServiceReadback` in Bundle |

## Production Ready

**Bedingt ja** — Code + Tests grün; vollständige Prod-Abnahme Pause→End Service erfordert Live-Test mit Kevin-Account nach Netlify-Deploy.

## Commit / Bundle

*(Wird nach Push ergänzt)*
