# K.1.6 Manual Device Gate + Release Readiness — Abnahmebericht

**Stand:** 2026-07-06T08:11:13Z  
**URL:** http://localhost:8091  
**Branch:** `cursor/client-portal-k1-refactor`  
**HEAD:** `bbc9c611`  
**Audit-Script:** `.audit-k16-manual-device-gate.mjs`  
**Grundlage:** K.1.5 (`40/40` grün)

---

## 11.1 Executive Summary

| | |
|---|---|
| **K.1 deployfähig** | **Nein** |
| **Commit** | Nein |
| **Push** | Nein |
| **Deploy** | Nein |
| **K.1.5 Smoke (erneut)** | **40/40 grün** — keine Regression |
| **Manuelle Geräte geprüft** | **Nein** — kein physisches iPhone, Android oder iPad in dieser Session |
| **Signaturabschluss geprüft** | **Teilweise** — Detail + CTA im Desktop-Browser grün; vollständiges Signieren nicht abgeschlossen |
| **Nachweise geprüft** | **Teilweise** — K.1.5 Smoke grün; Desktop-Gegencheck zeigte Lade-Timeout in erweiterter Session |
| **Echte Restblocker** | Physische Geräteabnahme (iPhone Safari Tastatur/Safe Area, Android Chrome, iPad Split-View), Signaturabschluss mit Testdaten auf echtem Gerät/Browser |

```text
K.1 DEPLOY-FREIGABE: NEIN
```

**Begründung:** Die K.1.5-Automatisierung bleibt vollständig grün. Für K.1.6 fehlen die verpflichtenden Prüfungen auf **echten Geräten** (iPhone Safari, Android Chrome, iPad). Ein Desktop-Chromium-Gegencheck auf localhost ersetzt diese nicht. Signaturabschluss wurde nicht vollständig durchgeführt.

---

## 11.2 Git-Precheck

| Feld | Wert |
| --- | --- |
| **Branch** | `cursor/client-portal-k1-refactor` |
| **HEAD** | `bbc9c611` |
| **Lokale Änderungen** | Ja — zahlreiche modifizierte Portal-/Messenger-/Design-Dateien (K.1–K.1.5), uncommitted |
| **Untracked / Audit** | `.audit-k15-seed.mjs`, `.audit-k15-release-blockers.mjs`, `.audit-k16-manual-device-gate.mjs`, `docs/audit/client-portal-k15-*`, `docs/audit/client-portal-k16-*`, `docs/audit/k15-*`, `docs/audit/k16-*` |
| **Commit / Push / Deploy** | **Nein / Nein / Nein** |

---

## 11.3 K.1.5 Smoke

| Lauf | Ergebnis | Regression |
| --- | --- | --- |
| K.1.5 Baseline | 40/40 grün | — |
| K.1.6 Vorab (direkt) | **40/40 grün** | Nein |
| K.1.6 eingebettet (in `.audit-k16-manual-device-gate.mjs`) | **40/40 grün** | Nein |

Smoke-Befehl:

```powershell
$env:AUDIT_WEB_URL="http://localhost:8091"; node .audit-k15-release-blockers.mjs
```

---

## 11.4 Geräte-Matrix

| Gerät | Browser | Messenger | Tastatur/Safe Area | Dokumente | Nachweise | Ergebnis |
| ----- | ------- | --------- | ------------------ | --------- | --------- | -------- |
| **iPhone** | Safari | **nicht geprüft** | **nicht geprüft** | **nicht geprüft** | **nicht geprüft** | **nicht geprüft** |
| **Android** | Chrome | **nicht geprüft** | **nicht geprüft** | **nicht geprüft** | **nicht geprüft** | **nicht geprüft** |
| **iPad** | Safari/Chrome | **nicht geprüft** | **nicht geprüft** | **nicht geprüft** | **nicht geprüft** | **nicht geprüft** |
| **Desktop** | Chromium (Gegencheck) | **grün** | n/a | **grün** | **offen** (Lade-Timeout in K.1.6-Session; K.1.5 Smoke grün) | **teilweise** |

**Hinweis:** Playwright/Chromium auf localhost ist **kein Ersatz** für iPhone Safari, Android Chrome oder iPad. Keine iOS-/Android-Version erfasst, da keine physischen Geräte angebunden waren.

---

## 11.5 iPhone Safari Detail

| Prüfpunkt | Ergebnis |
| --- | --- |
| Login / Portalstart | **Nicht geprüft** |
| Messenger Inbox | **Nicht geprüft** |
| Thread öffnen | **Nicht geprüft** (K.1.5 Playwright iPhone: grün) |
| Composer | **Nicht geprüft** |
| Tastatur / Safe Area | **Nicht geprüft** — **Pflicht-Blocker für Deploy** |
| Nachricht senden | **Nicht geprüft** |
| Back / Bottom-Nav | **Nicht geprüft** (K.1.5 Playwright: grün) |

**Gesamt iPhone Safari:** **nicht geprüft** (kein physisches Gerät)

---

## 11.6 Android Chrome Detail

| Prüfpunkt | Ergebnis |
| --- | --- |
| Login / Übersicht | **Nicht geprüft** |
| Messenger Inbox / Thread | **Nicht geprüft** |
| Composer / Senden / Back | **Nicht geprüft** |
| Android-Tastatur / Bottom-Nav | **Nicht geprüft** |

**Gesamt Android Chrome:** **nicht geprüft** (kein physisches Gerät)

---

## 11.7 iPad Detail

| Prüfpunkt | Ergebnis |
| --- | --- |
| Portal-Tabs (Übersicht, Einsätze, Dokumente, Nachrichten, Profil, Nachweise) | **Nicht geprüft** |
| Split-View Messenger | **Nicht geprüft** (K.1.5 Playwright iPad: grün) |
| Drawer / Navigation | **Nicht geprüft** |
| Tastatur / Composer | **Nicht geprüft** |

**Gesamt iPad:** **nicht geprüft** (kein physisches Gerät)

---

## 11.8 Signaturabschluss

| Punkt | Ergebnis |
| --- | --- |
| **Testdatensatz** | `c0e5e001-e001-4000-8000-000000000001` — „E2E Einwilligung Klient:innenportal“ |
| **Liste** | K.1.5 Smoke: **grün** |
| **Detail** | Desktop-Gegencheck: **grün** — Vorschau, Status „Offene Signatur: client“, Historie-Bereich |
| **Signatur gesetzt** | **Nein** — Signatur-Modal in Chromium-Automation nicht geöffnet; manueller Abschluss ausstehend |
| **Erfolgsmeldung** | **Nicht geprüft** |
| **Historie nach Signatur** | **Nicht geprüft** |
| **KPI** | **Nicht geprüft** |

**Screenshot:** `docs/audit/k16-manual-device-gate-screenshots/signature_detail_desktop.png`

**Gesamt Signaturabschluss:** **offen** — mindestens ein manueller Abschluss mit Testdaten auf echtem Browser/Gerät erforderlich vor vollständiger Freigabe.

---

## 11.9 Leistungsnachweise

| Punkt | Ergebnis |
| --- | --- |
| **Testdatensatz** | `E2E Leistungsnachweis K.1.5` (`c0e50003-…`) |
| **K.1.5 Smoke** | **grün** — Karte, Status OFFEN, PDF/Unterschreiben-CTAs |
| **Desktop-Gegencheck K.1.6** | Lade-Spinner („Nachweise werden geladen…“) — Timing in erweiterter Session, **kein UI-Regression-Nachweis** |
| **PDF anzeigen** | K.1.5: sichtbar; realer Binary-Download: **nicht geprüft** |
| **Unterschreiben** | K.1.5: sichtbar |
| **PDF-Binary geprüft** | **Nein** |
| **Phase-4-Klassifikation** | PDF-Binary = Phase 4; **kein K.1-Blocker**, solange UI ehrlich bleibt |

**Gesamt Nachweise:** **UI grün (K.1.5 Smoke)**; Binary-Download weiterhin Phase 4.

---

## 11.10 K.1.2 Regression

| Punkt | Ergebnis |
| --- | --- |
| Neue dunkle Alt-Komponenten | **Nein** (Desktop-Gegencheck + K.1.5 Screenshots) |
| Neue Kontrastprobleme | **Nein** (keine vollständige WCAG-Runde) |
| Messenger mobil M.1-konform | **Ja** (K.1.5 Playwright iPhone; physisches iPhone offen) |

**Gesamt K.1.2 Regression:** **Nein**

---

## 11.11 Geänderte Dateien

**Keine Codeänderungen in K.1.6.**

Neu/aktualisiert nur Audit-Artefakte:

| Datei | Zweck |
| --- | --- |
| `.audit-k16-manual-device-gate.mjs` | K.1.6 Gate: K.1.5-Retest + Desktop-Gegencheck + Signatur-/Nachweis-Hilfsprüfungen |
| `docs/audit/client-portal-k16-manual-device-gate.md` | Dieser Bericht |
| `docs/audit/client-portal-k16-manual-device-gate.json` | Maschinenlesbarer Report |
| `docs/audit/k16-manual-device-gate-screenshots/` | Desktop-Gegencheck-Screenshots |

---

## 11.12 Abschlussentscheidung

```text
K.1 DEPLOY-FREIGABE: NEIN
```

**Konkrete Restpunkte (max. 5):**

1. **iPhone Safari — Pflicht:** Login, Messenger, Tastatur/Safe Area, Composer, Senden, Back (physisches Gerät).
2. **Android Chrome — Pflicht:** Messenger + Tastaturhöhe + Bottom-Nav (physisches Gerät).
3. **iPad — Pflicht:** Split-View Messenger, Drawer, Dokumente, Nachweise (physisches Gerät).
4. **Signaturabschluss — Pflicht:** Testdatensatz `E2E Einwilligung Klient:innenportal` einmal vollständig signieren, Erfolg + Historie prüfen.
5. **Nachweise — optional vor Deploy:** `PDF anzeigen` auf echtem Gerät prüfen (Binary = Phase 4, kein K.1-Blocker wenn UI ehrlich).

---

## Manuelle Checkliste für Kevin (auf echten Geräten ausfüllen)

Vor Deploy auf `https://caresuiteplus.app` oder lokaler Test-URL mit Audit-Zugang (Erika Mustermann):

### iPhone Safari

- [ ] Login → Übersicht ohne weiße Screens
- [ ] Nachrichten → Thread `E2E Klienten-Nachricht` → Composer
- [ ] Tastatur öffnen → Composer + Senden sichtbar, nicht verdeckt
- [ ] Testnachricht senden (optional)
- [ ] Back → Inbox
- [ ] Dokumente → Signaturdetail → **Unterschreiben abschließen**
- [ ] Nachweise → Karte `E2E Leistungsnachweis K.1.5`

### Android Chrome

- [ ] Gleiche Messenger-/Tastatur-/Bottom-Nav-Checks

### iPad Safari/Chrome

- [ ] Split-View Messenger, Composer, Nachweise, Drawer

---

## Commit-/Deploy-Empfehlung (ohne Ausführung)

| | |
|---|---|
| **Commit vorbereiten empfohlen** | **Nein** — erst nach grüner manueller Geräteabnahme |
| **Deploy vorbereiten empfohlen** | **Nein** |
| **Nach Freigabe** | Ein Commit mit K.1–K.1.5-Änderungen + Audit-Docs; Deploy **nur** auf explizite Anfrage mit `[deploy]` |
