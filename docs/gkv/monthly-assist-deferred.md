# Persönliche Erfassung und nachgereichte Portalunterschrift

Stand 02.11.2026, Weiterentwicklung von `7c8699e`. Der
[neunte SQL-Entwurf](sql/monthly-assist-deferred-draft.sql) ist **nicht aktiviert**.
Er benötigt die acht Monatsentwürfe in ihrer aktuellen gemeinsamen Fassung und
die bestehenden Mitarbeiter-/Klientenportal-Signaturfunktionen. Die Änderungen
an Entwurf sieben und acht gehören zu diesem Paket. Keine Datenbankmigration
wurde an ein verbundenes Projekt gesendet.

## Unterstützter Ablauf

Die eingesetzte Pflegekraft beendet die tatsächliche Leistung und reicht die
vollständige Dokumentation ein. Ist eine Unterschrift vor Ort nicht möglich,
gibt sie den Nachweis über die bestehende Aktion für das Klient:innenportal frei.
Die Datenbank prüft die persönliche aktive Sitzung, die vor Leistungsbeginn
freigegebene Beschäftigtennummer, die eindeutige Zuordnung des Einsatzes,
Dokumentation, vollständige Aufgaben, tatsächliche Zeiten und Pausen.

Bei dieser Freigabe entsteht eine private unveränderbare Erfassungsfassung.
Sie enthält den vollständigen noch nicht unterschriebenen Inhalt mit Hash,
Pflegekraft, Nummernfreigabe, Sitzung und serverseitigem Erfassungszeitpunkt.
Die bestehende interne 15-Minuten-Grenze nach Leistungsende gilt weiterhin.
Sie ist eine Produktregel, keine hier behauptete gesetzliche Frist.
Freigabe, Portal-Dokument und Erfassungsfassung werden gemeinsam gespeichert
oder zurückgerollt. Eine wiederholte unveränderte Freigabe erhält den ersten
Inhalt und Zeitpunkt; ein erneuter Aufruf erzeugt keine neue Herkunft.

Die Unterschrift kann später über die vorhandene Klientenportal-Funktion
nachgereicht werden. Nur das zugeordnete aktive Klientenkonto darf die
Unterschrift ergänzen. Signaturinhalt, Quellhash, Dokumentationsstand und
Zeitfolge werden geprüft. Der übrige Leistungsinhalt bleibt gesperrt. Veraltete
Entwurfsjobs, neue Ersatzquellen und Änderungen an der persönlichen Quelle
können die erfasste Fassung nicht überschreiben.

Anschließend schließt die ursprüngliche Pflegekraft den Nachweis über das
Web-Panel im abgeschlossenen Einsatz ab. Dafür darf sie eine neue aktive Sitzung
verwenden; die ursprüngliche Erfassung behält ihre damalige Sitzung. Es entsteht
wie beim Vor-Ort-Ablauf eine neue Original-ID. Ein privater Bezug verbindet sie
mit dem früh erfassten Inhalt und der späteren Unterschrift. Die gespeicherte
Herkunft nennt ausdrücklich `personal-deferred-source-15m-v1` und enthält den
Hash der unsignierten Erfassungsfassung sowie Signatur- und Abschlusszeit.
Sie wird nicht als nachträglicher zeitnaher Original-INSERT ausgegeben.

Der unveränderte Edge-Dienst prüft die tatsächlichen Signaturbytes, erzeugt sein
eigenes finales PDF und liest dessen gespeicherte Bytes zurück. Das zuvor im
Klientenportal hochgeladene PDF wird nicht als vertrauenswürdige Bytebestätigung
übernommen. Erst die neue Originalfassung darf als Leistungsnachweis in die
Monatsabrechnung gelangen. Direkte Aufrufe älterer Clients oder des Byte-Dienstes
können diese Bindung nicht umgehen.

Im Web-Einsatz wird die ausstehende Portalunterschrift ohne Abschluss-Schaltfläche
angezeigt. Nach Aktualisierung kann die Pflegekraft die Fertigstellung anstoßen.
Die Monatsansicht und das serverseitige Monats-PDF zeigen dieselbe Erläuterung
mit Erfassungs-, Unterschrifts- und Abschlusszeit in Europe/Berlin.
Die gesonderte persönliche Monatsbestätigung bleibt erforderlich.

## Prüfung

- `monthly-assist-deferred.test.mjs`: 19 bestandene SQL-/Vertragsprüfmeldungen.
  Die bestehende Mitarbeiter-Freigabefunktion, die vollständige bestehende
  Klienten-Fertigstellungsfunktion und alle neun SQL-Entwürfe werden ausgeführt.
  Fälle umfassen Rollback bei Portal-Dokumentkonflikt, wiederholte Freigabe,
  spätere Unterschrift, neue Mitarbeitendensitzung, fremde/abgelaufene Konten,
  veränderte Quellen, fehlende Zeitereignisse, direkte Übergabeversuche,
  tatsächliche Signaturbyte-Manipulation und Widerruf.
- Die vorhandenen Web-Abschlussprüfungen umfassen nun 23 Fälle; die Monats-DOM-
  Prüfung umfasst 25 Fälle. Ausstehende Unterschrift, gezielte Aktualisierung,
  anschließender Abschluss und getrennte Zeitangaben sind enthalten.
- Ein integrierter Fall in `tsl-ocsp.test.mjs` führt die neue Portalquelle über
  Bytebestätigung, Monatsdaten und amtliche XSD in die lokale SOAP-/CMS-Kette.
  Eine anschließende Monatskorrektur erhält die Herkunft, entwertet die vorherige
  Monatsfassung und übernimmt deren Bestätigung nicht.
- `node scripts/gkv-assist-original-bytes.mjs` prüft Vor-Ort- und Portalweg mit
  dem unveränderten Edge-PDF-Renderer und der vorhandenen pdf-lib 1.17.1.
  Beide Wege bestanden bis zum tatsächlichen Monats-PDF. Mit dem optionalen
  lokalen `GKV_ASSIST_TEST_EVIDENCE_DIR` können synthetische Prüf-PDFs abgelegt
  werden. Ein einseitiges A4-Monats-PDF mit den neuen Zeitangaben wurde gerendert
  und auf Lesbarkeit, Umbruch und Überlagerungen geprüft.

Die Fixture nutzt kontrollierte Auth-/Rollen-/Storage-Grenzen. Historische Daten
für die verspätete Unterschrift werden ausschließlich in der isolierten Fixture
angelegt; das Produkt enthält keinen Rückdatierungsendpunkt. PGlite serialisiert
die Verbindung. Die Tests belegen keine unabhängigen parallelen PostgreSQL-
Verbindungen, produktive Auth-/RLS-/Storage-Abnahme oder tatsächliche Portal-
Konten. Die reguläre CI-PDF-Erzeugung ist ein ausdrücklich synthetisches Double.
Der zusätzliche Byte-Lauf verwendet den tatsächlichen Edge-Renderer.

Die PDF-Sichtprüfung ist keine Browserabnahme. Breite und schmale Webansichten
bleiben mangels ausführbarem Browser ungeprüft. Die DOM-Prüfungen berechnen kein
Layout. Abschließende Typ-, Gesamt- und Vercel-Ergebnisse werden im
[Prüfentwurf #129](https://github.com/caresuiteapp/caresuiteplus-app/pull/129)
dem veröffentlichten Commit zugeordnet.

## Grenzen und nächste Aufgaben

Bestehende Altquellen ohne rechtzeitige persönliche Erfassung werden nicht
nachträglich aufgewertet. Eine Freigabe durch eine andere Verwaltungsperson kann
die Erfassung der eingesetzten Pflegekraft nicht ersetzen. Reale Konten, Storage,
konkurrierende Verbindungen und die anschließende Aktivierung benötigen Abnahme.

Die fachliche Berichtigung der bereits erfassten Assist-Ursprungsfassung bleibt
ein eigener offener Ablauf. Der neue Schutz weist Inhaltsänderungen ab; er
liefert noch keinen neuen Korrekturauftrag für diese Quelle. Die vorhandene
Monatskorrektur ist davon zu unterscheiden. Mobile Einzelleistungserfassung,
Mehrpersonenleistungen und weitere Sonderprofile bleiben ebenfalls offen.

Android wurde nicht verändert. Keine echten Patientendaten, keine produktiven
Datenbankänderungen, kein DTA-/KIM-Versand. Hardware, TI, Annahmestellen, ITSG-
Prüfbestätigung und Zulassung werden nicht aus diesen Tests abgeleitet.
`upstreamEmployeeCaptureVerified`, `dispatchReady`, `productionReady` und
`submissionDossierComplete` bleiben false.
