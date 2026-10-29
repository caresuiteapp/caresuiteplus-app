# Vertretung bei der Monatsbestätigung

Stand: 29.10.2026. Implementiert auf dem Entwicklungszweig für Web/Desktop;
keine produktive SQL-Aktivierung, keine ITSG-Abnahme. Der Ablauf ergänzt die
[persönliche Monatsbestätigung](monthly-host.md).

## Dokumentierte persönliche Prüfung

Eine verantwortliche Pflegefachperson mit aktiver GKV-Beauftragung und dem
zusätzlichen Recht `office.clients.edit` dokumentiert eine tatsächlich geprüfte
Berechtigung. Gespeichert werden Name, Grundlage, Belegreferenz in der
Klientenakte, Prüfvermerk, Gültigkeitszeitraum sowie prüfender Akteur und Zeitpunkt.
Die Prüfung gilt für genau einen Mandanten, Klienten und eine Leistungsart.
Kontakt- oder Angehörigenstatus allein wird nicht als Berechtigung übernommen.

Die Grundlagen Vollmacht, gesetzliche Vertretung und berechtigte Angehörige
verlangen dieselbe ausdrückliche persönliche Prüfung. Die Anwendung kann damit
auch eine Prüfung von Papierunterlagen dokumentieren. Sie liest hier keine
Vollmachtsdatei, authentifiziert deren Aussteller nicht und entscheidet nicht
automatisch über die rechtliche Reichweite eines Dokuments. Die dokumentierende
Person muss diese Punkte fachlich tatsächlich prüfen. Die digitale Aufbewahrung
der zugrunde liegenden Vollmachtsdatei ist kein Bestandteil dieses neuen Archivs.

Neue Prüfungen haben eine eigene UUID. Identität, Umfang, Belegreferenz und
Prüfzeitpunkt sind danach unveränderlich. Ein Widerruf ergänzt Akteur, Zeit und
Begründung; er löscht oder überschreibt keine Prüfung. Eine Änderung erfordert
eine neue Prüfung. Unklare Speicherantworten behalten denselben Auftrag für eine
lesende Abfrage oder ausdrückliche identische Wiederholung. Ein erneutes Anlegen
mit derselben ID und anderen Angaben wird zurückgewiesen.

## Bindung von Auswahl bis Abschluss

| Schritt | Geprüfte Bindung |
| --- | --- |
| Auswahl | Das öffentliche RPC liefert nur Prüfungen für den berechtigten aktuellen Nachweisbereich. Änderungen benötigen zusätzlich Klientenrechte und eine aktive persönliche Sitzung. |
| Original vorbereiten | Der Browser übermittelt nur die Prüfungs-ID. Der Host löst Name, Umfang und Gültigkeit über die geschützte SQL-Brücke auf. |
| PDF und Archiv | Name, Grundlage, Belegreferenz und Prüfungs-ID erscheinen vor dem Zeichnen in der PDF. Der vollständige Prüfdatensatz wird im verschlüsselten Erfassungssnapshot festgehalten. |
| Prüfen und unterschreiben | Jede weitere Aktion vergleicht den vollständigen Snapshot und prüft aktuelle Rechte, Quellen, Sitzung und Berechtigung. Wechsel zwischen Patient und Vertreter oder zwischen Prüfungen erfordert eine neue Erfassung. |
| Prüfbeleg | Die SQL-Funktion prüft Name und Prüfungs-ID sowie Gültigkeit beim Zeichnen und beim Ausstellen. Browserangaben können keinen privaten Beleg ersetzen. |
| Endgültig speichern | Ein zusätzlicher Trigger prüft die Berechtigung nochmals in derselben Transaktion wie den Belegverbrauch. Der Zeilen-Lock serialisiert diese Prüfung mit einem Widerruf. |
| Historie | Späterer Widerruf ändert das damalige PDF und die damalige Prüfung nicht. Der Archivabruf zeigt weiterhin den aktuellen Status der Nachweisfassung. Eine Korrekturfassung beginnt ohne Unterschrift. |

Pro Leistungsart wird eine neue Unterschrift verlangt. Die bestehenden Sperren
gegen gleiche PNG-Bytes und gegen neu kodierte Bilder mit gleichem Tintenbild
gelten auch für Vertretungen. Das Zeichnen erfolgt im vorhandenen Web-Feld;
eine Identitätsfeststellung allein durch ein gezeichnetes Bild wird nicht behauptet.

## SQL und Prüfung

Der fünfte Entwurf [monthly-authorities-draft.sql](sql/monthly-authorities-draft.sql)
wird im isolierten Prüflauf nach den vier bisherigen Monatsentwürfen geladen.
Alle fünf bilden den neuen gemeinsamen Reviewstand; einzelne ältere Entwürfe
dürfen nicht unabhängig als neue Migration ausgerollt werden. Tabellen und
Resolver bleiben für `anon`, `authenticated` und `service_role` unmittelbar
gesperrt. Nur der kontrollierte öffentliche Invoker-Wrapper ist für die
persönlich angemeldete Rolle ausführbar.

Die integrierte Host-Suite umfasst jetzt 20 Unterfälle plus Hauptfall. Sechs neue
Fälle prüfen Vertreter-PDF und Archiv, Widerruf an drei Erfassungsgrenzen,
unveränderliche und idempotente Prüfungen, Rechte und Bereichsgrenzen,
Zeitablauf nach Belegerteilung sowie drei Leistungsarten mit drei Unterschriften.
Die React-Suite umfasst jetzt 19 Abläufe; vier neue Fälle prüfen die vollständige
Vertreterbedienung, fehlende Freigaben, verlorene Antworten und Kontextwechsel.
Auth-/REST- und Office-Quellgrenzen sind weiterhin synthetische Doubles. Die
Zeilen-Locks sind im SQL implementiert; unabhängige parallele PostgreSQL-Sitzungen
sind mit PGlite nicht nachgewiesen.

Zusätzlich wurden alle drei gerenderten Seiten einer synthetischen PDF mit
langem Vertretername und mehrzeiliger Belegreferenz angesehen: kein abgeschnittener
Text oder überlagerter Inhalt. Das ersetzt keine breite/schmale Browserprüfung,
keinen echten Zeichenablauf und keine Prüfung mit vergrößerter Schrift.
Der verbundene Desktop war erneut offline; lokal fehlt eine Browserlaufzeit.
Die bestehenden Lockfile-Abhängigkeiten wurden nach der Workspace-Bereinigung
wiederhergestellt; zusätzliche Browser- oder Testinfrastruktur wurde nicht installiert.

## Normative Einordnung und verbleibende Nachweise

Der am 29.10.2026 erneut gelesene
[ITSG-Prüfkatalog, Fall 3.8](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf)
verlangt bei angebotener Angehörigenoption den Ablauf mit drei Leistungsarten
analog zu 3.7. Dazu gehört auch die Betrachtung des finalen XML-Nachweises.
Die hier implementierte Prüfregistrierung ist eine zusätzliche CareSuite-Kontrolle;
sie wird nicht als wörtliche Vorgabe dieses Prüfkatalogs ausgegeben.

Fach-XML und XSD-/CMS-Bindung, Druck/Scan, tatsächliche Anmeldung und konkurrierende
Zugriffe in der Zielumgebung, Host-/Schlüsselprovisionierung, visuelle Web-Abnahme
und unabhängige Prüfung bleiben offen. ITSG 3.8 und das übergeordnete Arbeitspaket
bleiben deshalb **teilweise implementiert / externe Verifikation offen**.
