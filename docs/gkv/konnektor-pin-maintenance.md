# SMC-B: PIN initialisieren, ändern und entsperren

Stand: 22.10.2026. `maintainSmcbPin` ergänzt den bestehenden
[PIN-Vorbereitungsablauf](konnektor-pin.md) um drei ausdrücklich auswählbare
Verwaltungsaktionen. Die echte SOAP-/mTLS-Kommunikation und die Prüfketten sind
gegen lokale Gegenstellen mit synthetischen Karten-/Zertifikatsdaten geprüft.
Der Betrieb an einem physischen PIN-Pad oder Konnektor ist noch nicht nachgewiesen.

## Aktionen und Voraussetzungen

| Aktion | Frisch benötigter PIN-Zustand | Konnektoroperation | Eingaben am Terminal |
| --- | --- | --- | --- |
| `initialize` | TRANSPORT_PIN oder EMPTY_PIN | ChangePin | Initialisierung gemäß Karten-/Terminalprofil mit neuer PIN |
| `change` | VERIFIABLE oder VERIFIED | ChangePin | Bisherige und neue PIN |
| `unblock`, `setNewPin: false` | BLOCKED | UnblockPin | PUK; bisherige PIN bleibt bestehen |
| `unblock`, `setNewPin: true` | BLOCKED | UnblockPin | PUK und neue PIN |

Ein anderer aktueller Zustand führt zu `KIM_CONNECTOR_PIN_MAINTENANCE_STATE`.
Der Client wählt keine Ersatzaktion. Insbesondere wird eine gesperrte Karte
nicht über ChangePin behandelt und UnblockPin nicht vorsorglich ausgeführt.
Der Entsperrvorgang kann den begrenzten PUK-Nutzungszähler beanspruchen.

Die API enthält keine Geheimzahlen. PIN, alte/neue PIN und PUK werden weder
übergeben noch gespeichert, protokolliert oder in SOAP geschrieben. Unbekannte
Optionen, beispielsweise `pin`, `puk`, `oldPin`, `newPin` und `pinTyp`, werden
abgewiesen. Alle Operationen verwenden ausschließlich `PIN.SMC`. Das PIN-Pad
und ein etwaiges Remote-PIN-Routing bestimmt der Konnektor aus dem bereits
provisionierten Kontext. Die Bestätigung einer neuen PIN liegt im Terminalablauf.

Der unveränderte festgeschriebene CardService-8.1-Vertrag enthält bereits
ChangePin und UnblockPin. Der Client schreibt `SetNewPin` ausdrücklich als
`true` oder `false`; das optionale Schema-Default wird nicht verwendet.
Bei Initialize/Change ist diese Option verboten. Die vorhandenen
Schema-Hashes, mTLS-/Hostname-/Serverpin-Prüfungen und SOAP-/XML-Grenzen bleiben
verpflichtend. Nur die drei Terminaloperationen VerifyPin, ChangePin und
UnblockPin erhalten die gesonderte, auf höchstens 180000 ms begrenzte
`pinTimeoutMs`-Wartezeit. Der Gesamtworkflow bleibt auf 240000 ms begrenzt.

## Dienstschnittstelle

```js
import { maintainSmcbPin, assertMaintainedSmcbPin }
  from '../../services/kim/connector-pin.mjs';

const selection = {
  connector,
  statusClient,
  expectedTelematikId: configuration.institutionTelematikId,
  requiredRoles: configuration.institutionProfessionOids,
  iccsn: configuration.selectedSmcbIccsn,
  signal,
};

// Prüft Karte, Zertifikate und den zur Aktion passenden PIN-Zustand.
// Der Standard löst keinen Terminaldialog aus.
const inspection = await maintainSmcbPin({
  ...selection,
  action: 'unblock',
  setNewPin: false,
});

// Als eigene, ausdrückliche Benutzeraktion aufrufen. Keine Retry-Schleife.
const result = await maintainSmcbPin({
  ...selection,
  action: 'unblock',
  setNewPin: false,
  allowPrompt: true,
});

if (result.state === 'pin-maintained') {
  assertMaintainedSmcbPin(result, connector, statusClient);
}
```

Das Beispiel beschreibt zwei getrennte Aufrufe, die eine spätere Oberfläche
an Anzeige und Benutzeraktion binden muss. Die Lesestufe liefert
`pin-maintenance-required`, die gewählte Aktion und Karte, den aktuellen
`pinStatus` sowie `pinLeftTries`. Sie ist kein später wiederverwendbares
Ausführungsticket: Jeder tatsächliche Versuch beginnt mit neuen Prüfungen.
`allowPrompt` muss ein Boolean sein und ist standardmäßig false.

Die darunterliegenden Methoden sind `changeSmcbPin({status, mode, signal})`
und `unblockSmcbPin({status, setNewPin, signal})` am
`KonnektorCertificateClient`. Beide benötigen einen ursprünglichen aktuellen
Statusbeleg desselben Clients. `mode` ist ausdrücklich `initialize` oder
`change`; `setNewPin` ist bei UnblockPin ein verpflichtendes Boolean.
Diese Methoden liefern lediglich die gebundene Konnektorantwort. Erst der
Gesamtworkflow führt die Nachkontrollen durch.

## Ergebnis und Nachkontrollen

Vor der Terminalaktion wird die SMC-B frisch ausgewählt. Alle drei tatsächlichen
AUT-/ENC-/OSIG-Zertifikate müssen Einrichtung und Rollen entsprechen und die
lokalen TSL-/OCSP- sowie Konnektorprüfungen bestehen. Der Ausgangsstatus muss
zur gewählten Aktion passen. Genau ein ChangePin oder UnblockPin verbraucht
diesen ursprünglichen Statusbeleg. Automatische weitere Versuche und ein
anschließendes automatisches VerifyPin gibt es nicht.

Nach einer OK-Antwort werden Karte und alle drei Zertifikate neu gelesen und
geprüft. Kartenmerkmale einschließlich Seriennummer, Handle, Terminal,
Steckplatz, Einsteckzeit und Version sowie die exakten Zertifikat-Hashes müssen
zur ersten Auswahl passen. Ein zusätzlicher GetPinStatus muss einen regulären
Zustand VERIFIABLE oder VERIFIED liefern. Erst danach werden die neuen
Rohbelege, TSL-Bindungen, Konnektorbelege und der neue PIN-Status erneut geprüft.
Eine längere Terminaleingabe verlängert keinen alten Status- oder Zertifikatsbeleg.

| Ergebnis | Bedeutung |
| --- | --- |
| `pin-maintained` | Konnektor meldet OK; Karten-/Zertifikatsbezug und regulärer PIN-Zustand sind danach bestätigt |
| `pin-rejected` | Bisherige PIN wurde bei ChangePin zurückgewiesen; `leftTries` zählt PIN-Versuche |
| `pin-blocked` | ChangePin meldet eine vorherige oder neu eingetretene PIN-Sperre |
| `puk-rejected` | PUK wurde bei UnblockPin zurückgewiesen; `leftTries` zählt PUK-Versuche |
| `puk-blocked` | UnblockPin meldet eine gesperrte PUK oder eine solche Sperre ist in dieser Clientinstanz bereits für die ICCSN bekannt |

Bei PIN-Fehlversuchen ist ein Restzähler von 1–3 zulässig, bei PUK-Fehlversuchen
von 1–10. `retryCounter: pin` oder `retryCounter: puk` benennt die Bedeutung.
Der tatsächliche Wert stammt aus der Antwort. Ein GetPinStatus-Restzähler wird
niemals als verbleibende Zahl von PUK-Versuchen ausgegeben. Die Anzahl noch
möglicher erfolgreicher PUK-Verwendungen wird nicht aus einem Fehlversuchszähler
berechnet. Unbekannt bleibt unbekannt.
Ein Transport-/Leer-PIN-Status mit ausdrücklich null Restversuchen wird als
widersprüchlich abgewiesen und kann keine Initialisierung auslösen.

Ein durch UnblockPin gemeldetes WASBLOCKED/NOWBLOCKED wird in der Clientinstanz
an die ICCSN gebunden. Spätere GetPinStatus-Ergebnisse tragen für diese Karte
`pukState: blocked`; sonst steht dort `unknown`. Das ist eine lokal behaltene
Beobachtung einer UnblockPin-Antwort, keine zusätzliche PUK-Abfrage. Ein neuer
Karten-Snapshot löscht sie nicht. Ein weiterer Entsperrversuch derselben Karte
wird verhindert. Für andere Karten wird dieser Befund nicht übernommen. Ein
aus dem gespeicherten Befund erzeugtes `puk-blocked` erfindet keinen Restzähler
und liefert deshalb `leftTries: null`.

`requiresVerification` benennt beim fertigen Verwaltungsbeleg, ob zuletzt
VERIFIABLE statt VERIFIED beobachtet wurde. Auch bei VERIFIED gilt der Beleg
nur für diese Verwaltungsaktion. Er wird von `assertPreparedSmcbPin` nicht
als vorbereiteter Schlüsseloperationsbeleg akzeptiert. Alle Ergebnisse bleiben
`identityStatus: unverified` und `deliveryStatus: held-for-trust-validation`.
Es wird weder eine Signatur noch eine Authentisierung oder Entschlüsselung ausgeführt.

## Fehler nach einer möglicherweise wirksamen Änderung

Bei unterbrochener Verbindung, Zeitüberschreitung, SOAP-/XML-Fehler oder
PinResult ERROR ist der Ausgang konservativ unklar. Weitere PIN-Operationen
derselben Instanz bleiben wie im [PIN-Ablauf](konnektor-pin.md) gesperrt.
Ein lokaler Abbruch beendet einen entfernten Terminaldialog nicht nachweisbar.

Hat der Client bereits eine gültige OK-Antwort auf ChangePin/UnblockPin erhalten,
kann eine folgende Prüfung trotzdem scheitern. Beispielsweise kann die Karte
gezogen werden, ein Zertifikat abweichen oder die letzte Statusabfrage abbrechen.
Dieser Fall liefert `KIM_CONNECTOR_PIN_MAINTENANCE_UNCONFIRMED` mit:

- `operation`: ChangePin oder UnblockPin;
- `reportedPinResult: OK`: die bereits erhaltene Antwort;
- `causeCode`: der begrenzte lokale Grund der gescheiterten Nachkontrolle;
- ausschließlich numerischen `remoteCodes`, soweit vorhanden.

Der Host muss anzeigen, dass der Konnektor Erfolg gemeldet hat, die
Nachkontrolle aber nicht abgeschlossen werden konnte. Er darf weder eine
unveränderte alte PIN behaupten noch dieselbe Änderung automatisch wiederholen.
Eine bestätigte Nachkontrolle ist keine Voraussetzung dafür, dass die Karte
eine zuvor erfolgreich ausgeführte Änderung bereits gespeichert hat.
Es gibt keine behauptete Rücknahme der Kartenänderung.

## Gültigkeit und noch fehlender Betrieb

Prüfbelege sind nur als ursprüngliche Objekte an dieselben Konnektor- und
Statusclients gebunden. Kopien und vertauschte Clients scheitern. Spätere
Karten-/PIN-Abfragen, Ablauf, Abbruch, Schließen und TSL-Wechsel können sie
entwerten. Eine nachträgliche Entwertung ändert keinen bereits erfolgten
Kartenbefehl. Während einer Terminalaktion sperrt der Client alle weiteren
PIN-Operationen; Vorbereitung und Verwaltung teilen dieselbe Workflowsperre.
Dies ist weiterhin keine instanzübergreifende oder verteilte Terminalsperre.

Offen bleiben die Oberfläche, ein koordinierender Host mit dauerhaftem Umgang
mit unklaren Aktionen und PUK-Sperren, echte Karten-/PIN-Pad-/TI-Interoperabilität,
weitere Karten-/HSM-Profile und die Karten-Schlüsseloperationen. Physische
Entnahmeüberwachung und atomare Bindung an eine spätere Schlüsseloperation sind
nicht nachgewiesen. Die vorhandenen produktiven Sperren bleiben bestehen;
unabhängige Prüfung und Zulassung sind noch erforderlich.

## Primärquellen

- [Festgeschriebener CardService-Vertrag](https://github.com/gematik/api-telematik/tree/31dd17b7dbe76ba6016318a2dfdd028e63598419/conn): CardService WSDL/XSD 8.1.0 und CardServiceCommon 2.0.0.
- [gemSpec_Kon 5.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_Kon/gemSpec_Kon_V5.28.0/): TIP1-A_4588, TAB_KON_049 ChangePin; TIP1-A_4590, TAB_KON_053 UnblockPin und SetNewPin; TUC_KON_019/TUC_KON_021.
- [gemILF_PS](https://gemspec.gematik.de/docs/gemILF/gemILF_PS/latest/): 4.1.5.1–4.1.5.3, TIP1-A_4972, TIP1-A_6460/6461; Initialisierung, Änderung und auf bestätigte Sperren begrenzte Entsperrung, geprüft am 22.10.2026.
