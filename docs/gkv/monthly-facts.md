# Fachangaben vor der Monatsbestätigung

Stand: 29.10.2026. Review- und Implementierungsstand; kein produktiver Rollout,
kein authentifizierter Herkunftsnachweis für GKV-Beschäftigtennummern und keine
ITSG-/gematik-Freigabe. Android wurde nicht geändert.

## Erfasste Fassung

Die Webaktion **Fachangaben übernehmen** sendet ausschließlich Nachweis-ID,
Bearbeitungsstand und die vorhandene idempotente Auftragskennung. Sie nimmt
keine Beschäftigtennummer, Leistungszeit, Leistungsziffer, Versicherungsdaten
oder Browserbehauptung zur Herkunft entgegen. Die bisherige interne
`employees.employee_number` wird nicht als GKV-Beschäftigtennummer verwendet.

Der sechste [SQL-Reviewentwurf](sql/monthly-facts-draft.sql) ergänzt private
Zuordnungen für Leistungserbringer/Verantwortliche und einzelne Originalquellen.
Er ist nach den fünf bestehenden Monatsentwürfen anzuwenden, ausschließlich
nach deren gemeinsamer Prüfung. Es wurde keine nummerierte Migration erzeugt,
keine Verbindung provisioniert und keine verbundene Datenbank geändert.

| Inhalt | Herkunft und Bindung |
| --- | --- |
| IK, verantwortliche Beschäftigtennummer | Private, zeitgültige Zuordnung zur beauftragten Person mit getrennten Referenzen |
| Vorname, Nachname, Versichertennummer | Aktuelle Klientenakte des Mandanten; Name muss zum kanonischen Leistungsstand passen |
| Datum und Beginn | Tatsächlicher Start aus dem ursprünglichen `sourceReceipt`, deutsche Ortszeit; Ende muss vor der Übernahme liegen |
| Leistungsziffer, Bezeichnung, Menge oder Minuten | Private Zuordnung zur genauen Quellversion und SHA-256 des PostgreSQL-JSONB-Originalbelegs |
| Beschäftigtennummer | Explizite private Zuordnung zur ursprünglichen Mitarbeiter-ID; dauerhaft je Serie und Quelle gesperrt |

Diese privaten Tabellen besitzen RLS und keine Lese-/Schreibfreigabe für
`anon`, `authenticated` oder `service_role`. Die Hilfsfunktionen besitzen keine
solche Ausführungsfreigabe; feste Suchpfade und bestehende persönliche
Beauftragungsprüfungen bleiben wirksam. Es gibt noch **keinen produktiven
Schreib-/Prüfablauf**, der diese Zuordnungen aus der persönlichen mobilen
Erfassung liefert. Ein späterer solcher Ablauf muss Quelle, Registrierung,
Berufs-/Vertragszuordnung, Gültigkeit und Änderungen unabhängig prüfen.
Deshalb lautet die gespeicherte Herkunft ausdrücklich
`captureProvenance: not-attested`; synthetische Testzuordnungen gelten nicht
als reale Beschäftigtennachweise.

Unterstützt wird zunächst eine Originalquelle je Einsatz mit genau einer
ursprünglichen Pflegekraft, Leistungsarten 01/07/10 und mehreren Einzelpositionen.
Mehrere Quellen mit derselben ursprünglichen Einsatz-ID werden gesperrt;
getrennte Einsätze erscheinen in PDF und XML in zeitlicher Reihenfolge.
Gemeinsame Einsätze mehrerer Personen werden nicht aus Freitext oder gleichen
Uhrzeiten erraten. Minutenpositionen dürfen zusammen die kanonische tatsächliche
Dauer nicht überschreiten; eine eigenständige Vertrags-/Tarifprüfung fehlt.

## Bearbeitung, Original und Bestätigung

Die Übernahme speichert `xmlFacts` im vorhandenen Payload und ändert Revision,
Inhaltshash und Protokoll atomar. Serien-/Fassungssperren, Wiederholungskennung
und Wiederherstellung nach Antwortverlust werden wiederverwendet. Fehlende
Zuordnungen verändern weder Fassung noch Auftragstabelle.

Alle übernommenen Fachfelder erscheinen vor der Bestätigung in der Oberfläche
und im serverseitigen Bildschirm-/Druck-PDF, einschließlich vollständiger
Leistungsziffern und Beschäftigtennummern. Das Archiv bewahrt weiterhin die
angezeigte ursprüngliche PDF-Datei auf.

Vor Erfassung, Belegausgabe und endgültigem Abschluss werden die kanonischen
Quellen und aktuellen Fachzuordnungen nochmals geprüft. Änderungen an
Versichertennummer, Leistungspositionen, Quelle oder Verantwortlichenzuordnung
sperren eine laufende Erfassung. Eine erneute Übernahme erzeugt eine neue
Revision und verlangt eine neue Erfassungskennung. Der Quellenabgleich entfernt
übernommene Fachangaben; sie müssen anschließend erneut aufgelöst werden.

Eine Korrektur kopiert den gespeicherten Inhalt, niemals die Bestätigung.
Die einmal gebundene Beschäftigtennummer einer übernommenen Quelle bleibt
auch nach Quellenabgleich und Korrektur gesperrt. Ein fehlerhafter erster
Nummernbezug erfordert einen künftig gesondert zu prüfenden Berichtigungsablauf;
der normale Bearbeitungsdialog kann ihn nicht überschreiben. Archivansichten
hängen nicht von heute geänderten Stammdaten ab.

## Anschluss an den XML-Prüfer

`generateCapturedMonthlyXml` verarbeitet im privaten Host den entschlüsselten
Archivstand, nachdem die bestehende SQL-/Sitzungs-/Berechtigungsprüfung ihn an
die aktuelle offene Fassung gebunden hat. Der Baustein:

1. Prüft Fassung, Revision, Capture, Akteur, Zeitfolge, Hashes und Dateiversionen.
2. Erzeugt die Originaldarstellung aus dem gespeicherten Snapshot erneut und
   vergleicht ihre tatsächlichen PDF-Bytes über SHA-256. Ungezeigte Fachangaben
   können nicht an eine alte Bestätigung angehängt werden.
3. Prüft die tatsächlich gespeicherten PNG-Bildpunkte bzw. bindet den gesamten
   zuvor geprüften Vertreter-Scan an Seitenmanifest, Prüfperson und Zeitpunkt.
4. Erzeugt XML aus ausschließlich diesen Fachfeldern und der gespeicherten
   Datei. Der bestehende separate Prozess prüft Original-XSD, Feldregeln und
   den vollständigen wieder eingelesenen Inhalt.
5. Wiederholt nach der asynchronen XML-Prüfung die aktuelle Kontextprüfung,
   bevor die private Bestätigungsquittung ausgegeben wird.

Bei übernommenen Fachangaben ist diese Prüfung ein zusätzlicher Schritt vor
der Quittung. Ohne diese Fachangaben bleibt der bisherige Monatsablauf erhalten,
aber es wird kein Fach-XML erzeugt. Papierprofil 3 wird nur für eine geprüfte
Vertretung angeboten und serverseitig erzwungen; eine Patienten-Papierunterschrift
wird nicht als Vertreterunterschrift ausgegeben.

`captureBinding.displayedContentMatches` bestätigt den Vergleich mit dem
angezeigten Original. `upstreamEmployeeCaptureVerified`,
`componentSignatureVerified`, `dispatchReady` und der umfassende
`verification.sourceBindingVerified` bleiben **false**. Das geprüfte XML ist
vorläufig und wird aktuell verworfen: weder dauerhaft archiviert noch über
einen Download, einen öffentlichen Endpunkt oder den Versand freigegeben.
Der endgültige Monatsstatus ist weiterhin keine elektronische Abrechnungsfreigabe.

## Prüfung und nächste Schritte

Die zusätzliche Suite benutzt die sechs tatsächlichen SQL-Entwürfe, pgcrypto,
PGlite, verschlüsseltes SQLite, tatsächliche PDF-/PNG-Bytes und den amtlichen
XML-Prüfer. Auth-/Office-Auflösung und persönliche Unterschriften bleiben
synthetische Grenzen. Negative Fälle umfassen freie Browserfelder, private
Tabellenzugriffe, fehlende Zuordnung, veraltete Originalbelege trotz unverändertem
Zeitstempel, verlorene Antworten, laufende Änderung, Personenwechsel,
Korrektur und falsche Archiv-/Signaturbytes. Der Vertreterfall bindet die
vollständige gerenderte und geprüfte Scan-PDF bis zum SQL-Abschluss.

```bash
npm run verify:gkv:monthly-web
npm run verify:gkv:monthly-xml
npm run verify:gkv:services
npm run typecheck
npm run build:web:production
```

Offen bleiben die persönliche zeitnahe GKV-Nummernerfassung einschließlich
Mehrpersonenleistungen, geprüfte Provisionierung, unmittelbare elektronische
Komponentensignatur, unabhängige Signaturprüfung, atomare XML/CMS-Archivierung
und Abschluss, Abrechnungshülle/IMG/PROD-/MOD-Zuordnung, tatsächliche
Zieloberflächen-/Hardware-/TI-/Annahmestellentests und externe Softwareprüfung.
Ein früheres Testoriginal wird nicht zum echten Zulassungsnachweis umgedeutet.
