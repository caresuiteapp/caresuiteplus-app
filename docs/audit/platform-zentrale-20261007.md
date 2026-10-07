# CareSuite – Prüfung der gesamten Plattformverwaltung

Stand: 7. Oktober 2026. Bestandsabfrage: 15:12 Uhr, Europe/Berlin.
Projekt: caresuiteapp/caresuiteplus-app. Produktiver Server: euagyyztvmemuaiumvxm.

## Ergebnis

Die Plattformverwaltung ist vorhanden und mit wesentlichen Unternehmens-, Konto- und Supportfunktionen verbunden. Sie ist noch keine vollständige Betriebszentrale für die gesamte Software und Website. Besonders Live-Nutzung, Registrierungsabbrüche, automatische Fehlerauswertung und die durchgängige Umsetzung allgemeiner Systemeinstellungen fehlten bisher.

Dieser Stand ergänzt die korrekte Statusauswahl und eine echte, nur lesende Bestandsübersicht. Die Serverabfrage dafür ist produktiv eingerichtet. Die neue Weboberfläche liegt im geprüften Veröffentlichungsstand des Pakets; ihre Veröffentlichung ist erst nach erfolgreichem Git-Bash-Lauf bestätigt.

Die weitergehende Erfassung von Besuchen, Registrierungen und Fehlern ist getrennt vorbereitet. Sie ist ausgeschaltet und gehört nicht zum veröffentlichbaren Git-Stand dieses Pakets. Ihre Produktionseinrichtung wurde von der automatischen Freigabeprüfung wegen zusätzlicher sitzungsbezogener Daten abgelehnt. Der Nutzer hat diese Aktion nicht abgelehnt.

CareSuite bleibt kostenlos. Tarife, Abonnements, kostenpflichtige Add-ons und Zahlungsfunktionen für den Softwarezugang werden nicht wieder eingeführt. Eine spätere Premium-Version ist kein gegenwärtiger Buchungsablauf.

## Tatsächlicher Bestand

| Kennzahl | Vorhandener Stand |
| --- | ---: |
| Unternehmensakten insgesamt, einschließlich gelöschter Akten | 3 |
| Aktive Unternehmen | 2 |
| Gesperrte oder blockierte Unternehmen | 0 |
| Deaktivierte Unternehmen | 0 |
| Gelöschte, erhaltene Unternehmensakten | 1 |
| Klienten ohne gelöschte Datensätze | 80 |
| Gelöschte, erhaltene Klientendatensätze | 14 |
| Klientendatensätze insgesamt | 94 |
| Mitarbeitende ohne gelöschte Datensätze | 29 |
| Gelöschte, erhaltene Mitarbeitendendatensätze | 3 |
| Mitarbeitendendatensätze insgesamt | 32 |
| Aktive Verwaltungskonten | 3 |
| Offene Supporttickets / gültige genehmigte Zugriffe | 0 / 0 |
| Ausstehende Willkommensmails / Versand zu prüfen | 0 / 0 |
| Kontovorgänge mit Prüfbedarf | 0 |

| Datenumgebung | Unternehmen einschließlich gelöschter Akten | Klienten ohne gelöschte Datensätze | Mitarbeitende ohne gelöschte Datensätze |
| --- | ---: | ---: | ---: |
| Produktion | 2, davon 1 aktiv und 1 gelöscht | 22 | 8 |
| Interner Test | 1 aktiv | 58 | 21 |

Damit sind 80 Klienten und 29 Mitarbeitende keine reine Kunden- oder Produktivzahl. Die neue Oberfläche zeigt Test- und Produktivbestände getrennt. Diese Zahlen zählen die noch vorhandenen Datensätze. Bereits endgültig entfernte Datensätze und frühere Besuche lassen sich daraus nicht nachträglich bestimmen.

## Vollständigkeits- und Verbindungsprüfung

„Verbunden“ bedeutet hier: Der aktuelle Webablauf verwendet eine vorhandene Serverfunktion und passende Rechte. Ein erfolgreicher produktiver Schreibvorgang wurde nicht für jeden Ablauf mit echten Kundendaten ausgelöst.

| Bereich | Vorhanden und verbunden | Bearbeitbarkeit / offene Punkte |
| --- | --- | --- |
| Plattformanmeldung | Eigener Zugang, Plattformrolle und aktive Berechtigung | Kein allgemeiner Unternehmenszugang zu Plattformdaten; bestehende Zugriffskontrollen bleiben maßgeblich. |
| Abmelden | Schaltflächen in Kopfbereich und Navigation vorhanden | In der aktuellen Plattformoberfläche vorhanden; hier nicht erneut als fehlend behandelt. |
| Rollen und Rechte | Plattformbenutzer, Rollen, Lese- und Schreibrechte serverseitig | Webrechte an den Server angeglichen: „Lesezugriff“ bietet keinen vom Server verweigerten Supportzugang an. Nicht berechtigte Bodymap-Funktionen werden nicht angeboten. |
| Unternehmensübersicht | Suche, Seitennavigation, Unternehmensakten, Datenumgebungen | Statusauswahl korrigiert: Aktiv, Gesperrt, Blockiert, Deaktiviert, Gelöscht. Standardauswahl zeigt bestehende Unternehmen; gelöschte Akten werden ausdrücklich ausgewählt. |
| Unternehmensstatus | Sperren, Freigeben, Deaktivieren, Löschen und Wiederherstellen vorhanden | Schutz durch Begründung, Bestätigung, Änderungsstand und Protokoll. „Löschen“ bewahrt die Akte zur Wiederherstellung; eine endgültige Datenvernichtung ist kein vorhandener Bedienablauf. |
| Unternehmensangaben | Plattformakten bearbeitbar | Nicht alle Angaben werden in die operativen Unternehmensdaten übertragen. Die allgemeine Plattformbearbeitung aktualisiert vorrangig die Plattformakte. Gemeinsame Stammdatenpflege muss weiter vereinheitlicht werden. |
| Verwaltungskonten | Auflistung, letzte Anmeldung, Rollen und Zustände | Deaktivieren, Löschen, Wiederherstellen vorhanden; letztes aktives Geschäftsführungskonto geschützt. |
| Anmelde-E-Mail korrigieren | Kontoaktion über abgesicherte Serverfunktion | Begründung und bestätigte Berechtigung erforderlich. Authentifizierung und Unternehmenszuordnung werden serverseitig geprüft. Keine Änderung medizinischer oder persönlicher Falldaten. |
| Passwort wiederherstellen | Vorhandener Versandablauf für Verwaltungskonten | Kein Auslesen oder Anzeigen bestehender Passwörter. Kein zusätzlicher Testversand an echte Konten durchgeführt. |
| Willkommensmail | Versandbestand, Empfänger, Versandstatus und erneuter Versand vorhanden | Der erneute Versand verwendet die aktuelle Anmelde-E-Mail. Versandfehler und abweichender früherer Empfänger werden angezeigt. Bestehende Versandfunktion und deren Konfiguration werden im Basisstand nicht verändert. |
| Unvollständige Kontoänderungen | Vorgänge und Prüfbedarf werden gespeichert | Ein vollständig bedienbarer Wiederaufnahme- und Klärungsablauf für jeden seltenen Teilfehler fehlt noch. Eine bloße erneute Ausführung darf keine widersprüchlichen Kontodaten verdecken. |
| Supporttickets | Unternehmenseigene Tickets, Nachrichten und Bearbeitung vorhanden | Link aus der Akte öffnet jetzt Support für genau dieses Unternehmen. |
| Genehmigter Detailzugriff | Ticket, Unternehmensgenehmigung, zeitliche Gültigkeit und Umfang werden geprüft | Klienten-, Mitarbeitenden- und Fehlerdetails nur im genehmigten Umfang. Die alte pauschale Support-Sitzung erteilt keinen unbeschränkten Zugriff mehr. |
| Supportbearbeitung | Freigegebene Unternehmensangaben und interne Zuordnungshinweise bearbeitbar | Kein uneingeschränkter Plattformeditor für sämtliche Klienten- und Personalakten. Dafür weiterhin Unternehmensrechte und genehmigter Supportumfang erforderlich. |
| Funktionsbereiche | Funktionskatalog, Beschreibungen und Status bearbeitbar | Grundfunktionen geschützt. Änderungen müssen zur tatsächlich vorhandenen Produktfunktion passen. |
| Funktionen je Unternehmen | Unternehmensfreigaben mit Produktzugriff verbunden | Anwendung liest die Plattformfreigaben beim Laden der Unternehmensfunktionen; ausdrücklich verweigerte Zugriffe werden berücksichtigt. Eine unmittelbare Verteilung jeder Änderung an bereits offene Fenster ist nicht vollständig belegt. |
| Allgemeine Funktionsfreigaben | Verwaltung und Speicherung vorhanden | Kein vollständiger Verbrauch dieser allgemeinen Schalter in allen Produktfunktionen gefunden. Oberfläche kennzeichnet diese Lücke. Keine bestätigte globale Abschaltwirkung behaupten. |
| Systemeinstellungen | Lesen, Begründung, typgerechte Bearbeitung, Schutz vertraulicher Werte | Wartung, Registrierungsfreigabe und Plattformhinweise haben noch keine durchgängige Umsetzung in Website, Anmeldung und Produkt. Gespeicherter Wert ist kein Nachweis einer tatsächlichen Sperre. |
| Änderungsprotokoll | Serverprotokoll, Unternehmensfilter, Zeitraum, Suche und Export | Unterstützte Änderungen werden protokolliert. Kein vollständiges Verlaufsarchiv aller historischen Fachdatensätze. |
| Veröffentlichungen | Versionen und Prüfergebnisse dokumentierbar | Ein Registereintrag veröffentlicht keine Software. Automatische Zuordnung aller Web-, Server- und Android-Versionen zur Plattformübersicht fehlt. |
| Unternehmensregistrierung | Kostenloser Webablauf und Servereinrichtung vorhanden | Bestand enthält bestätigte Unternehmen; bisher kein vollständiges Register laufender oder abgebrochener Formulare. |
| Registrierung gerade live | Bisher nicht erfasst | Schrittverlauf und bestätigte Ergebnisse vorbereitet, ausgeschaltet. Ohne neue Erfassung keine verlässliche Live-Auskunft. |
| Wer hat abgebrochen? | Bisher nicht rekonstruierbar | Entwurf zeigt vor Kontoanlage einen anonymen Versuch. Erst erfolgreicher Serverabschluss ordnet Unternehmen und Verwaltungskonto zu. Inaktivität ist nur ein möglicher Abbruch; der persönliche Grund bleibt unbekannt. |
| Klienten und Mitarbeitende systemweit | Echte neue Bestandsabfrage eingerichtet | Übersicht, Gesamtbestände, gelöschte Datensätze und Datenumgebungen ergänzt. Kein nachträglich erfundener Zähler endgültig entfernter Datensätze. |
| Software gerade genutzt | Bisher keine globale Aktivitätsmessung | Sichtbare Sitzungen mit bestätigter Anmeldung vorbereitet. Android und nicht bestätigte oder blockierte Meldungen werden damit nicht vollständig erfasst. |
| Website gerade besucht | Bisher keine gemeinsame Messung mit der Software | Landingpage ist eigenständiges HTML. Entwurf enthält deshalb eine separate, ebenfalls ausgeschaltete Anbindung für Landingpage und öffentliche Informationsseiten. |
| Zentrale Fehlerübersicht | Alte Fehlertabelle und freigegebene Supportansicht vorhanden | Alte Tabelle derzeit leer; echte Fehler stehen trotzdem in Serverprotokollen. Neue bereinigte Fehlergruppen mit Bearbeitungsstand vorbereitet, ausgeschaltet. |
| Fehlerursachen | Serverprotokolle können untersucht werden | Browsermessungen allein ersetzen keine Serveranalyse. Hintergrundaufträge, direkte Zusatzverbindungen, E-Mail-, Push-, OCR- und sonstige Dienste brauchen eine weitere gemeinsame Anbindung. |
| Websiteinhalte | Öffentliche Seiten, Registrierung, Kontakt, Rechtstexte und Produktinformationen vorhanden | Kein durchgängiger Plattformeditor für Texte, Medien, Intro, Social-Links oder Nachrichten gefunden. Änderungen erfolgen gegenwärtig überwiegend über Quellstand und Veröffentlichung. |
| Serverzustand und Sicherheitsübersicht | Über vorhandene Verwaltungsverbindung prüfbar | Kein vollständiges Plattformcockpit für Dienstgesundheit, Sicherheitsmeldungen, Sicherungen, Speicher, Versand und Hintergrundaufträge vorhanden. |
| Tarife / kostenpflichtige Add-ons | Gegenwärtig bewusst entfernt | Kein fehlendes Merkmal der kostenlosen Software. Alte Bedienwege werden abgefangen; kostenpflichtige Rechte bleiben auch für den Inhaber abgewiesen. |

## Tatsächliche Fehlerbefunde

Eine während dieser Prüfung ausgeführte Abfrage des rollierenden Serverprotokolls zeigte unter anderem:

| Anfragebereich | Meldungen in dieser Abfrage | Bedeutung |
| --- | ---: | --- |
| Einsätze – assist_visits | 214 Antworten mit Status 500 | Anfrage konnte serverseitig nicht abgeschlossen werden. |
| Ambulante Klientendetails – client_ambulatory_details | 53 Antworten mit Status 500 | Serverfehler; weitere Ursachenprüfung erforderlich. |
| Klienteneinstellungen – client_preferences | 122 Antworten mit Status 403 | Berechtigung verweigert; tatsächlicher Benutzerablauf und Rechte müssen zusammen geprüft werden. |
| Mitarbeitendenportal-Konten | 14 Antworten mit Status 403 | Verweigerter Datenzugriff; nicht ohne Rollenprüfung als Fehler korrigieren. |

Im Datenbankprotokoll fanden sich außerdem zahlreiche Zeitüberschreitungen: eine Abfrage zeigte 221 bei Datenzugriffen, 9 bei Echtzeitverbindungen und 1 beim Dateidienst. Berechtigungsverweigerungen waren ebenfalls sichtbar. Die Zahlen stammen aus einzelnen rollierenden Abfragen; sie sind keine Tagesstatistik und keine Anzahl unterschiedlicher betroffener Personen. Nicht alle Datenbankmeldungen sind Anwendungsfehler: Erwartete Ablehnungen und Abfragefehler der Prüfung sind separat zu berücksichtigen.

Diese Ursachen sind durch die Bestandsübersicht oder das Vorbereiten einer Erfassung nicht behoben. Es wurden keine neuen Testeinsätze, Konten oder Klienten in der Produktion angelegt und keine Kundendaten als Test korrigiert. Die priorisierte Untersuchung muss konkrete Anfrage, Rollenprüfung, Abfrageplan und betroffenen Ablauf zusammenführen.

## Verbesserungen im veröffentlichbaren Stand

1. Statusbegriffe eindeutig; keine doppelte Anzeige „Gesperrt“. Gelöschte Unternehmen auswählbar und bestehende Unternehmen klar bezeichnet.
2. Zentrale Bestandsübersicht auf der Startseite und ausführlich im Bereich System. Echte Zahlen, deutsche Beschriftungen, Aktualisierung nur bei sichtbarer Seite, Fehler- und Wiederholungsanzeige.
3. Gesamtbestände und gelöschte Datensätze getrennt; interne Tests werden nicht als reiner Produktivbestand dargestellt.
4. Supportlink auf das gewählte Unternehmen begrenzt. Webrollen entsprechen den tatsächlichen Serverrechten.
5. Startübersicht zählt nur aktive Unternehmen in Einrichtung und tatsächlich gültige Supportfreigaben; keine alten Tarif- oder Zahlungsauswertungen mehr.
6. Unvollständige Anbindung von Funktionsschaltern und Systemeinstellungen sichtbar benannt.
7. Noch nicht erfasste Live-Daten zeigen keine erfundene Null. Nicht eingerichtete Registrierungs- und Fehlerendpunkte werden nicht aufgerufen.

Die neue Bestandsmigration verändert vorhandene Kundendatensätze nicht. Vorher und nachher blieben 3 Unternehmen, 94 Klientendatensätze, 32 Mitarbeitendendatensätze, 3 Verwaltungskonten und 1 Willkommensmail erhalten.

## Getrennt vorbereitete Erfassung – Freigabe ausstehend

Der zusätzliche Quellstand befindet sich ausschließlich im Paketordner FREIGABE_AUSSTEHEND. Das Upload- und Veröffentlichungsskript wendet ihn nicht an, lädt ihn nicht hoch und richtet dafür keine Serverfunktion ein.

| Information | Vorbereiteter Umfang |
| --- | --- |
| Aktive Websiteansichten | Sichtbare Fenster und Tabs einschließlich Firmenregistrierung; keine garantierte Anzahl einzelner Personen. |
| Aktive Softwarekonten | Zusammenfassung anhand serverseitig bestätigter Anmeldung und aktivem Unternehmen. |
| Registrierungsversuche | Schritte, Zeitpunkte, bekannte technische Hinweise, Abschicken, Verlassen, Inaktivität und bestätigtes Ergebnis. |
| Erfolgreiche Registrierung | Bestätigung ausschließlich durch den Registrierungsserver; anschließend Zuordnung zur Unternehmensakte und Geschäftsführung. |
| Fehler | Feste Kategorien, Bereich, Vorgangsart, Antwortstatus, Zeit und Häufigkeit. Bearbeitungsstand mit Begründung; erneutes Auftreten öffnet eine erledigte Gruppe erneut. |
| Kennung | Zufällige Kennung und geheimes Gegenstück nur im Arbeitsspeicher des Fensters; kein Analyse-Cookie, kein neuer lokaler Analysespeicher und kein Gerätefingerabdruck. |
| Verifizierte Identität | Serverseitig geprüfte Anmeldekennung und Unternehmenszuordnung für Software-/Plattformkonten; keine Behauptung durch frei übermittelte Kundenkennung. |
| Schutz gegen Missbrauch | Kurzlebige Anfragezähler, täglich wechselnder serverseitig geschützter IP-Prüfwert; keine Roh-IP in den neuen Erfassungstabellen. |
| Nicht enthalten | Formularinhalte, Passwörter, vollständige aufgerufene Adressen, Personenakteninhalte oder medizinische Daten. |
| Browserwünsche | Do Not Track und Global Privacy Control stoppen diese Erfassung. Vorschau- und Demoseiten erfassen nicht. |

„Live“ berücksichtigt Meldungen der letzten 90 Sekunden. Sichtbare Seiten melden ungefähr alle 30 Sekunden. Die Verwaltungsübersicht fragt etwa alle 15 Sekunden ab. Seitenmeldungen werden nach einem Tag bereinigt, verknüpfte Registrierungsversuche und ihre Schritte nach 14 Tagen, zusammengefasste Fehler nach 30 Tagen. Anfragezähler werden nach einer Stunde bereinigt. Die Bereinigung wird bei weiteren Betriebsmeldungen angestoßen; ohne neue Meldungen können Datensätze bis zur nächsten Bereinigung bestehen bleiben.

Begrenzungen: Android bleibt unverändert und wird nicht nachträglich als erfasst ausgegeben. Blockierte Meldungen und fehlende bestätigte Identitäten werden nicht erfunden. Direkte Sonderverbindungen und Hintergrundprozesse sind keine durchgehend geprüfte Fehlerquelle dieses Entwurfs. Vor Aktivierung sind zusätzlich Serverausführung, vollständige Web-Erstellung, Datenschutztexte und echte breite/schmale Bedienabläufe zu prüfen. Die neue SQL-Erfassung wurde wegen der abgelehnten Freigabe nicht produktiv ausgeführt; ihre Berechtigungs- und Zustandsregeln sind noch nicht mit einer laufenden Datenbank nachgewiesen.

## Prioritäten für eine vollständige Betriebszentrale

| Priorität | Noch zu erledigen | Abschlussnachweis |
| --- | --- | --- |
| 1 | Tatsächliche Einsatz- und Klientendetail-Zeitüberschreitungen aufklären | Betroffener erlaubter Ablauf funktioniert; Ursachenprüfung und relevante Berechtigungsverweigerungen dokumentiert. |
| 1 | Wartung und Registrierungsfreigabe durchgängig anbinden | Website, Anmeldung und Registrierungsserver berücksichtigen die Einstellung tatsächlich; bestehende Sitzungen verhalten sich definiert. |
| 1 | Vorbereitete Live-/Registrierungs-/Fehlererfassung ausdrücklich freigeben und anschließend serverseitig prüfen | Keine Daten ohne Freigabe; nach Aktivierung echtes Ende-zu-Ende-Ergebnis für öffentliche Website und Software. |
| 2 | Allgemeine Funktionsschalter mit ihren konkreten Produktfunktionen verbinden | Jede angebotene Kennung besitzt einen nachgewiesenen Verbraucher; wirksame Änderung im Produkt. |
| 2 | Unternehmensstammdaten und Konto-Teilfehler vereinheitlichen | Änderung bleibt zwischen Anmeldung, Plattformakte, Unternehmensdaten und Versand konsistent. |
| 2 | Server-, Versand-, Push- und Hintergrundfehler in gemeinsame Fehlerbearbeitung führen | Fehlerherkunft, Zeitpunkt, Zustand und verantwortlicher Ablauf nachvollziehbar. |
| 2 | Öffentliche Inhalte und Veröffentlichungsstand zentral verwalten | Websiteänderungen und tatsächliche Versionen sind prüfbar verbunden, mit Vorschau und dokumentierter Veröffentlichung. |
| 3 | Verlauf und Betriebsauswertungen erweitern | Echte Zeiträume, eindeutige Zählweisen, Löschfristen und Trennung von Test-/Produktivdaten; kein erfundener historischer Bestand. |

## Prüfstand und technische Zuordnung

- Gesamte aktuelle Webnavigation, Plattformdienste und vorhandene Serververbindungen untersucht; 93 bereits bestehende Plattform-/Supportfunktionen im Serverkatalog berücksichtigt. Alte Tariffunktionen sind dabei Bestandsquellen, kein freigegebenes Produktmerkmal.
- Neue Bestandsabfrage mit der vorhandenen Inhaberidentität nur lesend ausgeführt: Zahlen und Rückgabeform bestätigt. Ohne Anmeldeidentität und ohne Plattformberechtigung wird sie abgewiesen. Anonymer Zugriff auf den Bestandsendpunkt ist nicht gestattet.
- Neuer öffentlicher Versionsendpunkt liefert nur Bereitschaft: Bestände eingerichtet, zusätzliche Erfassung ausgeschaltet. Kein neues Erfassungsschema vorhanden.
- 30 ausführbare Node-Prüfungen für den Basisstand bestanden: Zugriffszustände, kostenlose Nutzung, Rechte, Seitennavigation und keine Abfrage nicht eingerichteter Endpunkte. Weitere 20 Node-Prüfungen für den getrennten Erfassungsentwurf bestanden: Datenbegrenzung, Freigabeschranke, anonyme Website, bestätigte Ergebnisse, unveränderter Fehlertransport und ausgeschaltete Erfassung.
- 25 geänderte oder neue JavaScript-/TypeScript-Dateien wurden im gemeinsamen Arbeitsstand syntaktisch geparst und übersetzt. Das ist keine vollständige Typprüfung oder produktive Web-Erstellung.
- React-/Browserinteraktionen, ein lokaler Datenbanklauf des Erfassungsentwurfs und tatsächliche breite/schmale Darstellung der neuen Oberfläche bleiben offen: die dafür benötigte vorhandene Projektumgebung steht hier nicht vollständig bereit. Keine zusätzliche Software, Abhängigkeiten oder Testinfrastruktur installiert.
- Sicherheitsprüfung nach der Bestandsmigration: keine zusätzlichen anonym ausführbaren Funktionen mit erhöhten Rechten, keine neue veränderliche Namensauflösung, keine neue ungeschützte Tabelle. Ein zusätzlicher Hinweis zur bewusst authentifiziert ausführbaren Bestandsfunktion; Anmelde- und Plattformprüfung sowie leere Namensauflösung sind vorhanden. Bestehende Hinweise werden dadurch nicht pauschal als gelöst erklärt.
- Bestehende Sicherheitsprüfung meldet weiterhin unter anderem nicht aktivierte Prüfung auf veröffentlichte Passwörter und bestehende Funktionen mit variabler Namensauflösung. Details: [Passwortschutz](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [Namensauflösung](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [bewusst erhöhte Funktionsrechte](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Die bestehende GitHub-Verbindung kann dieses Projekt hier lesen, Schreibaktionen wurden jedoch mit HTTP 403 abgewiesen. Die Vercel-Verbindung gibt ebenfalls keinen ausreichenden Veröffentlichungszugriff. Das Paket verwendet deshalb die bereits funktionierende GitHub-Anmeldung der vorhandenen Git-Bash-Arbeitskopie. Es erzwingt keine Anmeldung, installiert nichts und überschreibt keinen neueren Hauptzweig.

Relevante neue Quelldateien: PlatformOperationsPanel.web.tsx, platformOperationsService.web.ts, consoleWorkspaceModel.web.ts und platformCapabilities.web.ts. Produktive Bestandsmigration: 20261007130954_platform_operations_inventory.sql. Bestehende Zugriffsmigration: 20261007112708_platform_tenant_access_controls.sql.

Serverkennung für diesen Bestandsstand: caresuite-platform-operations-20261007; inventoryReady=true; observationReady=false.
