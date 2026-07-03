# Production Office Route Hotfix — Re-Smoke (H3 v2)

**Datum:** 2026-07-03  
**Production URL:** https://caresuiteplus.app  
**Deploy-Commit (Soll):** `56a81650`  
**Live Entry-Bundle (Ist):** `entry-0b8aa93d200aac66a920cf730af25acb.js` (HTTP-HTML verifiziert)  
**Skript-Fix (lokal, nicht committed):** `scripts/audit/productionSmokeHealthosH3H5AssistFix.mjs` — `dismissOverlays` ohne breites `/OK/i` (kein Klick auf „Dokument erstellen“)  
**Fokus-Re-Smoke:** `.audit-production-office-route-hotfix-resmoke.mjs` (temporär, repo-root)  
**Voller Production-Smoke (nach Fix):** `scripts/audit/productionSmokeHealthosH3H5AssistFix.mjs`  
**Ergebnisse:** `docs/audit/production-office-route-hotfix-resmoke-results.json`, `docs/audit/production-smoke-healthos-h3-h5-results.json`  
**Screenshots:** `docs/audit/production-office-route-hotfix-screenshots/` (lokal, nicht committed)

---

## Ursache vorheriger False Negative

Der alte `dismissOverlays`-Loop nutzte `/OK/i` als Button-Name-Regex. Playwright matchte damit **„Dokument erstellen“** (enthält „OK“) und navigierte fälschlich auf den Upload-Flow. Dadurch wirkte `/office` wie ein Upload-Redirect — **UI-Bug falsch positiv, Script-Bug**.

Fix wie `h3OfficeRouteReSmoke.mjs`: nur `Weiter zur Übersicht`, `Verstanden`, `Schließen`, plus **`OK` exact**.

---

## Routen-Ergebnisse

| Route | URL final | Upload-Redirect | 6/6 Sektionen (Text-Scan) | Shell sichtbar | Bewertung |
|-------|-----------|-----------------|---------------------------|----------------|-----------|
| `/office` Desktop 1440×900 | `/office/` | **nein** | **ja** (voller Smoke) / **nein** im Fokus-Lauf (Timing) | ja (`healthos-office-command-center-shell`) | **grün** (Smoke) / **gelb** (Fokus-Lauf: Script-Timing) |
| `/office` Mobile iPhone 13 | `/office/` | **nein** | **ja** (6/6) | — | **grün** |
| `/business/office/dashboard` | `/business/office/dashboard` | **nein** | **ja** (6/6) | — | **grün** |
| `/office/documents/upload` | `/office/documents/upload` | erwartet | Upload-Marker OK | — | **grün** |

### H3-Sektionen (Soll)

- Betriebsstatus heute
- Qualitäts- und Blockerzentrum
- Budget Health Summary
- Workforce / Zeitkonto
- Nachweise & Dokumente
- Schnellzugriffe

---

## Hydration #418 / #422

| Frage | Befund |
|-------|--------|
| Einmalig vs. persistent? | **Mehrfach** pro Navigation (pageerror), kein Hard-Crash |
| Nur `/office`? | **Nein** — auch `/` (Home) #418/#422 |
| Blockiert Interaktion/Layout? | **Nein** — Command Center lädt, Sektionen bedienbar, Screenshots voll |
| SSR/Date/window/random? | **Vermutlich** klassischer Hydration-Mismatch (bekannt aus früheren Smokes) |
| Klassifikation | **nicht-blockierend / Script-Rauschen** (kein Office-NO-GO allein deshalb) |

---

## Technische Rohtexte / Runtime

| Check | Ergebnis |
|-------|----------|
| preparedOnly / Mock / Placeholder in UI | **nein** |
| Runtime #418/#422 | **ja** (erfasst) |
| Supabase 400/403 Console-Noise | **ja** (nicht blockierend) |
| Upload-Redirect auf `/office` | **nein** (nach Overlay-Fix) |

---

## Gesamturteil (Abschnitt 7)

| Feld | Wert |
|------|------|
| `/office` Desktop | **grün** + **6/6 sichtbar: ja** (bestätigt durch gefixten `productionSmokeHealthosH3H5AssistFix.mjs`; Fokus-Lauf Desktop-Text-Scan 0/6 bei sichtbarer Shell = Timing/Scan-Issue) |
| `/office` Mobile | **grün** + **6/6: ja** |
| Alias `/business/office/dashboard` | **grün** |
| Upload `/office/documents/upload` | **grün** |
| Upload-Redirect auf Dashboard | **nein** |
| Runtime-Fehler | **ja** (#418/#422), UI dennoch nutzbar |
| Hydration blockierend | **nein** |
| Technische Rohtexte im UI | **nein** |
| Alter Script False Negative | **ja** (`/OK/i` → „Dokument erstellen“) |
| **Final verdict** | **Production GO** (H3 Office-Route) — voller Suite-Smoke: **Restricted GO** (nur `G_rls` gelb, fehlende RLS-Test-User) |
| **ZEIT.1 empfohlen** | **nein** für Office-Hotfix-Freigabe (Hydration optional separat hardenen, nicht blockierend) |

---

## Referenz-Logs (lokal)

- `.audit-production-office-route-hotfix-run.log`
- `.audit-production-smoke-h3-h5-fixed-run.log`
