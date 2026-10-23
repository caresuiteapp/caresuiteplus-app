# Kartenentschlüsselung im KIM-Empfang

Stand: 23.10.2026. Der interne Empfang kann ein gespeichertes INLINE-ECC-Original
über den konfigurierten Konnektor entschlüsseln, seine Dokumentensignatur prüfen
und den bestehenden VZD-/AUT-Diagnoseweg durchlaufen. Die Tests verwenden lokale
mTLS-/LDAPS-Gegenstellen mit Software-Testschlüsseln. Sie attestieren keine
physische Karte, TI-Verbindung, Zulassung oder normale Clientzustellung.

## Aufrufvertrag

`receiveEccKimMessageWithTsl(options, reportOptions, dependencies)` wählt diesen
Pfad ausschließlich mit `dependencies.card`. Der direkte Einstieg heißt
`receiveEccKimMessageWithCard`. Die Abhängigkeiten umfassen echte Instanzen von
`KonnektorCertificateClient`, `TslOcspStatusClient` und das konfigurierte Verzeichnis
derselben Umgebung. `card` enthält die erwartete Telematik-ID und Berufsrollen,
optional ICCSN, Terminal und Slot. Diese Angaben sowie `options.address` stammen
aus der Postfach-/Hostkonfiguration; die From-/To-Felder dürfen sie nicht ersetzen.

Die Nachrichtenoptionen enthalten Originalbytes, abholendes Postfach, erwartetes
OSIG-Zertifikat, optionales AUT-Zertifikat und Verarbeitungszeit. Software-Schlüssel,
frei übergebene Kartenbelege, automatische PIN-Freischaltung und externes
`verificationReport` werden in diesem Pfad abgewiesen. Das ursprüngliche
Software-Diagnoseprofil bleibt separat verfügbar. Ein Kartenfehler wechselt
nicht zu diesem Profil.

Der Aufrufer muss das Original zuvor dauerhaft speichern. Dieser Dienst liest
keine Postfach-Zugangsdaten, sendet keine Nachrichten, löscht kein POP3-Original
und verändert keinen Rechnungsstatus. Eine nicht als KIM markierte Nachricht
wird unverändert zurückgegeben, ohne Kartenoperation.

## Zusammenhängender Ablauf

1. Transportformat, INLINE-Version, unterstützte ECC-Hülle, Empfängerzuordnung
   und erwartetes Signaturzertifikat vor dem privaten Schlüsselzugriff prüfen.
2. SMC-B eindeutig auswählen, C.AUT/C.ENC/C.SIG lesen und jeweils TSL, OCSP,
   Institutions-ID, Rolle und VerifyCertificate prüfen. Nur ein bereits durch
   GetPinStatus bestätigter PIN-Zustand darf weiterlaufen.
3. Die tatsächlich gelesene C.ENC muss exakt zum RecipientIdentifier des
   abholenden Postfachs passen. DecryptDocument wird einmal aufgerufen; der
   Kartenclient prüft das zurückgegebene SignedData unabhängig mit ECDSA und
   dem signierten recipient-emails-Attribut. Unklare Ausgänge bleiben gesperrt.
4. Dieselben geschützten Header-, MIME- und Empfängerprüfungen wie im bisherigen
   Empfang ausführen. OSIG erneut gegen TSL/OCSP und VerifyCertificate prüfen,
   anschließend VerifyDocument. Inhalt, Signaturwert und Zertifikat werden an
   den tatsächlichen Dokumentenbericht gebunden.
5. Den gemeinsamen VZD-/AUT-Ablauf ausführen. Passt die OSIG-ID zum geprüften
   From-Eintrag, ist AUT nicht erforderlich; sonst muss das tatsächlich
   eingebettete AUT-Zertifikat dessen Identität bestätigen. Negative Statusbelege
   oder widersprüchliche Verzeichniseinträge bleiben negative Diagnosen.
6. Karte, alle drei Zertifikate und PIN-Zustand erneut lesen und prüfen. Handle,
   Kartenfingerabdruck und Zertifikatshashes müssen unverändert sein. Erworbene
   Status-/Verzeichnisbelege werden unmittelbar vor der Ausgabe erneut geprüft.

Ein Vorgang hat insgesamt höchstens 120 Sekunden; die engeren Grenzen der
Unteroperationen bleiben erhalten. Ein zweiter gleichzeitiger Kartenempfang
derselben Clientinstanz wird abgewiesen. Abbruch löst keine Wiederholung aus.
Veränderbare Eingaben werden vor dem ersten Warten kopiert. Nachrichten- und
CMS-Puffer sind begrenzt und werden nach Gebrauch überschrieben. Der empfangene
SignedData-MIME-Puffer bleibt für die abschließende Diagnose während der
Netzprüfungen im Arbeitsspeicher; JavaScript-Strings und Laufzeitkopien bieten
keine garantierte vollständige Speicherlöschung. Er wird nicht protokolliert
oder durch diesen Baustein unverschlüsselt auf Datenträger geschrieben.

## Originale negative Dokumentenberichte

Der bestehende XML-Worker prüft auch negative Antworten gegen die festgeschriebenen
XSDs und das begrenzte Einzel-Signaturprofil. Vor Übernahme müssen Signaturwert,
OSIG-Leaf und Prüfzeit zum tatsächlichen Aufruf passen. Der originale
VerificationReport-Teilbaum wird exklusiv kanonisiert, auf 256 KiB begrenzt und
gehasht. SOAP-Umschlag und fremde Header werden nicht angehängt. Die kanonisierte
Darstellung ist keine bytegleiche Kopie der gesamten SOAP-Antwort; deren Hash
bleibt separat im Transkript erhalten.

INVALID, INCONCLUSIVE und ein widersprüchliches positives Gesamtergebnis
stoppen den Ablauf vor LDAP. `takeConnectorDocumentFailure` gibt das XML genau
einmal aus dem tatsächlich entstandenen Fehlerobjekt heraus, gebunden an
Clientinstanz und CMS-Hash. Ein kopiertes Fehlerobjekt oder ein anderer Aufruf
kann keinen Bericht liefern. Fehler-JSON enthält nur feste Codes; die rohen
Berichtsdaten erscheinen ausschließlich im dafür vorgesehenen XML-Anhang.

Die Diagnose verwendet `VerificationReport_<Referenz>.xml`. Ihr JSON bindet
`connectorReportSha256` an die Aufrufmetadaten und unterscheidet diesen Bericht
von einem externen, unbestätigten Anhang. Bei falscher Bindung, veralteter Zeit,
fehlendem Bericht oder nicht unterstützter Struktur wird kein Bericht erfunden.
Klartextanhänge bleiben standardmäßig aus; eine explizite Option erzeugt beim
auswertbaren Kartenpfad einen bytegleichen RFC822-Anhang. Scheitern bereits CMS
oder geschützte Header, gibt dieser Pfad keinen ungeprüften Klartextanhang aus.

Die Umsetzung berücksichtigt insbesondere Empfängerschlüsselbindung und
negative Berichtsanhänge aus
[gemSpec_CM_KOMLE, 3.4.4.2 und A_23165-02](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/).
Dies ersetzt keine vollständige normative Fehlercode-/Pflichttextabnahme.

## Ergebnis und offene Integration

Der Kartenbefund enthält Aufrufhashes, begrenzte Dokumentenmetadaten und den
erreichten Schritt. `cardAcquisition.state: checked` bestätigt nur den beobachteten
Kartenablauf; maßgeblich bleiben die gesonderten Nachrichten-, Status- und
Verzeichnisbefunde. Auch vollständig bestandene lokale Prüfungen erzeugen eine
07-Diagnose mit `identityStatus: unverified` und `deliveryStatus: diagnostic-only`.
`hardwareEvidence` und `tiEvidence` bleiben `not-attested`.

Der [Empfangshost](konnektor-receive-host.md) verbindet diesen Pfad jetzt mit
bereits verschlüsselt gespeicherten Inbox-Originalen, lokal hinterlegten
Zertifikatserwartungen, dauerhaften Aufträgen und einer Listen-/Start-/Status-API.
Ergebnisse bleiben verschlüsselt am Host; die Webansicht verbindet Auswahl,
Detailprüfung und gezielten Start mit den gemeinsamen Kartensperren.
Reale Oberflächenabnahme, sichere automatische
OSIG-Auflösung, produktiver Postfach-/Clientproxyanschluss, normale Clientzustellung
und weitere CMS-/KAS-/Herstellerprofile bleiben offen. Fehlerhaftes CMS erreicht
wegen der unabhängigen lokalen Vorprüfung noch keinen allgemeinen negativen
VerifyDocument-Pfad. Die vollständige normative Fehlermatrix ist deshalb
ausdrücklich offen. Das verbundene Gerät war beim erneuten Abruf offline;
ein Hardware-/TI-Lauf wurde nicht ausgeführt.

Ausgeführte Prüfungen stehen im [Prüfprotokoll](verification.md).
