# K.1.5 Release-Blocker Fix — Abnahmebericht

**Stand:** 2026-07-06T07:54:00Z  
**URL:** http://localhost:8091  
**Branch:** `cursor/client-portal-k1-refactor`  
**HEAD:** `bbc9c611`  
**Audit-Script:** `.audit-k15-release-blockers.mjs`  
**Seed-Script:** `.audit-k15-seed.mjs`

---

## 13.1 Executive Summary

| | |
|---|---|
| **K.1 deployfähig** | **Nein** — nur nach manuellem Gerätecheck freigabefähig |
| **Commit** | Nein |
| **Push** | Nein |
| **Deploy** | Nein |
| **Smoke vorher (K.1.4)** | 44/54 grün |
| **Smoke nachher (K.1.5)** | **40/40 grün** (fokussierter Blocker-Suite) |
| **Echte Blocker vorher (K.1.4)** | 5 (iPhone Messenger, Deep-Link, Signatur-Testdaten, Nachweis-Testdaten, echte Geräte) |
| **Echte Blocker nachher (K.1.5)** | 1 (echte Geräte Safe-Area/Tastatur — manuell offen) |

**K.1 DEPLOY-FREIGABE: NEIN**

Automatisierung ist für die vier technischen Blocker grün. Deploy bleibt blockiert, bis die manuelle Geräte-Checkliste (Blocker 5) durchgeführt und dokumentiert ist.

---

## 13.2 Git-Precheck

| Feld | Wert |
| --- | --- |
| **Branch** | `cursor/client-portal-k1-refactor` |
| **HEAD** | `bbc9c611` |
| **Lokale Änderungen** | Ja — K.1–K.1.5 Portal-/Messenger-/Hook-/Seed-/Audit-Dateien, uncommitted |
| **Untracked Audit-Artefakte** | `.audit-k15-seed.mjs`, `.audit-k15-release-blockers.mjs`, `.audit-k15-seed-results.json`, `docs/audit/client-portal-k15-release-blockers.json`, `docs/audit/k15-release-blockers-screenshots/`, frühere `.audit-*` / `docs/audit/*` aus K.1.1–K.1.4 |

Dateien aus K.1.1 bis K.1.4 sind weiterhin uncommitted auf demselben Branch.

---

## 13.3 Blocker-Matrix

| ID | Blocker | K.1.4 Status | K.1.5 Status | Release-Blocker bleibt? |
| -- | ------- | ------------ | ------------ | ----------------------: |
| 1 | iPhone Messenger Thread | Rot (Row-Klick) | **Grün** (Thread via Route, Composer, Back, Bottom-Nav) | Nein |
| 2 | Deep-Link `/portal/client/messages/{id}` | Rot (eternal loading) | **Grün** (iPhone/iPad/Desktop) | Nein |
| 3 | Signatur-E2E Testdaten | Rot (0 offene Anfragen) | **Grün** (Seed + Liste/Detail/CTA/Historie) | Nein |
| 4 | Leistungsnachweise Testdaten | Rot (0 portal-sichtbar) | **Grün** (Seed + Karte + Status + PDF-CTA) | Nein |
| 5 | Echte Geräte Safe-Area/Tastatur | Offen | **Offen** (nur Playwright) | **Ja** |

---

## 13.4 Messenger iPhone

### Root Cause

1. **Deep-Link / Thread-Laden:** `useAsyncQuery` in `usePortalOfficeThreadDetail` hing von instabilem `resolveActor`-Callback ab → Endlosschleife auf Conversation-Route.
2. **Row-Klick RN Web:** `Pressable`/`Link`+`TouchableOpacity` auf 390px unzuverlässig; produktiver Pfad nutzt jetzt `router.push` auf Mobile.
3. **Back → Inbox Crash:** `Link asChild` + `TouchableOpacity` verursachte auf Web `CSSStyleDeclaration`-Indexed-Property-Fehler beim Zurücknavigieren; Back nutzte `router.push` statt `replace`.

### Fix

- `useportalofficethreaddetail.ts`: Actor-Deps auf Primitive (`actorRoleKey`, `actorClientId`, …) umgestellt.
- `portalofficemessenger.tsx`: Mobile Client → `router.push('/portal/client/messages/${threadId}')`.
- `portalofficeinbox.tsx`: Stabile `testID` `portal-thread-open-${id}`, Web-`Pressable` ohne `Link`-Wrapper.
- `portalofficemessagesscreens.tsx`: `showMobileChrome` ohne `isPhone`-Gate; Back → `router.replace('/portal/client/messages')`.

### Ergebnis (Playwright iPhone 13)

| Check | Ergebnis |
| --- | --- |
| Inbox sichtbar | Grün |
| Thread-Row sichtbar | Grün |
| Thread öffnet (Mobile) | Grün |
| Thread-Container | Grün (`messenger-mobile-thread`) |
| Composer / Input / Send | Grün |
| Back sichtbar | Grün |
| Back → Inbox | Grün |
| Bottom-Nav im Thread | Grün (ausgeblendet) |

**Screenshots:** `docs/audit/k15-release-blockers-screenshots/iphone_messenger_thread.png`, `iphone_messenger_inbox_after_back.png`

---

## 13.5 Messenger Deep-Link

### Root Cause

Identisch mit iPhone Thread-Ladehang: instabile `useAsyncQuery`-Deps → Thread-Detail-Query wurde ständig neu gestartet, UI blieb auf „Chat wird geladen…“.

### Route-Param / Datenabfrage

- Route: `/portal/client/messages/{id}` — Param `id` wird via `resolveRouteParam(threadId) ?? resolveRouteParam(id)` gelesen.
- Mandanten-/Client-Filter über Portal-Actor in `usePortalOfficeThreadDetail`.

### Loading-State

Nach Fix endet Loading, Composer und Nachrichtenliste werden angezeigt.

### Ergebnis

| Viewport | Loads | Titel | Composer | Loading endet |
| --- | --- | --- | --- | --- |
| iPhone | Grün | Grün | Grün | Grün |
| iPad | Grün | Grün | Grün | Grün |
| Desktop | Grün | Grün | Grün | Grün |

**Screenshots:** `docs/audit/k15-release-blockers-screenshots/deeplink_thread__iphone.png`, `deeplink_thread__ipad.png`, `deeplink_thread__desktop.png`

---

## 13.6 Signatur-E2E

| Punkt | Ergebnis |
| --- | --- |
| Testdaten erzeugt | **Ja** — `cs_document_requests` `c0e5e001-…`, Status `sent`, `portal_visible` |
| Offene Anfrage sichtbar | **Ja** |
| Detail sichtbar | **Ja** |
| Signieren geprüft | **Teilweise** — Signatur-CTA „Unterschreiben“ sichtbar; vollständiges Canvas-Signieren im Headless-Browser nicht automatisiert |
| Historie sichtbar | **Ja** |
| KPI geprüft | **Nein** — KPI-Zähler in dieser Suite nicht separat assertiert |
| Rest offen | Signatur-Abschluss im Browser manuell oder dedizierter Signatur-Smoke |

**Screenshots:** `signatures_list_iphone.png`, `signature_detail_iphone.png`

---

## 13.7 Leistungsnachweise

| Punkt | Ergebnis |
| --- | --- |
| Testdaten erzeugt | **Ja** — `assist_visit_proofs` + Mirror in `client_documents` (Business-Admin-Insert) |
| Portal-sichtbarer Nachweis | **Ja** — „E2E Leistungsnachweis K.1.5“ |
| Karte sichtbar | **Ja** |
| Status sichtbar | **Ja** — „OFFEN“ |
| PDF-/Download-Aktion | **UI grün** — „PDF anzeigen“ + „Unterschreiben“ sichtbar; **realer PDF-Download nicht geprüft** (Storage-Datei Audit-Pfad, kein Binary-Smoke) |
| Rest offen | Echter PDF-Download = Phase-4-/Storage-Thema, kein K.1-Blocker |

### Root Cause (Testdaten)

1. `service_role` darf `client_documents` nicht INSERTen → Mirror via Business-Login.
2. `inherit_tenant_defaults: true` ignorierte `show_proofs: true` am Client → `inherit_tenant_defaults: false` gesetzt.

**Screenshot:** `proofs_iphone.png`

---

## 13.8 Safe-Area / echte Geräte

| Punkt | Ergebnis |
| --- | --- |
| Playwright geprüft | **Ja** — Safe-Area-Indikatoren (Bottom-Nav aus, Composer sichtbar) auf iPhone/iPad/Desktop |
| Echte Geräte geprüft | **Nein** |
| Manuelle Checkliste vorhanden | **Ja** (unten) |
| Deploy nur nach manuellem Gerätecheck | **Ja** |

### Manuelle Geräte-Checkliste (vor Deploy)

#### iPhone Safari

- [ ] Login
- [ ] Übersicht öffnen
- [ ] Nachrichten öffnen
- [ ] Thread öffnen
- [ ] Tastatur öffnen, Nachricht tippen
- [ ] Composer + Senden sichtbar, Bottom-Nav verdeckt nichts
- [ ] Back zur Inbox
- [ ] Dokumente → Signaturdetail öffnen

#### Android Chrome

- [ ] Gleiche Schritte, Fokus Tastaturhöhe + Bottom-Nav

#### iPad Safari/Chrome

- [ ] Split-View Messenger, Composer, Dokumente, Nachweise, Drawer

---

## 13.9 K.1.2 Regression

| Punkt | Ergebnis |
| --- | --- |
| Neue dunkle Alt-Komponenten | **Nein** |
| Neue Kontrastprobleme | **Nein** (keine neuen WCAG-Läufe in K.1.5) |
| Messenger mobil M.1-konform | **Ja** — Composer lesbar, Glass-Hero, Bottom-Nav im Thread ausgeblendet |

---

## 13.10 Geänderte Dateien

| Datei | Kurzbeschreibung |
| --- | --- |
| `src/hooks/useportalofficethreaddetail.ts` | Deep-Link-Ladehang: stabile `useAsyncQuery`-Deps |
| `src/components/portal/portalofficemessenger.tsx` | Mobile Thread-Navigation via `router.push` |
| `src/components/portal/portalofficeinbox.tsx` | Web-Pressable, `portal-thread-open-*` testIDs, Link-Wrapper entfernt |
| `src/screens/portal/portalofficemessagesscreens.tsx` | Mobile Chrome + `router.replace` Back |
| `.audit-k15-seed.mjs` | Idempotenter Seed: Signatur + Nachweis + Portal-Settings |
| `.audit-k15-release-blockers.mjs` | K.1.5 Blocker-Suite (40 Checks, 3 Viewports) |
| `docs/audit/client-portal-k15-release-blockers.json` | Maschinenlesbarer Audit-Report |
| `docs/audit/k15-release-blockers-screenshots/` | Neue Screenshots |

*(Weitere uncommitted Dateien aus K.1.1–K.1.4 unverändert in Scope dieser Runde.)*

---

## 13.11 Abschlussentscheidung

```text
K.1 DEPLOY-FREIGABE: NEIN
```

**Konkrete Restpunkte (max. 5):**

1. **Manuelle Geräteprüfung iPhone Safari** — Tastatur, Safe Area, Composer, Bottom-Nav (Blocker 5).
2. **Manuelle Geräteprüfung Android Chrome** — Tastaturhöhe + Bottom-Nav.
3. **Manuelle Geräteprüfung iPad** — Split-View Messenger, Nachweise, Drawer.
4. **Signatur-Abschluss im echten Browser** — CTA grün, vollständiges Signieren nicht headless-automatisiert.
5. **PDF-Download real** — UI ehrlich („PDF anzeigen“), Binary-Download nicht smoke-getestet (Phase 4, kein K.1-Blocker).

---

## Smoke-Vergleich

| Suite | Grün | Rot | Gesamt |
| --- | ---: | ---: | ---: |
| K.1.4 Release-Gate | 44 | 10 | 54 |
| K.1.5 Release-Blockers | **40** | **0** | **40** |

Neu grün in K.1.5 (gegenüber K.1.4-Blockern): iPhone Messenger (Inbox, Thread, Composer, Back, Bottom-Nav), Deep-Link (3 Viewports), Signatur-Testdaten + E2E-UI, Nachweis-Testdaten + Karten-UI.

Rot / manuell: echte Geräte (Blocker 5) — **kein Playwright-Ersatz**.
