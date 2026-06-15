# CareSuite+ — sehr detaillierte Arbeitsschritt-Liste je einzelner Seite

Diese Liste ergänzt die vorherige Soll-Liste. Sie beschreibt für jede Seite einzeln: Inhalt, Workflow, Arbeitsschritte, Daten, Dropdowns, Tests und Abnahme.

## Harte Regel

Eine Seite zählt nicht als fertig, wenn sie nur Route, Hero, KPI, Bridge, Placeholder, falsche Liste, falsche Detailansicht oder No-Op-Buttons enthält.



## 001. OFFICE — Office Dashboard

**Route:** `/business/office/dashboard`  
**Zweck:** Zentrale Verwaltungsstartseite mit Tagesübersicht, Aufgaben, Rechnungen, Dokumenten, QM, Portalen und Modulstatus.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/dashboard` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 002. OFFICE — Klient:innenliste

**Route:** `/business/office/clients`  
**Zweck:** Alle Klient:innen suchen, filtern, öffnen und neu aufnehmen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 003. OFFICE — Klient:innenaufnahme Wizard

**Route:** `/business/office/clients/new`  
**Zweck:** Kontextbasierte Neuaufnahme mit Leistungsart-Auswahl zuerst.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 004. OFFICE — Klient:innenakte

**Route:** `/business/office/clients/[id]`  
**Zweck:** Zentrale Personenakte als Hauptarbeitswerkzeug.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 005. OFFICE — Klient:in bearbeiten

**Route:** `/business/office/clients/[id]/edit`  
**Zweck:** Stammdaten, Kontakt, Kasse, Leistungsarten, Module bearbeiten.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/[id]/edit` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Bestehende Daten laden.
17. Edit-Formular vorbefüllen.
18. Änderungen speichern.
19. Zur Detailseite zurück.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 006. OFFICE — Klient:innen Dokumente

**Route:** `/business/office/clients/[id]/documents`  
**Zweck:** Dokumentenakte der Person mit Upload, Kategorien, Portal-Freigabe.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/[id]/documents` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 007. OFFICE — Klient:innen Verträge

**Route:** `/business/office/clients/[id]/contracts`  
**Zweck:** Verträge aus Vorlagen erstellen, befüllen, signieren, speichern.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/[id]/contracts` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 008. OFFICE — Einwilligungen

**Route:** `/business/office/clients/[id]/consents`  
**Zweck:** Datenschutz, Schweigepflicht, Portal, Foto, Abrechnungsvollmacht.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/[id]/consents` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 009. OFFICE — Module der Klient:in

**Route:** `/business/office/clients/[id]/modules`  
**Zweck:** Assist/Pflege/Beratung/Stationär/Akademie zuordnen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/[id]/modules` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 010. OFFICE — Timeline

**Route:** `/business/office/clients/[id]/timeline`  
**Zweck:** Alle Aktenereignisse chronologisch anzeigen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/[id]/timeline` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 011. OFFICE — Medikation in Akte

**Route:** `/business/office/clients/[id]/medication`  
**Zweck:** Medikationsplan und Einnahmeschema in der Akte.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/[id]/medication` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 012. OFFICE — Vitalwerte in Akte

**Route:** `/business/office/clients/[id]/vitals`  
**Zweck:** Messungen, Verlauf, Grenzwerte.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/clients/[id]/vitals` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 013. OFFICE — Mitarbeitende

**Route:** `/business/office/employees`  
**Zweck:** Mitarbeitendenliste, Zugänge, Rollen, Module.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/employees` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 014. OFFICE — Mitarbeitende anlegen

**Route:** `/business/office/employees/new`  
**Zweck:** Neue Mitarbeitende inklusive generiertem Zugang.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/employees/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 015. OFFICE — Mitarbeitendenakte

**Route:** `/business/office/employees/[id]`  
**Zweck:** Profil, Qualifikationen, Einsätze, Dokumente, Schulungen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/employees/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 016. OFFICE — Dokumentenzentrale

**Route:** `/business/office/documents`  
**Zweck:** Alle Dokumente zentral verwalten.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/documents` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 017. OFFICE — Dokument hochladen

**Route:** `/business/office/documents/upload`  
**Zweck:** Datei/Fotos/Scan vorbereitet mit Metadaten speichern.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/documents/upload` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 018. OFFICE — Rechnungen

**Route:** `/business/office/invoices`  
**Zweck:** Rechnungen und Abrechnungsstatus zentral.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/invoices` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 019. OFFICE — Rechnung erstellen

**Route:** `/business/office/invoices/new`  
**Zweck:** Rechnung aus Modul-Abrechnungsquellen erzeugen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/invoices/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 020. OFFICE — Rechnung Detail

**Route:** `/business/office/invoices/[id]`  
**Zweck:** Positionen, Zahlung, Mahnung, PDF vorbereitet.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/invoices/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 021. OFFICE — Vorlagenübersicht

**Route:** `/business/office/templates`  
**Zweck:** System- und eigene Vorlagen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/templates` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 022. OFFICE — Vorlage erstellen

**Route:** `/business/office/templates/new`  
**Zweck:** Neue Vorlage mit Platzhaltern, Kategorie und Version.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/templates/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 023. OFFICE — Vorlage Detail

**Route:** `/business/office/templates/[id]`  
**Zweck:** Vorlage bearbeiten, Vorschau, aktivieren, versionieren.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/templates/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 024. OFFICE — QM Übersicht

**Route:** `/business/office/qm`  
**Zweck:** QM-Handbuch, Maßnahmen, Richtlinien, Prüfpakete.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/qm` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 025. OFFICE — QM-Handbuch

**Route:** `/business/office/qm/manual`  
**Zweck:** Kapitelbaum, Inhalte, Versionen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/qm/manual` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 026. OFFICE — QM-Kapitel

**Route:** `/business/office/qm/manual/[id]`  
**Zweck:** Kapitel bearbeiten, Version freigeben, Lesebestätigung.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/qm/manual/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 027. OFFICE — MD-Kontrolle

**Route:** `/business/office/qm/md-check`  
**Zweck:** Unterlagen für MD-/Prüfung zusammenstellen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/qm/md-check` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 028. OFFICE — Module & Zuordnung

**Route:** `/business/office/modules`  
**Zweck:** Zentrale Modulsteuerung.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/modules` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 029. OFFICE — Klient:innen je Modul

**Route:** `/business/office/modules/clients`  
**Zweck:** Klient:innen Modulen zuordnen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/modules/clients` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 030. OFFICE — Mitarbeitende je Modul

**Route:** `/business/office/modules/employees`  
**Zweck:** Rollen und Rechte pro Modul.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/modules/employees` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 031. OFFICE — Abrechnungsquellen

**Route:** `/business/office/modules/billing`  
**Zweck:** Quellen aus Modulen prüfen und an Rechnungen übergeben.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/modules/billing` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 032. OFFICE — Portalverwaltung

**Route:** `/business/office/portals`  
**Zweck:** Zugänge für Mitarbeitende, Klient:innen, Angehörige.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/portals` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 033. OFFICE — Benutzer & Rechte

**Route:** `/business/office/permissions`  
**Zweck:** Rollen, Rechte, Module und Berechtigungen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/permissions` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 034. OFFICE — Office Einstellungen

**Route:** `/business/office/settings`  
**Zweck:** Mandant, Module, Kataloge, Sicherheit.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/settings` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 035. OFFICE — Office Reporting

**Route:** `/business/office/reporting`  
**Zweck:** Kennzahlen, Filter, Drilldowns.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/office/reporting` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- anzeigen
- suchen
- filtern
- sortieren
- öffnen
- erstellen
- bearbeiten
- speichern
- archivieren
- Timeline/Audit schreiben

### Benötigte Daten / Tabellen / Services

- `clients`
- `employees`
- `documents`
- `contracts`
- `consents`
- `invoices`
- `templates`
- `module_assignments`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Status Klient:in
- Leistungsart
- Pflegegrad
- Abrechnungsart
- Dokumentkategorie
- Einwilligungsart
- Vertragsart
- Modulzuordnung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 036. ASSIST — Assist Dashboard

**Route:** `/assist`  
**Zweck:** Heutige Einsätze, offene Nachweise, fehlende Signaturen, Fahrten, Qualität.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 037. ASSIST — Einsätze

**Route:** `/assist/einsaetze`  
**Zweck:** Einsatzliste mit Suche, Filter, Detailpanel.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/einsaetze` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 038. ASSIST — Einsatz anlegen

**Route:** `/assist/einsaetze/new`  
**Zweck:** Einsatz mit Office-Klient:in und Mitarbeitenden planen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/einsaetze/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 039. ASSIST — Einsatzdetail

**Route:** `/assist/einsaetze/[id]`  
**Zweck:** Einsatzdaten, Aufgaben, Hinweise, Durchführungsstart.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/einsaetze/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 040. ASSIST — Einsatz bearbeiten

**Route:** `/assist/einsaetze/[id]/edit`  
**Zweck:** Zeit, Aufgaben, Mitarbeitende und Status ändern.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/einsaetze/[id]/edit` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Bestehende Daten laden.
17. Edit-Formular vorbefüllen.
18. Änderungen speichern.
19. Zur Detailseite zurück.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 041. ASSIST — Einsatz durchführen

**Route:** `/assist/durchfuehrung/[id]`  
**Zweck:** Unterwegs → Angekommen → Start → Aufgaben → Doku → Signatur → Abschluss.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/durchfuehrung/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.
20. Statuskette bauen.
21. Unterwegs/Angekommen/Start/Ende speichern.
22. Aufgaben abhaken.
23. Doku erfassen.
24. Signatur erfassen.
25. Leistungsnachweis erzeugen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 042. ASSIST — Aufgaben

**Route:** `/assist/aufgaben`  
**Zweck:** Aufgaben aus Einsätzen und Standardaufgaben.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/aufgaben` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 043. ASSIST — Leistungsnachweise

**Route:** `/assist/nachweise`  
**Zweck:** Nachweise prüfen, signieren, abrechnungsbereit machen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/nachweise` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 044. ASSIST — Fahrten

**Route:** `/assist/fahrten`  
**Zweck:** Fahrtenbuch mit km, Zweck und Klient:in.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/fahrten` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 045. ASSIST — Touren

**Route:** `/assist/touren`  
**Zweck:** Tourenplanung und Reihenfolge.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/touren` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 046. ASSIST — Kalender

**Route:** `/assist/kalender`  
**Zweck:** Tages- und Wochenkalender.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/kalender` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 047. ASSIST — Live-Status

**Route:** `/assist/live-status`  
**Zweck:** Laufende Einsätze und Status.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/live-status` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 048. ASSIST — Abrechnungsquellen

**Route:** `/assist/abrechnungsquellen`  
**Zweck:** Assist-Leistungen an Office übergeben.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/assist/abrechnungsquellen` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Einsatz öffnen
- Einsatz anlegen
- Einsatz bearbeiten
- Durchführung starten
- Status wechseln
- Aufgabe abhaken
- Dokumentation speichern
- Signatur erfassen
- Nachweis erzeugen
- Abrechnungsquelle an Office übergeben

### Benötigte Daten / Tabellen / Services

- `assist_assignments`
- `assist_executions`
- `assist_task_results`
- `assist_signatures`
- `service_records`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Assist-Leistung
- Aufgabenstatus
- Einsatzstatus
- Abrechnungsstatus
- Bevorzugte Einsatzzeit

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 049. PFLEGE — Pflege Dashboard

**Route:** `/pflege`  
**Zweck:** Pflegepläne, Vitalwerte, Medikation, Wunden, Risiken, SIS, Berichte.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 050. PFLEGE — SIS Liste

**Route:** `/pflege/sis`  
**Zweck:** Strukturierte Informationssammlung als Liste.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/sis` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. 6 SIS-Themenfelder bauen.
17. Ressourcen/Probleme/Wünsche/Gewohnheiten/Beobachtungen/Handlungsbedarf je Themenfeld.
18. Risikomatrix bauen.
19. Maßnahmenableitung bauen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 051. PFLEGE — SIS anlegen

**Route:** `/pflege/sis/new`  
**Zweck:** Echte SIS mit 6 Themenfeldern und Risikomatrix.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/sis/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.
20. 6 SIS-Themenfelder bauen.
21. Ressourcen/Probleme/Wünsche/Gewohnheiten/Beobachtungen/Handlungsbedarf je Themenfeld.
22. Risikomatrix bauen.
23. Maßnahmenableitung bauen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 052. PFLEGE — SIS Detail

**Route:** `/pflege/sis/[id]`  
**Zweck:** SIS anzeigen, Risiken bewerten, Maßnahmen ableiten.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/sis/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.
20. 6 SIS-Themenfelder bauen.
21. Ressourcen/Probleme/Wünsche/Gewohnheiten/Beobachtungen/Handlungsbedarf je Themenfeld.
22. Risikomatrix bauen.
23. Maßnahmenableitung bauen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 053. PFLEGE — Pflegeplanung

**Route:** `/pflege/planung`  
**Zweck:** Pflegepläne und Maßnahmen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/planung` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 054. PFLEGE — Pflegeplanung anlegen

**Route:** `/pflege/planung/new`  
**Zweck:** Plan aus SIS/Risiken/Maßnahmen erstellen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/planung/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 055. PFLEGE — Pflegeplanung Detail

**Route:** `/pflege/planung/[id]`  
**Zweck:** Ziele, Maßnahmen, Evaluation.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/planung/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 056. PFLEGE — Vitalwerte

**Route:** `/pflege/vitalwerte`  
**Zweck:** Messungen und Verlauf.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/vitalwerte` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 057. PFLEGE — Vitalwert erfassen

**Route:** `/pflege/vitalwerte/new`  
**Zweck:** Messart-Dropdown und dynamische Felder.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/vitalwerte/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 058. PFLEGE — Medikation

**Route:** `/pflege/medikation`  
**Zweck:** Medikamentenplan.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/medikation` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 059. PFLEGE — Medikament hinzufügen

**Route:** `/pflege/medikation/new`  
**Zweck:** Einnahmeschema morgens/mittags/abends/nachts.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/medikation/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 060. PFLEGE — Wunddokumentation

**Route:** `/pflege/wunden`  
**Zweck:** Wunden, BodyMap und Verlauf.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/wunden` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 061. PFLEGE — Wunde anlegen

**Route:** `/pflege/wunden/new`  
**Zweck:** Wunde mit BodyMap-Marker und Fachfeldern.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/wunden/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 062. PFLEGE — Wunde Detail

**Route:** `/pflege/wunden/[id]`  
**Zweck:** Wundverlauf, Fotos, Maßnahmen, Kontrolle.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/wunden/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 063. PFLEGE — BodyMap

**Route:** `/pflege/bodymap`  
**Zweck:** Interaktive klinische Körperkarte mit Marker-Speicherung.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/bodymap` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Interaktive klinische BodyMap bauen.
17. Modellwahl männlich/weiblich/neutral.
18. Ansicht Vorderseite/Rückseite/Detail.
19. Marker setzen und speichern.
20. Marker mit Wunde verknüpfen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 064. PFLEGE — Risiken

**Route:** `/pflege/risiken`  
**Zweck:** Risiken, Stufen, Maßnahmen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/risiken` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 065. PFLEGE — Pflegeberichte

**Route:** `/pflege/berichte`  
**Zweck:** Berichte, Übergaben, Beobachtungen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/berichte` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 066. PFLEGE — Pflegebericht erstellen

**Route:** `/pflege/berichte/new`  
**Zweck:** Berichtstyp, Vorlage, Text, Aktenablage.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/berichte/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 067. PFLEGE — Dienstpläne

**Route:** `/pflege/dienstplaene`  
**Zweck:** Schichten und Planung.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/dienstplaene` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 068. PFLEGE — Schicht anlegen

**Route:** `/pflege/dienstplaene/new`  
**Zweck:** Schichttyp, Mitarbeitende, Zeitraum.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/dienstplaene/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 069. PFLEGE — Verordnungen

**Route:** `/pflege/verordnungen`  
**Zweck:** Rezepte, Verordnungen, Arztbriefe.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/pflege/verordnungen` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Klient:in wählen
- Daten erfassen
- Dropdown auswählen
- validieren
- speichern
- bearbeiten
- Verlauf ergänzen
- Timeline/Audit schreiben
- in Akte anzeigen

### Benötigte Daten / Tabellen / Services

- `care_sis_assessments`
- `care_plans`
- `care_reports`
- `client_vital_signs`
- `client_medications`
- `client_wounds`
- `client_body_map_markers`
- `care_shift_plans`

### Benötigte Dropdowns / Kataloge

- SIS Themenfeld
- Risikoart
- Risikostufe
- Vitalwertart
- Medikamenteneinheit
- Einnahmeschema
- Wundart
- Wundlokalisation
- Wundstatus
- BodyMap Modell
- BodyMap Ansicht

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 070. BERATUNG — Beratung Dashboard

**Route:** `/beratung`  
**Zweck:** Offene Fälle, Wiedervorlagen, Protokolle, Maßnahmen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/beratung` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Fall anlegen
- Fall öffnen
- Protokoll erstellen
- Maßnahme setzen
- Wiedervorlage planen
- Dokument verknüpfen
- Abrechnungsquelle an Office

### Benötigte Daten / Tabellen / Services

- `consulting_cases`
- `consulting_protocols`
- `consulting_measures`
- `consulting_followups`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Beratungsart
- Kontaktweg
- Maßnahmenstatus
- Priorität
- Abrechnungsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 071. BERATUNG — Fälle

**Route:** `/beratung/faelle`  
**Zweck:** Beratungsfallliste.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/beratung/faelle` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Fall anlegen
- Fall öffnen
- Protokoll erstellen
- Maßnahme setzen
- Wiedervorlage planen
- Dokument verknüpfen
- Abrechnungsquelle an Office

### Benötigte Daten / Tabellen / Services

- `consulting_cases`
- `consulting_protocols`
- `consulting_measures`
- `consulting_followups`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Beratungsart
- Kontaktweg
- Maßnahmenstatus
- Priorität
- Abrechnungsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 072. BERATUNG — Fall anlegen

**Route:** `/beratung/faelle/new`  
**Zweck:** Neuen Beratungsfall mit Office-Klient:in.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/beratung/faelle/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Fall anlegen
- Fall öffnen
- Protokoll erstellen
- Maßnahme setzen
- Wiedervorlage planen
- Dokument verknüpfen
- Abrechnungsquelle an Office

### Benötigte Daten / Tabellen / Services

- `consulting_cases`
- `consulting_protocols`
- `consulting_measures`
- `consulting_followups`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Beratungsart
- Kontaktweg
- Maßnahmenstatus
- Priorität
- Abrechnungsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 073. BERATUNG — Fallakte

**Route:** `/beratung/faelle/[id]`  
**Zweck:** Protokolle, Maßnahmen, Dokumente.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/beratung/faelle/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- Fall anlegen
- Fall öffnen
- Protokoll erstellen
- Maßnahme setzen
- Wiedervorlage planen
- Dokument verknüpfen
- Abrechnungsquelle an Office

### Benötigte Daten / Tabellen / Services

- `consulting_cases`
- `consulting_protocols`
- `consulting_measures`
- `consulting_followups`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Beratungsart
- Kontaktweg
- Maßnahmenstatus
- Priorität
- Abrechnungsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 074. BERATUNG — Protokolle

**Route:** `/beratung/protokolle`  
**Zweck:** Beratungsprotokolle.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/beratung/protokolle` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Fall anlegen
- Fall öffnen
- Protokoll erstellen
- Maßnahme setzen
- Wiedervorlage planen
- Dokument verknüpfen
- Abrechnungsquelle an Office

### Benötigte Daten / Tabellen / Services

- `consulting_cases`
- `consulting_protocols`
- `consulting_measures`
- `consulting_followups`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Beratungsart
- Kontaktweg
- Maßnahmenstatus
- Priorität
- Abrechnungsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 075. BERATUNG — Protokoll erstellen

**Route:** `/beratung/protokolle/new`  
**Zweck:** Vorlage, Empfehlungen, Maßnahmen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/beratung/protokolle/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Fall anlegen
- Fall öffnen
- Protokoll erstellen
- Maßnahme setzen
- Wiedervorlage planen
- Dokument verknüpfen
- Abrechnungsquelle an Office

### Benötigte Daten / Tabellen / Services

- `consulting_cases`
- `consulting_protocols`
- `consulting_measures`
- `consulting_followups`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Beratungsart
- Kontaktweg
- Maßnahmenstatus
- Priorität
- Abrechnungsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 076. BERATUNG — Maßnahmen

**Route:** `/beratung/massnahmen`  
**Zweck:** Maßnahmen und Status.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/beratung/massnahmen` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Fall anlegen
- Fall öffnen
- Protokoll erstellen
- Maßnahme setzen
- Wiedervorlage planen
- Dokument verknüpfen
- Abrechnungsquelle an Office

### Benötigte Daten / Tabellen / Services

- `consulting_cases`
- `consulting_protocols`
- `consulting_measures`
- `consulting_followups`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Beratungsart
- Kontaktweg
- Maßnahmenstatus
- Priorität
- Abrechnungsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 077. BERATUNG — Wiedervorlagen

**Route:** `/beratung/wiedervorlagen`  
**Zweck:** Fällige Kontakte und Aufgaben.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/beratung/wiedervorlagen` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Fall anlegen
- Fall öffnen
- Protokoll erstellen
- Maßnahme setzen
- Wiedervorlage planen
- Dokument verknüpfen
- Abrechnungsquelle an Office

### Benötigte Daten / Tabellen / Services

- `consulting_cases`
- `consulting_protocols`
- `consulting_measures`
- `consulting_followups`
- `module_billing_sources`

### Benötigte Dropdowns / Kataloge

- Beratungsart
- Kontaktweg
- Maßnahmenstatus
- Priorität
- Abrechnungsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 078. STATIONAER — Stationär Dashboard

**Route:** `/stationaer`  
**Zweck:** Bewohner:innen, Wohnbereiche, Belegung, Übergaben.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/stationaer` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Bewohner öffnen
- Zimmer zuweisen
- Wohnbereich ändern
- Tagesstruktur speichern
- Übergabe schreiben
- Status ändern

### Benötigte Daten / Tabellen / Services

- `resident_profiles`
- `care_units`
- `rooms`
- `occupancy`
- `daily_structure`
- `meal_plans`
- `activities`
- `handover_notes`

### Benötigte Dropdowns / Kataloge

- Wohnbereich
- Zimmerstatus
- Kostform
- Risikoart
- Risikostufe

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 079. STATIONAER — Bewohner:innen

**Route:** `/stationaer/bewohner`  
**Zweck:** Bewohnerliste aus Office-Zuordnung.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/stationaer/bewohner` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Bewohner öffnen
- Zimmer zuweisen
- Wohnbereich ändern
- Tagesstruktur speichern
- Übergabe schreiben
- Status ändern

### Benötigte Daten / Tabellen / Services

- `resident_profiles`
- `care_units`
- `rooms`
- `occupancy`
- `daily_structure`
- `meal_plans`
- `activities`
- `handover_notes`

### Benötigte Dropdowns / Kataloge

- Wohnbereich
- Zimmerstatus
- Kostform
- Risikoart
- Risikostufe

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 080. STATIONAER — Bewohnerdetail

**Route:** `/stationaer/bewohner/[id]`  
**Zweck:** Bewohnerdaten, Zimmer, Tagesstruktur.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/stationaer/bewohner/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- Bewohner öffnen
- Zimmer zuweisen
- Wohnbereich ändern
- Tagesstruktur speichern
- Übergabe schreiben
- Status ändern

### Benötigte Daten / Tabellen / Services

- `resident_profiles`
- `care_units`
- `rooms`
- `occupancy`
- `daily_structure`
- `meal_plans`
- `activities`
- `handover_notes`

### Benötigte Dropdowns / Kataloge

- Wohnbereich
- Zimmerstatus
- Kostform
- Risikoart
- Risikostufe

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 081. STATIONAER — Wohnbereiche

**Route:** `/stationaer/wohnbereiche`  
**Zweck:** Wohnbereiche verwalten.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/stationaer/wohnbereiche` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Bewohner öffnen
- Zimmer zuweisen
- Wohnbereich ändern
- Tagesstruktur speichern
- Übergabe schreiben
- Status ändern

### Benötigte Daten / Tabellen / Services

- `resident_profiles`
- `care_units`
- `rooms`
- `occupancy`
- `daily_structure`
- `meal_plans`
- `activities`
- `handover_notes`

### Benötigte Dropdowns / Kataloge

- Wohnbereich
- Zimmerstatus
- Kostform
- Risikoart
- Risikostufe

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 082. STATIONAER — Zimmer

**Route:** `/stationaer/zimmer`  
**Zweck:** Zimmerstatus und Belegung.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/stationaer/zimmer` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Bewohner öffnen
- Zimmer zuweisen
- Wohnbereich ändern
- Tagesstruktur speichern
- Übergabe schreiben
- Status ändern

### Benötigte Daten / Tabellen / Services

- `resident_profiles`
- `care_units`
- `rooms`
- `occupancy`
- `daily_structure`
- `meal_plans`
- `activities`
- `handover_notes`

### Benötigte Dropdowns / Kataloge

- Wohnbereich
- Zimmerstatus
- Kostform
- Risikoart
- Risikostufe

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 083. STATIONAER — Belegung

**Route:** `/stationaer/belegung`  
**Zweck:** Einzug/Auszug/Reservierung.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/stationaer/belegung` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Bewohner öffnen
- Zimmer zuweisen
- Wohnbereich ändern
- Tagesstruktur speichern
- Übergabe schreiben
- Status ändern

### Benötigte Daten / Tabellen / Services

- `resident_profiles`
- `care_units`
- `rooms`
- `occupancy`
- `daily_structure`
- `meal_plans`
- `activities`
- `handover_notes`

### Benötigte Dropdowns / Kataloge

- Wohnbereich
- Zimmerstatus
- Kostform
- Risikoart
- Risikostufe

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 084. STATIONAER — Tagesstruktur

**Route:** `/stationaer/tagesstruktur`  
**Zweck:** Tagesablauf je Bewohner:in.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/stationaer/tagesstruktur` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Bewohner öffnen
- Zimmer zuweisen
- Wohnbereich ändern
- Tagesstruktur speichern
- Übergabe schreiben
- Status ändern

### Benötigte Daten / Tabellen / Services

- `resident_profiles`
- `care_units`
- `rooms`
- `occupancy`
- `daily_structure`
- `meal_plans`
- `activities`
- `handover_notes`

### Benötigte Dropdowns / Kataloge

- Wohnbereich
- Zimmerstatus
- Kostform
- Risikoart
- Risikostufe

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 085. STATIONAER — Mahlzeiten

**Route:** `/stationaer/mahlzeiten`  
**Zweck:** Kostformen und Mahlzeitenhinweise.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/stationaer/mahlzeiten` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Bewohner öffnen
- Zimmer zuweisen
- Wohnbereich ändern
- Tagesstruktur speichern
- Übergabe schreiben
- Status ändern

### Benötigte Daten / Tabellen / Services

- `resident_profiles`
- `care_units`
- `rooms`
- `occupancy`
- `daily_structure`
- `meal_plans`
- `activities`
- `handover_notes`

### Benötigte Dropdowns / Kataloge

- Wohnbereich
- Zimmerstatus
- Kostform
- Risikoart
- Risikostufe

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 086. STATIONAER — Übergabe

**Route:** `/stationaer/uebergabe`  
**Zweck:** Schicht-/Wohnbereichsübergabe.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/stationaer/uebergabe` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Bewohner öffnen
- Zimmer zuweisen
- Wohnbereich ändern
- Tagesstruktur speichern
- Übergabe schreiben
- Status ändern

### Benötigte Daten / Tabellen / Services

- `resident_profiles`
- `care_units`
- `rooms`
- `occupancy`
- `daily_structure`
- `meal_plans`
- `activities`
- `handover_notes`

### Benötigte Dropdowns / Kataloge

- Wohnbereich
- Zimmerstatus
- Kostform
- Risikoart
- Risikostufe

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 087. AKADEMIE — Akademie Dashboard

**Route:** `/akademie`  
**Zweck:** Kurse, Pflichtschulungen, Fortschritt.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/akademie` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Kurs erstellen
- Lektion hinzufügen
- Teilnehmende zuweisen
- Prüfung erstellen
- Zertifikat erzeugen
- Dokument in Office speichern

### Benötigte Daten / Tabellen / Services

- `academy_courses`
- `academy_lessons`
- `academy_enrollments`
- `academy_exams`
- `academy_certificates`

### Benötigte Dropdowns / Kataloge

- Kursstatus
- Zielgruppe
- Prüfungsstatus
- Zertifikatsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 088. AKADEMIE — Kurse

**Route:** `/akademie/kurse`  
**Zweck:** Kursliste.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/akademie/kurse` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Kurs erstellen
- Lektion hinzufügen
- Teilnehmende zuweisen
- Prüfung erstellen
- Zertifikat erzeugen
- Dokument in Office speichern

### Benötigte Daten / Tabellen / Services

- `academy_courses`
- `academy_lessons`
- `academy_enrollments`
- `academy_exams`
- `academy_certificates`

### Benötigte Dropdowns / Kataloge

- Kursstatus
- Zielgruppe
- Prüfungsstatus
- Zertifikatsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 089. AKADEMIE — Kurs erstellen

**Route:** `/akademie/kurse/new`  
**Zweck:** Kurs mit Lektionen und Zielgruppe.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/akademie/kurse/new` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Formular statt Liste rendern.
17. Pflichtfelder definieren.
18. Validierung bauen.
19. Nach Speichern zur Detailseite navigieren.

### Benötigte Funktionen

- Kurs erstellen
- Lektion hinzufügen
- Teilnehmende zuweisen
- Prüfung erstellen
- Zertifikat erzeugen
- Dokument in Office speichern

### Benötigte Daten / Tabellen / Services

- `academy_courses`
- `academy_lessons`
- `academy_enrollments`
- `academy_exams`
- `academy_certificates`

### Benötigte Dropdowns / Kataloge

- Kursstatus
- Zielgruppe
- Prüfungsstatus
- Zertifikatsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 090. AKADEMIE — Kursdetail

**Route:** `/akademie/kurse/[id]`  
**Zweck:** Lektionen, Teilnehmende, Prüfung.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/akademie/kurse/[id]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.
16. Datensatz anhand ID laden.
17. Detailheader bauen.
18. Tabs/Sections bauen.
19. Bearbeiten-Aktion verbinden.

### Benötigte Funktionen

- Kurs erstellen
- Lektion hinzufügen
- Teilnehmende zuweisen
- Prüfung erstellen
- Zertifikat erzeugen
- Dokument in Office speichern

### Benötigte Daten / Tabellen / Services

- `academy_courses`
- `academy_lessons`
- `academy_enrollments`
- `academy_exams`
- `academy_certificates`

### Benötigte Dropdowns / Kataloge

- Kursstatus
- Zielgruppe
- Prüfungsstatus
- Zertifikatsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 091. AKADEMIE — Lektionen

**Route:** `/akademie/lektionen`  
**Zweck:** Lerninhalte.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/akademie/lektionen` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Kurs erstellen
- Lektion hinzufügen
- Teilnehmende zuweisen
- Prüfung erstellen
- Zertifikat erzeugen
- Dokument in Office speichern

### Benötigte Daten / Tabellen / Services

- `academy_courses`
- `academy_lessons`
- `academy_enrollments`
- `academy_exams`
- `academy_certificates`

### Benötigte Dropdowns / Kataloge

- Kursstatus
- Zielgruppe
- Prüfungsstatus
- Zertifikatsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 092. AKADEMIE — Teilnehmende

**Route:** `/akademie/teilnehmende`  
**Zweck:** Teilnehmende und Fortschritt.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/akademie/teilnehmende` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Kurs erstellen
- Lektion hinzufügen
- Teilnehmende zuweisen
- Prüfung erstellen
- Zertifikat erzeugen
- Dokument in Office speichern

### Benötigte Daten / Tabellen / Services

- `academy_courses`
- `academy_lessons`
- `academy_enrollments`
- `academy_exams`
- `academy_certificates`

### Benötigte Dropdowns / Kataloge

- Kursstatus
- Zielgruppe
- Prüfungsstatus
- Zertifikatsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 093. AKADEMIE — Prüfungen

**Route:** `/akademie/pruefungen`  
**Zweck:** Fragen, Antworten, Ergebnisse.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/akademie/pruefungen` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Kurs erstellen
- Lektion hinzufügen
- Teilnehmende zuweisen
- Prüfung erstellen
- Zertifikat erzeugen
- Dokument in Office speichern

### Benötigte Daten / Tabellen / Services

- `academy_courses`
- `academy_lessons`
- `academy_enrollments`
- `academy_exams`
- `academy_certificates`

### Benötigte Dropdowns / Kataloge

- Kursstatus
- Zielgruppe
- Prüfungsstatus
- Zertifikatsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 094. AKADEMIE — Zertifikate

**Route:** `/akademie/zertifikate`  
**Zweck:** Zertifikate erzeugen und ablegen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/akademie/zertifikate` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- Kurs erstellen
- Lektion hinzufügen
- Teilnehmende zuweisen
- Prüfung erstellen
- Zertifikat erzeugen
- Dokument in Office speichern

### Benötigte Daten / Tabellen / Services

- `academy_courses`
- `academy_lessons`
- `academy_enrollments`
- `academy_exams`
- `academy_certificates`

### Benötigte Dropdowns / Kataloge

- Kursstatus
- Zielgruppe
- Prüfungsstatus
- Zertifikatsstatus

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 095. WEITERE — Nachrichtenübersicht

**Route:** `/business/messages`  
**Zweck:** Threads und Kommunikation.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/messages` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 096. WEITERE — Chat / Thread

**Route:** `/business/messages/[threadId]`  
**Zweck:** Nachrichtenverlauf.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/messages/[threadId]` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 097. WEITERE — Globale Dokumente

**Route:** `/business/documents`  
**Zweck:** Dokumentenzentrale.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/documents` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 098. WEITERE — QM Center

**Route:** `/business/qm`  
**Zweck:** QM-Zentrale.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/qm` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 099. WEITERE — InsightCenter

**Route:** `/business/insight`  
**Zweck:** Kennzahlen und Drilldowns.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/insight` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 100. WEITERE — Einstellungen

**Route:** `/business/settings`  
**Zweck:** Mandant und System.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/settings` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 101. WEITERE — TI Vorbereitung

**Route:** `/business/ti`  
**Zweck:** Externe TI-Anbindungen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/business/ti` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 102. WEITERE — Mitarbeiterportal

**Route:** `/portal/employee`  
**Zweck:** Portal für Mitarbeitende.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/portal/employee` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 103. WEITERE — Klient:innenportal

**Route:** `/portal/client`  
**Zweck:** Portal für Klient:innen.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/portal/client` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.



## 104. WEITERE — Angehörigenportal

**Route:** `/portal/relative`  
**Zweck:** Portal für Angehörige.

### Sichtbarer Inhalt

- CareSuite+ Header mit Titel und fachlichem Untertitel
- Kontextinformationen passend zur Seite
- echte Daten aus Demo-/Live-Service
- Hauptaktion und Nebenaktionen
- Such-/Filterbereich, wenn Liste
- Formular, wenn Anlage/Bearbeitung
- Detailbereiche, wenn Detailseite
- Loading, Empty, Error und Success State
- deutsche Labels und deutsche Formate
- keine „In Vorbereitung“-Kernfunktion
- keine No-Op-Buttons

### Arbeitsschritte

1. Route `/portal/relative` im Projekt suchen und exakte Datei identifizieren.
2. Prüfen, ob eine gleichnamige Datei und ein gleichnamiger Ordner im selben Segment existieren.
3. Prüfen, ob die Seite nicht über Bridge-, Alias- oder generischen Sammel-Screen gerendert wird.
4. Screen-Datei mit eindeutigem Namen anlegen oder bereinigen.
5. CareSuite+ Light Layout einbauen: Header, Content, Aktionen, States.
6. Mobile, Tablet und Desktop Layout prüfen.
7. Berechtigungen und Modulzugriff prüfen.
8. Demo-Service und Live-Service eindeutig trennen.
9. Loading, Empty, Error und Success State bauen.
10. Hauptaktionen mit echten Handlern verbinden.
11. Dropdowns über zentrale Kataloge anbinden.
12. de-DE Formatierung für Datum, Uhrzeit, Währung, Zahlen verwenden.
13. Speichern muss UI sichtbar aktualisieren.
14. Timeline/Audit schreiben, wenn fachlich relevant.
15. Tests und Audit-Regeln ergänzen.

### Benötigte Funktionen

- laden
- suchen
- filtern
- öffnen
- speichern
- archivieren
- Berechtigung prüfen

### Benötigte Daten / Tabellen / Services

- `communication_threads`
- `documents`
- `portal_sessions`
- `qm_manuals`
- `insight_snapshots`
- `audit_events`

### Benötigte Dropdowns / Kataloge

- Kommunikationskanal
- Dokumentstatus
- Portalstatus
- Rolle/Berechtigung

### Workflow

1. Seite öffnen.
2. Berechtigung und Tenant prüfen.
3. Daten laden.
4. Nutzeraktion ausführen.
5. Eingaben validieren.
6. Speichern.
7. UI aktualisieren.
8. Timeline/Audit ergänzen, falls relevant.
9. Bei Fachmodulen: Office-Bezug sicherstellen.
10. Fehler verständlich anzeigen.

### Tests

- Route rendert ohne Crash.
- Hauptinhalt wird angezeigt.
- Hauptaktion funktioniert.
- Dropdowns sind echte Auswahlfelder.
- Speichern verändert Daten sichtbar.
- Empty State funktioniert.
- Error State funktioniert.
- Keine Duplicate-Route.
- Keine Bridge-Route.
- Keine „In Vorbereitung“-Kernfunktion.

### Abnahme

Die Seite gilt erst als fertig, wenn sie in der Vorschau geöffnet, bedient, gespeichert und erneut angezeigt werden kann.
