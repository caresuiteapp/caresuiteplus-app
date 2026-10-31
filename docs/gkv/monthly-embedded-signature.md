# Unterschriftsbild ausschließlich im gebundenen XML-Nachweis

Stand: 31.10.2026, Entwicklungszweig nach `c8f402a2`. Keine produktive
Aktivierung, Hardware-/TI-Bestätigung oder unabhängige Abnahme.

## Ablauf für neue Nachweise mit vollständigen Fachangaben

Die [Vereinbarung nach § 105 Abs. 2 Satz 2 SGB XI, Abschnitt 4.2.1,
Nummern 8 und 10](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/2023_10_05_Vereinbarung__105_Abs.2_Satz_2_SGBXI_final.pdf)
verlangt die Bindung der persönlichen Unterschrift an den Leistungsnachweis.
Die Unterschrift darf nach der Einbettung nicht gesondert verfügbar bleiben.
Die nachfolgende technische Umsetzung deckt einen Teil dieser Anforderungen ab;
die unabhängige Prüfung des vollständigen Verfahrens steht aus.

Bei neuen Erfassungen mit `xmlFacts` erzeugt der Host den XML-Kandidaten aus dem
eingefrorenen Snapshot, dem reproduzierten Original und der aktuell geprüften
Unterschrift im Arbeitsspeicher. Der vorhandene Python/lxml-Worker prüft die
tatsächlichen Bytes gegen die fixierten amtlichen Schemata und Feldregeln.
Anschließend werden Quelle, Anmeldung, Beauftragung und gegebenenfalls
Vertretungsberechtigung erneut geprüft.

Erst danach speichert eine SQLite-Transaktion die verschlüsselten Quittungsmetadaten,
die verschlüsselte Bindung und das vollständige XML. Eine eigenständige PNG-Datei
wird dabei zu keinem Zeitpunkt geschrieben. Der Bildausschnitt eines geprüften
Vertreter-Scans wird ebenfalls nicht separat abgelegt; Profil 3 enthält den
vollständigen geprüften Scan im XML. Die vorhandene Ablage vollständiger
Papieroriginale und gerenderter ganzer Seiten bleibt gesondert zu bewerten.

Die Transaktion prüft vor dem Schreiben einen nur vom abgeschlossenen XML-Worker
ausgestellten internen Objektbeleg. Kopierte Erfolgsflags, veränderte Bytes oder
eine andere Quittung reichen nicht aus. Nach dem Schreiben werden die
verschlüsselten Objekte zurückgelesen und miteinander verglichen. Speicherfehler
oder Überschreitung der Archivgrenze rollen Quittung und XML gemeinsam zurück.
Der Fingerabdruck des ursprünglichen Bildes bleibt als Wiederverwendungssperre
erhalten; er kann kein Bild rekonstruieren.

Das bestehende CMS-Journal übernimmt genau dieses XML. Fehlende PIN, verlorene
SignDocument-Antwort und unklarer Prüfbericht erzeugen keine separate Bildablage.
Erst ein vollständiges CMS mit positivem gebundenem VerifyDocument-Bericht erlaubt
im konfigurierten Host die private Bestätigungsquittung. `dispatchReady` bleibt
unabhängig davon false.

## Wiederaufnahme und Oberfläche

`resume-verification` akzeptiert ausschließlich die bisherige Erfassungskennung,
Fassung und persönliche Zuordnung. PNG, Quittung, Hash, Kartenparameter und ein
neuer Papierprüfauftrag sind keine zulässigen Zusatzfelder. Gateway und mTLS-Host
prüfen die persönliche Anmeldung; der private Verifizierer prüft die aktuelle
Quelle und den gespeicherten Kontext erneut.

| Archivzustand | Ausdrücklich angeforderte Wiederaufnahme |
| --- | --- |
| Noch kein XML/keine Quittungsmetadaten | Verständlicher Fehler; Erfassung schließen und neu unterschreiben. Es wird kein Bild aus dem Browser erneut abgesendet. |
| `prepared` | Gespeichertes XML nach frischen Karten-/Vertrauensprüfungen signieren. |
| `in-flight` oder `held` | Zur Klärung gesperrt; kein zweiter Schlüsselaufruf. |
| `signed` | Vorhandene CMS-Bytes nur weiter prüfen; niemals erneut signieren. |
| `complete` | Vorhandene Quittung und unveränderte Bytes verwenden. |

Der Browser behält bei einer ungeklärten Signaturantwort nur den Fortsetzungsauftrag
mit Erfassungskennung. Ein Statusabruf muss vor einer ausdrücklichen Wiederholung
erfolgen. Das Zeichenfeld wird während der Verarbeitung ausgehängt. Die neue
Fortsetzung erzeugt weder eine Ersatzunterschrift noch einen Monatsabschluss.
Der Monatsabschluss bleibt eine eigene Aktion mit erneuter Rechte-/Quellenprüfung.

Der bisherige Wert `signature_path` bleibt ein gebundener logischer Bezeichner in
Quittung und Bestätigung. Im neuen XML-Pfad existiert darunter kein eigenständiges
Bildobjekt und keine Downloadadresse. Private Archivleser liefern vollständige
Nachweise; der Web-Endpunkt veröffentlicht keine CMS-/XML- oder freien Bildbytes.

## Bestandsdaten und Grenzen

Die SQLite-Schemaerweiterung fügt nur eine verschlüsselte Bindungsspalte hinzu.
Das Öffnen älterer Archive löscht oder verändert keine vorhandene Unterschrift.
Ein noch offener älterer Fachnachweis kann über die aktuelle Prüfung in die
eingebettete Ablage überführt werden. Dafür muss neu geprüftes XML exakt zum
ursprünglichen Bild, zur Quittung und zu einem gegebenenfalls vorhandenen
CMS-Journal passen. Der Zustandswechsel ersetzt keine Signatur und hebt keine
Sperre auf.

Eine flächendeckende Bereinigung bereits abgeschlossener Altarchive, alter
WAL-Seiten und Backups ist kein Bestandteil dieses Schritts. Solche Kopien dürfen
nicht allein aufgrund eines leeren aktuellen PNG-Felds als gelöscht gelten.
Ältere Erfassungen ohne `xmlFacts` bleiben im bisherigen Bestätigungsarchiv; sie
werden dadurch nicht zu freigegebenen elektronischen GKV-Leistungsnachweisen.

Die Verarbeitung benötigt vorübergehend Bilddaten in HTTP-/JavaScript-/XML-
Arbeitsspeichern. Eigene veränderbare PNG-Puffer werden nach Gebrauch überschrieben;
eine garantierte physische Speicherlöschung durch JavaScript, Betriebssystem,
Browser, Swap oder externe Proxys wird nicht behauptet. Die Tests belegen keine
Handschrift, Vertretungsmacht oder Erfassung durch eine echte Pflegekraft.

## Prüfung

- `monthly-embedded-signature.test.mjs`: tatsächlicher XML-Worker, SQLite-Trigger
  gegen jede separate Bildschreiboperation, Transaktionsabbruch, Kontingent,
  Wiederverwendung, Kontextwechsel, Manipulation, Bestandskonvertierung und
  additive Erweiterung des früheren Schemas.
- `tsl-ocsp.test.mjs`, Gruppe `monthly component:`: tatsächliches lokales
  mTLS/SOAP mit synthetischen Karten-/TSL-/OCSP-Antworten, SignDocument,
  VerifyDocument und Wiederaufnahme über den echten mTLS-Hostvertrag.
- Monats-Web-Gate: Vertrags-/Gatewayprüfungen, bestehende SQL-/Originalabläufe
  und React-DOM-Bedienung. Die Python-Tests bleiben im separaten XML-/Dienstetest.

DOM-Prüfungen belegen keine visuelle Abnahme. Produktive Datenbankanbindung,
physische Karten, TI, Aufbewahrung/Backup und externe Prüfung bleiben offen.
