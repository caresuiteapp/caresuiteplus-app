# CareSuite+ — Mitarbeiter-Schulung (PowerPoint-Briefing)

**Stand:** 2026-06-27  
**Produktion:** https://caresuiteplus.app  
**Zweck:** Vollständiges Briefing für ChatGPT / PowerPoint-Erstellung — Office, Assist, Mitarbeiterportal, Klient:innenportal  
**Quellen:** Codebase (`src/`, `app/`), Routen-Registry, UI-Labels (Deutsch), Audit-Dokumente `docs/audit/portal-m3-*.md`

---

## 1. Einleitung

### Zielgruppe

| Rolle | Schwerpunkt in der Schulung |
|-------|----------------------------|
| **Verwaltung / Office** (PDL, Disposition, Backoffice) | Klient:innen- und Personalakten, Zugänge, Abrechnung, Nachrichten |
| **Einsatzplanung / Assist** (Disponent:in, Teamleitung) | Einsätze anlegen, Kalender, Durchführung, Live-Status |
| **Pflege- / Betreuungskräfte** (Mitarbeiterportal) | Tagesübersicht, Einsatz durchführen, GPS, Dienstplan |
| **Ansprechpersonen für Klient:innen** | Portal erklären, Zugang einrichten, Hilfe bei Login |

### Lernziele (nach 90 Minuten können Teilnehmende …)

1. … die **vier Einstiege** auf der Startseite benennen und die richtige Anmeldung wählen.
2. … in **Office** eine Klient:innenakte öffnen, Stammdaten prüfen und einen **Portal-Zugang** einrichten oder zurücksetzen.
3. … in **Assist** einen Einsatz anlegen, im Kalender finden und den **Status-Flow** erklären.
4. … im **Mitarbeiterportal** einloggen (inkl. Erstlogin), einen Einsatz **starten und abschließen** (GPS-Einwilligung).
5. … Klient:innen das **Klient:innenportal** in einfachen Worten erklären und beim Login mit Benutzername + Portal-Code helfen.
6. … typische **Fehler** (falsches Passwort, abgelaufener Code, fehlende GPS-Berechtigung) erkennen und an die Verwaltung eskalieren.

### Dauer-Vorschlag: 90 Minuten

| Block | Dauer | Inhalt |
|-------|-------|--------|
| Begrüßung & Überblick | 10 Min | CareSuite+-Vision, vier Zugänge, Rollen |
| Modul Office | 20 Min | Dashboard, Klient:innen, Personalakte, Zugänge |
| Modul Assist | 20 Min | Einsatzplanung, Kalender, Durchführung |
| Modul Mitarbeiterportal | 20 Min | Login, Dashboard, Einsatz-Feldworkflow |
| Modul Klient:innenportal | 10 Min | Login, Erklärung für Klient:innen |
| Praxis & FAQ | 10 Min | Rollenspiele, Troubleshooting |

### Empfohlene Voraussetzungen für Teilnehmende

- Eigener **Business-Login** (Verwaltung) oder **Mitarbeiterportal-Zugang** (Feld)
- Smartphone oder Tablet für Portal-Demo (Mitarbeiterportal ist **mobile-first**)
- Optional: Demo-Klient:in mit aktivem Portal-Code

---

## 2. Modul Office (Verwaltung)

### 2.1 Überblick

**Office** ist das zentrale Verwaltungsmodul für Klient:innen, Mitarbeitende, Termine, Dokumente, Abrechnung und Zugangsverwaltung.

- **Login:** Startseite → **Anmeldung Verwaltung** → `/auth/business-login`
- **Ziel nach Login:** `/business` (Business-Dashboard) oder direkt `/office`
- **Shell-Navigation (Sidebar / Schnellzugriff):** Klient:innen, Mitarbeitende, Rechnungen, Dokumente, Terminverwaltung, Kalender, Nachrichten, Broadcast, Qualitätsmanagement, Zugänge & Benutzer, Modulzuordnungen, Audit-Log

### 2.2 Slide-by-Slide Outline — Modul Office

#### Slide O-01: Titel „Office — Ihre Verwaltungszentrale“

- **Lernziele:** Office als Mandanten-Steuerzentrale verstehen
- **Klickpfad:** `https://caresuiteplus.app/` → **Anmeldung Verwaltung**
- **Sprecher-Notizen:** CareSuite+ bündelt Office, Assist, Pflege und weitere Module. Office ist der Ausgangspunkt für Stammdaten, Verträge und Zugänge. Nicht jede Rolle sieht alle Bereiche — Rechte kommen aus Rollen & Modulrechten.

#### Slide O-02: Business-Login

- **Lernziele:** Anmeldung mit Benutzername oder E-Mail + Passwort
- **Klickpfad:** `/auth/business-login` → Einloggen → `/business` oder `/office`
- **UI-Labels:** „Business-Anmeldung“, Felder Benutzername/E-Mail, Passwort, **Einloggen**
- **Sprecher-Notizen:** Nur Unternehmen registrieren sich selbst (`/auth/register-business`). Mitarbeitende und Klient:innen erhalten Zugänge über Office.

#### Slide O-03: Office-Dashboard

- **Lernziele:** Schnellzugriff-Karten und Modulwechsel
- **Klickpfad:** `/office`
- **Sichtbar:** KPI-Karten, Schnellzugriff (Klient:innen, Mitarbeitende, Rechnungen, …), Modul-Switcher
- **Sprecher-Notizen:** Das Dashboard spiegelt die Sidebar. Von hier starten fast alle Verwaltungsaufgaben.

#### Slide O-04: Klient:innenliste

- **Lernziele:** Suchen, filtern, neuen Klienten anlegen
- **Klickpfad:** `/office/clients` → Zeile antippen → Klient:innenakte
- **Neuaufnahme:** `/business/office/clients/new`
- **UI-Labels:** „Klient:innen“, „Liste, Suche, Filter und Status“
- **Sprecher-Notizen:** Die Liste ist der Einstieg in jede Klient:innenakte. Neuaufnahme führt durch strukturierte Intake-Schritte.

#### Slide O-05: Klient:innenakte — Aufbau

- **Lernziele:** Tabs der Akte kennen
- **Klickpfad:** `/business/office/clients/[id]`
- **Tabs (Auswahl):** Übersicht, Stammdaten, Leistungen & Budget, Pflegegrad & Anspruch, Kontakte, Angehörige, Vertrag, Einwilligungen, Dokumente & Nachweise, Einsätze & Termine, **Portal & Freigaben**, Verlauf, Aktionen
- **Sprecher-Notizen:** Nicht jeder Tab ist für jede Rolle sichtbar. PDL sieht Pflege-Details; Buchhaltung eher Vertrag und Budget.

#### Slide O-06: Stammdaten & Kontakt

- **Lernziele:** Pflichtfelder, Adresse, Angehörige pflegen
- **Klickpfad:** Akte → Tab **Stammdaten** / **Kontakte** / **Angehörige**
- **Sprecher-Notizen:** Korrekte Adresse ist wichtig für Assist-Routing und GPS-Geofence im Mitarbeiterportal.

#### Slide O-07: Portal & Freigaben (Klient:in)

- **Lernziele:** Portal einrichten, Code erzeugen, Module zuweisen
- **Klickpfad:** Akte → Tab **Portal & Freigaben**
- **Aktionen:** „Portal einrichten“, „Portal-Code neu erzeugen“, Module zuweisen (Assist, Pflege, …)
- **UI-Labels:** „Anmeldung Klient:innen Portal“, Benutzername + 6-stelliger Portal-Code
- **Sprecher-Notizen:** Der Klartext-Code wird **nur einmal** angezeigt — sofort notieren oder ausdrucken. Login erfolgt über Startseite → **Anmeldung Klient:innen Portal** (`/auth/portal-code-login`).

#### Slide O-08: Mitarbeitendenliste

- **Lernziele:** Team finden, Personalakte öffnen
- **Klickpfad:** `/office/employees` → Mitarbeitende auswählen
- **Neu anlegen:** `/office/employees/create`
- **Sprecher-Notizen:** Jede Person hat eine Personalakte mit Qualifikationen, Dokumenten und Portal-Tab.

#### Slide O-09: Personalakte (Mitarbeitende)

- **Lernziele:** Tabs der Personalakte
- **Klickpfad:** Mitarbeitende → Detail → Personalakte
- **Tabs:** Übersicht, Stammdaten, Kontakt, Anstellung, Rollen & Rechte, Qualifikationen, Dokumente, **Portal**, Einsatzfähigkeit, Arbeitsmaterial, Verlauf
- **Sprecher-Notizen:** Die Personalakte ist die Single Source of Truth für HR-relevante Daten und Portalzugang.

#### Slide O-10: Mitarbeiterportal-Zugang anlegen

- **Lernziele:** Einmalpasswort erstellen und übergeben
- **Klickpfad:** Personalakte → Tab **Portal** → **Zugang anlegen**
- **Anzeige:** Benutzername (Format z. B. `firma.vorn.nachna`) + **Einmalpasswort**
- **Login-Pfad für MA:** Startseite → **Anmeldung Mitarbeiter:in Portal** → `/auth/employee-login`
- **Sprecher-Notizen:** Nach Erstlogin muss ein eigenes Passwort gesetzt werden. Das Einmalpasswort ist danach ungültig. Anleitung auf der Login-Seite: „Ihr Benutzername und Ihr erstes Passwort werden von Ihrer Verwaltung bereitgestellt.“

#### Slide O-11: Passwort zurücksetzen (Mitarbeiter)

- **Lernziele:** OTP neu ausstellen, Zugang sperren/entsperren
- **Klickpfad:** Personalakte → Portal **oder** `/business/office/access` → Mitarbeitendenportal → Detail
- **Aktionen:** **Passwort zurücksetzen**, Sperren, Entsperren
- **Alternative:** Zugänge & Benutzer → Mitarbeitendenportal → Account-Detail
- **Sprecher-Notizen:** Nach Reset erscheint ein neues Einmalpasswort. Mitarbeitende müssen ggf. erneut den Erstlogin-Flow durchlaufen.

#### Slide O-12: Zugänge & Benutzer (Übersicht)

- **Lernziele:** Zentrale Zugangsverwaltung
- **Klickpfad:** `/business/office/access`
- **Unterbereiche:** Übersicht, Interne Benutzer, Mitarbeitendenportal, Klient:innenportal / Angehörigenportal, Rollen & Rechte, Modulrechte, Login-Protokoll
- **Sprecher-Notizen:** Hier verwalten Admins alle Login-Typen. Das Login-Protokoll hilft bei Support-Fällen.

#### Slide O-13: Termine & Kalender

- **Lernziele:** Termin anlegen, Kalenderansicht nutzen
- **Klickpfad:** `/office/appointments`, `/office/calendar`
- **Sprecher-Notizen:** Office-Termine sind mandantenweit. Assist-Einsätze werden separat in Assist geplant (siehe Modul 3).

#### Slide O-14: Nachrichten & Broadcast

- **Lernziele:** Interne Kommunikation, Rundschreiben
- **Klickpfad:** `/office/messages` → Verfassen `/office/messages/compose`
- **Broadcast:** `/office/messages?audience=employees&view=broadcasts`
- **Sprecher-Notizen:** Mitarbeitende sehen Nachrichten auch im Mitarbeiterportal unter Tab **Nachrichten**.

#### Slide O-15: Dokumente & Abrechnung (Kurzüberblick)

- **Lernziele:** Zentrale Dokumentenablage, Rechnungen
- **Klickpfad:** `/office/documents`, `/office/invoices`, `/office/budgets`
- **Sprecher-Notizen:** Klientenbezogene Dokumente liegen zusätzlich in der Klient:innenakte. Abrechnung erfordert Rolle Buchhaltung/Admin.

---

## 3. Modul Assist (Einsatzplanung)

### 3.1 Überblick

**Assist** plant und steuert Einsätze im ambulanten / assistiven Bereich: Zuordnung Mitarbeitende ↔ Klient:innen, Kalender, Durchführung, Nachweise, Fahrten, Live-Status.

- **Login:** Gleicher Business-Login wie Office
- **Einstieg:** Modulwechsel → **Assist** → `/assist`
- **Kernbereiche (Sidebar):**
  - **Einsätze & Durchführung:** Einsätze, Durchführung, Nachweise, Aufgaben
  - **Mobilität & Planung:** Fahrten, Touren, Kalender, Live-Status
  - **Qualität & Einstellungen:** Qualität, Zugeordnete Klient:innen, Einstellungen

### 3.2 Slide-by-Slide Outline — Modul Assist

#### Slide A-01: Titel „Assist — Einsatzplanung“

- **Lernziele:** Assist vs. Office vs. Mitarbeiterportal abgrenzen
- **Klickpfad:** `/assist`
- **Sprecher-Notizen:** Office verwaltet Stammdaten; Assist plant den operativen Einsatz; Mitarbeitende führen im Portal aus.

#### Slide A-02: Assist-Dashboard

- **Lernziele:** KPIs, offene Aufgaben, Schnellzugriff
- **Klickpfad:** `/assist`
- **Sichtbar:** KPI-Karten (Einsätze heute, offene Nachweise, …), Workspace-Hinweise
- **Sprecher-Notizen:** Dashboard zeigt den Tagesüberblick für Disposition.

#### Slide A-03: Einsätze — Liste

- **Lernziele:** Einsätze filtern, Detail öffnen
- **Klickpfad:** `/assist/assignments`
- **UI-Labels:** „Einsätze“
- **Sprecher-Notizen:** Hier erscheinen alle geplanten und laufenden Einsätze mandantenweit (je nach Rolle gefiltert).

#### Slide A-04: Einsatz anlegen

- **Lernziele:** Neuen Einsatz erstellen
- **Klickpfad:** `/assist/assignments?create=1` (Legacy-Redirect von `/assist/einsaetze/new`)
- **Pflichtfelder (typisch):** Klient:in, Mitarbeitende:r, Leistung, Zeitraum, Adresse
- **Sprecher-Notizen:** Nach Speichern erscheint der Einsatz in Assist und — sobald zugeordnet — im Mitarbeiterportal des/der Mitarbeitenden.

#### Slide A-05: Einsatz-Detail & Status

- **Lernziele:** Status-Lebenszyklus verstehen
- **Klickpfad:** `/assist/assignments/[id]`
- **Status (Deutsch):** Geplant → Bestätigt → Unterwegs → Angekommen → Gestartet → Beendet → Dokumentation offen → Abgeschlossen (alternativ: Storniert, Nicht erschienen)
- **Sprecher-Notizen:** Statusänderungen im Feld erfolgen primär über das Mitarbeiterportal. Disponent:innen sehen Updates in Echtzeit unter Live-Status.

#### Slide A-06: Kalender

- **Lernziele:** Wochen-/Tagesplanung
- **Klickpfad:** `/assist/calendar` oder `/assist/kalender`
- **Sprecher-Notizen:** Kalender bündelt Einsätze zeitlich — ideal für Disposition und Vertretungsplanung.

#### Slide A-07: Durchführung

- **Lernziele:** Laufende und abgeschlossene Einsätze überwachen
- **Klickpfad:** `/assist/durchfuehrung`, Detail `/assist/durchfuehrung/[id]`
- **Sprecher-Notizen:** Hier sieht die Verwaltung den operativen Fortschritt aller Einsätze.

#### Slide A-08: Nachweise

- **Lernziele:** Leistungsnachweise prüfen und freigeben
- **Klickpfad:** `/assist/nachweise`, Review `/assist/nachweise/review`
- **Sprecher-Notizen:** Nachweise können als PDF exportiert werden. Klient:innen sehen freigegebene Dokumente ggf. im Portal.

#### Slide A-09: Fahrten & Touren

- **Lernziele:** Fahrtenbuch, Tourenplanung
- **Klickpfad:** `/assist/fahrten`, `/assist/touren`, `/assist/touren-vertretung`
- **Sprecher-Notizen:** GPS-Daten aus dem Mitarbeiterportal fließen in Fahrten und Live-Status ein.

#### Slide A-10: Live-Status

- **Lernziele:** Echtzeit-Lage aller Einsätze
- **Klickpfad:** `/assist/live-status`
- **Sichtbar:** Karte, Position, Status-Badges
- **Sprecher-Notizen:** Setzt voraus, dass Mitarbeitende Standortfreigabe erteilt haben und „Anfahrt starten“ genutzt wurde.

#### Slide A-11: Zugeordnete Klient:innen & Qualität

- **Lernziele:** Klient:innenzuordnung, Qualitätsmanagement
- **Klickpfad:** `/assist/zugeordnete-klienten`, `/assist/qualitaet`
- **Sprecher-Notizen:** Nur zugeordnete Klient:innen erscheinen in der Feld-Ansicht des Mitarbeitenden.

#### Slide A-12: Assist-Einstellungen

- **Lernziele:** Modul-Konfiguration
- **Klickpfad:** `/assist/einstellungen`
- **Sprecher-Notizen:** Einstellungen betreffen u. a. Kataloge, Geofence-Hinweise und Portal-Sichtbarkeit.

---

## 4. Modul Mitarbeiterportal

### 4.1 Überblick

Das **Mitarbeiterportal** ist **mobile-first** (Smartphone optimiert): Sticky Header, fixe Bottom-Navigation mit **5 Tabs**, Safe-Area-Unterstützung.

| Tab | Label | Route |
|-----|-------|-------|
| 1 | **Übersicht** | `/portal/employee` |
| 2 | **Einsätze** | `/portal/employee/assignments` |
| 3 | **Dienstplan** | `/portal/employee/schedule` |
| 4 | **Nachrichten** | `/portal/employee/messages` |
| 5 | **Profil** | `/portal/employee/profile` |

**Login:** Startseite → **Anmeldung Mitarbeiter:in Portal** → `/auth/employee-login`

### 4.2 Login-Flow (Schritt für Schritt)

1. **Startseite** (`/`) → Karte **Anmeldung Mitarbeiter:in Portal**
2. **Login-Screen:** Benutzername + Passwort (Erstlogin: **Einmalpasswort** von Verwaltung)
3. **Erstlogin** (falls `mustChangePassword`): Redirect → `/auth/employee-first-login`
   - Neues Passwort + Bestätigung
   - Datenschutz / Nutzungsbedingungen bestätigen
   - Hinweis: „Nach Abschluss wird das Einmalpasswort ungültig.“
4. **Willkommens-Popup:** Modal „Willkommen“ mit Begrüßung (tageszeitabhängig), Name, Mandant, Rolle → **Weiter zur Übersicht**
5. **Dashboard** `/portal/employee`

### 4.3 Slide-by-Slide Outline — Mitarbeiterportal

#### Slide M-01: Titel „Mitarbeiterportal — Ihr Arbeitsplatz unterwegs“

- **Lernziele:** Mobile-first Konzept, 5 Tabs
- **Gerät:** Smartphone (390 px Breite empfohlen für Screenshots)
- **Sprecher-Notizen:** Das Portal ist bewusst einfach gehalten — keine Verwaltungsfunktionen, nur das was im Einsatz gebraucht wird.

#### Slide M-02: Login Mitarbeiterportal

- **Klickpfad:** `/auth/employee-login`
- **UI:** Logo, „Mitarbeiterportal“, Felder Benutzername + Passwort, **Einloggen**
- **Sprecher-Notizen:** Keine Selbstregistrierung. Zugangsdaten kommen aus Office → Personalakte → Portal.

#### Slide M-03: Erstlogin — Passwort setzen

- **Klickpfad:** `/auth/employee-first-login`
- **UI:** „Bitte vergeben Sie ein eigenes Passwort.“, Einmalpasswort, Neues Passwort, Bestätigen, Datenschutz-Button
- **Sprecher-Notizen:** Neues Passwort darf nicht identisch mit Einmalpasswort sein. Nach Speichern → Weiterleitung zum Dashboard + Willkommens-Popup.

#### Slide M-04: Willkommens-Popup

- **UI:** Avatar, CareSuite-Wordmark, „Guten Morgen/Tag/Abend, [Name]“, Mandantenname, Rolle, Button **Weiter zur Übersicht**
- **Sprecher-Notizen:** Erscheint nach jedem frischen Login (bis geschlossen). X oder Button schließt das Modal.

#### Slide M-05: Dashboard — Übersicht

- **Klickpfad:** `/portal/employee`
- **Sichtbar:**
  - Personalisierte Begrüßung + Avatar
  - **Arbeitsstatus:** „Im Einsatz“ / „Einsätze heute“ / „Keine Einsätze heute“
  - **Stunden heute** (KPI)
  - **Nächster Einsatz** (Karte mit Status-Badge, Adresse, Zeiten)
  - **Tagesübersicht:** Einsätze, Std., offene Docs, Nachrichten
  - **Quick Actions:** Einsätze, Dienstplan, Nachrichten, Profil
  - **Benachrichtigungen** (Widget)
- **Sprecher-Notizen:** Die Übersicht ist der Startpunkt jeden Arbeitstags — hier sehen Mitarbeitende sofort den nächsten Termin.

#### Slide M-06: Tab Einsätze

- **Klickpfad:** `/portal/employee/assignments`
- **Sichtbar:** Liste heutiger/kommender Einsätze, Filter, Leerzustand „Keine Einsätze geplant“
- **Detail:** `/portal/employee/assignments/[id]`
- **Sprecher-Notizen:** Tippen öffnet Einsatz-Detail mit Buttons Navigation, Starten, Öffnen.

#### Slide M-07: Tab Dienstplan

- **Klickpfad:** `/portal/employee/schedule`
- **Sichtbar:** Wochenplan, Einsätze nach Tag
- **Sprecher-Notizen:** Langfristige Planung — ergänzt die Tagesliste unter Einsätze.

#### Slide M-08: Tab Nachrichten

- **Klickpfad:** `/portal/employee/messages`, Thread `/portal/employee/messages/[threadId]`
- **Sprecher-Notizen:** Nachrichten von Verwaltung / Team. Push-Benachrichtigungen über Glocken-Icon in der Kopfzeile.

#### Slide M-09: Tab Profil

- **Klickpfad:** `/portal/employee/profile`
- **Sichtbar:** Profilbild (Upload), Name, Rolle, Zeiterfassung / Stundenübersicht
- **Sprecher-Notizen:** Profilbild erscheint auch in Kopfzeile und Willkommens-Popup.

#### Slide M-10: Einsatz durchführen — Übersicht

- **Klickpfad:** Einsatz-Detail → **Starten** oder `/portal/employee/assignments/[id]/execute`
- **UI-Titel:** „Einsatz durchführen“
- **Sprecher-Notizen:** Nur aus dem Mitarbeiterportal startbar — nicht aus Office/Assist heraus.

#### Slide M-11: GPS-Einwilligung

- **UI:** Banner **Standort-Einwilligung** → bestätigen
- **Sprecher-Notizen:** Ohne Einwilligung keine Anfahrt. Einmalig pro Gerät/Mandant bestätigen. Datenschutzhinweis mündlich erklären: Standort nur während aktiver Anfahrt/Einsatz.

#### Slide M-12: Anfahrt starten (Unterwegs)

- **Aktion:** **Anfahrt starten** → Status **Unterwegs**
- **System:** Standortberechtigung anfragen, GPS erfassen, Timer starten
- **Erfolgsmeldung:** „Anfahrt gestartet — Assist wird informiert.“
- **Sprecher-Notizen:** Disponent:in sieht Update unter Assist → Live-Status.

#### Slide M-13: Angekommen & Einsatz starten

- **Aktionen:** **Angekommen** → Status **Angekommen** → **Einsatz starten** → **Gestartet**
- **Geofence:** Weicher Check — bei Abweichung optional Begründung (z. B. „Parkplatz nebenan“)
- **Sprecher-Notizen:** Geofence blockiert nicht hart, dokumentiert aber Abweichungen.

#### Slide M-14: Einsatz beenden & abschließen

- **Aktionen:** **Beendet** → **Dokumentation offen** → Abschluss **Abgeschlossen**
- **UI:** Live-Timer-Panel, Karte/Route-Button
- **Sprecher-Notizen:** Nach Beendigung ggf. Dokumentation in Assist/Nachweise vervollständigen.

#### Slide M-15: Abmelden & Hilfe

- **Klickpfad:** Kopfzeile → Menü/Drawer (Mobil) → Abmelden; `/portal/employee/help`
- **Sprecher-Notizen:** Abmelden auf dem Phone über Drawer — nicht in der Bottom-Nav.

---

## 5. Modul Klient:innenportal

### 5.1 Überblick

Das **Klient:innenportal** richtet sich an Klient:innen (seniorengerecht, große Touch-Targets). Login mit **Benutzername + 6-stelliger Portal-Code** — kein klassisches Passwort.

| Tab | Label | Route |
|-----|-------|-------|
| 1 | **Übersicht** | `/portal/client` |
| 2 | **Einsätze** (Termine) | `/portal/client/appointments` |
| 3 | **Dokumente** | `/portal/client/documents` |
| 4 | **Nachrichten** | `/portal/client/messages` |
| 5 | **Profil** | `/portal/client/profile` |

**Login:** Startseite → **Anmeldung Klient:innen Portal** → `/auth/portal-code-login`

### 5.2 Slide-by-Slide Outline — Klient:innenportal

#### Slide K-01: Titel „Klient:innenportal — Einfach & übersichtlich“

- **Lernziele:** Zielgruppe, einfache Bedienung
- **Sprecher-Notizen:** Weniger Funktionen als Verwaltung — Fokus auf Termine, Dokumente, Nachrichten. Große Schrift, wenig Ablenkung.

#### Slide K-02: Zugang einrichten (Office-Seite)

- **Klickpfad:** Klient:innenakte → **Portal & Freigaben** → **Portal einrichten**
- **Ausgabe:** Benutzername + Portal-Code (6 Zeichen)
- **Sprecher-Notizen:** Code sicher übergeben — Zettel, kein unverschlüsseltes E-Mail wenn vermeidbar.

#### Slide K-03: Login Klient:innenportal

- **Klickpfad:** `/auth/portal-code-login`
- **UI:** „Anmeldung Klient:innen Portal“, Benutzername, **Portal-Code (6-stellig)**, **Einloggen**, **Hilfe anfordern**
- **Sprecher-Notizen:** Benutzername kann E-Mail-Format enthalten. Code ohne verwechselbare Zeichen (kein O/0, I/1).

#### Slide K-04: Willkommens-Popup (Klient:in)

- **UI:** Analog Mitarbeiterportal, Untertitel „Klient:innenportal · CareSuite+“
- **Sprecher-Notizen:** Gemeinsam mit Klient:in schließen — erklären: „Das ist Ihre persönliche Startseite.“

#### Slide K-05: Dashboard / Übersicht

- **Klickpfad:** `/portal/client`
- **Sichtbar (Assist-Modul aktiv):**
  - Begrüßung mit Name
  - **Nächster Besuch / Termin** (Hero-Karte)
  - Quick-Actions: Einsätze, Dokumente, Nachrichten
  - KPI-Karten (große Touch-Flächen)
- **Sprecher-Notizen:** Inhalt hängt von freigeschalteten Modulen ab (Office → Portal & Freigaben → Modulzuordnung).

#### Slide K-06: Tab Einsätze / Termine

- **Klickpfad:** `/portal/client/appointments`, Detail `/portal/client/appointments/[id]`
- **Sichtbar:** Kommende Besuche, Uhrzeit, ggf. Name der Betreuungskraft (je nach Freigabe)
- **Sprecher-Notizen:** „Hier sehen Sie, wann jemand zu Ihnen kommt.“

#### Slide K-07: Tab Dokumente

- **Klickpfad:** `/portal/client/documents`, Detail `/portal/client/documents/[id]`
- **Sichtbar:** Freigegebene Unterlagen (Verträge, Nachweise)
- **Sprecher-Notizen:** Nur Dokumente, die Verwaltung explizit freigegeben hat.

#### Slide K-08: Tab Nachrichten

- **Klickpfad:** `/portal/client/messages`
- **Sprecher-Notizen:** Einfache Chat-Ansicht — ideal für kurze Rückfragen an das Team.

#### Slide K-09: Tab Profil

- **Klickpfad:** `/portal/client/profile`
- **Sichtbar:** Name, Kontaktdaten (read-only), Avatar
- **Sprecher-Notizen:** Änderungen an Stammdaten nur über Verwaltung — nicht im Portal.

#### Slide K-10: Portal-Code zurücksetzen

- **Klickpfad (Office):** Portal & Freigaben → **Portal-Code neu erzeugen**
- **Sprecher-Notizen:** Alter Code wird ungültig. Klient:in braucht neuen Zettel.

---

## 6. Praxis-Szenarien (Rollenspiele)

### Szenario 1: Neue Pflegekraft — Erstlogin & erster Einsatz (15 Min)

**Rollen:** Verwaltung ( gibt Zugang), Pflegekraft (Portal), Beobachter

1. Verwaltung legt in Personalakte → Portal → **Zugang anlegen** an, notiert Benutzername + Einmalpasswort.
2. Pflegekraft: Startseite → Mitarbeiterportal → Login mit OTP.
3. Erstlogin: eigenes Passwort setzen, Datenschutz bestätigen.
4. Willkommens-Popup schließen → Dashboard prüfen.
5. Tab **Einsätze** → Einsatz öffnen → **Anfahrt starten** (GPS-Einwilligung).
6. Status bis **Gestartet** durchklicken.
7. **Diskussion:** Was sieht Disposition unter Assist → Live-Status?

### Szenario 2: Klient:in erhält Portal-Zugang (10 Min)

**Rollen:** Sachbearbeitung, „Klient:in“ (geschulte Person)

1. Office → Klient:innenakte → **Portal & Freigaben** → **Portal einrichten**.
2. Zugangsdaten auf Zettel schreiben (Benutzername + 6-stelliger Code).
3. „Klient:in“ loggt sich ein (Tablet, große Schrift).
4. Gemeinsam Tabs durchgehen: Termine, Dokumente.
5. **Diskussion:** Welche Formulierungen sind seniorengerecht? (Siehe Abschnitt 10)

### Szenario 3: Disponent plant Einsatz (10 Min)

**Rollen:** Disponent:in, Pflegekraft (Beobachter)

1. Assist → **Einsätze** → **Neu** (`?create=1`).
2. Klient:in, Mitarbeitende:r, Leistung, Zeitfenster wählen.
3. Speichern → Kalender prüfen.
4. Pflegekraft aktualisiert Mitarbeiterportal (Pull-to-Refresh / neu öffnen).
5. **Diskussion:** Was passiert bei Vertretung / Stornierung?

### Szenario 4: Passwort vergessen — Mitarbeiter (5 Min)

**Rollen:** Pflegekraft, Verwaltung

1. Pflegekraft: Login schlägt fehl.
2. Verwaltung: Personalakte → Portal → **Passwort zurücksetzen**.
3. Neues Einmalpasswort übergeben → Erstlogin erneut.
4. **Diskussion:** Login-Protokoll unter Zugänge & Benutzer prüfen.

### Szenario 5: GPS funktioniert nicht (5 Min)

**Rollen:** Pflegekraft, IT-Beobachter

1. Einsatz öffnen → Einwilligung fehlt → Banner bestätigen.
2. Standortberechtigung verweigert → Meldung: „Standortberechtigung nicht erteilt — bitte in den Geräteeinstellungen prüfen.“
3. Geräteeinstellungen → Standort für Browser/App erlauben.
4. Erneut **Anfahrt starten**.
5. **Diskussion:** Geofence-Warnung mit Begründung dokumentieren.

---

## 7. FAQ / Troubleshooting

| Problem | Ursache | Lösung | Eskalation |
|---------|---------|--------|------------|
| „Anmeldung fehlgeschlagen“ (Mitarbeiter) | Falsches Passwort / OTP bereits verbraucht | Verwaltung: **Passwort zurücksetzen** in Personalakte → Portal | Admin prüft Login-Protokoll |
| Erstlogin akzeptiert Passwort nicht | Neues Passwort = Einmalpasswort | Anderes Passwort wählen (min. 10 Zeichen, Groß/Klein/Zahl) | — |
| Klient:in kann sich nicht einloggen | Falscher Code / `@` im Benutzernamen abgeschnitten (ältere Version) | Code neu erzeugen; Benutzername exakt abschreiben | Support / aktuelle App-Version prüfen |
| Portal-Code ungültig | Code abgelaufen, gesperrt oder neu erzeugt | Office → **Portal-Code neu erzeugen** | — |
| Weiße/leere Seite nach Login | Browser-Cache, veraltetes Bundle | Hard-Refresh (Strg+F5), anderen Browser testen | Technik-Team |
| Keine Einsätze im Portal | Keine Zuordnung / falscher Tag | Assist: Einsatz anlegen + Mitarbeitende:n zuweisen | Disposition prüfen |
| GPS / Anfahrt starten geht nicht | Keine Einwilligung oder Standort aus | Einwilligungs-Banner bestätigen; Geräte-Standort aktivieren | — |
| Geofence-Warnung | Mitarbeitende:r nicht am Einsatzort | Optional Begründung eingeben; trotzdem **Angekommen** möglich | Teamleitung informieren |
| Keine Dokumente im Klient:innenportal | Nicht freigegeben | Office → Dokument hochladen + für Portal freigeben | — |
| Nachrichten leer | Noch keine Konversation | Verwaltung sendet erste Nachricht über Office | — |

### Support-Kontakte (Platzhalter für Folie)

- **Intern:** Verwaltung / PDL / IT-Administration
- **CareSuite+ Hilfe:** Footer-Link **Hilfe** auf Startseite
- **Login-Protokoll:** `/business/office/access/login-audit`

---

## 8. Screenshot-Katalog

> **Hinweis zur Erstellung:** Browser-MCP war zum Erstellungszeitpunkt nicht verfügbar. Screenshots manuell oder per Playwright-Skript `scripts/audit/contentPortalUiRealityAudit.mjs` erzeugen. Gespeichert werden unter `docs/schulung/screenshots/`.

### Allgemein / Landing / Auth

#### SS-001
- **Dateiname-Vorschlag:** `01-landing-startseite.png`
- **URL/Route:** `https://caresuiteplus.app/`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:**
  - CareSuite+ Logo und Headline
  - 4 Karten: Anmeldung Verwaltung, Anmeldung Mitarbeiter:in Portal, Anmeldung Klient:innen Portal, Kostenlos Registrieren
  - Beschreibungstexte unter jeder Karte
  - Footer: Hilfe, Datenschutz, Impressum, Version
- **Slide-Zuordnung:** Slide 1, O-01, M-01, K-01
- **Alt-Text:** CareSuite+ Startseite mit vier Anmelde-Karten für Verwaltung, Mitarbeiterportal, Klientenportal und Registrierung

#### SS-002
- **Dateiname-Vorschlag:** `01b-landing-startseite-mobile.png`
- **URL/Route:** `https://caresuiteplus.app/`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Wie SS-001, gestapelt, Safe-Area sichtbar
- **Slide-Zuordnung:** Slide 2 (Mobile Überblick)
- **Alt-Text:** CareSuite+ Startseite auf dem Smartphone

#### SS-003
- **Dateiname-Vorschlag:** `02-auth-business-login.png`
- **URL/Route:** `https://caresuiteplus.app/auth/business-login`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Login-Formular Business, Felder, Einloggen-Button
- **Slide-Zuordnung:** O-02
- **Alt-Text:** Business-Anmeldung für Verwaltung

#### SS-004
- **Dateiname-Vorschlag:** `03-auth-employee-login.png`
- **URL/Route:** `https://caresuiteplus.app/auth/employee-login`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Mitarbeiterportal-Login, Hero-Text „Ihr Benutzername und Ihr erstes Passwort werden von Ihrer Verwaltung bereitgestellt.“
- **Slide-Zuordnung:** M-02
- **Alt-Text:** Mitarbeiterportal Anmeldemaske

#### SS-005
- **Dateiname-Vorschlag:** `04-auth-employee-first-login.png`
- **URL/Route:** `https://caresuiteplus.app/auth/employee-first-login`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Passwort-Felder, Datenschutz-Button, „Passwort speichern“
- **Slide-Zuordnung:** M-03
- **Alt-Text:** Erstlogin Bildschirm zum Setzen eines neuen Passworts

#### SS-006
- **Dateiname-Vorschlag:** `05-auth-portal-code-login.png`
- **URL/Route:** `https://caresuiteplus.app/auth/portal-code-login`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Benutzername, Portal-Code (6-stellig), Einloggen, Hilfe anfordern
- **Slide-Zuordnung:** K-03
- **Alt-Text:** Klientenportal Anmeldung mit Portal-Code

#### SS-007
- **Dateiname-Vorschlag:** `06-auth-forgot-password.png`
- **URL/Route:** `https://caresuiteplus.app/auth/forgot-password`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Passwort-vergessen-Formular
- **Slide-Zuordnung:** FAQ-Folie
- **Alt-Text:** Passwort zurücksetzen für Business-Benutzer

### Office

#### SS-010
- **Dateiname-Vorschlag:** `10-office-dashboard.png`
- **URL/Route:** `https://caresuiteplus.app/office`
- **Gerät:** Desktop 1440px
- **Voraussetzung:** Business-Login
- **Was sichtbar sein muss:** Office-Dashboard, Schnellzugriff-Karten, Sidebar
- **Slide-Zuordnung:** O-03
- **Alt-Text:** Office Verwaltungs-Dashboard

#### SS-011
- **Dateiname-Vorschlag:** `11-office-clients-list.png`
- **URL/Route:** `https://caresuiteplus.app/office/clients`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Klientenliste, Suche, Filter, Neu-Button
- **Slide-Zuordnung:** O-04
- **Alt-Text:** Liste aller Klientinnen und Klienten

#### SS-012
- **Dateiname-Vorschlag:** `12-office-client-record-tabs.png`
- **URL/Route:** `https://caresuiteplus.app/business/office/clients/[id]`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Tab-Leiste (Stammdaten, Portal & Freigaben, …), Hero mit Name
- **Slide-Zuordnung:** O-05
- **Alt-Text:** Klientenakte mit Registerkarten

#### SS-013
- **Dateiname-Vorschlag:** `13-office-client-portal-tab.png`
- **URL/Route:** `.../clients/[id]?tab=portal`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Portal-Panel, Status, Button „Portal einrichten“ oder „Portal-Code neu erzeugen“
- **Slide-Zuordnung:** O-07, K-02
- **Alt-Text:** Portal-Freigaben für eine Klientin

#### SS-014
- **Dateiname-Vorschlag:** `14-office-client-new-intake.png`
- **URL/Route:** `https://caresuiteplus.app/business/office/clients/new`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Neuaufnahme-Assistent, erste Schritte
- **Slide-Zuordnung:** O-04
- **Alt-Text:** Neue Klientin anlegen Assistent

#### SS-015
- **Dateiname-Vorschlag:** `15-office-employees-list.png`
- **URL/Route:** `https://caresuiteplus.app/office/employees`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Mitarbeitendenliste
- **Slide-Zuordnung:** O-08
- **Alt-Text:** Liste der Mitarbeitenden

#### SS-016
- **Dateiname-Vorschlag:** `16-office-personnel-file-portal.png`
- **URL/Route:** Mitarbeitende Detail → Tab Portal
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** „Zugang anlegen“ / „Passwort zurücksetzen“, Anleitungstext mit Login-Pfad
- **Slide-Zuordnung:** O-10, O-11
- **Alt-Text:** Mitarbeiterportal-Zugang in der Personalakte

#### SS-017
- **Dateiname-Vorschlag:** `17-office-access-dashboard.png`
- **URL/Route:** `https://caresuiteplus.app/business/office/access`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Zugänge-Übersicht, Kacheln für Portal-Typen
- **Slide-Zuordnung:** O-12
- **Alt-Text:** Zugänge und Benutzer Übersicht

#### SS-018
- **Dateiname-Vorschlag:** `18-office-messages.png`
- **URL/Route:** `https://caresuiteplus.app/office/messages`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Nachrichtenliste, Verfassen-Button
- **Slide-Zuordnung:** O-14
- **Alt-Text:** Interne Nachrichten in Office

#### SS-019
- **Dateiname-Vorschlag:** `19-office-calendar.png`
- **URL/Route:** `https://caresuiteplus.app/office/calendar`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Kalender-Mehransicht
- **Slide-Zuordnung:** O-13
- **Alt-Text:** Office Kalender

#### SS-020
- **Dateiname-Vorschlag:** `20-office-invoices.png`
- **URL/Route:** `https://caresuiteplus.app/office/invoices`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Rechnungsliste
- **Slide-Zuordnung:** O-15
- **Alt-Text:** Abrechnung und Rechnungen

### Assist

#### SS-030
- **Dateiname-Vorschlag:** `30-assist-dashboard.png`
- **URL/Route:** `https://caresuiteplus.app/assist`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Assist-KPIs, Schnellzugriff
- **Slide-Zuordnung:** A-02
- **Alt-Text:** Assist Einsatzplanung Dashboard

#### SS-031
- **Dateiname-Vorschlag:** `31-assist-assignments-list.png`
- **URL/Route:** `https://caresuiteplus.app/assist/assignments`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Einsatzliste, Filter, Neu-Button
- **Slide-Zuordnung:** A-03
- **Alt-Text:** Liste der Assist-Einsätze

#### SS-032
- **Dateiname-Vorschlag:** `32-assist-assignment-create.png`
- **URL/Route:** `https://caresuiteplus.app/assist/assignments?create=1`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Formular Neuer Einsatz (Klient, MA, Zeit)
- **Slide-Zuordnung:** A-04
- **Alt-Text:** Neuen Einsatz anlegen Formular

#### SS-033
- **Dateiname-Vorschlag:** `33-assist-assignment-detail.png`
- **URL/Route:** `https://caresuiteplus.app/assist/assignments/[id]`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Einsatz-Detail, Status-Badge
- **Slide-Zuordnung:** A-05
- **Alt-Text:** Einsatz-Detailansicht mit Status

#### SS-034
- **Dateiname-Vorschlag:** `34-assist-calendar.png`
- **URL/Route:** `https://caresuiteplus.app/assist/calendar`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Kalender mit Einsätzen
- **Slide-Zuordnung:** A-06
- **Alt-Text:** Assist Kalender Wochenansicht

#### SS-035
- **Dateiname-Vorschlag:** `35-assist-durchfuehrung.png`
- **URL/Route:** `https://caresuiteplus.app/assist/durchfuehrung`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Durchführungsliste
- **Slide-Zuordnung:** A-07
- **Alt-Text:** Einsatz-Durchführung Übersicht

#### SS-036
- **Dateiname-Vorschlag:** `36-assist-nachweise.png`
- **URL/Route:** `https://caresuiteplus.app/assist/nachweise`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Nachweisliste
- **Slide-Zuordnung:** A-08
- **Alt-Text:** Leistungsnachweise Liste

#### SS-037
- **Dateiname-Vorschlag:** `37-assist-fahrten.png`
- **URL/Route:** `https://caresuiteplus.app/assist/fahrten`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Fahrtenbuch
- **Slide-Zuordnung:** A-09
- **Alt-Text:** Assist Fahrtenbuch

#### SS-038
- **Dateiname-Vorschlag:** `38-assist-live-status.png`
- **URL/Route:** `https://caresuiteplus.app/assist/live-status`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Karte mit aktiven Einsätzen
- **Slide-Zuordnung:** A-10
- **Alt-Text:** Live-Status Karte aller Einsätze

#### SS-039
- **Dateiname-Vorschlag:** `39-assist-zugeordnete-klienten.png`
- **URL/Route:** `https://caresuiteplus.app/assist/zugeordnete-klienten`
- **Gerät:** Desktop 1440px
- **Was sichtbar sein muss:** Klient:innenzuordnungen
- **Slide-Zuordnung:** A-11
- **Alt-Text:** Zugeordnete Klientinnen und Klienten

### Mitarbeiterportal

#### SS-040
- **Dateiname-Vorschlag:** `40-employee-welcome-modal.png`
- **URL/Route:** Nach Login `/portal/employee`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Willkommens-Modal mit Name, Mandant, „Weiter zur Übersicht“
- **Slide-Zuordnung:** M-04
- **Alt-Text:** Willkommens-Popup im Mitarbeiterportal

#### SS-041
- **Dateiname-Vorschlag:** `41-employee-dashboard.png`
- **URL/Route:** `https://caresuiteplus.app/portal/employee`
- **Gerät:** iPhone 390px
- **Voraussetzung:** Mitarbeiter-Login
- **Was sichtbar sein muss:** Begrüßung, Arbeitsstatus, nächster Einsatz, KPIs, Bottom-Nav 5 Tabs
- **Slide-Zuordnung:** M-05
- **Alt-Text:** Mitarbeiterportal Übersicht Dashboard

#### SS-042
- **Dateiname-Vorschlag:** `42-employee-assignments.png`
- **URL/Route:** `https://caresuiteplus.app/portal/employee/assignments`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Einsatzliste, Bottom-Nav Tab Einsätze aktiv
- **Slide-Zuordnung:** M-06
- **Alt-Text:** Einsatzliste Mitarbeiterportal

#### SS-043
- **Dateiname-Vorschlag:** `43-employee-assignment-detail.png`
- **URL/Route:** `/portal/employee/assignments/[id]`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Einsatz-Karte, Buttons Navigation/Starten/Öffnen
- **Slide-Zuordnung:** M-06, M-10
- **Alt-Text:** Einsatz-Detail im Mitarbeiterportal

#### SS-044
- **Dateiname-Vorschlag:** `44-employee-execution-consent.png`
- **URL/Route:** `/portal/employee/assignments/[id]/execute`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Standort-Einwilligungs-Banner
- **Slide-Zuordnung:** M-11
- **Alt-Text:** GPS Einwilligung vor Einsatzstart

#### SS-045
- **Dateiname-Vorschlag:** `45-employee-execution-unterwegs.png`
- **URL/Route:** Execute-Screen Status Unterwegs
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Status „Unterwegs“, Timer, Button „Angekommen“
- **Slide-Zuordnung:** M-12
- **Alt-Text:** Anfahrt gestartet mit aktivem GPS-Tracking

#### SS-046
- **Dateiname-Vorschlag:** `46-employee-execution-gestartet.png`
- **URL/Route:** Execute-Screen Status Gestartet
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Live-Timer, Status Gestartet
- **Slide-Zuordnung:** M-13, M-14
- **Alt-Text:** Laufender Einsatz im Mitarbeiterportal

#### SS-047
- **Dateiname-Vorschlag:** `47-employee-schedule.png`
- **URL/Route:** `https://caresuiteplus.app/portal/employee/schedule`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Wochen-Dienstplan
- **Slide-Zuordnung:** M-07
- **Alt-Text:** Dienstplan Ansicht

#### SS-048
- **Dateiname-Vorschlag:** `48-employee-messages.png`
- **URL/Route:** `https://caresuiteplus.app/portal/employee/messages`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Nachrichtenliste
- **Slide-Zuordnung:** M-08
- **Alt-Text:** Nachrichten im Mitarbeiterportal

#### SS-049
- **Dateiname-Vorschlag:** `49-employee-profile.png`
- **URL/Route:** `https://caresuiteplus.app/portal/employee/profile`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Profilbild, Name, Stundenübersicht
- **Slide-Zuordnung:** M-09
- **Alt-Text:** Profilseite Mitarbeiterportal

#### SS-050
- **Dateiname-Vorschlag:** `50-employee-bottom-nav.png`
- **URL/Route:** Beliebige Portal-Seite
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Alle 5 Tabs: Übersicht, Einsätze, Dienstplan, Nachrichten, Profil
- **Slide-Zuordnung:** M-01, M-05
- **Alt-Text:** Untere Navigationsleiste Mitarbeiterportal

### Klient:innenportal

#### SS-051
- **Dateiname-Vorschlag:** `51-client-welcome-modal.png`
- **URL/Route:** Nach Login `/portal/client`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Willkommens-Modal Klient:innenportal
- **Slide-Zuordnung:** K-04
- **Alt-Text:** Willkommens-Popup Klientenportal

#### SS-052
- **Dateiname-Vorschlag:** `52-client-dashboard.png`
- **URL/Route:** `https://caresuiteplus.app/portal/client`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Begrüßung, Nächster-Termin-Karte, Quick-Actions
- **Slide-Zuordnung:** K-05
- **Alt-Text:** Klientenportal Startseite

#### SS-053
- **Dateiname-Vorschlag:** `53-client-appointments.png`
- **URL/Route:** `https://caresuiteplus.app/portal/client/appointments`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Terminliste
- **Slide-Zuordnung:** K-06
- **Alt-Text:** Termine und Einsätze Klientenportal

#### SS-054
- **Dateiname-Vorschlag:** `54-client-documents.png`
- **URL/Route:** `https://caresuiteplus.app/portal/client/documents`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Dokumentenliste
- **Slide-Zuordnung:** K-07
- **Alt-Text:** Dokumente im Klientenportal

#### SS-055
- **Dateiname-Vorschlag:** `55-client-messages-profile.png`
- **URL/Route:** `/portal/client/messages` und `/portal/client/profile`
- **Gerät:** iPhone 390px
- **Was sichtbar sein muss:** Nachrichten + Profil (ggf. 2 Screenshots)
- **Slide-Zuordnung:** K-08, K-09
- **Alt-Text:** Nachrichten und Profil Klientenportal

### Manuelle Screenshot-Anleitung

```bash
# Option A: Playwright-Audit (benötigt .env mit Business-Credentials)
node scripts/audit/contentPortalUiRealityAudit.mjs

# Option B: Manuell im Browser
# 1. Öffnen https://caresuiteplus.app/
# 2. DevTools → Device Toolbar → iPhone 12 Pro (390×844) für Portal
# 3. Desktop 1440×900 für Office/Assist
# 4. Speichern unter docs/schulung/screenshots/
```

**Test-Zugänge (Audit):**
- Mitarbeiter: `audit-employee@caresuiteplus.test` / OTP `CareSuiteEmployee2026!` (nach Repair)
- Klient:in: `audit-client@caresuiteplus.test` / Code `123456`

---

## 9. PowerPoint-Gliederung (72 Folien)

| Nr | Slide-Titel | Stichpunkte (max 5) | Sprecher-Notizen | Screenshot |
|----|-------------|---------------------|------------------|------------|
| 1 | CareSuite+ Schulung — Willkommen | Pflege & Assist digital; 4 Module heute; 90 Minuten; Fragen jederzeit | Begrüßung, Vorstellungsrunde nach Modul 1 | SS-001 |
| 2 | Die Startseite — vier Wege hinein | Verwaltung; Mitarbeiterportal; Klientenportal; Registrierung nur für Unternehmen | Jede Rolle hat genau einen Einstieg — Verwechslungen vermeiden | SS-001, SS-002 |
| 3 | Wer nutzt was? | Office = Stammdaten; Assist = Planung; MA-Portal = Feld; Klientenportal = Transparenz | Rollentabelle auf Flipchart ergänzen | — |
| 4 | Lernziele heute | 6 Lernziele aus Abschnitt 1 | Kurz abhaken am Ende der Schulung | — |
| 5 | **Modul Office — Einstieg** | Business-Login; Dashboard; Sidebar | Übergang zu Office-Block (~20 Min) | SS-003 |
| 6 | Business-Anmeldung | Benutzername oder E-Mail; Passwort; kein Self-Service für MA/Klienten | Demo-Login vorbereiten | SS-003 |
| 7 | Office-Dashboard | KPIs; Schnellzugriff; Modulwechsel | Parität Sidebar = Schnellzugriff | SS-010 |
| 8 | Klientinnen & Klienten — Liste | Suche; Filter; Neuaufnahme | Live-Demo: Klient suchen | SS-011 |
| 9 | Klientenakte — Tabs | Stammdaten; Vertrag; Dokumente; Portal | Nicht alle Tabs für alle Rollen | SS-012 |
| 10 | Stammdaten & Adresse | Name; Geburtsdatum; Adresse für GPS | Adresse = Assist + Geofence | — |
| 11 | Portal & Freigaben einrichten | Portal aktivieren; Code; Module | Code sofort notieren! | SS-013 |
| 12 | Mitarbeitendenliste | Team; Qualifikationen; Personalakte | Link zur Personalakte | SS-015 |
| 13 | Personalakte — Überblick | 11 Tabs; Portal-Tab wichtig | HR-Daten vs. operative Daten | — |
| 14 | Mitarbeiterportal-Zugang anlegen | Benutzername-Format; Einmalpasswort; Login-Pfad | Zettel für Rollenspiel vorbereiten | SS-016 |
| 15 | Passwort zurücksetzen | OTP neu; Erstlogin erneut; Sperren | FAQ-Häufigfall | SS-016 |
| 16 | Zugänge & Benutzer | Zentrale Verwaltung; Login-Protokoll | Für Admins und PDL | SS-017 |
| 17 | Termine & Kalender (Office) | Terminverwaltung; Mehransicht | Unterschied zu Assist-Einsätzen | SS-019 |
| 18 | Nachrichten & Broadcast | Intern; an Mitarbeitende; an Klienten | Verknüpfung zu Portal-Tabs | SS-018 |
| 19 | Dokumente & Abrechnung | Zentrale Akte; Rechnungen; Budgets | Rollenrechte beachten | SS-020 |
| 20 | **Modul Assist — Einstieg** | Einsatzplanung; Disposition; Live-Status | Übergang Assist-Block | SS-030 |
| 21 | Assist-Dashboard | KPIs; offene Aufgaben | Tagesüberblick Disposition | SS-030 |
| 22 | Einsätze — Liste | Filter; Status; Detail | Herzstück Assist | SS-031 |
| 23 | Einsatz anlegen | Klient; MA; Leistung; Zeit; Adresse | Demo: ?create=1 | SS-032 |
| 24 | Einsatz-Status-Lebenszyklus | Geplant → Unterwegs → Abgeschlossen; 13 Status | Tafelbild / Diagramm | SS-033 |
| 25 | Assist-Kalender | Woche/Tag; Vertretungen | Mit Office-Kalender vergleichen | SS-034 |
| 26 | Durchführung | Operativer Fortschritt; Detail | Disponent-Sicht | SS-035 |
| 27 | Nachweise | Prüfen; PDF; Freigabe | Rechtliche Bedeutung kurz | SS-036 |
| 28 | Fahrten & Touren | Fahrtenbuch; Routen | GPS-Daten aus Portal | SS-037 |
| 29 | Live-Status | Karte; Echtzeit; Status-Badges | Voraussetzung: MA startet Anfahrt | SS-038 |
| 30 | Zugeordnete Klienten & Qualität | Zuordnung; QM | Nur Zugeordnete im MA-Portal | SS-039 |
| 31 | **Mitarbeiterportal — Einstieg** | Mobile-first; 5 Tabs; kein Office im Feld | Smartphone zeigen | SS-050 |
| 32 | Login Mitarbeiterportal | Benutzername; Passwort/OTP; kein Register | Von Verwaltung erhalten | SS-004 |
| 33 | Erstlogin | Neues Passwort; Datenschutz; OTP ungültig danach | Live oder Screenshots | SS-005 |
| 34 | Willkommens-Popup | Name; Mandant; Rolle; Weiter | Nur einmal pro Login-Session | SS-040 |
| 35 | Dashboard Übersicht | Begrüßung; Arbeitsstatus; nächster Einsatz | Täglicher Startpunkt | SS-041 |
| 36 | KPIs & Quick Actions | Einsätze; Std.; Docs; Nachrichten | Vier Quick-Action-Karten | SS-041 |
| 37 | Tab Einsätze | Liste; Detail; Leerzustand | Pull-to-Refresh | SS-042 |
| 38 | Einsatz-Detail | Navigation; Starten; Status-Badge | Vor Execute | SS-043 |
| 39 | Tab Dienstplan | Wochenplan | Langfristige Sicht | SS-047 |
| 40 | Tab Nachrichten | Threads; Benachrichtigungen | Glocken-Icon Header | SS-048 |
| 41 | Tab Profil | Avatar; Stunden | Upload Profilbild | SS-049 |
| 42 | Einsatz durchführen — Start | Nur im Portal; Execute-Screen | Nicht aus Assist | SS-043 |
| 43 | GPS-Einwilligung | Banner; einmalig; Datenschutz | Mündlich erklären | SS-044 |
| 44 | Anfahrt starten | Unterwegs; Timer; Assist informiert | Live-Status Demo | SS-045 |
| 45 | Angekommen & Geofence | Weicher Check; Begründung optional | Kein Hard-Block | SS-045 |
| 46 | Einsatz starten & beenden | Gestartet → Beendet → Abgeschlossen | Timer-Panel | SS-046 |
| 47 | Abmelden & Hilfe | Drawer (Mobile); Help-Route | Sicherheit: Gerät abmelden | — |
| 48 | **Klientenportal — Einstieg** | Einfach; große Buttons; Portal-Code | Seniorenfreundlich | SS-052 |
| 49 | Zugang einrichten (Office) | Code 6-stellig; einmalig sichtbar | Rollenspiel 2 | SS-013 |
| 50 | Login Klientenportal | Benutzername; Code; Hilfe-Button | Kein Passwort | SS-006 |
| 51 | Willkommen Klient:in | Popup; persönliche Begrüßung | Gemeinsam schließen | SS-051 |
| 52 | Übersicht / Dashboard | Nächster Besuch; Quick-Actions | Modul-abhängig | SS-052 |
| 53 | Termine / Einsätze | Kommende Besuche; Uhrzeit | „Wann kommt jemand?“ | SS-053 |
| 54 | Dokumente | Freigegebene PDFs | Verwaltung gibt frei | SS-054 |
| 55 | Nachrichten & Profil | Einfacher Chat; Kontakt read-only | — | SS-055 |
| 56 | Code zurücksetzen | Office → neu erzeugen; alter ungültig | Support-Fall | SS-013 |
| 57 | **Praxis — Rollenspiel 1** | Neue Pflegekraft; Erstlogin; Einsatz | 15 Min | — |
| 58 | **Praxis — Rollenspiel 2** | Klient Portal; Zettel; Login | 10 Min | — |
| 59 | **Praxis — Rollenspiel 3** | Disponent; Einsatz anlegen | 10 Min | SS-032 |
| 60 | **FAQ** | Top-5 Fehler; wer hilft | Tabelle Abschnitt 7 | — |
| 61 | Passwort & Code-Probleme | Reset MA; Code neu Klient | Eskalationspfad | — |
| 62 | GPS-Probleme | Einwilligung; Geräteeinstellungen | Rollenspiel 5 | SS-044 |
| 63 | Support & Login-Protokoll | Hilfe-Link; Audit-Log | Admin-Kontakt eintragen | SS-017 |
| 64 | Klienten-Erklärung — Überblick | Einfache Sprache; Zettel; Geduld | Abschnitt 10 | — |
| 65 | Sicherheit & Datenschutz | Tenant-Isolation; kein Klartext; Audit | Kurz, nicht juristisch | — |
| 66 | Status-Übersicht (Diagramm) | 13 Assist-Status | Als Anhang | — |
| 67 | Klickpfad-Spickzettel Office | Top-5 Pfade | Handout | — |
| 68 | Klickpfad-Spickzettel Assist | Top-5 Pfade | Handout | — |
| 69 | Klickpfad-Spickzettel MA-Portal | Top-5 Pfade | Handout | — |
| 70 | Klickpfad-Spickzettel Klientenportal | Top-5 Pfade | Handout | — |
| 71 | Zusammenfassung & Lernziele | 6 Punkte abhaken | Feedback-Runde | — |
| 72 | Danke & nächste Schritte | Übungszugänge; Ansprechpartner; Feedback | Ende | SS-001 |

---

## 10. Klienten-Erklärungs-Script (wortwörtlich)

> **Hinweis für Mitarbeitende:** Langsam sprechen. Tablet oder großes Smartphone vor Klient:in legen. Zettel mit Zugangsdaten bereitlegen. Pausen einplanen.

---

### Teil A — Bevor wir anfangen (am Telefon oder zu Hause)

„Guten Tag, [Name]. Mein Name ist [Ihr Name] von [Unternehmen].  
Wir möchten Ihnen etwas anbieten, damit Sie jederzeit sehen können, wann jemand zu Ihnen kommt und welche Unterlagen für Sie bereitliegen.  
Das geht über unser **Klientenportal** — eine kleine, persönliche Internet-Seite nur für Sie.  
Sie brauchen dafür kein neues Passwort, sondern nur zwei Dinge, die wir Ihnen auf einem Zettel geben: Ihren **Benutzernamen** und einen **6-stelligen Code**.  
Haben Sie ein Tablet oder ein Handy, das Sie gut bedienen können? — Wunderbar, dann schauen wir das gemeinsam an.“

---

### Teil B — Zettel übergeben

„Hier ist Ihr persönlicher Zettel. Oben steht Ihr Benutzername: **[Benutzername vorlesen]**.  
Darunter der Code — das sind **sechs Buchstaben und Zahlen**: **[Code Buchstabe für Buchstabe]**.  
Bitte legen Sie den Zettel an einen sicheren Ort, zum Beispiel in Ihre Unterlagenmappe.  
Geben Sie den Code bitte **nicht am Telefon** an Unbekannte weiter. Wenn Sie unsicher sind, rufen Sie uns an unter **[Telefonnummer]**.“

---

### Teil C — Startseite öffnen

„Wir öffnen jetzt gemeinsam die Internet-Seite **caresuiteplus.app** — das können Sie sich merken: Care-Suite-Plus.  
Hier sehen Sie mehrere Karten. Für Sie ist die richtige Karte: **Anmeldung Klientinnen Portal** — die mit dem Haus-Symbol.  
Tippen Sie bitte darauf.“

---

### Teil D — Einloggen

„Jetzt sehen Sie zwei Felder.  
Oben tragen Sie Ihren **Benutzername** ein — den von Ihrem Zettel.  
Unten den **6-stelligen Code** — auch vom Zettel.  
Wenn beides stimmt, tippen Sie auf **Einloggen**.  
Keine Sorge, wenn es beim ersten Mal nicht klappt — dann lesen wir den Code noch einmal langsam vor.“

---

### Teil E — Willkommens-Fenster

„Schön — es hat geklappt!  
Jetzt erscheint ein Fenster: **Willkommen, [Name]**.  
Das ist Ihre persönliche Begrüßung von uns.  
Tippen Sie unten auf **Weiter zur Übersicht** — oder auf das X oben rechts.“

---

### Teil F — Die Übersicht erklären

„Das ist jetzt **Ihre Startseite**.  
Ganz oben steht, wann der **nächste Besuch** bei Ihnen ist — Datum und Uhrzeit.  
Unten sehen Sie fünf Symbole — das ist Ihre Leiste:

1. **Übersicht** — Ihre Startseite, immer wenn Sie sich einloggen.  
2. **Einsätze** — hier sehen Sie alle kommenden Termine.  
3. **Dokumente** — Unterlagen, die wir für Sie bereitgestellt haben.  
4. **Nachrichten** — wenn Sie uns schreiben möchten oder wir Ihnen etwas mitteilen.  
5. **Profil** — Ihre Kontaktdaten, die bei uns hinterlegt sind.

Sie müssen sich das nicht alles merken — der Zettel mit Ihrem Code reicht zum Einloggen. Wir helfen Ihnen gern wieder.“

---

### Teil G — Termine zeigen

„Tippen Sie bitte auf **Einsätze** — oder **Termine**.  
Hier steht, **wann** jemand kommt und **wie lange** der Besuch ungefähr dauert.  
Wenn sich ein Termin verschiebt, sehen Sie das hier aktualisiert — Sie müssen nicht extra anrufen, es sei denn, Sie möchten etwas besprechen.“

---

### Teil H — Dokumente zeigen

„Unter **Dokumente** finden Sie zum Beispiel Verträge oder Nachweise, die wir für Sie freigegeben haben.  
Tippen Sie auf einen Eintrag, um ihn zu lesen.  
Wenn Sie etwas vermissen, sagen Sie uns Bescheid — wir schauen in der Verwaltung nach.“

---

### Teil I — Nachrichten (optional)

„Unter **Nachrichten** können Sie uns eine kurze Nachricht schicken — zum Beispiel wenn sich Ihr Termin geändert hat oder Sie eine Frage haben.  
Wir antworten so schnell wie möglich in der Regel während unserer Bürozeiten.“

---

### Teil J — Abschluss & Sicherheit

„Zum Schluss: Wenn Sie fertig sind, können Sie das Fenster schließen — Sie sind dann automatisch abgemeldet, oder Sie melden sich über das Menü ab.  
Wenn Sie Ihren Code verloren haben oder er nicht mehr funktioniert, rufen Sie uns an — wir geben Ihnen einen **neuen Code**.  
Haben Sie noch Fragen? — Sehr gut. Wir notieren uns, dass das Portal eingerichtet ist, und melden uns, wenn wir Ihnen etwas Neues bereitstellen.“

---

### Kurzversion (30 Sekunden, für wiederholten Besuch)

„Sie gehen auf **caresuiteplus.app**, wählen **Klientinnen Portal**, geben Benutzername und 6-stelligen Code ein, tippen **Einloggen** — dann sehen Sie Ihre Termine und Dokumente. Bei Problemen rufen Sie uns an: **[Telefonnummer]**.“

---

## Anhang: Technische Referenz (für Trainer)

| Bereich | Wichtige Routen |
|---------|-----------------|
| Start | `/` |
| Auth | `/auth/business-login`, `/auth/employee-login`, `/auth/portal-code-login`, `/auth/employee-first-login` |
| Office | `/office`, `/office/clients`, `/office/employees`, `/business/office/access` |
| Assist | `/assist`, `/assist/assignments`, `/assist/durchfuehrung`, `/assist/live-status` |
| MA-Portal | `/portal/employee`, `/portal/employee/assignments/[id]/execute` |
| Klient-Portal | `/portal/client`, `/portal/client/appointments` |

**Einsatz-Status (Assist / MA-Portal):** Geplant → Bestätigt → Unterwegs → Angekommen → Gestartet → Beendet → Dokumentation offen → Abgeschlossen

---

*Erstellt für interne Schulung CareSuite+. Bei Produktänderungen Routen in `src/lib/navigation/routes.ts` prüfen.*
