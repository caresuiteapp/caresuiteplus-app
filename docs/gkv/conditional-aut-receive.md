# Bedingte AUT-Prüfung beim KIM-Empfang

Stand: 22.10.2026. Ausführbare lokale ECC-Teilmenge, weiterhin ausschließlich
Diagnose. Keine Zulassung, TI-Vertrauensbestätigung oder normale Clientzustellung.

## Entscheidung aus tatsächlichen Belegen

`receiveEccKimMessageWithTsl(options, reportOptions, { statusClient, directory,
connector, signal })` verwendet mit `directory` den neuen Ablauf in `receive-vzd.mjs`.
Ohne Verzeichnis bleibt der bisherige strikte Pfad bestehen, der AUT und ein
explizit erwartetes AUT-Zertifikat verlangt. Der Erzeuger setzt weiterhin vor
jeder CMS-Signatur einen frischen AUT-Token ein.

Ein ausdrücklich konfigurierter [Konnektor-Client](konnektor-certificates.md)
ergänzt für OSIG und gegebenenfalls AUT eine verpflichtende VerifyCertificate-
Anfrage. Sein negatives oder fehlendes Ergebnis kann nicht durch den lokalen
OCSP-Erfolg ersetzt werden. Er wird nach dem letzten Warten erneut geprüft.
Ohne Konnektor bleibt der bisherige lokale Diagnosepfad bestehen.

1. Originalbytes, Zertifikatbytes und Berichtsoptionen werden vor dem ersten
   Warten kopiert. CMS-Signatur, Empfängerzuordnung und geschützte Header werden
   tatsächlich geprüft. Ausschließlich X-KIM-Auth wird vorerst zurückgestellt.
2. Der TSL-/OCSP-Prüfer prüft das tatsächlich verwendete OSIG-Zertifikat.
   Ein negativer oder fehlender Befund verhindert jede VZD-/AUT-Abfrage.
3. Für die signierte innere From-Adresse wird ein eindeutiger VZD-Eintrag
   abgerufen. Die vorhandene TLS-Peer-/Rollen-/Statusprüfung muss vor LDAP
   bestehen. Ein kopiertes oder behauptetes Ergebnis ersetzt den privaten
   Serverbeleg nicht.
4. Passt die OSIG-Admission-ID exakt zur Verzeichnis-ID, ist AUT nicht
   erforderlich. Es gibt keine Tokenprüfung und keine AUT-Statusabfrage.
5. Bei abweichender ID muss X-KIM-Auth innen und außen jeweils einmal vorhanden
   und nach Unfolding gleich sein. Algorithmus, Signatur, Audience, sub/From,
   Produktkennung, UUID und nicht zukünftiges nbf werden geprüft. Das tatsächliche
   kanonische DER-Leaf aus x5c wird für TSL-/OCSP-/Admission-Prüfung verwendet.
   `expectedAuthCertificate` ist hier ein optionaler zusätzlicher exakter Pin.
   Die geprüfte AUT-ID muss zu **demselben** VZD-Eintrag passen.
6. Nach dem letzten Warten werden CMS, Header und erforderliche Tokens erneut
   geprüft. OSIG-/AUT-Rohbelege und VZD-Serverbeleg werden gegen ihren aktuellen
   geschützten Prüfer ausgewertet. Ablauf oder Listenwechsel erhält keinen
   früheren positiven Befund.

Vor den Netzwartezeiten werden die entschlüsselten Original- und Parser-
Bodypuffer überschrieben. Eine private WeakMap hält nur die für die spätere
AUT-Prüfung benötigten Token-/Versionswerte; das öffentliche Inspektionsobjekt
enthält keine Tokens oder Nutzdaten. Sein Klon ist kein Authentisierungsbeleg.
Dies ist keine Zusage einer vollständigen Speicherlöschung durch die
JavaScript-Laufzeit. Der Ablauf ist insgesamt auf 30 Sekunden begrenzt; ein
Aufruferabbruch beendet ihn ausdrücklich.

## Ausgabe und Fehler

| Zustand | `authenticationAssessment` | Diagnose |
| --- | --- | --- |
| OSIG-Status nicht positiv | `not-checked`, `signing-status` | `XCS_CERT_STATUS` |
| VZD fehlt, ist mehrdeutig oder ungültig | `not-checked`, `directory-unavailable` vor AUT | `XCS_DIRECTORY` |
| OSIG-ID passt zur From-Adresse | `not-required`, `signing-address-match` | 07 |
| Andere OSIG-ID, erforderlicher Token fehlt/ist ungültig | `rejected`, `token` | 10 |
| Erforderliches AUT-Leaf ohne positiven Status | `rejected`, `certificate-status` | `XCS_CERT_STATUS` |
| AUT gültig und Status positiv, ID passt nicht | `checked`, `different-signing-identity` | `XCS_DIRECTORY` |
| AUT gültig und Status positiv, ID passt | `checked`, `different-signing-identity` | 07 |

`checked` beschreibt hier die AUT-Token-/Zertifikatsprüfung; die Adresszuordnung
steht getrennt in `directoryAcquisition`. `authenticationMatches` fehlt, wenn
die AUT-Identität nicht geprüft wurde. Der Statusbericht enthält nur die
tatsächlich benötigten Rollen. `statusAcquisition` gibt keine Zustellfreigabe.
Standardmäßig wird kein entschlüsselter Originalbody angehängt. Die bestehende
ausdrückliche Diagnoseanhangoption bleibt erhalten, ebenso die Übernahme
auswertbarer X-KIM-Header; der separate JSON-Bericht enthält keine Tokens.

## Normbezug und verbleibende Arbeit

Grundlage ist [gemSpec_CM_KOMLE 1.23.0, KOM-LE-A_2048-02](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/gemSpec_CM_KOMLE_V1.23.0/),
am 22.10.2026 geprüft. Die Vorschrift nennt für die AUT-Prüfung sowohl das
Vorhandensein im inneren und äußeren Header als auch die fehlende Zuordnung
der From-Adresse zur OSIG-ID. Die lokale Entscheidung bei passender OSIG-ID
ist umgesetzt. **Bei fehlendem beidseitigem AUT und abweichender OSIG-ID lehnt
dieser Pfad weiterhin ab.** Er behauptet keine vollständige Kompatibilität mit
Alt-/Fremdclient-Nachrichten ohne AUT.

Die FD-Annahmefrist TTL_MSG_AUTH wird beim Empfang nicht erneut angewendet.
Zertifikatsgültigkeit und aktueller Sperrstatus bleiben erforderlich. Historische
Vertrauensevidenz fehlt. Der ergänzte SOAP-/mTLS-Adapter führt VerifyCertificate
gegen einen provisionierten Endpunkt aus; reale Interoperabilität ist noch nicht
nachgewiesen. Der eigene TSL-/OCSP-Pfad allein ersetzt diese Operation nicht. Offen
bleiben authentisierte TI-Ankerbereitstellung, SMC-B, reale VZD-/Konnektor-
Anbindung, weitere Kryptografie-/MIME-Profile, vollständige normative Fehler-
und Zustellbehandlung sowie unabhängige Interoperabilitäts- und Zulassungsprüfung.
Ergebnis 07 bleibt die konservative lokale Diagnose; Ergebnis 01 wird nie erzeugt.
Das FD-Anforderungsinventar bleibt unverändert bei 106 Kennungen,
28 teilweise lokal belegt und 78 offen. [Ausgeführte Prüfungen](verification.md).
