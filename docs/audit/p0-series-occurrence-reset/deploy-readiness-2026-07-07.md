# P0 Serien-Occurrences — Deploy-Readiness Gate

**Datum:** 2026-07-07 (Europe/Berlin)  
**Ergebnis:** **BLOCKED** — kein Production-Deploy  
**Deploy ausgelöst:** Nein (kein `[deploy]`, kein Push)

---

## Git

| Feld | Wert |
|---|---|
| Branch | `main` |
| HEAD | `cce4d27e7fec4d117d4cae73ab49343daae0c0ce` |
| Commit-Message | `fix(assist): isolate recurring occurrence execution status` |

### `git status --short` (Gate-Abschluss)

Bewusst **nicht** committed (wie vorgesehen):

- `docs/audit/messaging-abnahme-screenshots/`
- `scripts/audit/apply-cs-vorlagen-*.mjs`

Gate-Artefakte (uncommitted, erwartet):

- `scripts/audit/p0SeriesOccurrenceWebSmoke.mjs`
- `docs/audit/p0-series-occurrence-reset/screenshots/*.png`
- `docs/audit/p0-series-occurrence-reset/web-smoke-results-2026-07-07.json`
- `package.json` / `package-lock.json` (Playwright devDependency für Web-Smoke)

Fix-Commit selbst: **clean** auf `main` (nur obige Gate-Dateien offen).

---

## Build (production-ähnlich)

| Feld | Wert |
|---|---|
| Befehl | `EXPO_PUBLIC_DEMO_MODE=false npx expo export --platform web` |
| Ergebnis | **SUCCESS** — Output `dist/` |
| Netlify-Parität | Gleicher Export-Befehl wie in `netlify.toml` |

**Hinweis Static-Server:** Für SPA-Routing wie Netlify (`/* → /index.html`) muss der Server im **SPA-Modus** laufen. `http-server` ohne SPA liefert für `/assist/assignments/` ein Directory-Listing (kein App-Shell). Empfohlen:

```bash
npx serve dist -s -p 8093
```

---

## Static-Smoke

| Feld | Wert |
|---|---|
| URL | `http://localhost:8093` (SPA via `npx serve dist -s -p 8093`) |
| Skript | `node scripts/audit/p0SeriesOccurrenceWebSmoke.mjs` |
| Auth | Supabase Password-Grant (Business) + Employee-Portal-Login (separate Browser-Contexts) |
| Ergebnis-JSON | `web-smoke-results-2026-07-07.json` |

### Export-Build vs. Metro

| Umgebung | `Platform is not defined` |
|---|---|
| Metro Dev (`localhost:8091`) | **Ja** — blockiert Browser-Abnahme im Dev-Server |
| Exportierter Build (`8093`) | **Nein** — App lädt, Login funktioniert, Assist-Liste zeigt 63 Einsätze |

**Einordnung:** Der Metro-Fehler betrifft **nur den Dev-Server**, nicht den exportierten Web-Build. Deploy aus diesem Grund **nicht** blockiert — aber der Web-Smoke-Gate ist aus anderen Gründen BLOCKED (s. u.).

---

## Automatisierte Vorprüfungen (PASS)

| Prüfung | Ergebnis |
|---|---|
| Unit-Tests | **8/8 PASS** (`visitRecurrenceExecution`, `visitRecurrenceListPipeline`) |
| Debug-Script | **54 → 0** falsche zukünftige „Abgeschlossen“ |
| Pipeline-Abnahme | **PASS** — 8/8 Listen + 3/3 Detail (`npm run audit:p0-series-local-acceptance`) |
| Mandant (Pipeline) | `56180c22-b894-4fab-b55e-a563c94dd6e7` |

---

## Pflichtfälle — Web-Smoke (BLOCKED)

Die Pflichtfälle Ellen/Dagmar (Juli 2026) sind für den **AUDIT_BUSINESS**-User in der exportierten Assist-Liste **nicht sichtbar**:

- Suche „Ellen“ / „Zacharias“ → **0 von 63 Einsätzen**
- Pflichtdaten (03./10./17./24./31.07., 13./20./27.07.) fehlen im DOM-Text der geladenen Liste
- Office-Vorschau per Klick/Direct-Route → „Einsatz nicht gefunden“
- Mitarbeiterportal (AUDIT_EMPLOYEE) → „Einsatz nicht zugewiesen“ / kein 10.07.2026 in der Liste

Die Pipeline-Abnahme gegen Live-DB (Admin-Client + Post-Fix-Simulation) bestätigt den Fix für dieselben IDs — die **Browser-Sicht** unter Audit-Credentials zeigt diese Serien jedoch nicht.

| Pflichtfall | Web-Smoke |
|---|---|
| Ellen 03.07. abgeschlossen | FAIL (nicht in Liste) |
| Ellen 10./17./24./31.07. bestätigt/offen | FAIL |
| Dagmar 13./20./27.07. bestätigt/offen | FAIL |
| Office-Vorschau Ellen 10.07. | FAIL |
| Office-Vorschau Dagmar 13.07. | FAIL |
| Mitarbeiterportal Ellen 10.07. Start | FAIL |

**Vermutete Ursache (Smoke):** Sichtbarkeit/Zuordnung der P0-Testdaten für Audit-Business-/Employee-Accounts (RLS/Mitarbeiter-Zuordnung Kathrin Pott `ffbac02b-…`), nicht Regression des Occurrence-Fixes.

---

## Screenshots (PNG)

Ablage: `docs/audit/p0-series-occurrence-reset/screenshots/`

| Datei | Inhalt (Ist) |
|---|---|
| `office-list-ellen-03-10-17.png` | Assist-Liste, Suche „Ellen“, 0 Treffer |
| `office-list-ellen-24-31.png` | Assist-Liste, Suche „Ellen“ |
| `office-list-dagmar-13-20-27.png` | Assist-Liste, Suche „Dagmar“ |
| `office-preview-ellen-2026-07-10.png` | Fehler: „Einsatz nicht gefunden“ |
| `office-preview-dagmar-2026-07-13.png` | Fehler: „Einsatz nicht gefunden“ |
| `employee-portal-ellen-2026-07-10.png` | Fehler: „Einsatz nicht zugewiesen“ |
| `web-smoke-error.png` | Letzter Fehlerzustand (Automation) |

Pipeline-Artefakte (`.txt`) mit korrekten Statuszeilen: weiterhin unter demselben Ordner.

---

## Deploy-Freigabe

| Kriterium | Status |
|---|---|
| Code-Fix committed | Ja (`cce4d27e`) |
| Unit + Pipeline-Abnahme | **PASS** |
| Export-Build | **PASS** |
| Export ohne `Platform`-Crash | **PASS** |
| Web-Smoke Pflichtfälle (PNG) | **BLOCKED** |

### Aussage

**Deploy ist nicht freigegeben.** Der P0-Fix ist technisch durch Tests und Pipeline-Abnahme abgesichert, aber der geforderte **production-ähnliche Web-Smoke** gegen Ellen/Dagmar konnte nicht bestanden werden, weil die Pflicht-Termine unter den Audit-Web-Credentials nicht erreichbar sind.

**Kein Deploy ausgelöst.** Production bleibt unverändert bis zu einem explizit freigegebenen Deploy mit `[deploy]`.

### Empfohlene nächste Schritte (vor erneutem Gate)

1. Audit-Business-User Zugriff auf Ellen/Dagmar-Serien in Mandant `56180c22-…` prüfen (RLS / Klientenzuordnung).
2. Employee-Portal-Login auf den der Serie zugeordneten Mitarbeiter (Kathrin Pott) ausrichten oder Testzuordnung anpassen.
3. Web-Smoke erneut: `npx serve dist -s -p 8093` → `SMOKE_BASE_URL=http://localhost:8093 node scripts/audit/p0SeriesOccurrenceWebSmoke.mjs`
4. Erst bei Web-Smoke **PASS** → Deploy-Freigabe mit `[deploy]` (explizite Nutzeranfrage).

### Push-Hinweis

Push **ohne** `[deploy]` startet laut `netlify.toml` **keinen** Production-Build. Remote-Sicherung des Fix-Commits ist möglich, löst aber kein Deploy aus.
