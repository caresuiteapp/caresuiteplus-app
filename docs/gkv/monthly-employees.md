# Persönliche GKV-Beschäftigtenzuordnung

Stand 31.10.2026, Entwicklung nach `5248025`. Der siebte
[SQL-Entwurf](sql/monthly-employees-draft.sql) ist nicht produktiv angewendet.
Er ergänzt die sechs Monatsentwürfe, die bestehenden persönlichen Konten und
den tatsächlichen Originalnachweis-INSERT. Android-Dateien bleiben unverändert.

## Meldung und unabhängige Prüfung

Im Mitarbeitenden-Webprofil kann die eigene GKV-Beschäftigtennummer mit einer
Referenz auf ihren Nachweis gemeldet werden. Im Office-Arbeitsplatz
**Pflegekassen-Abrechnung → Beschäftigtennummern** stehen Meldung und Prüfung
zur Verfügung. Die Formulare laden nur nach Öffnen des jeweiligen Bereichs.
Ein fehlender Datenbankausbau erscheint als nicht freigeschalteter Bereich.

Der Server ermittelt die Person aus der aktiven Mitarbeitendenakte und dem
aktuellen persönlichen Verwaltungs- oder Mitarbeitendenkonto. Mehrdeutige
Verknüpfungen, andere Portale, gesperrte Unternehmen, anonyme oder beendete
Sitzungen werden abgewiesen. Ein Browserfeld kann keine andere Person auswählen.
Interne Personalnummern werden nicht als GKV-Beschäftigtennummern verwendet.

Eine andere persönlich angemeldete Person benötigt die bestehende aktive
Monatsbeauftragung und `office.employees.edit`. Sie gleicht Nummer, Person und
Nachweis ab, dokumentiert Referenz und Prüfvermerk und legt das Ende der internen
Freigabe fest. Selbstprüfung, Freigabe ohne ausdrückliche Prüfbestätigung,
gleichzeitig aktive doppelte Nummernzuordnungen und veraltete Revisionen scheitern.
Die Zuordnung gilt frühestens ab ihrer Freigabe; eine rückwirkende Freigabe ist
nicht vorgesehen. Die maximale Dauer von 366 Tagen ist eine Produktregel.

| Ausgangsstand | Aktion | Berechtigung | Ergebnis |
| --- | --- | --- | --- |
| Keine offene Meldung | Melden | Eigene aktive Personenverknüpfung | Prüfung ausstehend |
| Prüfung ausstehend | Freigeben / Ablehnen | Andere beauftragte Person | Freigegeben / abgelehnt |
| Prüfung ausstehend | Zurückziehen | Meldende Person | Zurückgezogen |
| Freigegeben | Widerrufen | Andere beauftragte Person | Widerrufen |
| Gültigkeit abgelaufen | Neue Meldung und Prüfung | Jeweils persönliche Anmeldung | Neue Zuordnung; Historie bleibt |

Jede Änderung speichert Person, aktive Sitzung, Zeitpunkt sowie vorherigen und
neuen Stand in einem unveränderbaren privaten Protokoll. Die Tabellen haben RLS
und keine direkten Rechte für `anon`, `authenticated` oder `service_role`.
Öffentlich erreichbar sind ausschließlich überprüfte Invoker-RPCs. Private
Definer-Funktionen haben feste Suchpfade und explizite Entzüge der Ausführungsrechte.
Die bestehenden Konten, Rollen und `auth.sessions` werden verwendet; es wird
keine zusätzliche Anmeldung, kein Passwort und kein privater Schlüssel gespeichert.

Schreibaufträge sind an Mandant, Person, Kennung und exakten Inhalt gebunden.
Bei verlorener Antwort sperrt die Oberfläche weitere Bearbeitung und liest zuerst
den Auftragsstatus. Nur ein ausdrücklich nicht gefundener Auftrag darf mit
unveränderter Kennung erneut gesendet werden. Wiederholungen liefern den aktuellen
Stand; eine inzwischen widerrufene Zuordnung wird nicht wieder freigegeben.

## Bindung beim Originalnachweis

Der neue Trigger läuft ausschließlich beim INSERT in `assist_visit_proofs`.
Er prüft aktive persönliche Sitzung, genau zugeordnete Pflegekraft, vorherige
Nummernfreigabe, tatsächlichen Einsatzbeginn und -abschluss sowie den serverseitig
neu berechneten Hash des Originalinhalts. Der Erfassungszeitpunkt stammt aus der
Datenbank. Er muss zwischen Einsatzabschluss und 15 Minuten danach liegen.
Diese enge Zeitgrenze ist eine interne Umsetzungspolitik für die zeitnahe
Erfassung; die [Vereinbarung](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/2023_10_05_Vereinbarung__105_Abs.2_Satz_2_SGBXI_final.pdf)
nennt keine pauschale gesetzliche 15-Minuten-Frist. Ihre praktische Eignung muss
vor der Aktivierung anhand der tatsächlichen Einsatzabläufe geprüft werden.

Der private Ursprungsbeleg bindet Original-ID und -Hash, Einsatz, Pflegekraft,
Nummer, freigegebene Registrierung, Person, Sitzung und Zeitpaar atomar an den
INSERT. Scheitert eine Prüfung bei vorhandener aktiver Zuordnung, werden Original
und Ursprungsbeleg gemeinsam zurückgerollt. Der Browser kann den Beleg weder
direkt schreiben noch nachträglich an einen alten Nachweis anhängen.

Ohne aktive Zuordnung entsteht kein persönlicher Herkunftsbeleg. Eine spätere
Freigabe ergänzt keine Altleistung. Änderungen am Originalinhalt oder Widerruf
verhindern die weitere Verwendung einer zuvor gebundenen Quelle; der Ablauf fällt
in diesem Fall nicht auf eine unbestätigte Nummer zurück. Ein bloßer späterer
Ablauf der Freigabe ändert eine während ihrer Gültigkeit korrekt erfasste Quelle
nicht. Fehlerhafte ursprüngliche Zuordnungen benötigen weiterhin einen eigenen
fachlichen Berichtigungsablauf.

## Monatsnachweis, XML und CMS

Die Fachübernahme liest den Ursprungsbeleg zusammen mit den kanonischen Quellen.
Sie vergleicht Original-Hash, Einsatz, Person und beide tatsächlichen Zeitpunkte
und übernimmt die dort gebundene Nummer. Die bisherigen privaten Zuordnungen
liefern weiterhin Leistungsziffern und Vertragsinformationen. Eine unabhängige
Tarif- oder Berufsprüfung wird daraus nicht abgeleitet.

`captureProvenance` unterscheidet `personally-bound`, `partially-bound` und
`not-attested`. Jeder persönlich gebundene Eintrag trägt die prüfbare Referenz auf
seine Registrierung und seinen Ursprung. Der TypeScript-Vertrag verwirft falsche
Personen, Nummern, Zeiten, Hashes und widersprüchliche Gesamtkennzeichen.
Die Herkunft wird im Monatsarbeitsplatz angezeigt; die gebundenen Nummern stehen
auch im angezeigten PDF und im amtlich geprüften XML. Die weitere Signatur- und
Archivkette verarbeitet dieselben eingefrorenen Daten.

Ein Widerruf während der SignDocument-Ausführung verhindert die Abschlussquittung.
Ein bereits begonnener Schlüsselversuch bleibt gesperrt; es erfolgt keine zweite
Signatur. Korrekturen behalten die ursprüngliche Nummer und ihren Beleg, entwerten
die alte Fassung und übernehmen keine Patientenunterschrift. Abgeschlossene
Archivfassungen bleiben mit ihrem damaligen Inhalt lesbar.

## Nachweise und verbleibende Grenzen

- `monthly-employees.test.mjs`: tatsächliche sieben SQL-Entwürfe in vorhandenem
  PGlite, Konto-/Sitzungsgrenzen, getrennte Prüfung, privates Protokoll,
  Ursprungserfassung, Fristen, Manipulation, Widerruf und Wiederaufnahme.
- `monthly-employees-ui-check.mjs`: tatsächliche React-Formulare und Auftragslogik,
  getrennte Prüfung, verlorene Antwort, explizite Wiederholung, Kontowechsel und
  fehlende Freischaltung. DOM-Prüfungen sind keine visuelle Abnahme.
- Zwei zusätzliche integrierte Fälle in `tsl-ocsp.test.mjs`: persönliche Meldung
  und Prüfung über Ursprung, PDF, amtliche XSD, tatsächliches lokales SOAP/CMS,
  OpenSSL-Prüfung, Abschluss, Korrektur sowie Widerruf während des Kartenaufrufs.

Konten-/Office- und Konnektorgrenzen bleiben synthetisch. PGlite belegt keine
separaten konkurrierenden PostgreSQL-Verbindungen. Es gibt keinen automatischen
BfArM-Abgleich, keine neue Kontoprovisionierung und keine unabhängige Identitäts-
oder Berufsprüfung. Ersatz-Beschäftigtennummern werden nicht als eigenes Fachprofil
umgesetzt. Mehrpersonenleistungen, einzelne mobile Leistungserfassung vor dem
abschließenden Originalnachweis, PDL-Nummernprovisionierung und produktive
Berichtigung bleiben offen. `upstreamEmployeeCaptureVerified` und
`dispatchReady` im umfassenden Host-Prüfbeleg bleiben deshalb false.

Breite/schmale echte Browseransichten, Druck-/Scan-Abläufe, echte Karte und TI,
Annahmestellen und die unabhängige Softwareprüfung sind gesondert nachzuweisen.
Die ITSG-Fälle bleiben offen; insbesondere ersetzt dieser Baustein keine
Vorführung von 3.1–3.5 und 4.1 auf den vorgesehenen Geräten.

Ausführungsstand und Vercel-Vorschauen des veröffentlichten Commits stehen in
[Draft-PR #129](https://github.com/caresuiteapp/caresuiteplus-app/pull/129).
