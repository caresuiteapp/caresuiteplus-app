# Gemeinsame Office-Dokumentation

Office: `/office/dokumentation`. Mitarbeitendenportal: `/portal/employee/dokumentation`.

Die neue Dokumentation ist ein gemeinsamer interner Teamverlauf pro Unternehmen. Freie Einträge benötigen keinen Einsatz. Sie können Klienten, Mitarbeitenden oder der Verwaltung zugeordnet werden. Kategorien, Dringlichkeit, Suche, Quelle und Berliner Kalendermonate werden serverseitig gefiltert. Die Liste lädt jeweils 50 Einträge und bietet eine kompakte Darstellung. Auf schmalen Geräten lassen sich die Filter einklappen.

Die Klientenauswahl in Filter und Editor enthält nur angelegte, nicht gelöschte Klientenakten. Aufnahmen mit Status `lead` (Entwurf) sind ausgeschlossen, auch wenn bereits ein vollständiger Name vorliegt. Die Datenbank prüft diese Bedingung beim Speichern erneut. Vorhandene Dokumentationen bleiben lesbar, wenn sich der Klientenstatus später ändert. Bestehende pausierte, beendete oder archivierte Klientenakten bleiben für Nachträge verfügbar.

Gespeicherte Berichte aus `assist_visit_documentation` werden automatisch eingebunden, sobald der zugehörige Einsatz `execution_status=completed` erreicht hat. Nicht eingereichte, leere oder stornierte Berichte erscheinen nicht. Der Verlauf liest das Original über einen privaten View; es entstehen keine separaten Kopien oder doppelten Importdatensätze. Spätere Änderungen am Original werden beim nächsten Laden angezeigt. Dies ersetzt keine Pflege-Freigabe, Signatur oder Rechnungsprüfung.

Freie Einträge bleiben unverändert gespeichert. Ergänzungen können Titel, Datum und Zuordnung eines geöffneten Eintrags übernehmen. Eine einmal erzeugte Request-ID verhindert beim erneuten Prüfen einer unklaren Speicherbestätigung doppelte Einträge. Der Browser speichert keine Dokumentationsinhalte in Local Storage. Bei einem Konto- oder Unternehmenswechsel wird der Arbeitsbereich neu aufgebaut.

Aktive Office-Zugänge folgen den vorhandenen Unternehmensberechtigungen und Einschränkungen. Ein aktiver, eindeutig zugeordneter Mitarbeitendenportalzugang darf den gemeinsamen Teamverlauf lesen und ergänzen. Klienten- und Angehörigenportale haben keinen Zugriff. Bestehende vertrauliche Personalakten, persönliche Notizen und private Nachrichten werden nicht in diesen Verlauf übernommen. Der Editor weist auf die gemeinsame Sichtbarkeit hin.

Die Tabelle und der View liegen im privaten Schema `care_security`, sind nicht direkt für `authenticated` oder `anon` freigegeben und haben RLS. Die bewusst fehlende direkte Tabellenpolicy bewirkt vollständige Sperrung außerhalb der kontrollierten RPCs. Die öffentlichen RPCs sind Security Invoker; die privaten Implementierungen prüfen Anmeldung, Firma, aktiven Zugang und Zuordnungen erneut. Ältere Staging-Schemas ohne Unternehmenshelfer verwenden eine eng begrenzte Prüfung des aktiven Geschäftsprofils und der vorhandenen Office-Berechtigung.

Prüfung: `npm run verify:office-documentation:release` führt isolierte PostgreSQL-Szenarien sowie Service- und Oberflächentests aus. Die SQL-Szenarien umfassen Berechtigungen, Mandantentrennung, idempotentes Speichern, Monatsgrenzen, Filter, Seitennavigation und die automatische Anzeige abgeschlossener Einsätze. Browserprüfungen verwenden ausschließlich synthetische Beispieldaten. Sie belegen Layout und Bedienung der gemeinsamen Komponente, keinen angemeldeten produktiven Ende-zu-Ende-Ablauf. Die native Darstellung wird aus derselben Webquelle generiert; ein physischer Gerätetest ist ein eigener Nachweis.

## Leseansicht und Anhänge

Ein Klick auf einen Eintrag öffnet eine große modale Leseansicht. Kopf und Aktionen bleiben sichtbar; der vollständige Text und seine Anhänge scrollen in einem eigenen Bereich. Die Schrift lässt sich zwischen 15 und 25 Pixeln einstellen. Der Verlauf besitzt unabhängig davon einen eigenen Scrollbereich. Auf schmalen Ansichten brechen die Bedienelemente ohne horizontales Scrollen um.

Aktive Office-Zugänge können pro Eintrag bis zu zehn Dateien mit jeweils maximal 50 MB ergänzen, auch zu bestehenden Einsatzberichten. Unterstützt sind Fotos, Videos, Audiodateien, PDFs und weitere Dateien zum Herunterladen. Die Aufnahme einer Sprachnotiz startet erst nach einem ausdrücklichen Klick und Mikrofonfreigabe. Web nutzt den vorhandenen Browserrecorder; die native App verwendet Expo Audio.

Ein neuer Text wird zuerst bestätigt, anschließend werden seine Anhänge einzeln hochgeladen und bestätigt. Schlägt ein Anhang fehl, zeigt der Editor ausdrücklich den bereits gespeicherten Text an und wiederholt nur die fehlenden Anhänge. Stabile Dateikennungen und unveränderliche Storage-Objekte verhindern Überschreibungen. Der Server prüft vor der Freigabe das tatsächliche Storage-Objekt einschließlich Eigentümer, Größe und Inhaltstyp. Entfernte, noch unbestätigte Uploads werden verworfen; gespeicherte Originale sind unveränderlich.

Die Dateien liegen im privaten Bucket `office-documentation`. Die private Metadatentabelle hat RLS und keine direkten Clientrechte. Zusätzlich zu gezielten Storage-Regeln verhindern restriktive Regeln den Zugriff über breitere Alt-Policies. Aktive Teamzugänge dürfen bestätigte Anhänge lesen; Uploads sind auf aktive Office-Zugänge beschränkt. Mandantenfremde Zugänge sowie Klienten- und Angehörigenportale bleiben ausgeschlossen. Vorschau- und Downloadlinks gelten zehn Minuten und werden bei Bedarf neu angefordert. HTML und SVG werden nicht als aktive Vorschau eingebettet.

Die Releaseprüfung enthält PostgreSQL-Szenarien mit einer absichtlich breiten Storage-Altpolicy sowie Browser-/Servicefälle zu einem verlorenen Uploadbeleg, wiederholtem Speichern, fremden Dateipfaden und unveränderlichen Originalen. Layout- und Medientests im Browser verwenden ausschließlich synthetische Inhalte. Ein angemeldeter produktiver Upload und die Aufnahme auf einem physischen Androidgerät sind getrennte Nachweise.

### Mitarbeitendenportal und Übernahme der Einsatzmedien

Mitarbeitende können in der Einsatzdokumentation Fotos (bis 15 MB) und Videos (bis 50 MB) auswählen, prüfen und hochladen. PDF-, Sprach- und andere Dateiaktionen wurden dort entfernt; solche Ergänzungen sind der Verwaltung vorbehalten. Stabile Uploadkennungen verhindern bei einer unterbrochenen Rückmeldung doppelte Originale. Eine Wiederholung vergleicht eine bereits vorhandene Datei vollständig mit den erneut angebotenen Bytes.

Die fehlende Tabelle `assist_visit_attachments` wird mit aktiver, einsatzbezogener Portalberechtigung angelegt. Neue Mitarbeitenden-Metadaten müssen zum tatsächlich hochgeladenen Original passen. Restriktive Storage- und Metadatenregeln begrenzen Mandant, Einsatz und Dateityp auch neben breiteren Altregeln. Andere Portal-Dateiuploads außerhalb der Einsatzdokumentation behalten ihre bisherigen Dateitypen.

Mit dem Einsatzabschluss liest die zentrale Dokumentation zusätzlich die Originale aus `office-documents/tenant/<tenant>/assist/visits/<visit>/attachments/`. Es werden keine Mediendateien kopiert. Der direkte Abgleich mit den Storage-Originalen stellt auch Medien ohne bisherige Metadatenzeile dar und erzeugt bei vorhandenen Metadaten keine Dubletten. Eine private Bestandsmarkierung erhält vor der Umstellung hochgeladene zusätzliche Dateitypen, ohne neue Mitarbeitenden-Uploads dafür freizugeben. Fremde Einsätze, Firmen, Signaturen, Leistungsnachweise und private Dokumentenordner werden nicht über diesen Lesepfad geöffnet.

Für diesen Stand erfolgt die Veröffentlichung auf Nutzerwunsch über das Git-Bash-Downloadpaket. Ein automatischer Push oder Webdeploy aus dieser Bearbeitung wird nicht durchgeführt.
