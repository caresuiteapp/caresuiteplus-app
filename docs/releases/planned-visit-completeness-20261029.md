# Geplante Aufgaben sind keine fehlenden Einsatzangaben

Die Einsatzvorschau konnte trotz vollständig aufgelöster Klientenadresse „Angaben unvollständig“ anzeigen. Der gemeinsame Ausführungs-Snapshot wertete jede noch offene Pflichtaufgabe als fehlendes Ergebnis, unabhängig davon, ob der Einsatz erst geplant war. Bei der geprüften Konstellation waren elf Aufgaben vor Durchführung offen; die gespeicherten Einsatzdaten enthielten keine Fehlermeldung.

Offene Pflichtaufgaben tragen jetzt erst nach Ende der Durchführung zur Kennzeichnung als unvollständig bei. Die Aufgaben und ihre offene Anzahl bleiben unverändert vorhanden. Abschlussprüfungen, fehlende Dokumentation und fehlende Unterschriften nach Durchführung werden weiterhin berücksichtigt. Die Auflösung der Einsatzadresse aus der Klientenakte bleibt bestehen. Fachdaten, Rechte und Datenbankschema werden nicht verändert.

Der Fix liegt im gemeinsamen Web-/App-Dienst. Ein weiteres Android-Paket wird dafür nicht erzeugt.

## Prüfung

- Vor der Korrektur schlugen neun neue Prüfungen fehl, darunter die echte Web-Vorschau mit elf offenen Aufgaben und einer Adresse aus den Klientenstammdaten.
- Danach bestanden alle 462 Funktionstests in den 44 bestehenden beziehungsweise erweiterten Einsatz-Prüfdateien sowie die 18 isolierten PostgreSQL-Prüfungen des Einsatz-Releasegates.
- Die neuen Fälle prüfen Planung, laufende Durchführung, Absage und Nichterscheinen sowie weiterhin fehlende Pflichtaufgaben nach verifiziertem Abschluss. Optionale Aufgaben lösen keine fehlenden Pflichtangaben aus.
- Der DOM-Test belegt den sichtbaren Adresstext und das entfallene Warnlabel, keine grafische Geräteprüfung. Markup und CSS bleiben unverändert. Lokal ist kein Browser installiert; der vorhandene Cloud-Browser verfügt über keine angemeldete CareSuite-Sitzung.
