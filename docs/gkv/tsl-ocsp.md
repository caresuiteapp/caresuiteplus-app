# TSL-gebundene Statusprüfung im KIM-Empfang

Stand: 22.10.2026. `TslOcspStatusClient` verbindet den laufenden
[TSL-Aktualisierungsdienst](tsl-refresh.md) mit dem dauerhaften OCSP-Cache.
Für ein Nachrichtenzertifikat wählt er die Statusadresse aus dem passenden
CA-Diensteintrag der geprüften TSL. `receiveEccKimMessageWithTsl` verwendet
diesen Weg für die OSIG- und AUT-Belege des bestehenden lokalen Empfangsberichts.

## Vertrauens- und Routenauswahl

Der unterstützte Weg ist die **TI-nonQES-Statusprüfung** gemäß TUC_PKI_003 bis
TUC_PKI_006. Er unterscheidet sich von der Internet-AIA des TSL-Signierers:

| Zertifikat / Aufgabe | Herkunft der Statusadresse |
| --- | --- |
| TSL-Signierer beim Internet-Listenabruf | Authentisierte AIA; vorhandener `TslSignerStatusSource`, siehe A_30044 |
| Nachrichtenzertifikat im neuen TI-nonQES-Pfad | `ServiceSupplyPoint` des passenden CA/PKC-Dienstes der geprüften TSL |
| OCSP-Signierer | Autorisierte Dienstidentität aus der geprüften TSL; dessen eigene Service-URL ersetzt die CA-Statusadresse nicht |

`manager.current().ocspPlanFor(certificate, { model, policyList })` verlangt eine
nichtleere erlaubte Zertifikatstypliste und prüft sie gegen Blatt und
CA-ExtensionOIDs. [Typprüfung und Umstellung bisheriger Aufrufe](certificate-types.md).
Die Methode liefert einen geschützten
Prüfer, DER-Zertifikatkopie, Zertifikat-/Ausstellerhash, OCSP-Anfrage und die
kanonisierten CA-Statusadressen. Das Blatt muss aktuell, kein CA-Zertifikat und
tatsächlich von genau einer passenden aktuellen CA signiert sein. Ausstellername,
KeyUsage sowie AuthorityKeyIdentifier/SubjectKeyIdentifier müssen passen.
Fehlende oder widersprüchliche Schlüsselkennungen geben keinen Pfad frei.

Standardmäßig werden nur aktive CA-Dienste verwendet. Das ausdrücklich gewählte
Modell `nonqes-compromise` kann einen gesperrten CA-Dienst nur für Zertifikate
verwenden, deren notBefore vor dessen StatusStartingTime liegt. Es ist keine
historische QES-Validierung. Aktuelle Zertifikats- und Snapshotfristen bleiben
auch in diesem Modell verbindlich.

Der Client verlangt genau eine passende vorkonfigurierte Route. Mehrere signierte
CA-Adressen sind nur dann verwendbar, wenn genau eine konfigurierte Route dazu
passt. Keine Übereinstimmung oder zwei passende Routen führen zum Fehler.
Fehlende Adressen, Duplikate, Zugangsdaten, Fragmente und andere Protokolle als
HTTP(S) werden abgelehnt. Eine Leaf-AIA, ein vom Aufrufer geliefertes `good` oder
ein eingebettetes Responderzertifikat kann keinen alternativen Weg eröffnen.
Es gibt keine automatische Anlage einer Route und keinen Backup-Fallback.

## Verwendung im vorhandenen Diensthost

```js
import { OcspHttpTransport } from '../../services/kim/ocsp-http.mjs';
import { TslOcspStatusClient } from '../../services/kim/tsl-ocsp.mjs';
import { receiveEccKimMessageWithTsl } from '../../services/kim/receive-tsl.mjs';

// manager ist der laufende TslRefreshManager aus tsl-refresh.md.
// Konfiguration, Schlüssel und stabile UUIDs kommen aus dem Diensthost.
const statusClient = new TslOcspStatusClient({
  manager,
  environment: manager.environment,
  path: configuration.absoluteStatusDatabasePath,
  key: storageKey, // 32 Bytes; getrennt vom geschützten lokalen Volume
  scopeId: configuration.stableStatusClientUuid,
  routes: [{
    transport: new OcspHttpTransport({
      url: configuration.caOcspUrl,
      timeoutMs: 10_000,
    }),
    scopeId: configuration.stableCaStatusCacheUuid,
  }],
  model: 'current',
  timeoutMs: 10_000,
  maxEntriesPerRoute: 256,
  maxBytesPerRoute: 67_108_864,
});

try {
  const result = await receiveEccKimMessageWithTsl(
    messageOptions, // gespeicherte Originalbytes, Schlüssel und erwartete Zertifikate
    diagnosticOptions,
    { statusClient, signal },
  );
  // result bleibt eine lokale Empfangsausgabe; keine Versand-/Zustellfreigabe.
} finally {
  statusClient.close();
}
```

Der Host hält den Client normalerweise über mehrere Nachrichten hinweg offen.
Der Konstruktor legt nur die geschützte Ablage an und prüft ihre Konfiguration;
er startet weder einen Listener noch einen TSL-Abruf. Ohne aktuellen Managerstand
gibt es keinen Statusabruf. Schlüssel, vertrauenswürdige Anker, TLS-Konfiguration
und erreichbare TI-Routen müssen separat bereitgestellt werden.

`check({ certificate, purpose, signal })` benötigt einen ausdrücklichen Zweck
(`signing`, `authentication`, `encryption` oder `directory-server`) und liefert einen tatsächlich geprüften Status mit
eigenen Anfrage-/Antwortkopien, geschütztem Prüfer, Routenhash und TSL-Version.
`certificateTypeOid` nennt die mit Blatt und CA-Freigabe abgeglichene Typkennung.
`admission` enthält die zum Zertifikatstyp geprüften Rollen und die eindeutige
Telematik-ID aus dem signierten Blatt. Fehlende oder widersprüchliche Angaben
blockieren auch einen vorhandenen positiven Cachebeleg vor dessen Verwendung.
`trustSource` lautet hier `configured-tsl-anchors`; auch ein `good` bleibt
`identityStatus: unverified`.

Der Zweck `directory-server` verwendet stattdessen
`directoryServerOcspPlanFor`: C.ZD.TLS-S, technisches VZD-Admission ohne
Telematik-ID und das begrenzte ECC-Serverprofil werden vor dem Cachezugriff
verlangt. Der CA-Pfad bleibt hier immer `current`, auch wenn der Client für
Nachrichtenzertifikate das Kompromissmodell verwendet.
[Ablauf am tatsächlichen TLS-Peer](vzd-server-certificate.md).

`messageEvidence({ signingCertificate, authenticationCertificate, signal })`
bereitet beide Pfade gegen denselben geschützten Listenstand vor, bevor eine
Statusanfrage beginnt. Ein einzelner Transportfehler erhält den gültigen Beleg
der anderen Rolle. Fehler werden als feste Codes pro Rolle zurückgegeben;
ein ungültiger globaler Listenstand gibt dagegen kein Belegpaar frei.

## Dauerhafte Belege und Responderwechsel

Die verschlüsselte Konfigurationsbindung umfasst Umgebung, Listenprofil,
Ankerbindung, Validierungsmodell, Quoten, Timeout und die festen Routen samt
Cache-UUIDs. Jede Route hat einen eigenen Cache-Namespace. Ein anderer
Client-Namespace kann diese reservierten UUIDs nicht übernehmen. Änderungen der
Konfiguration brauchen ausdrücklich neue Namespaces. Vor jedem Vorgang werden
Konfigurationsbindung und Zuordnung erneut geprüft.

Ein Cachezugriff verwendet den **aktuellen geschützten Prüfer des Aufrufs**,
auch nach einem Neustart oder einem Listenupdate. Wartende Aufrufer prüfen das
gemeinsam beschaffte Ergebnis ebenfalls mit ihrem eigenen Prüfer. Ein Wechsel
während des Abrufs kann deshalb keine Freigabe mit einem alten Handle erzeugen.
Nach erfolgreicher neuer Listenprüfung dürfen unveränderte Rohbelege erneut
verwendet werden, sofern ihre Signatur, Autorisierung und Fristen noch passen.

Neue Cacheeinträge enthalten zusätzlich den Hash des tatsächlich verifizierten
Responderzertifikats innerhalb der authentisiert verschlüsselten Nutzdaten.
Ist dieser Responder in der aktuellen Liste nicht mehr zugelassen, darf der
Client den zugehörigen alten Beleg entfernen und einen neuen abrufen. Eine
Antwort vom entfernten Schlüssel bleibt dabei unzulässig, auch bei gleichem
Respondernamen. Bei überlappenden Namen mehrerer gelisteter Responder entscheidet
die tatsächliche Signaturprüfung mit den bereits autorisierten Schlüsseln;
kein oder mehr als ein verifizierender Schlüssel gibt keinen Beleg frei.

Manipulierte Verschlüsselung, ungültige Signaturen und andere Prüffehler sind
kein Anlass für diese Erneuerung. Solange der Responder autorisiert und der
Beleg aktuell ist, werden auch `revoked` und `unknown` aus dem Cache übernommen;
sie werden nicht für eine erneute Suche nach einem positiven Status verdrängt.

**Kompatibilität:** Alte verschlüsselte `{request,response}`-Einträge bleiben
lesbar und werden vollständig geprüft. Fehlt die neue Respondermetadatenbindung
bei einem gleichnamigen Schlüsselwechsel, scheitert der alte Beleg mit einem
Signaturfehler bis zu seinem Ablauf; es gibt keinen automatischen Vertrauens-
Fallback. Ältere Programmstände können neue Einträge mit `responderSha256` nicht
lesen. Daher keine gemischten alten/neuen Cache-Schreiber betreiben und bei einem
Programmrollback diesen Formatunterschied berücksichtigen. Eine allgemeine
Schlüssel-/Speichermigration ist damit nicht implementiert.

Die bestehenden Cachegrenzen gelten weiter: verschlüsselte Rohbelege, erneute
Signatur-/CertID-/certHash-/Zeitprüfung, Prozess-Claims, Quoten und vier
Protokollfehlerversuche mit dauerhaftem fünfminütigem Backoff. Die hier verwendete
producedAt-Frist bleibt eine Stunde gemäß dem bereits implementierten aktuellen
nonQES-Pfad. Details und die Grenzen dieser Teilregel stehen in
[ocsp.md](ocsp.md) und [ocsp-online.md](ocsp-online.md).

## Empfang, Abbruch und Lebensdauer

Die asynchrone Empfangsfunktion kopiert Originalbytes, Zertifikatbytes und
Berichtsoptionen vor dem ersten Warten. Sie prüft zuerst Format, ECC-CMS und
Headerbindung. Ungültige Berichtsoptionen oder Fehler in diesen Prüfungen
lösen keine Statusanfrage aus. Ohne Verzeichnis wird auch AUT vor beiden
Statusanfragen geprüft. Unverschlüsselte Nachrichten bleiben im vorhandenen
unveränderten Durchreichpfad.

Vor der Netzabfrage wird der zwischenzeitlich entschlüsselte Nachrichtenpuffer
überschrieben. Nach dem Abruf prüft der bestehende synchrone Empfänger die
Originalnachricht und die jeweils erforderlichen Rohbelege erneut. Vorgegebene Statusflags werden
nicht übernommen. Das Ergebnis enthält zusätzlich `statusAcquisition` mit
`checked`, `incomplete` oder `unavailable`, festen Fehlercodes und gegebenenfalls
der TSL-Version, den geprüften `certificateTypes` und den getrennten
`certificateAdmissions` für OSIG/AUT. Diese Attribute bestätigen keine
VZD-Adresszuordnung. Die eigentlichen Befunde
stehen weiterhin im Empfangsbericht.

Seit 22.10.2026 ergänzt die optionale `directory`-Konfiguration den
[LDAPS-/Adressabgleich](vzd.md) nach positivem OSIG-Status. Der
[bedingte AUT-Zweig](conditional-aut-receive.md) fragt AUT nur bei abweichender
OSIG-/VZD-ID ab. Dazu wird das tatsächliche x5c-Leaf aus dem signierten Token
verwendet; ein erwartetes AUT-Leaf ist ein zusätzlicher optionaler Pin.
`authenticationAssessment` unterscheidet nicht erforderlich, geprüft, abgelehnt
und nicht geprüft. Statusbericht und Zertifikatsattribute enthalten nur
tatsächlich geprüfte Rollen. `directoryAcquisition` weist Treffer, Widerspruch
und fehlenden Nachweis aus. Vor der abschließenden Diagnose werden OSIG,
gegebenenfalls AUT sowie der private VZD-Serverbeleg erneut geprüft. Ein
TSL-Wechsel oder Ablauf während LDAP/AUT-OCSP erhält keinen alten Erfolg.
Der gesamte Verzeichnis-Empfangszweig hat zusätzlich eine Frist von 30 Sekunden.

Auch alle erforderlichen positiven Belege ergeben weiterhin Diagnose 07. Gesperrte, unbekannte
oder nicht verfügbare Belege erzeugen `XCS_CERT_STATUS`; Klartextanhänge sind
standardmäßig aus. Es wird weder eine normale Zustellung noch ein SMTP-Versand
oder Rechnungsstatuswechsel ausgelöst.

Ein Abbruch beendet den wartenden Aufruf ausdrücklich. Eine gemeinsam benutzte
Cacheabfrage darf für andere Aufrufer innerhalb ihrer Frist weiterlaufen.
`close()` beendet dagegen die vom Client gehaltenen Caches und gibt deren Claims
frei. Externe Manager und Stores bleiben Eigentum des Hosts. Grenzen: 16 Routen,
maximal 4096 Einträge und 64 MiB rohe Belegbytes je Route, 30 Sekunden je
Cachevorgang. Quoten sind keine Begrenzung der gesamten SQLite-/WAL-Dateigröße.

## Nachweise und verbleibende Integration

Die ursprünglichen 38 Prüfungen verwenden eine lokale HTTPS-Gegenstelle, echte signierte
TSL-/OCSP-Bytes, die vollständige XSD-Prüfung, verschlüsselte SQLite-Ablage und
eine tatsächlich ECC-verschlüsselte KIM-Nachricht. Sie prüfen insbesondere
Adressherkunft, fehlende/mehrdeutige Routen, Schlüsselkennungen, Responderwechsel
einschließlich gleicher Namen, Cachekompatibilität, negative Befunde,
Manipulation, Neustart, konkurrierende Zugriffe, Listenwechsel während einer
Abfrage, Quoten, Timeout und Abbruch. Die anschließende Typprüfung ergänzt
gezielte Fälle zu CA-Freigaben und deren Entzug. Der aktuelle Gesamtlauf ist in
[verification.md](verification.md) dokumentiert. Weitere vier Integrationstests
belegen die [Admission-Prüfung](certificate-admission.md) vor Statusanfragen,
auch gegen ältere positive Cachebelege und nach Listenwechsel.

Keine Abfrage echter TI-Dienste und kein Echtversand. Noch offen bleiben
authentisierte TI-Ankerbereitstellung/-rotation, vollständige Rollen-/Policy-
und Identitätsprüfung, vollständige VZD-Serverprofile/TI-Anbindung, Konnektor/SMC-B, produktiver Diensthost,
vollständiges Clientmodul und Fachdienst sowie unabhängige Prüfung/Zulassung.
Der Dienst benötigt die bestehenden Laufzeiten und ein geschütztes dauerhaftes
lokales Volume; Vercel-Funktionen mit flüchtigem Speicher ersetzen diesen Host
nicht. Das FD-Inventar bleibt bei 106 Kennungen: 28 teilweise lokal belegt,
78 offen.

## Primärquellen

- [gemSpec_PKI 2.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_PKI/gemSpec_PKI_V2.28.0/): TUC_PKI_003–006, GS-A_4654-01, GS-A_4655, GS-A_4656, GS-A_4657-03; A_23225 und Abgrenzung zu A_30044. Geprüft am 21.10.2026.
- [gemKPT_PKI_TIP 2.14.0](https://gemspec.gematik.de/docs/gemKPT/gemKPT_PKI_TIP/gemKPT_PKI_TIP_V2.14.0/): insbesondere §6.4–6.5 zur TI-Statusadresse und zu autorisierten OCSP-Signierern.
- [gemSpec_TSL](https://gemspec.gematik.de/docs/gemSpec/gemSpec_TSL/latest/): CA-/OCSP-Dienstidentitäten und ServiceSupplyPoints; geprüft am 21.10.2026.
