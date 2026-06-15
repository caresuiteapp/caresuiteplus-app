# CareSuite+ — sehr detaillierte Arbeitsschritt-Liste je einzelner Seite

Diese Liste ergänzt die vorherige Soll-Liste. Sie beschreibt für jede Seite einzeln: Inhalt, Workflow, Arbeitsschritte, Daten, Dropdowns, Tests und Abnahme.

## Harte Regel

Eine Seite zählt nicht als fertig, wenn sie nur Route, Hero, KPI, Bridge, Placeholder, falsche Liste, falsche Detailansicht oder No-Op-Buttons enthält.



## 001. STATIONAER — Stationär Dashboard

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



## 002. STATIONAER — Bewohner:innen

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



## 003. STATIONAER — Bewohnerdetail

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



## 004. STATIONAER — Wohnbereiche

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



## 005. STATIONAER — Zimmer

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



## 006. STATIONAER — Belegung

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



## 007. STATIONAER — Tagesstruktur

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



## 008. STATIONAER — Mahlzeiten

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



## 009. STATIONAER — Übergabe

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
