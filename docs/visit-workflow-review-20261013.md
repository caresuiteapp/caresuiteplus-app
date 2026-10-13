# Einsatzworkflow: Prüfung und Korrekturen am 13.10.2026

Geprüfter Ausgangsstand: `09a386537d369d1089f36beeaee36a1d571a6c3a`.

## Korrigierte Befunde

- Anfahrt wartet nicht mehr auf einen unbeantworteten Standortdialog. Der kanonische Start läuft über die gemeinsame Schreibsperre und die serverseitige Rückbestätigung; GPS verbindet anschließend. Späte Standortantworten gelten nur für denselben Einsatz und dasselbe Konto.
- Start, Pausenwechsel, Einsatzende und Abschluss warten auf ihre Status-/Zeitabgleiche, bevor eine weitere Aktion freigegeben wird. Diese statusverändernden Aufträge werden nicht mehr als unabhängige Browser-Hintergrundjobs gestartet.
- Fehlgeschlagene Status-/Arbeitszeitübergaben werden gemeldet; das bestätigte Zeitereignis bzw. der bereits gespeicherte Nachweis wird dabei nicht zurückgenommen oder erneut erzeugt.
- Die Leistungsnachweisvorbereitung nach Abschluss wird abgewartet und separat als unbestätigt gemeldet, wenn sie scheitert.
- Alte Verwaltungs-Speicherdienste liefern im Livebetrieb keinen Demo-Erfolg bei ungültiger oder fehlender Einsatzzuordnung.
- Dokumentationsänderungen benötigen eine passende Update-Rückgabe mit Einsatz, Mandant, Inhalt und Status. Null Treffer führen nicht zu einer Erfolgsmeldung oder einem Änderungs-Audit.
- Der Anfahrt-Fahrtenbuchabgleich hat eine begrenzte Wartezeit; ein verspäteter Abgleich wird nicht als fehlgeschlagener kanonischer Anfahrtstart dargestellt.

## Verifikation

16 Node-Prüfungen führen tatsächliche Workflow-Servicefunktionen mit isolierten Netzwerkadaptern aus. Die Dokumentationsprüfungen führen den tatsächlichen Repository-Methodenkörper isoliert aus. Zusätzlich bestehen 13 vorhandene Prüfungen der DOM-Bedienungssperre. Acht geänderte TypeScript-Dateien wurden syntaktisch geparst; das ist kein Typcheck. `git diff --check` besteht.

Nicht ausgeführt: vollständiges Vitest-Paket, Typcheck, angemeldeter Browserablauf, reale Geräte/GPS, echte Rollen-/RLS-Schreibtests, parallele produktive Vorgänge oder Android-Build/Play-Store-Upload. Keine produktiven Geschäftsdaten wurden für Tests verändert.

## Bestätigte offene Serverbefunde

Nur lesende Katalogabfragen in Produktion (`euagyyztvmemuaiumvxm`):

- `web_start_assist_visit_service` ist vorhanden. Die Existenz belegt keine vollständige Rollen- oder Ablaufprüfung.
- `workflow_assignment_record_capability` und `workflow_prepare_assignment_service_record` fehlen. Die abgesicherte Vorbereitung eines abrechenbaren Leistungsnachweises bleibt damit unvollständig. Die Änderung macht diesen Fehler sichtbar, installiert diese Funktionen aber nicht.
- `care_security_pdf_upload_ready` fehlt. Der Repository-PDF-Uploadhandler verweigert ohne diese Sicherheitsprüfung Uploads. Ob exakt dieser Handler produktiv ausgerollt ist, wurde hier nicht bestätigt. Das betrifft den Verwaltungs-PDF-Upload und belegt keine Ursache für jeden Mitarbeitenden-Einsatzfehler.

Die vorhandenen SQL-Entwürfe für diese Verträge sind keine vollständige Serverfreigabe. Vertrauenswürdige PDF-Attestierung und tatsächliche Rollen-/Storage-Abläufe müssen vor einer solchen Freigabe nachgewiesen werden. Die Korrekturen hier rechtfertigen keine Behauptung, dass der Einsatzworkflow insgesamt fehlerfrei oder vollständig betriebsbereit ist.
