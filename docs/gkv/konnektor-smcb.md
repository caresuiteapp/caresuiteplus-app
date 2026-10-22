# Konnektor: Kartenabfrage und gebundene SMC-B-Auswahl

Stand: 22.10.2026. `GetCards` und ein gemeinsamer SMC-B-Zertifikatsablauf sind
im eigenen Dienstkern ausführbar. Die Nachweise verwenden lokale mTLS-
Gegenstellen sowie echte signierte TSL-/OCSP-Belege. Physische Karten,
Konnektoren und TI-Dienste wurden noch nicht angebunden. Der Ablauf führt keine
PIN- oder Karten-Schlüsseloperation aus und gibt keinen Echtversand frei.
Der aufbauende [PIN-Ablauf](konnektor-pin.md) ergänzt Statusprüfung und einen
ausdrücklich ausgelösten Terminalversuch mit anschließender erneuter
Karten-/Zertifikatsprüfung.

## Vertrag und Endpunkte

Die Kartenabfrage verwendet EventService WSDL 7.2.0 und XSD 7.2.1 aus
`gematik/api-telematik`, Commit `31dd17b7dbe76ba6016318a2dfdd028e63598419`.
Die sechs ergänzten Vertrags-/Importdateien sind mit Herkunft und SHA-256 im
vorhandenen Schema-Manifest erfasst. Die Dateien entsprechen bis auf
LF-Zeilenenden den Originalen. Auch EventService-Anfragen und -Antworten werden
mit der vorhandenen isolierten Python-/lxml-Laufzeit gegen das offizielle
Schema geprüft. Mitimportierte CardService- oder Terminaloperationen werden
dadurch nicht als ausführbare APIs freigeschaltet.

`KonnektorCertificateClient` erhält dafür optional `eventServiceUrl`. Diese
feste HTTPS-URL muss denselben Ursprung einschließlich Port wie der
CertificateService besitzen. Beide Endpunkte nutzen denselben Kontext,
CA-Anker, Serverpin und dasselbe Clientzertifikat. Der Transport bindet die
zulässigen Operationen und SOAPAction an den jeweiligen Dienst. Ein
GetCards-Aufruf wird nicht zum CertificateService umgeleitet. Ohne konfigurierten
EventService endet er mit `KIM_CONNECTOR_EVENT_UNCONFIGURED` vor dem Netzaufruf.
Abweichende Endpunktursprünge sind im aktuellen Profil nicht unterstützt.

## Karten abfragen und auswählen

```js
import { KonnektorCertificateClient, assertSelectedSmcb }
  from '../../services/kim/connector-certificates.mjs';
import { readAndVerifySmcb } from '../../services/kim/connector-smcb.mjs';

const connector = new KonnektorCertificateClient({
  ...provisionedConnectorOptions, // Zertifikatsdienst, mTLS, Kontext und Umgebung
  eventServiceUrl: configuration.eventServiceHttpsUrl,
});

try {
  const snapshot = await connector.getCards({
    cardType: 'SMC-B',
    ctId: configuration.selectedTerminalId, // optional
    mandantWide: false, // keine automatische Erweiterung auf andere Arbeitsplätze
    signal,
  });
  const selection = connector.selectSmcb(snapshot, {
    iccsn: configuration.selectedCardSerial, // optional, falls bereits eindeutig
  });
  assertSelectedSmcb(selection, connector);
  // selection bezeichnet eine beobachtete Kartensitzung, keine bestätigte TI-ID.

  const result = await readAndVerifySmcb({
    connector,
    statusClient, // bereits konfigurierter TslOcspStatusClient derselben Umgebung
    expectedTelematikId: configuration.institutionTelematikId,
    requiredRoles: configuration.institutionProfessionOids,
    iccsn: selection.card.iccsn,
    ctId: selection.card.ctId,
    slotId: selection.card.slotId,
    mandantWide: false,
    signal,
  });
  result.revalidate();
  // result.deliveryStatus bleibt held-for-trust-validation.
} finally {
  connector.close();
}
```

`getCards({ ctId, slotId, cardType, mandantWide, signal })` kopiert die
Filter vor dem ersten Warten. `mandantWide` ist standardmäßig ausdrücklich
false; nur boolesches true erweitert die Anfrage. Ein Steckplatzfilter braucht
in diesem lokalen Profil auch eine Terminal-ID. Antworten müssen sämtliche
angefragten Filter erfüllen. Ignoriert der Server einen Filter, wird die ganze
Antwort verworfen; der Client wählt keine Ersatzkarte.

Die Ausgabe enthält höchstens 64 Karteneinträge mit CardHandle, Kartentyp,
Terminal, Steckplatz, optionaler ICCSN, Einsteckzeit und Kartenversionen. Namen
der Karteninhaber, KVNR und behauptete Ablaufdaten werden nicht übernommen.
ICCSN, Handles und Terminaldaten sind Betriebsdaten des Hosts; sie gehören
nicht in öffentliche Protokolle. Doppelte Handles, doppelt belegte
Terminal-/Steckplatzpaare oder doppelte ICCSN machen die Liste unbrauchbar.
Steckplätze sind auf 1–65535 begrenzt; die vorhandenen XML-Größen-, Tiefen- und
Knotengrenzen gelten ebenfalls.

`selectSmcb(snapshot, { iccsn, ctId, slotId })` arbeitet ausschließlich auf dem
ursprünglichen aktuellen Snapshot desselben Clients. Es muss genau eine SMC-B
passen, mit 20-stelliger ICCSN sowie COS- und Objektsystemversion. Keine Karte
ergibt `CARD_NOT_FOUND`, mehrere ergeben `CARD_AMBIGUOUS`. Es gibt keine
stillschweigende Auswahl des ersten Eintrags. HBA, eGK oder UNKNOWN werden
nicht als SMC-B behandelt. Die SMC-B-Darstellung eines HSM-B wird nicht als
Nachweis einer physischen Karte ausgegeben; GetCardTerminals/IS_PHYSICAL ist
noch nicht integriert.

Jede gestartete neue Kartenabfrage entwertet die vorherigen Snapshots und
Auswahlen dieses Clients, auch wenn die neue Abfrage scheitert. Eine ältere
Antwort, die später als eine neuere eintrifft, kann diese nicht ersetzen.
Kopierte Objekte, andere Clients/Kontexte, Schließen, Aufruferabbruch,
Uhr-Rücksprung und Ablauf der 30-sekündigen Nutzungsfrist verhindern die
weitere Verwendung. Der Host sollte Kartenabfrage und abhängige Vorgänge je
Client koordinieren; parallele Aktualisierungen brechen alte Abläufe bewusst ab.

## Gemeinsamer SMC-B-Zertifikatsablauf

`readAndVerifySmcb` benötigt eine explizit provisionierte erwartete Telematik-ID
und eine nichtleere Liste erwarteter Rollen. Karte oder Anzeigename legen
diese Werte nicht fest. Der Ablauf arbeitet wie folgt:

1. Frische GetCards-Abfrage mit Kartentyp SMC-B und eindeutige Auswahl im
   angeforderten Arbeitsplatz-/Mandantenbereich.
2. ReadCardCertificate für C.AUT, C.ENC und C.SIG mit ausdrücklich ECC. Fehlende
   Zertifikate beenden den Vorgang. Das Kartenkennzeichen stammt aus der
   geschützten Auswahl, nicht aus einer unabhängig übergebenen Zeichenfolge.
3. Für jedes tatsächliche DER-Zertifikat werden aktuelle TSL-CA, erlaubter
   Zertifikatstyp, Admission und signierter OCSP-Beleg geprüft. Die konkrete
   SMC-B-Typkennung muss passen: C.HCI.AUT `1.2.276.0.76.4.77`, C.HCI.ENC
   `1.2.276.0.76.4.76`, C.HCI.OSIG `1.2.276.0.76.4.78`. Ein sonst gültiges
   HBA-AUT reicht nicht. Alle drei Zertifikate müssen genau die erwartete
   Telematik-ID und sämtliche geforderten Rollen enthalten.
4. Nach positivem lokalen Befund wird VerifyCertificate für dieselben
   DER-Bytes ausgeführt. Sämtliche Rollen der geprüften Admission müssen auch
   im positiven Konnektorbefund vorhanden sein. Negative oder unbestimmte
   Antworten können nicht durch den lokalen OCSP-Erfolg ersetzt werden.
5. Eine zweite GetCards-Abfrage im selben Bereich muss dieselbe ausgewählte
   Karte bestätigen. Handle, ICCSN, Terminal, Steckplatz, vollständige
   Einsteckzeit einschließlich aller Nachkommastellen und Kartenversionen
   werden verglichen. Entfernen, Neustecken oder Austausch gibt kein Ergebnis
   mit dem alten Kartenkennzeichen frei.
6. Vor der Rückgabe werden alle rohen Statusbelege gegen ihre aktuellen
   TSL-Prüfer sowie alle Konnektorbelege und die bestätigte Kartenauswahl
   erneut ausgewertet. Änderungen während der letzten Abfrage bleiben wirksam.

Die Gesamtfrist beträgt 30 Sekunden; zusätzlich gelten die kürzeren
Einzelfristen und Belegfristen. Der Ablauf gibt entweder einen vollständigen
Satz von drei Zertifikaten oder einen begrenzten Fehler aus. Ein Teilresultat
berechtigt nicht zum Weiterarbeiten. `revalidate()` prüft nach weiterem Warten
die ursprünglichen Belege erneut, einschließlich veränderter Ausgabepuffer.
Eine spätere Kartenabfrage entwertet auch das zuvor ausgegebene Gesamtpaket.

## Genaue Grenzen

GetCards liefert Karteninformationen, keine eigenständige authentisierte
TI-Identität. Die zusätzliche Typ-/Admission-/Statusprüfung bleibt deshalb
verpflichtend. Auch deren positiver lokaler Ausgang bestätigt hier nur die
konfigurierten Anker: `identityStatus` bleibt `unverified` und die Lieferung
`held-for-trust-validation`. Der bestehende Empfang bleibt `diagnostic-only`.

Die zwei Kartenabfragen sind Momentaufnahmen. `revalidate()` ist synchron und
erkennt keine spätere physische Entnahme ohne erneute Abfrage oder Ereignis.
Ein Kartenwechsel kann damit nicht atomar mit einer späteren Schlüsseloperation
ausgeschlossen werden. Diese Operationen müssen ihren Kartenkontext selbst
erneut prüfen; sie sind noch nicht implementiert. Es gibt noch keine
Ereignisabonnements, DVD/ServiceDiscovery, Terminalinventar oder Auswahloberfläche.
Die bereits implementierte Auswahl ist eine Dienstschnittstelle.

Offen bleiben reale Konnektor-/SMC-B-/HSM-B-Interoperabilität, PIN-Betrieb,
Kartensignatur und -entschlüsselung, vollständige Profile, authentisierte
TI-Provisionierung, CareSuite-Host-/Versandintegration sowie unabhängige Prüfung
und Zulassung. Keine produktiven Daten oder echten Empfänger wurden verwendet.
Das FD-Inventar bleibt unverändert. [Prüfprotokoll](verification.md).

## Primärquellen

- [Festgeschriebene offizielle Schnittstellen](https://github.com/gematik/api-telematik/tree/31dd17b7dbe76ba6016318a2dfdd028e63598419): EventService.wsdl 7.2.0, EventService.xsd 7.2.1, CardService/CardServiceCommon/CardTerminalInfo und ProductInformation; am 22.10.2026 geprüft.
- [gemSpec_Kon 5.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_Kon/gemSpec_Kon_V5.28.0/): TIP1-A_4605-03, TAB_KON_565 GetCards und Kartentypen TAB_KON_500; Karten-Handles gelten für den Steckzyklus.
- [gemILF_PS](https://gemspec.gematik.de/docs/gemILF/gemILF_PS/latest/): 4.2.1.1 GetCards, 4.2.1.5 nicht authentisierte Karteninformationen, 4.2.3 Kartensitzung SM-B; geprüft am 22.10.2026.
- [Konnektor-Zertifikatsclient](konnektor-certificates.md) und [TSL-/OCSP-Prüfung](tsl-ocsp.md): bestehende Verträge und verbleibende Profilgrenzen.
