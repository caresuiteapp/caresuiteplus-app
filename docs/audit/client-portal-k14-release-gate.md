# K.1.4 Release-Gate Hardening — Abnahmebericht

**Stand:** 2026-07-06T06:55:02Z  
**URL:** http://localhost:8091  
**Branch:** `cursor/client-portal-k1-refactor`  
**HEAD:** `bbc9c611`  
**Audit-Script:** `.audit-k14-release-gate.mjs`

---

## 11.1 Executive Summary

| | |
|---|---|
| **K.1 deployfähig** | **Nein** |
| **Commit** | Nein |
| **Push** | Nein |
| **Deploy** | Nein |
| **Smoke vorher (K.1.3)** | 42/48 grün |
| **Smoke nachher (K.1.4)** | **44/54 grün** (6 zusätzliche Daten-/Signatur-Checks) |
| **Echte Blocker** | iPhone Messenger Thread, Deep-Link Thread-Ladehang, Signatur-/Nachweis-Testdaten fehlen, echte Geräte offen |
| **False Positives behoben** | `ipad_messenger_back`, `desktop_messenger_back` (Split-View ohne Back-Button) |
| **Phase-4-Punkte** | Finales PDF-Archiv nach Signatur — **kein K.1-Blocker** |

**K.1 DEPLOY-FREIGABE: NEIN**

---

## 11.2 Git-Precheck

| Feld | Wert |
| --- | --- |
| **Branch** | `cursor/client-portal-k1-refactor` |
| **HEAD** | `bbc9c611` |
| **Lokale Änderungen** | Ja — zahlreiche modifizierte Portal-/Messenger-/Dokumente-Dateien (K.1 + K.1.2 + K.1.3 + K.1.4), uncommitted |
| **Untracked Audit-Artefakte** | `.audit-k14-release-gate.mjs`, `.audit-k14-iphone-messenger.mjs`, `docs/audit/client-portal-k14-release-gate.json`, `docs/audit/k14-release-gate-screenshots/`, weitere `.audit-*` und `docs/audit/*` aus früheren Runden |

---

## 11.3 Blocker-Matrix

| ID | Bereich | Problem | Status | Release-Blocker | Ergebnis |
| -- | ------- | ------- | ------ | --------------: | -------- |
| B1 | Messenger iPhone | Thread-Klick öffnet mobile Chat-Ansicht in Playwright nicht; Composer/Back/Bottom-Nav-Checks rot | **Offen** | Ja | In-App-Row-Klick auf RN Web (390px) feuert `onPress` nicht zuverlässig; TouchableOpacity + Web-Cursor ohne Erfolg in Diagnose |
| B2 | Messenger Deep-Link | Route `/portal/client/messages/{id}` zeigt „Chat wird geladen…“ dauerhaft | **Teilfix** | Ja | Back-Button + Bottom-Nav-Ausblendung nach K.1.4-Fix grün; Thread-Detail/Composer bleibt hängen |
| B3 | Audit Test | `messenger_back` iPad/Desktop | **Behoben** | Nein | Split-View erwartet keinen Back-Button — Test als Pass/N/A klassifiziert |
| B4 | Signatur E2E | Keine offene `cs_document_requests` für Audit-Klient | **Offen** | Ja | Admin-Query: 0 offene + 0 gesamt sichtbare Anfragen (`clientId` Erika Mustermann) |
| B5 | Leistungsnachweise | Keine `portal_visible` Nachweise im Audit-Mandanten | **Offen** | Teilweise | UI-Smoke grün (Leerzustand); PDF-/Download-E2E nicht verifizierbar |
| B6 | PDF-Archiv | Finales PDF nach Signatur | **Klassifiziert** | Nein | Variante A — Phase 4; UI verspricht kein finales PDF-Download |
| B7 | K.1.2 Design | Formale Abschlussrunde | **Teilweise** | Teilweise | Mandant „Details →" auf Amber umgestellt; WCAG-Automatik weiterhin mit False Positives |
| B8 | Echte Geräte | Safe Area / Tastatur / Safari Toolbar | **Offen** | Vor Deploy | Nur Playwright — keine echten Geräte in dieser Runde |

---

## 11.4 Messenger-Ergebnis

| Viewport | Thread öffnen | Composer | Eingabe | Send | Back | Bottom-Nav im Thread |
| --- | --- | --- | --- | --- | --- | --- |
| **iPhone** | **Rot** | **Rot** | **Rot** | — | **Rot** | **Rot** (sichtbar) |
| **iPad** | Grün | Grün | Grün | Grün | Grün (N/A Split) | Grün (N/A) |
| **Desktop** | Grün | Grün | Grün | Grün | Grün (N/A Split) | Grün |

### K.1.4 Code-Fixes (Messenger)

- `ClientPortalOfficeConversationScreen`: Messenger-Focus aktiv, Mobile-Chrome mit `messenger-back-to-list`, `messenger-mobile-thread` testID
- `MessengerShell`: `testID="messenger-mobile-thread"` auf Mobile-Thread-Container
- `portalofficeinbox`: Web-`TouchableOpacity`, `cursor:pointer`, robustere Klickfläche
- Route-Param-Normalisierung (`string | string[]`) für `threadId`/`id`

### Diagnose iPhone (`.audit-k14-iphone-messenger.mjs`)

- Inbox sichtbar, Thread-Row `c0e5c002-c002-4000-8000-000000000002` vorhanden
- testid-/text-/evaluate-click: **Composer bleibt unsichtbar**
- Deep-Link: Back-Button sichtbar, Bottom-Nav ausgeblendet — **Composer weiterhin „Chat wird geladen…"**
- Screenshot: `docs/audit/k14-release-gate-screenshots/messages_thread__iphone.png`

### Voice

- Web-only (unverändert, kein Release-Blocker)

---

## 11.5 Signatur-E2E-Ergebnis

| Prüfpunkt | Ergebnis |
| --- | --- |
| Testdaten vorhanden | **Nein** — `cs_document_requests` für Audit-Klient leer |
| Offene Anfrage in DB | **Nein** (0) |
| Dokumente Cross-Link UI | **Ja** |
| Unterschriften-Liste UI | **Ja** (alle Viewports) |
| Detail sichtbar | **Nein** — keine offene Anfrage |
| Signaturabschluss geprüft | **Nein** |
| Historie/KPI nach Signatur | **Nein** — E2E nicht ausführbar |
| PDF-Finale Blocker | **Nein** — kein irreführender PDF-Download in Signatur-UI; HTML-Vorschau + Status/Historie |

**Audit-Mandant:** Erika Mustermann (`clientId`: `ec4f159f-e794-4326-8b0e-15c0166df1ea`, `tenantId`: `a4ba83bd-65db-46cf-8cf7-61492cc78315`)

---

## 11.6 Leistungsnachweise

| Prüfpunkt | Ergebnis |
| --- | --- |
| UI-Smoke (Route lädt) | **Ja** — alle Viewports |
| Leerer Zustand | **Ja** — korrekt dargestellt |
| Echte Daten in DB | **Nein** — 0 `portal_visible` `client_documents` für Audit-Klient |
| PDF-Aktion geprüft | **Nein** |
| Signatur-/Rückfrage-Flow geprüft | **Nein** |

**Bewertung:** UI-Smoke grün, **Daten-E2E offen** — nicht als vollständig grün verkauft.

---

## 11.7 K.1.2 Design/WCAG

### Geprüfte Screens (K.1.4 Screenshots)

Übersicht, Profil, Einsätze, Dokumente, Unterschriften, Nachweise, Nachrichten (+ Thread), Drawer (iPhone) — je iPhone/iPad/Desktop in `docs/audit/k14-release-gate-screenshots/`.

### K.1.4 Design-Fix

- `MobilePortalSidebarCards`: „Details →" nutzt `PORTAL_LIGHT_LINK_ORANGE` in Light-Shell (statt Gold)

### Verbleibende Restpunkte

- K.1.2 **nicht formal abgeschlossen** — automatisierte WCAG-Runde (`.audit-k12-design-wcag.mjs`, Referenz 26/45) weiterhin mit False Positives
- Keine neuen dunklen Alt-Chips in geprüften K.1.3/K.1.4-Screenshots identifiziert
- Messenger Composer M.1-konform auf iPad/Desktop; iPhone Thread weiterhin blockiert

**Design formal abschließen:** **Nein** (Messenger-iPhone + WCAG-Automatik offen)

---

## 11.8 Safe-Area-Gerätecheck

| | |
|---|---|
| **Automatisiert geprüft** | Playwright iPhone 13 / iPad Pro 11 / Desktop 1280×900 |
| **Manuell noch offen** | Safari Toolbar, Dynamic Island, Android Chrome Tastaturhöhe |
| **Echte Geräte erforderlich** | **Ja** vor Production-Deploy |

### Manuelle Checkliste (nicht in dieser Runde ausgeführt)

**iPhone Safari:** Login → Übersicht → Nachrichten Inbox → Thread öffnen → Tastatur → Composer sichtbar → Bottom-Nav verdeckt nichts → Zurück → Dokumente → Signaturdetail

**Android Chrome:** gleiche Schritte, Fokus Tastaturhöhe + Bottom-Nav

**iPad Safari/Chrome:** Split-View Messenger, Composer, Dokumente, Nachweise, Drawer

---

## 11.9 Geänderte Dateien (K.1.4)

| Datei | Kurzbeschreibung |
| --- | --- |
| `src/screens/portal/portalofficemessagesscreens.tsx` | Conversation: Messenger-Focus, Mobile-Back-Chrome, Route-Param-Normalisierung |
| `src/components/messaging/MessengerShell.tsx` | `testID="messenger-mobile-thread"` |
| `src/components/portal/portalofficeinbox.tsx` | Web TouchableOpacity + pointer cursor für Thread-Rows |
| `src/components/portal/assist/MobilePortalSidebarCards.tsx` | „Details →" Amber-Link in Light-Shell |
| `.audit-k14-release-gate.mjs` | Release-Gate-Smoke inkl. Daten-Queries, Split-View-Back-Logik |
| `docs/audit/client-portal-k14-release-gate.json` | Maschinenlesbarer Bericht |
| `docs/audit/k14-release-gate-screenshots/` | 27 Screenshots |

*(K.1.2/K.1.3-Änderungen weiterhin uncommitted auf dem Branch.)*

---

## 11.10 Abschlussentscheidung

### K.1 DEPLOY-FREIGABE: NEIN

**Maximal 5 konkrete Restpunkte:**

1. **iPhone Messenger:** Thread-Row öffnet in Mobile-Web (Playwright + Diagnose) keinen Chat — Composer, Back und Bottom-Nav-Verhalten nicht release-tauglich verifiziert.
2. **Deep-Link Thread-Route:** `/portal/client/messages/{id}` bleibt auf „Chat wird geladen…" — Detail-Fetch muss stabil laden, bevor Mobile-Deep-Link deployfähig ist.
3. **Signatur-E2E:** Audit-Mandant ohne offene `cs_document_requests` — reproduzierbarer Signatur-Flow (Detail → Signieren → Historie/KPI) nicht nachgewiesen.
4. **Leistungsnachweise Daten-E2E:** Keine portal-sichtbaren Testnachweise — PDF/Download-Flow ungeprüft.
5. **Echte Geräte Safe-Area/Tastatur:** Vor Deploy manuell auf iPhone Safari + Android Chrome prüfen (nicht durch Playwright abgedeckt).

---

## PDF-Finale — Klassifizierung

| | |
|---|---|
| **Blocker** | **Nein** |
| **Begründung** | K.1 deckt Portalzugriff, Signaturstatus, Historie und Dokumentenfluss ab — kein finales PDF-Archiv |
| **UI-Verhalten** | Signatur-Detail: HTML-Vorschau, Statuslabels, Historie — kein „Finales PDF herunterladen" |
| **Folgephase** | Phase 4: PDF-Generierung/Archiv nach Signatur |

---

_Kein Commit. Kein Push. Kein Deploy._
