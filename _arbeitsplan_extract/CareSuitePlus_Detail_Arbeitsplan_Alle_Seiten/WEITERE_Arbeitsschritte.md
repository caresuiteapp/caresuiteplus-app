# CareSuite+ — sehr detaillierte Arbeitsschritt-Liste je einzelner Seite

Diese Liste ergänzt die vorherige Soll-Liste. Sie beschreibt für jede Seite einzeln: Inhalt, Workflow, Arbeitsschritte, Daten, Dropdowns, Tests und Abnahme.

## Harte Regel

Eine Seite zählt nicht als fertig, wenn sie nur Route, Hero, KPI, Bridge, Placeholder, falsche Liste, falsche Detailansicht oder No-Op-Buttons enthält.



## 001. WEITERE — Nachrichtenübersicht

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



## 002. WEITERE — Chat / Thread

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



## 003. WEITERE — Globale Dokumente

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



## 004. WEITERE — QM Center

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



## 005. WEITERE — InsightCenter

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



## 006. WEITERE — Einstellungen

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



## 007. WEITERE — TI Vorbereitung

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



## 008. WEITERE — Mitarbeiterportal

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



## 009. WEITERE — Klient:innenportal

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



## 010. WEITERE — Angehörigenportal

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
