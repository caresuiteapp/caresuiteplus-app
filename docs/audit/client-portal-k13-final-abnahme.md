# K.1.3 Final UX — Abnahmebericht

**Stand:** 2026-07-06T06:25:49.979Z  
**URL:** http://localhost:8091  
**Branch:** `cursor/client-portal-k1-refactor`  
**Audit-Script:** `.audit-k13-final.mjs`

## Kurzstatus

| | |
|---|---|
| **Commit** | Nein |
| **Deploy** | Nein |
| **Browser-Smoke** | **42/48** grün |
| **K.1.2 Design** | Weiterhin nicht formal abgeschlossen |
| **K.1 gesamt** | **Noch nicht deploy-freigabe** |
| **Deploy-Freigabe** | **Nein** |

---

## 1. Geänderte Dateien (K.1.3)

### Messenger / Safe Area
| Datei | Änderung |
| --- | --- |
| `src/components/portal/portalofficethread.tsx` | KeyboardAvoidingView, Auto-Scroll, Voice-Player-Parität, Send-Retry, Safe-Area-Composer, Office-Layout-Spalten |
| `src/components/portal/portalofficemessenger.tsx` | Thread-Titel-Sync via `onThreadTitleResolved` |
| `src/screens/portal/portalofficemessagesscreens.tsx` | Deep-Link-Chat `variant="glass"` |
| `src/components/messaging/MessengerShell.tsx` | Mobile-Chrome-Layout |

### Dokumente & Unterschriften
| Datei | Änderung |
| --- | --- |
| `src/types/documents/csTemplateDatabase.ts` | Portal-Statuslabels (Neu/Offen/Unterschrieben/…) |
| `src/lib/portal/assist/portalAssistDashboardService.ts` | KPI Unterschriften zählt `cs_document_requests` statt `client_documents` |
| `src/screens/documents/CsDocumentRequestDetailScreen.tsx` | Erfolgsbestätigung, Historie, kein sofortiges `router.back()`, CareLightButton |
| `src/components/office/documentSignatures/CsDocumentRequestCard.tsx` | Portal-Statuslabels |
| `src/screens/portal/ClientDocumentSignaturesScreen.tsx` | Titel „Unterschriften“, Portal-Labels |
| `src/components/portal/PortalDocumentsTab.tsx` | Cross-Link „Offene Unterschriften anzeigen →“ |

### Audit
| Datei | Änderung |
| --- | --- |
| `.audit-k13-final.mjs` | Browser-Smoke + Screenshots Desktop/iPad/iPhone |
| `docs/audit/client-portal-k13-final-abnahme.json` | Maschinenlesbarer Bericht |
| `docs/audit/k13-final-screenshots/` | 25 Screenshots |

*(K.1.2-Dateien aus vorheriger Runde weiterhin uncommitted.)*

---

## 2. Screenshots

**Pfad:** `docs/audit/k13-final-screenshots/`

| Viewport | Screens |
| --- | --- |
| **iPhone** | overview, profile, appointments, documents, signatures, proofs, messages, drawer, messages_thread |
| **iPad** | overview, profile, appointments, documents, signatures, proofs, messages, messages_thread |
| **Desktop** | overview, profile, appointments, documents, signatures, proofs, messages, messages_thread |

---

## 3. Browser-Smoke (42/48)

### Grün
- Login API
- Alle 7 Routen × 3 Viewports laden (Übersicht, Profil, Einsätze, Dokumente, Unterschriften, Nachweise, Nachrichten)
- Dokumente → Unterschriften-Cross-Link (3 Viewports)
- Unterschriften-Liste sichtbar
- Drawer + Bottom-Nav (iPhone)
- Compose-CTA auf allen Viewports
- **iPad + Desktop:** Composer im Thread, Eingabefeld, Bottom-Nav ausgeblendet im Thread

### Offen (6 Checks)
| Check | Befund |
| --- | --- |
| `iphone_composer_in_thread` | Thread-Klick in Playwright öffnete mobile Chat-Ansicht nicht zuverlässig (Screenshot zeigt noch Inbox) |
| `iphone_composer_input` | Folgefehler |
| `iphone_messenger_back` | Folgefehler |
| `iphone_thread_hides_bottom_nav` | Bottom-Nav sichtbar, weil Thread-Fokus nicht aktiviert wurde |
| `ipad_messenger_back` | Split-View auf iPad — kein „← Liste"-Button (erwartbar) |
| `desktop_messenger_back` | Split-View auf Desktop — kein „← Liste"-Button (erwartbar) |

**Hinweis:** `messenger_back` auf iPad/Desktop ist ein **False Negative** — Master-Detail zeigt keinen Back-Button by design. iPhone-Thread-Checks erfordern manuelle Verifikation oder robusteres Playwright-Targeting.

---

## 4. Mobile-Smoke (iPhone)

| Bereich | Ergebnis | Bemerkung |
| --- | --- | --- |
| Login | grün | API ok |
| Übersicht | grün | Light-Shell, KPIs |
| Profil | grün | Lesbare Karten |
| Einsätze | grün | Glass-Hero, Karten |
| Dokumente | grün | Cross-Link Unterschriften |
| Unterschriften | grün | Liste + Filter Offen/Erledigt |
| Nachweise | grün | Glass-Hero, Rückfrage-Link |
| Nachrichten Inbox | grün | Compose, Filter, Glass |
| Nachrichten Thread | **manuell prüfen** | Automatisierung flaky |
| Drawer / Bottom-Nav | grün | |

---

## 5. Desktop-Smoke

| Bereich | Ergebnis |
| --- | --- |
| Alle Routen | grün |
| Messenger Split-View | grün — Composer + Input sichtbar |
| Unterschriften | grün |

---

## 6. Tablet-Smoke (iPad)

| Bereich | Ergebnis |
| --- | --- |
| Alle Routen | grün |
| Messenger | grün — Thread + Composer in Split-View |

---

## 7. Noch offene Punkte

### Messenger
- [ ] iPhone Thread-Navigation in Playwright härten (Pressable/Web-Events)
- [ ] Native Voice Recording (aktuell Web-only)
- [ ] Bottom-Sheet-Modals für Anhänge optional polieren
- [ ] Manuell: Tastatur auf echtem iPhone Safari / Android Chrome verifizieren

### Dokumente & Unterschriften
- [ ] **PDF-Archiv / finale PDF** nach Signatur (Phase 4 — nicht implementiert)
- [ ] Office-Seite Status-Sync visuell in Abnahme (Backend vorhanden)
- [ ] Automatisierter E2E Signatur-Flow (Send → Sign → Erledigt) blockiert durch Office-Wizard-Overlay
- [ ] Einheitliche Documents-Hub-Ansicht (Tab + Drawer noch getrennt)

### Leistungsnachweise
- [ ] PDF-Download mit echtem Nachweis-Datensatz (Audit-Account hat ggf. 0 Nachweise)
- [ ] Signatur-Flow über Nachweis → Dokument-Detail

### Design / K.1.2 Rest
- [ ] Mandant-Karte „Details →" Gold-Ton
- [ ] iPad Einsätze Lade-Timing im K.12-Audit
- [ ] WCAG DOM-Heuristik False Positives dokumentiert

### Safe Area
- [ ] Echtes Gerät: Dynamic Island, Safari Toolbar, Home Indicator
- [ ] Modals / Bottom Sheets auf allen Portal-Screens

---

## 8. Regressionen

- **Keine fachlichen Regressionen** beabsichtigt — nur UX/Layout/Portal-Labels
- **Risiko niedrig:** Messenger-Thread-Refactor nutzt etabliertes Office-Pattern
- **Zu prüfen:** KPI Unterschriften-Count kann von 0 auf echte cs_request-Anzahl springen (korrekter, aber sichtbare KPI-Änderung)

---

## 9. WCAG-Ergebnis

Referenz: `docs/audit/k12-design-wcag-bericht.md` — **26/45 automatisch**, Sichtprüfung iPhone-Kernflächen **grün**.

K.1.3 hat keine neuen WCAG-Regressionen eingeführt. Portal-Statuslabels verbessern Lesbarkeit.

---

## 10. Deploy-Freigabe

### **Nein — K.1 ist noch nicht vollständig abnahmefähig**

| Kriterium | Status |
| --- | --- |
| Messenger vollständig (funktional) | **Teilweise** — Code-Parität Office, iPhone-Thread manuell/automation offen |
| Dokumente vollständig | **Teilweise** — Signatur-Flow verbessert, PDF-Archiv fehlt |
| Unterschriften vollständig | **Teilweise** — Workflow bis Bestätigung/Historie, kein finales PDF |
| Leistungsnachweise vollständig | **Teilweise** — UI ok, keine E2E-Daten im Audit |
| Safe Area vollständig | **Teilweise** — Composer-Padding, echte Geräte offen |
| Browser-Smoke grün | **42/48** — iPhone-Thread + erwartbare Split-View-Fails |
| Screenshots vollständig | **Ja** — 25 Bilder |
| Sichtprüfung abgeschlossen | **Teilweise** — automatisiert + Stichproben |

**Empfehlung:** Nach manueller iPhone-Messenger-Prüfung und PDF-Archiv-Entscheidung (Phase 4 Scope) erneut abnehmen. Erst dann **ein** Production-Deploy vorbereiten.

---

## Umgesetzte K.1.3-Fixes (Zusammenfassung)

1. **Messenger:** KeyboardAvoidingView, Auto-Scroll, Voice-Nachrichten-Rendering, Send-Retry, Safe-Area am Composer, Thread-Titel-Sync
2. **Unterschriften:** Portal-Statuslabels, KPI-Fix, Erfolgsbestätigung + Historie, Cross-Link aus Dokumente
3. **Smoke-Infrastruktur:** `.audit-k13-final.mjs` + 25 Screenshots

---

_Kein Commit. Kein Push. Kein Deploy._
