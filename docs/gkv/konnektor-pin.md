# SMC-B: PIN-Status und Terminalfreischaltung

Stand: 22.10.2026. Der eigene Client implementiert `GetPinStatus` und `VerifyPin`
über CardService SOAP 1.1/mTLS. `prepareSmcbPin` verbindet sie mit der bestehenden
Karten-, Zertifikats-, TSL- und OCSP-Prüfung. Geprüft wurde gegen lokale
Gegenstellen mit synthetischen Zertifikaten. Eine echte SMC-B, ein PIN-Pad und
ein zugelassener Konnektor wurden damit noch nicht bedient.

Die Dienstschnittstelle führt keine Karten-Signatur, Entschlüsselung oder
Authentisierung aus. Auch ein Ergebnis `pin-verified` bleibt
`identityStatus: unverified` und `deliveryStatus: held-for-trust-validation`.
Es gibt noch keine zugehörige Bedienoberfläche oder produktive Versandfreigabe.

## Vertrag und Konfiguration

Der festgeschriebene Vertrag ist CardService WSDL/XSD 8.1.0 aus
`gematik/api-telematik`, Commit `31dd17b7dbe76ba6016318a2dfdd028e63598419`.
Die WSDL wurde zu den bereits vorhandenen XSDs ergänzt; Manifest und Dateien
werden vor jeder XML-Prüfung per SHA-256 geprüft. Nur Zeilenenden und die letzte
Zeilenschaltung wurden normalisiert. Keine Schemaeinschränkung wurde gelockert.

`KonnektorCertificateClient` erhält zusätzlich `cardServiceUrl`. Dieser feste
HTTPS-Endpunkt muss denselben Origin wie `url` für CertificateService besitzen.
CA, Hostname, Serverpin, mTLS-Identität und der unveränderliche Kontext bleiben
verpflichtend. Ein fehlender CardService wird weder durch CertificateService
ersetzt noch automatisch gesucht. Requests enthalten genau `Context`,
`CardHandle` und `PinTyp=PIN.SMC` mit der offiziellen SOAPAction. Die PIN selbst
ist kein API-Parameter. Unbekannte Optionen wie `pin`, `puk` oder `pinTyp`
werden abgewiesen; die sichere Eingabe wird allein über VerifyPin angefordert.
Welches PIN-Pad benutzt wird, bestimmt der Konnektor aus seinem Kontext und
seiner Terminalkonfiguration, auch bei Remote-PIN-Eingabe.

```js
const connector = new KonnektorCertificateClient({
  ...provisionedCertificateConfiguration,
  eventServiceUrl: configuration.eventServiceHttpsUrl,
  cardServiceUrl: configuration.cardServiceHttpsUrl,
  timeoutMs: 10000,
  pinTimeoutMs: 120000,
});

const result = await prepareSmcbPin({
  connector,
  statusClient,
  expectedTelematikId: configuration.institutionTelematikId,
  requiredRoles: configuration.institutionProfessionOids,
  iccsn: configuration.selectedSmcbIccsn,
  allowPrompt: false,
  signal,
});
```

Die Imports liegen in `services/kim/connector-certificates.mjs` sowie
`services/kim/connector-pin.mjs`. `allowPrompt: false` ist der Standard.
Eine spätere Oberfläche darf einen neuen Aufruf mit `allowPrompt: true` nur
als ausdrückliche Benutzeraktion auslösen. Ein fehlgeschlagener Versuch darf
keine Wiederholungsschleife auslösen. Der Restversuchszähler muss vor einer
weiteren ausdrücklich gewünschten Eingabe sichtbar sein.

`timeoutMs` bleibt auf 50–30000 ms beschränkt. Ausschließlich VerifyPin darf
mit `pinTimeoutMs` 50–180000 ms laufen; Standard sind 120000 ms. Diese Grenzen
sind lokale Laufzeitentscheidungen, keine zugesagten Terminalfristen. Der
gesamte Vorbereitungsablauf endet spätestens nach 240000 ms. Ein XML-Worker
behält seine bisherige Frist von fünf Sekunden. Die kurze Gültigkeit von
Kartenauswahl und Statusbelegen wird durch die längere Eingabezeit nicht verlängert.

## Ablauf und Ergebnisse

1. `readAndVerifySmcb` wählt die SMC-B frisch aus, prüft ihre tatsächlichen
   AUT-/ENC-/OSIG-Zertifikate gegen Einrichtung, Rollen, lokale TSL-/OCSP-Belege
   und VerifyCertificate und bestätigt die Kartensitzung erneut.
2. GetPinStatus liest `PIN.SMC` für genau diese ursprüngliche Auswahl.
   Technischer Aufruferfolg und PIN-Zustand werden getrennt ausgewertet.
3. Nur `VERIFIABLE` und `allowPrompt: true` erlauben einen einzelnen VerifyPin-
   Aufruf. Ein bereits verifiziertes, gesperrtes oder noch nicht initialisiertes
   PIN-Objekt löst keinen Eingabeversuch aus.
4. Nach VerifyPin `OK` wird der vollständige Karten-/Zertifikatsablauf erneut
   ausgeführt. ICCSN, Terminal und Steckplatz werden aus der ersten Auswahl
   festgehalten. Alle Kartenmerkmale einschließlich Einsteckzeit und Version
   sowie alle drei Zertifikat-Hashes müssen unverändert sein.
5. Ein zusätzlicher GetPinStatus muss jetzt `VERIFIED` melden. Danach werden
   die neuen Rohbelege, TSL-Bindungen und privaten Konnektorbelege erneut geprüft.

| Rückgabe | Bedeutung | Weiteres Verhalten |
| --- | --- | --- |
| `pin-verified` | Frische Zertifikats- und PIN-Beobachtungen vorhanden | Weiterhin gesperrte Vorbereitung; keine Schlüsseloperation ausgeführt |
| `pin-required` | Echt-PIN noch nicht verifiziert, kein Eingabeversuch erlaubt | `leftTries` anzeigen; weitere Aktion ausdrücklich auslösen |
| `pin-rejected` | Der einzelne Versuch wurde als falsche PIN zurückgewiesen | Restversuche anzeigen; keine automatische Wiederholung |
| `pin-blocked` | GetPinStatus BLOCKED oder VerifyPin WASBLOCKED/NOWBLOCKED | Kein weiterer VerifyPin-Versuch |
| `pin-initialization-required` | Transport- oder Leer-PIN | Initialisierung ist hier noch nicht implementiert |

Bei `VERIFIABLE` und `REJECTED` müssen 1–3 Restversuche vorliegen. BLOCKED
verlangt 0; WASBLOCKED/NOWBLOCKED dürfen keinen positiven Restzähler enthalten.
VERIFIED/OK mit widersprechendem Restzähler, fehlender Status, fremde Operationen,
Namespaces, doppelte Elemente und unbekannte Werte scheitern. PinResult ERROR
benötigt einen strukturierten Fehler und erzeugt nur einen festen Fehlercode
sowie begrenzte numerische Remote-Codes. Fremde Fehlermeldungen werden verworfen.

Das allgemeine Konnektordokument nennt auch DISABLED für andere PIN-Profile.
Der hier gebundene CardService-8.1-Vertrag enthält diesen Enum-Wert nicht.
Er wird deshalb nicht als VERIFIED umgedeutet. Weitere Schema-/Kartenprofile
müssen ausdrücklich ergänzt und mit passenden Originalverträgen geprüft werden.

## Belegbindung und Unterbrechung

`getSmcbPinStatus({selection, signal})` akzeptiert nur die ursprüngliche,
frische SMC-B-Auswahl desselben Clients. Ein privater Beleg bindet die Antwort
an Auswahl, Endpunkt, Kontext, Generation, Zeit und Abbruchsignal.
`verifySmcbPin({status, signal})` verbraucht den ursprünglichen VERIFIABLE-
Beleg beim Start. Eine Kopie, ein anderer Client oder ein später bereits
ersetzter Status kann damit keinen Terminalversuch starten.

Während VerifyPin sperrt der Client weitere PIN-Operationen. Parallel gestartete
Vorbereitungen werden ebenfalls abgewiesen. Auch eine fehlgeschlagene neuere
Statusabfrage entwertet ältere PIN-Belege. Ein veraltetes Ergebnis, das zuletzt
eintrifft, kann eine neue Abfrage nicht überschreiben. Eine gleichzeitig laufende
Kartenaktualisierung entwertet den bisherigen Kartenbezug des PIN-Versuchs.

Nach Zeitüberschreitung, Abbruch, SOAP-/Transport-/XML-Fehler oder PinResult ERROR
ist der Ausgang konservativ unklar. Der Client sperrt weitere PIN-Aufrufe mit
`KIM_CONNECTOR_PIN_OUTCOME_UNKNOWN`. Es gibt keine automatische Rücksetzung.
Ein Betreiber muss zunächst am Terminal/Konnektor klären, dass der alte Dialog
beendet ist; erst danach darf der Host einen neuen Client und einen vollständig
neuen Prüfablauf anlegen. `close()` beendet lokale Arbeit, aber ist kein
CardService-Befehl zum Abbruch eines entfernten Dialogs oder zur Abmeldung der
Karte. Eine lokale Unterbrechung hebt eine möglicherweise bereits erfolgte
PIN-Freischaltung auf der Karte nicht nachweisbar auf.

Diese Sperre gilt pro Clientinstanz; sie ist keine verteilte Terminalsperre.
Der noch zu integrierende Host muss einen gemeinsamen Besitzer je
Konnektor/Kartensitzung sicherstellen und Neustarts sowie andere Primärsysteme
berücksichtigen. Mehrere unabhängig erstellte Clients sind kein zulässiger
automatischer Wiederholungsmechanismus.

Für den fertigen Vorbereitungsbeleg gilt:

```js
if (result.state === 'pin-verified') {
  assertPreparedSmcbPin(result, connector, statusClient);
  // Die eigentliche Karten-Schlüsseloperation und ihre atomare Bindung fehlen noch.
}
```

`assertPreparedSmcbPin` akzeptiert nur das ursprüngliche Ergebnis und dieselben
beiden Clients. Es bewertet den intern gehaltenen Prüfablauf erneut; eine
kopierte Funktion oder behauptete Zeichenkette ersetzt den Beleg nicht.
Abbruch, Ablauf, Karten-/PIN-Aktualisierung, Schließen oder TSL-Wechsel verhindern
eine spätere Verwendung. Eine physische Entnahme ohne neue Abfrage bleibt eine
Grenze der Momentaufnahme. Die spätere Schlüsseloperation muss selbst ihren
Kontext und Kartenbezug prüfen.

## Offene Nachweise

Echte Hardware-/TI-Interoperabilität, PIN-Pad-Bedienung, Remote-PIN-Routing,
Transport-PIN-Initialisierung, ChangePin/UnblockPin, HSM-B-/weitere Profile,
Karten-Schlüsseloperationen, Ereignisüberwachung, Oberfläche und Hostintegration
bleiben offen. Keine produktiven Daten, Empfänger oder Terminalversuche wurden
verwendet. Die unabhängige Prüfung und Zulassung sind damit nicht ersetzt.
Das Fachdienstinventar bleibt bei 106 Kennungen, davon 28 teilweise umgesetzt
und 78 offen. Die lokalen Nachweise stehen in [verification.md](verification.md).

## Primärquellen

- [CardService WSDL am festgeschriebenen Commit](https://github.com/gematik/api-telematik/blob/31dd17b7dbe76ba6016318a2dfdd028e63598419/conn/CardService.wsdl), zugehörige CardService-/CardServiceCommon-XSDs.
- [gemSpec_Kon 5.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_Kon/gemSpec_Kon_V5.28.0/): TIP1-A_4587 VerifyPin, TIP1-A_4589 GetPinStatus, TAB_KON_047, TAB_KON_051 und TUC_KON_022.
- [gemILF_PS](https://gemspec.gematik.de/docs/gemILF/gemILF_PS/latest/): PIN-Handling, technischer Erfolg trotz falscher/gesperrter PIN und Remote-PIN-Konfiguration; geprüft am 22.10.2026.
- [gemSpec_CM_KOMLE](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/): Nachrichtenversand über SM-B, GetPinStatus und gegebenenfalls VerifyPin vor SignDocument; geprüft am 22.10.2026.
