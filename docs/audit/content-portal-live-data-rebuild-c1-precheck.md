# Content Portal Live Rebuild — C.1 Git/DB Safety Precheck

**Datum:** 2026-06-23  
**Branch:** `main`  
**Projekt-Ref:** `euagyyztvmemuaiumvxm` (entspricht `netlify.toml`)

## Git-Status

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Staged Secrets / `.env` | **Keine** staged Secrets |
| Offene K.6-Rechnungsarbeit | **Nicht** im Scope dieser Änderungen |
| `git add .` / `git add -A` | **Verboten** — nur selektive Pfade |
| Unrelated WIP (Background/Screensaver) | Vorhanden auf Branch, **nicht** in Content-Portal-Commits |

## Supabase

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Remote-Ref vs Netlify | **Match** `euagyyztvmemuaiumvxm` |
| Migration 0056 | In Historie, Tabellen waren fehlend → **0162 Repair** + MCP-Repair angewendet |
| Blind `db push` | **Nicht** ausgeführt |
| RLS Portal/Client/Employee | Bestehende Migrationen aktiv; keine Schema-Löschungen |

## STOP-Bedingungen (nicht aktiv)

- Keine staged Credentials
- Kein Deploy-Trigger
- LIVE-Daten: Whitelist vor Schreibzugriff definiert (siehe C.2)

## Freigabe

**C.2 Inventur** und gated Schema-Repair sind freigegeben. Produktive Datenänderungen nur für Whitelist-Mandanten und E2E-Mandant (isoliert).
