# Mandantenverwaltung: geprüfter Änderungsstand vom 6. Oktober 2026

Die Überarbeitung betrifft die Plattformverwaltung im Web und auf dem Desktop. Sie ergänzt die fehlenden Verwaltungsabläufe und gleicht die betroffenen Ansichten mit dem aktuellen Datenbankstand ab.

| Bereich | Ergebnis |
| --- | --- |
| Abmelden | Sichtbarer Knopf in der Kopfleiste und Kontonavigation, auch bei eingeklappter Navigation. Fehler bleiben sichtbar; wiederholtes Klicken löst keine zweite Abmeldung aus. |
| Sprache | Deutsche Navigation, Rollen, Tarifnamen, Funktionsbereiche, Vertragszustände und Änderungsbezeichnungen. Technische Angaben im Fehler- und Änderungsprotokoll sind gesondert aufklappbar. |
| Tarife | Auswahl anhand des vorhandenen Katalogs, Monat/Jahr, Preis, Zuweisung, Pause, Fortsetzung, Beendigung und Vertragsverlauf. |
| Zusatzpakete | Katalogauswahl, freigegebener Preis, Monat/Jahr, Zuweisung und Beendigung. Ohne gültigen Preis wird keine Zuweisung angeboten. |
| Anmeldung | Tatsächliche Verwaltungskonten, Benutzername, aktuelle Anmeldeadresse und letzte Anmeldung. Mitarbeitenden- und Klientenprofile sind hier ausgeschlossen. |
| E-Mail-Korrektur | Berechtigung, ausdrückliche Beauftragung, Begründung und eingegebene Zieladresse erforderlich. Anmeldung, Kontodatensatz und übereinstimmender primärer Kontakt werden abgeglichen. Alte ausstehende Willkommensmails werden gestoppt. |
| Passwort | Rücksetzmail an die aktuelle Adresse. Der Link ist an das Verwaltungskonto und die Versandadresse gebunden und nur einmal verwendbar. Alte Adressen können nach einer Korrektur nicht zum Zurücksetzen verwendet werden. |
| Willkommensmail | Empfänger, Versandstand, Zeitpunkt und verständlicher Fehlerhinweis; erneuter Versand an die aktuelle Adresse. Annahme durch den Versanddienst wird von einer tatsächlichen Posteingangszustellung unterschieden. |
| Einsichten | Unternehmenseigene, zeitlich begrenzte Freigaben für Klienten- und Mitarbeitendenkontakte sowie das Fehlerprotokoll. Abgelaufene, widerrufene und geschlossene Vorgänge verhindern weitere Abrufe. |
| Support | Tickets werden anhand der eindeutigen Unternehmensnummer gefiltert, bevor eine Seite geladen wird. |
| Kosten/Guthaben | Übersicht aus gespeicherten Tarif- und Paketzuweisungen; nachvollziehbare Gutschriften mit Schutz gegen Doppelbuchung. Die Kostenübersicht ersetzt keine Rechnung. |

## Abgleich mit dem tatsächlichen Systemstand

Die produktive Datenbank wurde ausschließlich gelesen. Die bisherigen Vertragsansichten verwendeten teilweise eine später geplante Vertragsstruktur und Funktionen, die dort nicht bereitgestellt sind. Diese Abläufe verwenden jetzt die vorhandenen Tarifverträge und Zusatzpakete. Tarifpflege wurde für den vorhandenen Katalog ergänzt; die nicht eingesetzte Tarifversionsverwaltung wird nicht mehr angeboten. Bestehende Preise und Vereinbarungen werden durch die Umstellung nicht automatisch verändert.

Der produktive Zusatzpaket- und Rabattkatalog war zum Prüfzeitpunkt leer. Diese Bestände werden nicht durch erfundene Pakete ersetzt. Die Oberfläche erklärt den leeren Bestand; neue Pakete können im vorhandenen Katalogbereich angelegt und anschließend zugewiesen werden. Ob einzelne ältere kostenpflichtige Tarifvereinbarungen weiterhin gelten, lässt sich nur anhand der jeweiligen Vereinbarung entscheiden.

## Nachweise und Grenzen

- 216 relevante Prüfungen erfolgreich: Plattformverwaltung, Anmelde- und Versandabläufe, PostgreSQL-Berechtigungen, Unternehmenszuordnung, Freigaben, Wiederholschutz und Bedienung. Die Datenbankprüfungen verwenden die tatsächlich eingesetzte Tarifstruktur.
- Web-Export und vorhandene Prüfungen für Web-Navigation, Kalender-Erkennung und Sprachdateien erfolgreich. Die öffentlichen Seiten werden mit dem vorhandenen Projektablauf erzeugt.
- Die gesamte Typprüfung enthält 32 bestehende Fehler in unveränderten Dateien. In den geänderten Dateien wurden keine Typfehler gefunden. Die Prüfung erlaubt die für Edge-Funktionen erforderlichen `.ts`-Importe.
- Die optische Prüfung in breiter und schmaler Darstellung bleibt offen: Der verfügbare Cloud-Browser blockiert die lokale Vorschau mit `ERR_BLOCKED_BY_CLIENT`. DOM-Bedienprüfungen ersetzen keinen Layoutnachweis.
- Es wurden keine produktiven Konten, Tarifzuweisungen oder Datenfreigaben verändert und keine Testmails an echte Empfänger versendet. Zustellung, realer Kontowechsel und Freigabe durch ein echtes Unternehmen sind deshalb noch nicht durchgängig nachgewiesen.
- Unklare externe Kontoänderungen oder Versandabschlüsse werden als prüfpflichtig gesperrt. Die Klärung solcher Vorgänge benötigt eine berechtigte technische Prüfung; ein weiterer Versand erfolgt nicht automatisch.
- Das freigegebene Fehlerprotokoll enthält Zeitpunkt, Bereich, Schweregrad, Bearbeitungsstand und aufklappbare technische Zuordnung. Ungefilterte Fehlermeldungen, interne Aufrufketten und Geheimnisse werden nicht an die Oberfläche übermittelt.

## Bereitstellung nach Freigabe

1. Den aktuellen Stand der bereits eingesetzten Willkommens- und Wiederherstellungsfunktionen abgleichen. Die vorhandenen Registrierungsmigrationen sind Voraussetzung; bereits angewandte Migrationen nicht erneut ausführen.
2. Die neue Migration `20261006122235_platform_tenant_operations_de.sql` anwenden. Sie ergänzt Kontoverwaltung, Versandversionen, Freigaben, Rücksetzlink-Bindung und Vertrags-/Guthabenfunktionen.
3. `business-password-recovery`, `registration-welcome-dispatch` und die neue Funktion `platform-tenant-account` als zusammengehörigen Stand bereitstellen. Anschließend den Web-Build bereitstellen. Die bestehende Versandplanung wird weiterverwendet.
4. Abmelden, Tarif-/Paketzuweisung, berechtigte E-Mail-Korrektur, Passwortlink, bewussten Neuversand und durch das Unternehmen genehmigte Einsichten anhand dafür freigegebener Konten überprüfen. Breite und schmale Darstellung getrennt prüfen.

Die neue Kontoverwaltung prüft das angemeldete Konto und seine serverseitige Plattformrolle. Verwaltungsidentitäten und privilegierte Schlüssel gelangen nicht in den Browser. Alle Änderungen benötigen eine Begründung und werden protokolliert. Die neue Rücksetzlink-Bindung kann ältere, vor der Umstellung erzeugte Links ungültig machen; in diesem Fall ist eine neue Rücksetzmail erforderlich.

Dieser Änderungsstand wurde noch nicht produktiv veröffentlicht. Der Auftrag umfasst keine Android-Veröffentlichung.
