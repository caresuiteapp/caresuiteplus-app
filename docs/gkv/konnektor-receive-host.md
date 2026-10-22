# Gespeicherte KIM-Nachrichten am Diagnosehost prüfen

Stand: 23.10.2026. Der vorhandene Node-Host kann einen lokal vorbereiteten
Empfangsauftrag über die [Kartenpipeline](konnektor-card-receive.md) ausführen.
Vorbereitung, ursprüngliche Nachricht und Ergebnis sind dauerhaft zugeordnet.
Die API liefert ausschließlich begrenzte Auftragsmetadaten. Die Implementierung
ist mit lokalen Software-Gegenstellen geprüft; Hardware-/TI-Nachweise und
normale Clientzustellung sind damit nicht erbracht.

## Einrichtung im vorhandenen Host

`KimDiagnosticHost` erhält optional `receive` neben der bestehenden
`probe`-Konfiguration. Ein Host gehört zu einem Mandanten und in diesem
Ausbaustand genau einem Empfangspostfach. Die Konfiguration enthält:

| Feld | Bedeutung |
| --- | --- |
| inbox | Bereits geöffnete `ReceiptInbox` mit dauerhaft gespeicherten Originalen |
| key | Separater 32-Byte-Schlüssel für das Empfangsjournal; außerhalb von SQLite bereitstellen |
| mailboxId | Bestehende Postfach-UUID dieser Inbox und dieses Mandanten |
| address | Abholadresse; muss zum gespeicherten Postfachbenutzernamen und zu `probe.address` passen |
| directory | Tatsächliche `VzdLdapsDirectory` derselben Umgebung wie der Statusclient |
| cmVersion / ptVersion | Versionen für die lokale Fehlerdiagnose |
| maxJobs | Optionales Auftragslimit, Standard 10.000; Bereich 1–100.000 |
| maxResultBytes | Optionales gemeinsames Limit der Ergebnisbytes, Standard 256.000.000; Bereich 1–10.000.000.000 |

Konnektor, Statusclient, Institutions-ID, Berufsrollen und optionale
ICCSN-/Terminal-/Slot-Auswahl kommen unverändert aus `probe`. Sie können nicht
pro HTTP-Auftrag ersetzt werden. Umgebung und Postfach müssen zusammenpassen.
Der private Hostspeicher verwendet weiterhin 0700-Verzeichnis, 0600-Datei,
WAL und FULL-Sync. Der Host läuft nicht in einem Vercel-Request oder dessen
temporärem Dateisystem. Es wird keine zusätzliche Software installiert.
Zum ungebündelten Host gehören auch die gemeinsamen TypeScript-Verträge unter
`src/lib/gkvExchange`; der vorhandene Node-24-Loader lädt sie ohne Buildschritt.

Die verschlüsselte Postfachidentität wird bei Einrichtung, Vorbereitung und
Ausführung erneut geprüft. Zusätzlich bindet das Journal seine Konfiguration
an Postfach, Konto-Hash, Adresse, Umgebung, Kartenwähler und Diagnoseversionen.
Ein falscher Schlüssel oder eine veränderte Bindung scheitert beim Öffnen;
vorhandene Aufträge werden nicht still auf ein anderes Konto umgestellt.
Schlüsselrotation und Konfigurationsmigration sind noch nicht implementiert.
Das gemeinsame Ergebnislimit zählt die MIME-Dateien; Parameter und Metadaten
sind zusätzlich pro Datensatz und durch das Auftragslimit begrenzt.

## Lokale Vorbereitung

Die Administration beziehungsweise ein vertrauenswürdiger lokaler Import kennt
das bereits gespeicherte Original und dessen erwartetes OSIG-Zertifikat:

```js
host.prepareReceive(tenantId, {
  requestId,
  messageId: stored.id,
  originalSha256: stored.sha256,
  expectedSignerCertificate: osigDer,
  expectedAuthCertificate: autDer, // optional
});
```

`stored` ist das tatsächliche Ergebnis von `ReceiptInbox.record`; `messageId`
bezeichnet die lokale Datensatz-UUID, nicht den RFC822-Message-ID-Header.
Die Zertifikate müssen vor Ort zum konkreten Original bereitgestellt werden.
Eine sichere automatische Senderzertifikatauflösung ist weiterhin offen. Die
Vorbereitung stellt kein Zertifikatsvertrauen her: Laufzeitprüfungen von CMS,
TSL, OCSP, Konnektor und VZD bleiben zwingend.

Die Methode akzeptiert weder Nachrichtenbytes noch Adressänderungen,
Software-Schlüssel, PIN, vorgegebene Zeit, fremde XML-Berichte oder eine
Klartextfreigabe. Sie liest und prüft das vorhandene Original, kopiert die
Zertifikate und legt einen `prepared`-Auftrag an. Dabei erfolgt kein Kartenaufruf.
Gleiche Anfrage mit gleichen Parametern liefert denselben Auftrag. Andere
Parameter unter gleicher UUID, dieselbe Nachricht unter neuer Auftrags-UUID
und eine bereits für den synthetischen Rundlauf verwendete UUID werden abgewiesen.

Das Konfigurationsmodul von `host-entry.mjs` kann ein optionales
`prepare(host)` exportieren, das beim Start vor Öffnung des Listeners aufgerufen
wird. Es darf beispielsweise eine vor Ort geprüfte Importliste mit obiger
Methode vorbereiten. Der Host startet vorbereitete Aufträge nicht selbständig.
Die Konfiguration verantwortet auch das Schließen von Inbox, Verzeichnis und
Statusclients über ihr bestehendes `close()`.

## Start und Status

Der vorhandene POST-Endpunkt `/api/gkv/kim-host` und der mTLS-Hostpfad
`/v1/diagnostics` unterstützen zusätzlich:

```js
{ tenantId, action: 'receive-start', requestId }
{ tenantId, action: 'receive-status', requestId }
```

Beide benötigen exakt die UUID eines lokal vorbereiteten Auftrags. Die API
prüft weiterhin Supabase-Anmeldung und mandantenbezogene Abrechnungsrechte;
der Host prüft zusätzlich mTLS, Client-Leaf-Pin und seinen festen Mandanten.
Benutzer-Token werden nicht zum Host weitergereicht. Der Antwortvertrag bindet
die Antwort an Mandant **und** Auftrags-ID; unbekannte Datenfelder scheitern.
Es gibt keine HTTP-Funktion zum Vorbereiten, Hochladen, Herunterladen des
Nachrichteninhalts, Austausch von Zertifikaten oder Bestätigen einer Wiederherstellung.

Start reserviert den Auftrag atomar im selben SQLite-Journal wie die
synthetische Anschlussprüfung. Erst danach folgen Originalprüfung und
Kartenoperationen im dauerhaft laufenden Host. Empfang und Rundlauf dürfen
nicht gleichzeitig auf die Karte zugreifen. Auch eine andere Hostinstanz
mit demselben Journal kann keine zweite Reservierung erzeugen. Für den Betrieb
bleibt ein aktiver Prozess pro Journal vorgesehen.

| Zustand | Bedeutung |
| --- | --- |
| prepared | Original und Zertifikatserwartung lokal gebunden; noch kein Lauf |
| running | Dauerhaft reservierter, derzeit ausgeführter Lauf |
| completed | Diagnose beziehungsweise unveränderte nicht geschützte Nachricht gespeichert; keine Zustellfreigabe |
| failed | Kein vollständiges Ergebnis gespeichert; feste Fehlerkennung und Prüfsperre |
| interrupted | Lauf im Journal ohne zugehörige aktive Ausführung; keine automatische Wiederaufnahme |

Die Antwort enthält IDs, Original-/Ergebnishash, Größen und Zeitpunkte,
Diagnosecode, Kartenstufe, begrenzten Dokumentenbefund und Berichts-Hash.
Adressen, Betreff, Inhalt, Zertifikatsdaten, Kartenhandle und XML fehlen darin.
`completed` ist kein Integritäts- oder Liefererfolg: `reviewRequired` und
Nachrichtenbefund bleiben getrennt. Alle Ergebnisse bleiben `unverified` und
`diagnostic-only` beziehungsweise `unprotected`; Hardware/TI sind `not-attested`.

Die bestehende Webansicht zeigt jetzt, wenn Kartenempfang, notwendige
Überprüfung oder dessen Wartezeit einen neuen synthetischen Rundlauf sperren.
Während eines aktiven Empfangs fragt sie den Status weiter ab. Eine Liste,
Auswahl und vollständige Bedienung der Empfangsaufträge in der Weboberfläche
sind noch nicht angeschlossen; die neuen Start-/Statusaktionen sind über die
authentisierte API verfügbar.

## Ergebnisablage und Wiederherstellung

Der ursprüngliche Inbox-Datensatz bleibt unverändert. Der Empfang klassifiziert
keine Abrechnungsrückmeldung, löscht kein POP3-Original, verschickt keine Mail
und ändert keinen Rechnungsstatus. Nicht als KIM markierte Originale durchlaufen
keinen Kartenaufruf; ihre unveränderten Bytes bleiben ebenfalls lokal verschlüsselt.

Vorbereitungsparameter, MIME-Ergebnis und vollständige lokale Diagnosemetadaten
werden getrennt mit AES-256-GCM verschlüsselt. Die Datensatzbindung umfasst
Mandant, Auftrag, Postfach, Nachricht, Originalhash und Parameterhash. Ergebnis
und Metadaten werden zusätzlich an den Ergebnishash gebunden und gemeinsam
mit dem Abschlusszustand geschrieben. Originale negative XML-Berichte bleiben
im verschlüsselten MIME-Ergebnis. Entschlüsselte Originalanhänge sind im Host
fest ausgeschaltet. Die lokale Administration kann mit
`host.receiveArtifact(tenantId, requestId)` die tatsächlichen Bytes und Metadaten
auslesen; der Aufrufer muss den übernommenen Bytepuffer nach Gebrauch löschen.

Ein Speicher-/Quotenfehler erzeugt kein gekürztes oder positives Ergebnis.
Scheitert selbst die Fehlerspeicherung, bleibt die zuvor dauerhaft angelegte
`running`-Reservierung bestehen. Nach Neustart wird sie als `interrupted`
behandelt. Ein abgebrochener Hostlauf wird nicht wiederholt. Bereits gestartete
Auftrags- und Nachrichtenkennungen bleiben auch nach einer Überprüfung reserviert.
Eine explizite erneute Verarbeitung desselben Originals ist noch nicht vorgesehen.

Abgewiesene Kartenabläufe und fehlgeschlagene/ungeklärte Ausführungen sperren
weitere Kartenarbeiten. Erst nach Beendigung des alten Prozesses und lokaler
Klärung kann die Administration mit frischen Clients und
`recoveryReviewedRequestId` des letzten gestarteten, gesperrten Auftrags neu
öffnen. Das Journal vermerkt die Klärung, ohne das frühere Ergebnis zu ersetzen
oder den Auftrag erneut auszuführen. Die gemeinsame Wartezeit von mindestens
30 Sekunden seit dem letzten Start gilt auch zwischen Empfang und Rundlauf.

Die Ablage ist kein unabhängig signiertes oder gegen lokale
Datenbankadministratoren geschütztes Archiv. Betriebliches Backup,
Aufbewahrung, Schlüsselrotation, explizite Wiederverarbeitung, automatische
OSIG-Auflösung, produktiver Postfach-/Clientproxyanschluss und vollständige
Webbedienung bleiben zu ergänzen. Der Prüfumfang der Karte selbst ist im
[Kartenempfangsvertrag](konnektor-card-receive.md) begrenzt; weitere CMS-/KAS-/
Herstellerprofile, reale Hardware-/TI-Interoperabilität und Zulassung bleiben offen.
