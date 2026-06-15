# CareSuite+ — sehr detaillierte Arbeitsschritt-Liste je einzelner Seite

Diese Liste ergänzt die vorherige Soll-Liste. Sie beschreibt für jede Seite einzeln: Inhalt, Workflow, Arbeitsschritte, Daten, Dropdowns, Tests und Abnahme.

## Harte Regel

Eine Seite zählt nicht als fertig, wenn sie nur Route, Hero, KPI, Bridge, Placeholder, falsche Liste, falsche Detailansicht oder No-Op-Buttons enthält.



## 001. AKADEMIE — Akademie Dashboard

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



## 002. AKADEMIE — Kurse

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



## 003. AKADEMIE — Kurs erstellen

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



## 004. AKADEMIE — Kursdetail

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



## 005. AKADEMIE — Lektionen

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



## 006. AKADEMIE — Teilnehmende

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



## 007. AKADEMIE — Prüfungen

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



## 008. AKADEMIE — Zertifikate

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
