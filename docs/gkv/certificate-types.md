# Zertifikatstyp und Ausstellungsberechtigung der CA

Stand: 21.10.2026. Der KIM-Empfang gleicht den erwarteten Zertifikatstyp mit der
CertificatePolicies-Erweiterung des Zertifikats und den ExtensionOIDs seiner
ausstellenden CA in der geprüften TSL ab. Dies ergänzt den bisherigen Signatur-,
Aussteller-, AKI/SKI- und Statuspfad um die Typprüfung nach TUC_PKI_007.

## Unterstützte Verwendungszwecke

Der Statusclient verlangt bei einzelnen Abfragen einen ausdrücklichen `purpose`.
Die Zuordnung stammt aus `gemSpec_OID`, Tab_PKI_405, und ist im Dienstcode
unveränderlich hinterlegt.

| purpose | Zertifikatstyp | Typ-OID |
| --- | --- | --- |
| signing | C.HCI.OSIG | 1.2.276.0.76.4.78 |
| authentication | C.HP.AUT | 1.2.276.0.76.4.75 |
| authentication | C.HCI.AUT | 1.2.276.0.76.4.77 |
| encryption | C.HP.ENC | 1.2.276.0.76.4.74 |
| encryption | C.HCI.ENC | 1.2.276.0.76.4.76 |

```js
const proof = await statusClient.check({
  certificate: osigCertificate,
  purpose: 'signing',
  signal,
});
// proof.certificateTypeOid enthält den tatsächlich geprüften Typ.
```

`messageEvidence()` setzt die Zwecke für OSIG und AUT selbst. Beide Typ- und
Routenprüfungen müssen vor der ersten Statusanfrage erfolgreich sein. Ein
fehlender Zweck, ein falscher Typ oder eine nicht dafür autorisierte CA erzeugt
keine Statusanfrage und erlaubt keinen Cachezugriff. Der bestehende asynchrone
Empfänger übernimmt die geprüften Typen in `statusAcquisition.certificateTypes`.

## Auswertung der signierten TSL

Der vorhandene XML-Worker liest ausschließlich direkte `ExtensionOID`-Kinder
der `Extension`-Einträge unter `ServiceInformationExtensions` im TSL-Namespace.
Die Originalbytes durchlaufen weiterhin separate und eingebettete Signatur,
fest gebundenes XSD, Signiererstatus und Versionskontrolle.

Eine erkannte OID benötigt das zugehörige `ExtensionValue` oder
`ExtensionValues`. Zahlen müssen in kanonischer Punktnotation vorliegen.
Doppelte OIDs, unzulässige Arcs, fehlende Partnerwerte und widersprüchliche
Strukturen werden abgelehnt. Unbekannte nichtkritische Erweiterungen bleiben
unberücksichtigt. Kritische Erweiterungen sind im bisherigen unterstützten
TSL-Profil weiterhin unzulässig.

Die numerische OID autorisiert den Typ. Ein passendes Textetikett wie
`oid_smc_b_osig`, eine OID in einem fremden Namespace oder in einem verschachtelten
Wert kann dies nicht ersetzen. `ExtensionValues` bleibt ein begrenzter, opaker
komplexer Wert; darin enthaltene Kennungen werden nicht als weitere Freigaben
übernommen. Die Zuordnung gilt ausschließlich für den passenden ausstellenden
CA/PKC-Dienst. Ein OCSP-Diensteintrag kann einer CA keine Typfreigabe erteilen.

Grenzen je Dienst: 128 Erweiterungen, 256 Zeichen und höchstens 32 Arcs pro OID,
Arcs bis 2^63−1. Für opake komplexe Werte gelten höchstens 256 XML-Knoten sowie
die bereits bestehenden Größen-/Tiefengrenzen des Workers. Diese Grenzen sind
Implementierungsgrenzen, keine vollständige Abbildung aller möglichen Profile.

## Zertifikatsauswertung und Schnittstellen

`certificate-policy.mjs` liest die tatsächlichen DER-PolicyInformation-Einträge.
Die erlaubte Liste muss 1–16 unterschiedliche kanonische OIDs enthalten. Es
darf genau ein Typ aus dieser Liste passen. Doppelte Policy-OIDs und mehrere
der unterstützten KIM-Typen im selben Zertifikat werden abgewiesen.

Policy-Qualifiers am Zertifikatstyp sind gemäß GS-A_4718 unzulässig. Bei anderen
Policy-OIDs werden begrenzte Qualifier-Strukturen angenommen, ihre Inhalte
begründen aber keine weitere Berechtigung; CPS-URLs werden nicht aufgerufen.
Nichtminimale oder unvollständige DER-OIDs, angehängte Bytes, ungültige
Strukturen und Größenüberschreitungen scheitern mit festen Fehlercodes.
Grenzen: 4 KiB Policy-Erweiterung, 32 Policy-Einträge und 16 Qualifiers je Eintrag.

Der gemeinsame Parser wird auch von ECC-CMS und AUT verwendet. Die dortigen
Schlüssel-, KeyUsage- und Nachrichtenprüfungen bleiben Voraussetzung. Eine
Ausstellungsrichtlinie wie `1.2.276.0.76.4.163` ersetzt die Typ-OID nicht.
Die Vollständigkeit aller Ausstellungsrichtlinien und deren inhaltliche
Einhaltung werden durch diesen Parser nicht bescheinigt.

`manager.current().certificateTypeFor(certificate, { policyList, model })`
liefert Typ, Blatt-/CA-Hash und begrenzte Vertrauensmetadaten. Die Liste muss
serverseitig vorgegeben sein. `ocspPlanFor()` benötigt nun ebenfalls
`policyList` und führt diesen Abgleich vor der Routenwahl aus. Ein altes
Manager-Handle scheitert nach Listenwechsel. Der niedrigere Baustein
`ocspVerifierFor()` bleibt ein Statussignaturprüfer; sein Ergebnis allein
belegt keine Typprüfung eines beliebigen weiteren Zertifikats.
Die folgende [Admission-Erweiterung](certificate-admission.md) prüft nun auch
Rollenfamilie und Telematik-ID im Statusplan. `certificateTypeFor()` allein
bleibt ausdrücklich eine Typprüfung.

## Cache, Umstellung und Grenzen

`TslOcspStatusClient.check({ certificate, purpose, signal })` ersetzt den
bisherigen Aufruf ohne Zweck. Fehlendes `purpose` liefert einen festen
Konfigurationsfehler. Die vorhandenen Empfangsaufrufe über `messageEvidence()`
brauchen keine zusätzlichen Parameter. Direkte Nutzer von `ocspPlanFor()`
müssen eine nichtleere erlaubte Typliste übergeben.

Eine aktive TSL ohne passende CA-ExtensionOID gibt keinen neuen Typprüfpfad
frei. Bereits gespeicherte XML-/OCSP-Originale bleiben verwendbar, werden aber
beim Laden beziehungsweise vor jeder Verwendung gegen die aktuelle Typfreigabe
geprüft. Entzug der Freigabe blockiert auch einen zuvor positiven Cachebeleg.
Eine während des HTTP-Abrufs geänderte Liste verhindert dessen spätere Freigabe.
Es wurde kein zusätzliches Speicherformat eingeführt.

40 neue Fälle ergänzen die bisherige Suite: **418 Prüfungen bestanden**.
Die Tests verwenden echte Zertifikatssignaturen, vollständige TSL-Signatur- und
XSD-Prüfung sowie lokale HTTPS-/OCSP-Verbindungen. OpenSSL liest die erzeugten
Policy-Erweiterungen unabhängig vom neuen DER-Parser. Details stehen im
[Prüfprotokoll](verification.md).

Typkennungen sind keine Admission-Rollen oder Telematik-IDs. Vollständiges
TUC_PKI_018, Rollen-/Policyprüfung, VZD-Adressbindung, TI-Ankerinitialisierung,
Konnektor/SMC-B, produktiver Dienstanschluss und unabhängige Prüfung/Zulassung
bleiben offen. Der Empfang bleibt bei lokaler Diagnose; `good` und ein erlaubter
Typ ergeben weiterhin keine bestätigte TI-Identität oder normale Zustellung.

## Primärquellen

- [gemSpec_PKI 2.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_PKI/gemSpec_PKI_V2.28.0/): GS-A_4718 / Tab_PKI_227 und GS-A_4749-01 / TUC_PKI_007.
- [gemSpec_TSL 1.25.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_TSL/gemSpec_TSL_V1.25.0/): §7.3.2.1, TIP1-A_4107–4110 und Tab_PKI_713–716.
- [gemSpec_OID](https://gemspec.gematik.de/docs/gemSpec/gemSpec_OID/latest/index.html): Tab_PKI_404–405, Ausstellungsrichtlinien und Zertifikatstypen. Quellen geprüft am 21.10.2026.
