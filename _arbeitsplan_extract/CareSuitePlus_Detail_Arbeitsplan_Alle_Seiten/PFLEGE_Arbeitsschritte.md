# CareSuite+ — sehr detaillierte Arbeitsschritt-Liste je einzelner Seite

Diese Liste ergänzt die vorherige Soll-Liste. Sie beschreibt für jede Seite einzeln: Inhalt, Workflow, Arbeitsschritte, Daten, Dropdowns, Tests und Abnahme.

## Harte Regel

Eine Seite zählt nicht als fertig, wenn sie nur Route, Hero, KPI, Bridge, Placeholder, falsche Liste, falsche Detailansicht oder No-Op-Buttons enthält.



## 001. PFLEGE — Pflege Dashboard

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



## 002. PFLEGE — SIS Liste

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



## 003. PFLEGE — SIS anlegen

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



## 004. PFLEGE — SIS Detail

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



## 005. PFLEGE — Pflegeplanung

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



## 006. PFLEGE — Pflegeplanung anlegen

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



## 007. PFLEGE — Pflegeplanung Detail

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



## 008. PFLEGE — Vitalwerte

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



## 009. PFLEGE — Vitalwert erfassen

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



## 010. PFLEGE — Medikation

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



## 011. PFLEGE — Medikament hinzufügen

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



## 012. PFLEGE — Wunddokumentation

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



## 013. PFLEGE — Wunde anlegen

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



## 014. PFLEGE — Wunde Detail

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



## 015. PFLEGE — BodyMap

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



## 016. PFLEGE — Risiken

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



## 017. PFLEGE — Pflegeberichte

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



## 018. PFLEGE — Pflegebericht erstellen

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



## 019. PFLEGE — Dienstpläne

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



## 020. PFLEGE — Schicht anlegen

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



## 021. PFLEGE — Verordnungen

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
