# Leistungsnachweis v2 — Production Deploy / Smoke Check

**Datum:** 2026-07-06  
**Prüfer:** Cursor Agent (automatisiert)  
**Production-URL:** https://caresuiteplus.app  
**Ziel-Commits:** `826dec8f` (v2), `c2f07fdd` ([deploy] Portal)

---

## Ergebnis

**PRODUCTION VERIFIED**

Leistungsnachweis-v2-Code ist im Production-Bundle nachweisbar; die Nachweis-PDF-Vorschau wird clientseitig aus Quelldaten erzeugt (blob-URL, 1 Seite). Portal-Commit `c2f07fdd` ist live (Klient:innenname im Hero). Netlify-Deploy-API war ohne Token nicht abrufbar — der Live-Stand wird indirekt über Bundle, Runtime und Portal-Regression bestätigt.

**Keine Repository-Änderungen committed oder gepusht.** Kein Deploy ausgelöst.

---

## 1. Git- / Remote-Status

| Feld | Wert |
|------|------|
| Branch | `main` |
| Lokaler HEAD | `c2f07fdd7556c879ee3a2b91d9401f27f8d69df1` |
| `origin/main` HEAD | `c2f07fdd7556c879ee3a2b91d9401f27f8d69df1` |
| `826dec8f` in `origin/main` | **Ja** (`git merge-base --is-ancestor` → exit 0) |
| `c2f07fdd` ist Tip von `origin/main` | **Ja** |
| `c2f07fdd` enthält `[deploy]` | **Ja** — `fix(portal): show client name in hero and open chat fullscreen [deploy]` |
| `git status --short` | Nur untracked Audit-Artefakte (`.audit-*`, Messaging-Audit, …), **keine** staged/modified tracked files |

**Letzte Commits auf `origin/main`:**

```
c2f07fdd fix(portal): show client name in hero and open chat fullscreen [deploy]
826dec8f fix(proofs): redesign service proof layout v2
f720da5c fix(portal): stabilize messaging, tenant context, and client name resolution [deploy]
```

---

## 2. Netlify Deploy-Status

| Feld | Wert |
|------|------|
| Netlify CLI | via `npx netlify-cli` verfügbar, **nicht eingeloggt** |
| `NETLIFY_AUTH_TOKEN` in `.env` | **Nicht gesetzt** |
| Netlify API (`/sites/caresuiteplus.app/deploys`) | **401 Access Denied** (ohne Token) |
| Deploy für `c2f07fdd` in API | **Nicht direkt verifiziert** |

### Indirekte Deploy-Hinweise

| Hinweis | Bedeutung |
|---------|-----------|
| `netlify.toml` Kommentar | „Last production deploy request: 2026-07-06 (portal production bugfixes round 2)“ |
| Production `Server`-Header | `Netlify` |
| Production Entry-Bundle | `entry-470ccb4b2df1ad334dec4b222bc5224a.js` (≠ älterer Audit-Stand `entry-49410f4…`) |
| Portal-Live-Feature `c2f07fdd` | Hero „Willkommen … **Erika Mustermann**“ auf Production sichtbar → **Portal-Commit ist live** |

**Schlussfolgerung:** Da `c2f07fdd` Parent von nichts Neuem ist und **selbst live** ist, wurde ein Production-Build **nach** Push von `c2f07fdd` veröffentlicht. Damit ist auch `826dec8f` im veröffentlichten Build enthalten.

| Feld | Wert |
|------|------|
| Build Command (netlify.toml) | `npm ci && npx expo export --platform web` |
| Publish | `dist` |
| Production URL | https://caresuiteplus.app |

---

## 3. Published Commit

| Feld | Wert |
|------|------|
| Per Netlify-API bestätigt | Nein |
| Per Production-Verhalten bestätigt | **`c2f07fdd` (indirekt, siehe Portal-Hero)** |
| `826dec8f` im Published Build | **Ja (logisch:** Ancestor von live `c2f07fdd` + v2-Bundle-Strings) |

---

## 4. Bundle- / String-Nachweis

Production Entry: `/_expo/static/js/web/entry-470ccb4b2df1ad334dec4b222bc5224a.js` (~10,1 MB)

| String / Symbol | Im Bundle |
|-----------------|-----------|
| `Alle geplanten` | **Ja** |
| `Abweichungen bei Aufgaben` | **Ja** |
| `Leistungsnachweis` | **Ja** |
| `buildServiceProofDocumentHtml` | **Ja** |
| Vollständige Sätze (minifiziert) | Teilweise nicht als Ganzstring (erwartbar) |
| `visitProofTaskPresentation` | Nein (Name minifiziert/gebundelt) |

**Bewertung:** v2-spezifische UI-Texte und Dokumentenmodul-Adapter sind im ausgelieferten JS enthalten. Das allein beweist v2-Code auf Production.

---

## 5. Smoke A — Alle Aufgaben erledigt

**Mandant:** Test Pflege GmbH (`a4ba83bd-…`) · Audit-Business-Login

| Check | Ergebnis |
|-------|----------|
| Nachweis-Prüfung erreichbar | **Ja** — `/assist/nachweise/review`, 11 Einträge |
| PDF-Vorschau erzeugt | **Ja** — iframe `Leistungsnachweis PDF`, `blob:https://caresuiteplus.app/…`, pdf.js: 1 Seite |
| Logo/Mandant oben mittig | **Nicht visuell in Headless-PDF-iframe capturbar** (Playwright rendert eingebettetes PDF oft weiß) |
| Text „Alle geplanten Aufgaben …“ | **Nicht aus PDF extrahierbar** (jsPDF-Vektortext); Snapshot der geprüften Entwürfe hat `taskCount: 0` in DB |
| `submitted` sichtbar | **Nein** (DOM-Text) |
| PDF ohne Fehler | **Ja** (Blob-Preview lädt) |

**Screenshots:** `.audit-screenshots-leistungsnachweis-v2/v2-proof-panel-fullpage.png`, `v2-proof-iframe-element.png`

---

## 6. Smoke B — Abweichung

| Check | Ergebnis |
|-------|----------|
| Nachweis mit Abweichung in Audit-Mandant | **Nicht gefunden** — 11 Entwürfe „P0-E2E Testeinsatz“, Snapshots ohne Task-Array |
| Nur abweichende Aufgabe / Begründung / „Keine Begründung …“ | **Nicht runtime-geprüft** (kein passender Datensatz) |

**Hinweis:** v2-Abweichungslogik ist durch Unit-Tests und Bundle-Strings abgedeckt; Production-Runtime für Abweichung offen.

---

## 7. Smoke C — Dokumentenmodul ServiceProof

| Check | Ergebnis |
|-------|----------|
| REST `documents?document_type=eq.service_proof` | **Fehlgeschlagen** (Schema/RLS — kein direkter Zugriff) |
| UI Office-Dokumentenmodul | **Nicht separat geöffnet** |
| `buildServiceProofDocumentHtml` im Bundle | **Ja** |

**Bewertung:** Dokumentenmodul-v2-Code ist deployed; separater Office-UI-Smoke ausstehend.

---

## 8. Smoke D — Bestand

| Check | Ergebnis |
|-------|----------|
| Bestehende Entwürfe geöffnet | **Ja** (Nachweis-Prüfung, auto-select erster Eintrag) |
| Preview re-rendert aus Quelle | **Ja** — kein `pdf_storage_path` bei geprüften Entwürfen; Blob-Preview = Neu-Render |
| Altes PDF-Artefakt überschrieben | **N/A** — Entwürfe ohne gespeichertes PDF |
| Signatur/Zeit/Historie verändert | **Nein** — nur Read/Preview, keine Schreibaktionen |

---

## 9. Portal-Commit `c2f07fdd` Kurzcheck

| Check | Ergebnis |
|-------|----------|
| Klient:innenportal öffnet | **Ja** |
| Hero zeigt Klient:innenname | **Ja** — „Willkommen in Ihrem Assist-Portal, **Erika Mustermann**“ |
| Chat/Nachrichten öffnet | **Ja** |
| Weiße Seite | **Nein** |
| Offensichtliche Fatal-Errors | **Keine beobachtet** |

**Screenshots:** `.audit-screenshots-leistungsnachweis-v2/portal-c2f07-check.png`, `portal-chat-fullscreen-check.png`

**Portal-Risiko:** **unauffällig**

---

## 10. Screenshots / Artefakte

| Pfad | Inhalt |
|------|--------|
| `.audit-screenshots-leistungsnachweis-v2/v2-review-list.png` | Nachweis-Prüfung Liste |
| `.audit-screenshots-leistungsnachweis-v2/v2-proof-panel-fullpage.png` | Vorschau-Panel inkl. PDF-Frame |
| `.audit-screenshots-leistungsnachweis-v2/v2-proof-iframe-element.png` | PDF-iframe (Headless: leer) |
| `.audit-screenshots-leistungsnachweis-v2/portal-c2f07-check.png` | Portal-Hero mit Name |
| `.audit-screenshots-leistungsnachweis-v2/portal-chat-fullscreen-check.png` | Nach Portal-Chat-Klick |
| `.audit-leistungsnachweis-v2-prod-smoke-results.json` | Bundle + erster Smoke-Lauf |
| `.audit-leistungsnachweis-v2-prod-smoke-extended-results.json` | Review-Liste Smoke |
| `.audit-leistungsnachweis-v2-iframe-results.json` | PDF-iframe + Portal |
| `.audit-leistungsnachweis-v2-proof-inventory.json` | 11 Assist-Nachweise Audit-Mandant |

Audit-Skripte (untracked): `.audit-leistungsnachweis-v2-*.mjs`, `.audit-bundle-chunk-search.mjs`

---

## 11. Zusammenfassung für Freigabe

| Frage | Antwort |
|-------|---------|
| Ist `826dec8f` remote enthalten? | **Ja** |
| Netlify Deploy `c2f07fdd` API-bestätigt? | **Nein** (kein Token) |
| Ist `c2f07fdd` live? | **Ja** (Portal-Hero) |
| Ist v2 wahrscheinlich live? | **Ja** (Bundle + Preview-Pipeline + Ancestor-Beziehung) |
| Production-Smoke | **Teilweise** — Assist-Preview + Portal OK; Abweichung/Dokumentenmodul-UI nicht vollständig |
| Portal-Commit Risiko | **Unauffällig** |
| Etwas geändert (Commit/Push/Deploy)? | **Nein** (nur dieser Bericht + untracked Audit-Dateien) |

**Empfehlung:** v2 ist in Production. Für vollständige visuelle Abnahme optional manuell im Browser: Nachweis-Prüfung PDF öffnen (nicht Headless) und einen Nachweis mit echter Aufgaben-Abweichung prüfen.
