# Prüfprotokoll: GKV-Datenaustausch

Stand: 29.10.2026. Reine Beispieldaten; keine Übermittlung an eine Pflegekasse.

## Vertreterbestätigung am 29.10.2026

Der Arbeitsstand nach `31a291f` ergänzt die [dokumentierte Vertreterprüfung](monthly-representatives.md)
mit Webauswahl, persönlicher Registrierung, Gültigkeit und Widerruf. Der Host
übernimmt ausschließlich eine Prüfungs-ID und löst Name und Berechtigung selbst
auf. PDF, verschlüsselter Snapshot, privater Prüfbeleg und endgültige Bestätigung
bleiben verbunden. Ein Widerruf oder Zeitablauf verhindert auch den endgültigen
Belegverbrauch nach bereits erteilter Signaturquittung. Frühere Originale bleiben
bytegleich und lesbar; Korrekturen übernehmen keine Unterschrift.

| Prüfung | Ergebnis |
| --- | --- |
| Generierter ESM-Gateway-Einstieg ohne Testloader | 4 Fälle bestanden |
| Monatsvertrag und Arbeitsplatzvertrag | 27 Fälle bestanden |
| Bisheriger SQL-Speichervertrag | 24 Prüfmeldungen bestanden |
| Originaldateien, PNG, verschlüsseltes Archiv | 20 Prüfmeldungen bestanden |
| Gateway, tatsächliches lokales mTLS, Host und fünf SQL-Entwürfe | 21 Prüfmeldungen bestanden |
| Tatsächliche React-Monats-/Office-Komponenten | 19 Abläufe bestanden |
| App-TypeScript | `tsc --noEmit --pretty false` bestanden |
| Zulassungskatalog | Konsistenzprüfung und 9 Tests bestanden |

Die sechs neuen Host-Unterfälle prüfen den vollständigen Vertreterablauf,
Widerruf vor Anerkennung / vor Dateiverifikation / nach Quittung, unveränderliche
und idempotente Berechtigungsprüfungen, Klienten-/Leistungsartgrenzen, fehlende
Verwaltungsrechte, Gültigkeitsablauf und drei getrennte Unterschriften für drei
Leistungsarten. Die vier neuen React-Fälle decken Registrierung bis Abschluss,
fehlende Freigabe, verlorene Schreibantwort und verspätete Antwort nach
Kontextwechsel ab. Ungültiger Prüftext kann nicht gespeichert werden.

Alle Daten und Unterschriften sind synthetisch. Auth-/REST-Grenzen und
Office-Quellrechte bleiben Doubles; PGlite belegt keine unabhängigen parallelen
PostgreSQL-Verbindungen. Ein dreiseitiges PDF mit langem Vertretername und
mehrzeiliger Belegreferenz wurde gerendert und auf allen Seiten visuell geprüft.
Die Browserdarstellung, echter Canvas, Tastatur und Schriftvergrößerung sind
weiterhin nicht visuell abgenommen: keine lokale Browserlaufzeit und verbundener
Desktop erneut offline. Bestehende Lockfile-Abhängigkeiten wurden nach der
Workspace-Bereinigung wiederhergestellt; keine Paketversion geändert und keine
zusätzliche Browser-/Testinfrastruktur eingerichtet.

Die fünf Monats-SQL-Entwürfe wurden nicht produktiv eingespielt. Eine tatsächliche
Unterlagen-/Identitätsprüfung, Zielbetrieb, Fach-XML, Druck/Scan, Hardware/TI und
unabhängige Abnahme bleiben offen. `productionReady` und
`submissionDossierComplete` bleiben `false`.

## Laufzeitprüfung der neuen Vercel-API am 29.10.2026

`c10d45ed3860ad60e607978fd638f45eb0a7b759` besteht den Vercel-Build in den
Projekten `repository` und `caresuiteplusapp`. Der anschließende echte GET-Aufruf
an `/api/gkv/monthly-originals` im Preview `dpl_AszBvR7YNBVSwZXhVFgBNLs2qzuo`
ergab jedoch HTTP 500. Das zugehörige Runtime-Protokoll zeigt `ERR_REQUIRE_ESM`:
Vercels CommonJS-Ausgabe des TypeScript-Einstiegs verwendete `require()` für den
ESM-Handler. Ein grüner Build war hier ausdrücklich kein Laufzeitnachweis.

Der Einstieg wird deshalb als einzelnes explizites `.mjs`-Bundle aus dem
unveränderten gemeinsamen Handler erzeugt. Er benötigt keine TypeScript- oder
Host-Archivmodule zur Laufzeit. Ein verpflichtender Generierungsvergleich und
vier tatsächliche Einstiegstests ohne Testloader, mit
`--no-experimental-require-module`, bestehen: GET 405, POST ohne Anmeldung 401,
fremde Eingabefelder 400 und komprimierte Requests 415. Das vollständige Monats-
Gate mit den bisherigen 101 Prüfmeldungen besteht erneut. Die folgenden lokalen
Webbuild- und Previewangaben gelten für den ausdrücklich genannten Codeumfang;
ein erfolgreicher Aufruf des korrigierten Previews wird getrennt dokumentiert.

## Persönliche Host-/Web-Anbindung am 29.10.2026

Der Arbeitsstand nach `1a6f6ed` ergänzt die [vollständige lokale Verbindung](monthly-host.md)
von Originalanzeige und frischer Web-Unterschrift über das Gateway zum privaten
mTLS-Host und zur SQL-Worker-Brücke. Gateway und Host prüfen den persönlichen
Bearer online; SQL verlangt zusätzlich einen mandantengebundenen Host-MAC und
eine aktive Auth-Sitzung. Erfassung und endgültiger Belegverbrauch bleiben an
denselben Akteur und dieselbe Anmeldung gebunden. Private Belegfunktionen und
Schlüsseltabellen werden nicht für Browserrollen geöffnet.

Die Oberfläche trennt Öffnen/Prüfen, neue Zeichnung, Dateiverifikation und
endgültige Bestätigung. Verlorene Erfassungs- und Abschlussantworten werden mit
rein lesenden Abfragen geklärt. Auswahl und Navigation bleiben bis zur Klärung
gesperrt; es wird weder automatisch erneut unterschrieben noch finalisiert.
Archivansichten zeigen auch nach einer Korrektur die ursprünglichen PDF-Bytes
und den aktuellen Status. Android wurde nicht geändert.

`npm run verify:gkv:monthly-web` besteht mit **27 Vertragsfällen, 24 bisherigen
SQL-Testmeldungen, 20 Originaldatei-Testmeldungen, 15 Host-Testmeldungen und
15 React-/Office-Abläufen**. Die Host-Suite führt eine echte lokale HTTPS-/mTLS-
Verbindung, verschlüsselte SQLite-Dateien und alle vier SQL-Entwürfe mit echtem
`pgcrypto` in PGlite aus. Sie prüft vollständigen Abschluss und Korrektur,
Sitzungswechsel/-widerruf, MAC-Manipulation, Schlüsselwiderruf, fremde Mandanten,
Rechte-/Quellenwechsel, Zertifikat-Pins, veränderte PDF-Bytes und verlorene
Antworten. Die React-Suite prüft zusätzlich die verlorene Antwort nach einer
bereits gespeicherten endgültigen Bestätigung, ohne einen zweiten Schreibauftrag.

Der vollständige lokale `npm run build:web:production` endet mit **Exitcode 0**:
App-Typcheck, 14 weitere Release-Gates mit **3.795 Vitest-Fällen**, **725 statische
Routen** und sämtliche Abschlussaudits. Die abschließende Entkopplung des
Gateway-Auth-Helfers vom privaten SQLite-Modul wurde anschließend mit allen
15 Host-Testmeldungen und einem tatsächlichen gebündelten API-Einstieg geprüft:
GET liefert 405, POST ohne Anmeldung 401. 47 bestehende Canvas-/Signatur-/Portal-
Regressionen sowie neun Katalogtests und der Konsistenzcheck bestehen ebenfalls.
Es wurden keine Pakete installiert oder Versionen geändert.

Auth-/REST-Server, Office-Quellrechte sowie die UI-API-/Viewer-/Canvas-Grenzen
sind synthetisch. Die Tests belegen keine echte Supabase-Anmeldung, produktive
PostgreSQL-Parallelität, tatsächliche Patientenidentität oder Hardware/TI.
Die lokale Browserlaufzeit ist nicht vorhanden; das erneut abgefragte verbundene
Gerät war offline. Breite/schmale Darstellung, Schriftvergrößerung, Tastaturfokus,
PDF-Viewer und tatsächliche Zeichenereignisse bleiben als visuelle Abnahme offen.

Vier SQL-Entwürfe, Hostschlüssel und Zertifikate sind **nicht aktiviert**.
Derzeit ist ein fester Host für einen Mandanten vorgesehen; allgemeines
Mehrmandanten-Routing fehlt. Vertreter, Druck/Scan, administrative Beauftragung,
Fach-XML/XSD/CMS und unabhängige ITSG-/gematik-Abnahme bleiben offen.
`productionReady` und `submissionDossierComplete` bleiben `false`.
Die folgenden Abschnitte und Previewnachweise dokumentieren frühere Stände.

## Privater Originaldatei-Verifizierer am 29.10.2026

Nach `885783a` ist der [Dienstkern für persönliche Bestätigungen](monthly-original-verifier.md)
implementiert. Er erzeugt die Original-PDF selbst, bewahrt PDF/PNG im vorhandenen
verschlüsselten Worker-Archiv auf, liest die gespeicherten Bytes zurück und
erstellt einen privaten Prüfbeleg. Der vorhandene SQL-Befehl finalisiert damit
im integrierten Test tatsächlich den Nachweis. Eine Korrektur benötigt eine
frische Erfassung; das entwertete Original bleibt für berechtigte Leser erhalten.

**20 neue Testmeldungen bestanden**: drei Datei-/PDF-Fälle, 16 integrierte
Unterfälle und ihr Hauptfall. Die bisherige Monatsprüfung besteht weiterhin
mit 27 Vertragsfällen, 24 SQL-Testmeldungen und zehn tatsächlichen React-Abläufen.
Die neue Suite ist Bestandteil des bestehenden Webbuilds. Sie prüft auch
Rechte-/Quellenwechsel während der Verifikation, Wiederverwendung anders
kodierter Unterschriftsbilder, manipulierte Archive, Neustart und ungewisse
Datenbankantworten. Office-Quellprüfung und Anmeldeauflösung bleiben Doubles;
keine echten Patientenunterschriften oder produktiven Daten wurden verwendet.

Der vollständige lokale Lauf von `npm run build:web:production` endet erneut
mit Exitcode 0: App-Typcheck, 14 weitere Release-Gates mit 3.795 Vitest-Fällen,
725 statische Routen und alle Abschlussprüfungen. Die abschließenden Ergänzungen
an privatem Archivabruf, PNG-Prüfung und Nutzdatenlimit sind danach nochmals
mit dem vollständigen Monats-Gate geprüft; sie verändern kein App-Bundle.
Neun Katalogtests und der Konsistenzcheck bestehen. Alle drei synthetischen
PDF-Seiten wurden mit Poppler gerendert und visuell auf vollständige Blöcke,
Umlaute, Kopf-/Fußzeilen und Umbrüche kontrolliert. Das ist keine visuelle
Abnahme der weiterhin getrennten Erfassungsoberfläche.

Host-/Gateway-Freigabe, Originalanzeige und Erfassung in der App, Vertreter,
Druck/Scan, Fach-XML und unabhängige Abnahme fehlen noch. Die neuen privaten
SQL-Funktionen sind nicht ausgerollt und für alle bisherigen Runtime-Rollen
gesperrt. Die folgenden Buildnachweise beziehen sich jeweils auf ihren
ausdrücklich genannten früheren Commit.

## Monatsnachweis-SQL und React-Prüfungen am 29.10.2026

Die Vercel-Protokolle sind über die verbundene Teamfreigabe jetzt lesbar. Der
fehlgeschlagene Preview-Build `dpl_Ebc1Lpp8Cu9LTcyGT8Vamvv8V9Ds` für `4058f96`
brach im letzten SQL-Unterfall mit PostgreSQL `42P08` ab. Die Testvorbereitung
verwendete denselben Parameter als UUID-Spalte und Textwert im JSON-Beleg.
Ein ausdrücklicher UUID-Cast vor der Textkonvertierung behebt die widersprüchliche
Typableitung; Seitennavigation und Prüfanforderungen bleiben unverändert.

`npm run verify:gkv:monthly-web` besteht jetzt mit den bereits vorhandenen,
zum Lockfile passenden Projektabhängigkeiten: **27 Vertrags-/Wiederherstellungsfälle,
23 SQL-Unterfälle plus Hauptfall (24 Testmeldungen) und zehn React-Bedienabläufe**.
Der SQL-Lauf umfasst Mandantentrennung, Rechte, Quellenbindung, Korrektur-Rollback,
Auftragsklärung und beide Seiten mit insgesamt 52 Klienten beziehungsweise Quellen.
Die React-Prüfung verwendet die tatsächliche Monatskomponente und Office-Seite.

Auch `kim-host-ui-check.mjs` und `editor-check.mjs` bestehen mit tatsächlichem
React: Host-/Empfangsstatus, Startsperren, verlorene Antworten, Rechtewechsel,
Fachparameter und Fassungsverlauf. API-/Auth-Grenzen bleiben synthetisch.
Es wurden keine Pakete installiert oder Versionen geändert.

Auch `npm run build:web:production` besteht für **`46536b6`** vollständig
(Exitcode 0): App-Typcheck, alle 14 weiteren Release-Gates mit 3.795 Vitest-Fällen
und zusätzlichen SQL-/Validatorprüfungen, Expo-Webexport mit
725 statischen Routen, Sprach-/Kalenderdateien, Navigation und öffentliche Seiten.
Die neun Katalogtests und der Konsistenzcheck bestehen ebenfalls.
Auch der [Vercel-Preview-Build im Projekt `repository`](https://vercel.com/caresuiteapps-projects/repository/96jwhuWXTvJiXPo391i6KchAt6Dy)
ist für denselben vollständigen Commit `46536b6a43b5a45a7dec0225bd1b644c10c9ed12`
mit **`READY`** bestätigt. Deploymentmetadaten und Abschlussprotokoll wurden
gelesen; es handelt sich um eine Vorschau, keine Produktionsfreigabe.
Andere Projektpreviews werden getrennt bewertet. Dieser Nachweis gilt für den
Code-/Teststand `46536b6`; die anschließende Änderung dokumentiert nur das Ergebnis.

Die früheren offenen lokalen SQL-/React-/Buildläufe sind damit erledigt; eine
breite/schmale visuelle Abnahme ist weiter offen, da lokal keine Browserlaufzeit
vorhanden ist. Das verbundene Gerät wurde erneut geprüft und war offline.
DOM-Prüfungen belegen
kein Layout, keine echte Supabase-Anmeldung, keine Hardware/TI und keine Zulassung.
Die SQL-Entwürfe bleiben unangewendet; Produktions- und Versandfreigaben bleiben
unverändert gesperrt. Die folgenden Abschnitte dokumentieren frühere Zwischenstände.

## Bindung von Monatsnachweis-Antworten am 23.10.2026

Der Arbeitsstand nach `3739a2d` schließt eine Annahmelücke bei Speicherantworten
und rein lesender Auftragsklärung. Nachweis-ID, Klienten-/Monats-/Leistungsartbindung
beim Anlegen, Korrekturvorgänger und Mindestrevision werden gemeinsam geprüft.
Frische Quellenantworten müssen exakt die ausgewählten Quellkennungen enthalten.
Bestätigungsart, Inhaltshash und bei Unterschriften der private Prüfbeleg müssen
zum ursprünglichen Auftrag passen. Ungültige Antworten lassen den Auftrag offen;
zulässige spätere Revisionen und entwertete Vorgänger bleiben wiederherstellbar.

**56/56 Tests bestanden:** 27 Vertrags-/Wiederherstellungsfälle und 29
Quellen-/Prüfexport-/Katalogregressionen. Sechs neue Negativfälle scheiterten
zuvor mit „Missing expected rejection“ und bestehen nach der Korrektur.
Zusätzlich besteht der strenge TypeScript-Check des Monatsnachweis-Fachkerns mit
TypeScript 6.0.3. Monatskomponente und Office-Seite lassen sich mit esbuild 0.28.2
bündeln, mit externem React und synthetischen API-/Auth-Grenzen. Die identischen
Compilerversionen stammen aus vorhandenen lokalen Archiven; ihre SHA-512-Werte
stimmen mit dem Projekt-Lockfile überein. Keine Paketdownloads oder Versionsänderungen.

Das ist kein vollständiger App-Typcheck und kein ausgeführter React-/Layouttest.
PGlite, happy-dom und die exakte React-Version sind weiterhin lokal nicht verfügbar.
Die zwei fehlgeschlagenen und zwei ausstehenden Vercel-Statusmeldungen für
`3739a2d` belegen keine aktuelle Buildfreigabe; die Ursache bleibt ohne Protokolle
offen. SQL, Produktionskonfiguration und Echtversand wurden nicht verändert.

## Monatsnachweis-Webanbindung am 23.10.2026

Neu implementiert sind Monats-/Klientenauswahl, Quellenabgleich, Fassungsvergleich,
Ausnahmeabschluss, begründete Korrektur und Klärung ungewisser Speicherantworten.
18 Vertrags-/Wiederholungstests und 29 Quellen-/Prüfexport-/Katalogregressionen
bestehen lokal. Die SQL-Suite ist um fünf Lese-/Wiederherstellungsfälle erweitert;
zehn Prüfabläufe verwenden die tatsächliche React-Komponente und Office-Navigation
mit synthetischen API-/Auth-Grenzen. Sie sind jetzt mit
`npm run verify:gkv:monthly-web` Bestandteil des bestehenden Webbuilds.

Die früher verwendeten lokalen Projektabhängigkeiten sind nicht mehr vorhanden.
Der neue SQL-/React-Lauf und der aktuelle vollständige Typcheck sind deshalb
bis zum Ergebnis des Preview-Builds offen. Vier erfolgreiche Vercel-Statusmeldungen
wurden für den Vorgänger `2c2b4fb` geprüft; sie belegen nicht die neue Änderung.
Keine zusätzliche Installation, keine Datenbankaktivierung und keine visuellen
Screenshots. Auch ein erfolgreicher DOM-Lauf ersetzt keine breite/schmale
Layoutabnahme, echte Auth-/Storage-Abnahme oder ausgeführte ITSG-Prüffälle.

## Monatsnachweis-Speichervertrag am 23.10.2026 (Vorgänger `2c2b4fb`)

Der [neue Speichervertrag](monthly-proofs.md) wurde mit 19 PostgreSQL-
Testmeldungen (18 Unterfälle plus Hauptfall) und acht Vertrags-/RPC-Tests
geprüft. Der SQL-Entwurf läuft im bereits vorhandenen PGlite. Geprüft sind
Mandantengrenzen, zusätzliche PDL-Beauftragung, RLS, direkte Schreibsperren,
kanonische Quellbindung, doppelte Quellenzuordnung, Versionskonflikte,
Auftragswiederholung, Originalbindung und die atomare Korrekturkette.
Die Web-Vertragsfunktion wurde auch gegen die SQL-Funktionen ausgeführt.
Die vollständige TypeScript-Prüfung bestand mit den bereits vorhandenen
Projektabhängigkeiten. 29 Quellen-, Prüfexport- und Katalogregressionen bestanden ebenfalls;
der gesamte kryptografische Dienstlauf wurde für diesen separaten
Speicherbaustein nicht erneut ausgeführt.

Office-Quellprüfung und Sitzungsauflösung sind ausdrücklich Vertragsdoubles;
Originaldatei-Prüfbelege stammen vom Fixture-Administrator. Kein echter
Unterschrifts-/Storage-Nachweis, keine Mehrverbindungs-Rennen, keine ausgeführten
ITSG-Fälle und keine Datenbankaktivierung. Dieser Vorgänger enthielt keine neue UI. Die oben beschriebene Webanbindung
ergänzt sie; ihre visuelle Abnahme bleibt offen.

## Prüfmatrix am 23.10.2026

Die [Arbeitsgrundlage für vier Prüfbereiche](approval/README.md) enthält
36 Quellen mit SHA-256, 744 Anforderungsverweise aus drei KIM-Steckbriefen,
14 ITSG-Fälle und 25 Arbeitspakete. Der Import wurde erneut gegen die exakten
Original-HTML-Bytes ausgeführt. Unterschiedliche Nachweisarten und gleichnamige
Kennungen aus unterschiedlichen Spezifikationen bleiben getrennt.

Neun gezielte Katalogtests bestanden: Vollständigkeit und Quellenbindung,
mehrfach referenzierte IDs, fehlende/duplizierte Zeilen, Versions-/Ankerfehler,
unbelegte Freigabebehauptungen, Dateipfade, Abhängigkeiten und offene
Anbieterkonstellationsverweise. Der Konsistenzcheck bestätigt keine Zulassung.
Der ausdrückliche Bereitschaftscheck endet weiterhin mit Exitcode 3.
App-Code, Datenbank und Versandfreigaben wurden nicht verändert; deshalb wurde
der Fach-/Dienstgesamtlauf für diese Dokumentations- und Werkzeugänderung nicht
wiederholt. Der folgende Gesamtlauf gehört zur bisherigen Implementierung.

## Letzter Fach-/Dienstgesamtlauf

```bash
node --import ./tests/gkv-exchange/register.mjs --test tests/gkv-exchange/*.test.mjs
```

**1.229/1.229 Fach-/API-/Dienstprüfungen bestanden** in einem gemeinsamen Lauf:
0 Fehler, 0 übersprungene oder abgebrochene Fälle, 339,3 Sekunden.
Die folgenden älteren Abschnitte belegen jeweils ihren damaligen Zwischenstand.

## Empfangsaufträge im Web am 23.10.2026

66 neue Fälle ergänzen den Empfangshost: 54 Listen-/Browsertransport-/
Bedienzustandsfälle, acht Gatewayfälle und vier weitere Hostfälle. Der gezielte
Hostlauf bestand mit 20 Empfangshostfällen in 24,3 Sekunden. Der gemeinsame
Gateway-/Vertrags-/Browserlauf bestand mit 131 Fällen in 3,9 Sekunden. Der
vollständige Lauf oben enthält alle 1.229 bisherigen und neuen Fälle.

Die tatsächliche mTLS-Verbindung trägt `receive-list` bis zum Host. Geprüft
sind aktuelle Mandantenberechtigung, fehlende Konfiguration, Scope-/Ankerbindung,
Datentypen, Größenbegrenzung und die Abweisung von Nachrichteninhalten.
Seiten mit jeweils zehn Einträgen bleiben bei gleicher Vorbereitungszeit und
neuen Aufträgen korrekt geordnet. Gemeinsame Kartensperren gelten auch bei einem
synthetischen Rundlauf oder einem ungeklärten Empfang außerhalb der aktuellen
Seite. Beschädigte Parameter ergeben keine unvollständige scheinbar gültige Liste.

Die Webansicht verwendet den tatsächlich geprüften `KimReceiveWorkspace` und
`postKimHostCommand`: Lesen startet keine Karte; ein ausdrücklicher Start behält
die vorbereitete UUID. Doppelstarts, verspätete Antworten nach Auswahl-/
Seitenwechsel und Antworten nach dem Schließen des alten Mandantenkontexts
werden abgefangen. Eine unterbrochene Startantwort bleibt gesperrt, bis der
Einzelstatus des exakt gebundenen Originals erneut gelesen wurde. Fehler bei
Liste und Einzelstatus werden getrennt behandelt. Der Browsertransport folgt
keinen Umleitungen, wiederholt keine Anforderung und begrenzt JSON/UTF-8-Antworten.

Sieben geänderte/neue TypeScript-/JSX-Dateien wurden mit dem vorhandenen
Babel-Parser syntaktisch geprüft; JS-Syntax, 670 Web-Elternroutenmuster und
`git diff --check` bestanden. Die tatsächlichen React-Komponenten sind im
bestehenden UI-Prüfskript mit Auswahl, Start, Sperre, negativem Signaturbefund,
unbestätigtem Start und Rechtewechsel hinterlegt. Der Aufruf
`node tests/gkv-exchange/kim-host-ui-check.mjs` scheitert jedoch weiterhin am
lokal fehlenden `esbuild`. Auch TypeScript, React und happy-dom sind in diesem
Checkout nicht installiert; es wurde keine zusätzliche Software eingerichtet.
Die ausgeführten Bedienzustandsprüfungen sind keine React-/Layoutabnahme.
Vollständige lokale Typ-/React-Prüfung und die visuelle Kontrolle bei breitem und
schmalem Arbeitsbereich bleiben ausdrücklich offen.

GitHub bestätigte alle vier erfolgreichen Vercel-Builds des bisherigen Commits
**c8ab895c**. Die Builds dieses nachfolgenden Webinkrements sind gesondert zu
bewerten. Das erneut abgefragte verbundene Gerät ChristianLaptop war offline;
ein physischer Karten-/TI-Durchlauf wurde nicht ausgeführt. Hardware/TI bleiben
`not-attested`; normale Zustellung, Echtversand und Zulassung bleiben offen.
API, Bedienung und Grenzen stehen im [Empfangshost-Vertrag](konnektor-receive-host.md).

## Historischer Stand: Dauerhafter Empfangshost am 23.10.2026

54 neue Fälle ergänzen den Kartenempfang: 16 integrierte Hostfälle und 38
API-/Vertragsfälle. Der gezielte Hostlauf bestand mit 18 Fällen einschließlich
der beiden bisherigen Rundlauf-/Wiederherstellungsfälle in 24,3 Sekunden.
Der separate Gateway-/Vertragslauf bestand mit 64 Fällen in 3,0 Sekunden.
Die anschließend ergänzten fünf Fälle gegen Datentypverwechslungen in Befehlen
und Antworten sind im abschließenden Gesamtlauf enthalten. Dieser prüft den
endgültigen Dienst- und Vertragscode.

Geprüft sind verschlüsselt gespeicherte Inbox-Originale, lokale Vorbereitung,
Supabase-Zugangsgrenze, tatsächliches mTLS zum Host, Kartenentschlüsselung,
VerifyDocument, LDAP und abschließende Kartennachprüfung. Auftrags-, Original-,
Mandanten- und Postfachbindung gelten vor Kartenoperationen und bei der
Ergebnisabfrage. Die gespeicherte Diagnose überlebt einen Neustart bytegleich;
ein negativer originaler XML-Bericht bleibt verschlüsselt im Ergebnis.

Doppelte Starts, zwei Hostobjekte, gegenseitige Sperre von Empfang und Rundlauf,
unterbrochene Reservierungen und Abbruch lösen keinen zweiten Schlüsselaufruf
aus. Falsche Schlüssel, geänderte Konfiguration, beschädigte Original-/Parameter-
Blöcke, zwischen Aufträgen vertauschte Ergebnisse/Metadaten und fehlgeschlagene
Ergebnisspeicherung werden abgewiesen. Quoten kürzen keine Belege. Die
administrative Wiederherstellung ist an den letzten gesperrten Auftrag gebunden
und lässt dessen ursprüngliche Reservierung bestehen.

Der API-Vertrag weist fremde Auftragsantworten, Inhalte, Zertifikate,
Klartextoptionen, HTTP-Wiederherstellung und behauptete Hardware-/Zustellerfolge
ab. Die bestehende Webansicht erhält Sperrtexte und Statusaktualisierung für
Kartenempfang. Die drei zusätzlichen UI-Zustände sind im vorhandenen
React-Prüfskript hinterlegt, konnten lokal aber nicht ausgeführt werden:
`node tests/gkv-exchange/kim-host-ui-check.mjs` scheitert am fehlenden Paket
`esbuild`. Es wurde nichts installiert. TS-/JSX-Syntaxprüfung mit dem vorhandenen
Babel-Parser, 670 Web-Elternroutenmuster und `git diff --check` bestanden.
Das ersetzt weder eine vollständige lokale TypeScript-/React-Prüfung noch die
breite/schmale visuelle Abnahme.

GitHub bestätigt alle vier erfolgreichen Vercel-Builds von **c6243a1e**, also
des vorherigen Kartenempfangs-Commits. Der Build dieses nachfolgenden
Hostinkrements muss getrennt bewertet werden. Der erneut abgefragte
Desktop-Commander-Zugang meldete nur ChristianLaptop als offline. Kein
Hardware-/TI-Lauf, keine Produktionsfreischaltung und keine Zulassung wurden
durchgeführt. Der [Empfangshost-Vertrag](konnektor-receive-host.md) beschreibt
die lokale Vorbereitung, API, Ablage und verbleibenden Integrationsschritte.

## Historischer Stand: Kartenempfang und originale negative Berichte am 22.10.2026

39 neue Fälle ergänzen den VerifyDocument-Stand: 33 integrierte Kartenempfangs-
und 6 zusätzliche Berichtsherkunftsfälle. Der gezielte Lauf der ersten 31
Empfangsfälle bestand in 50,9 Sekunden. Die anschließend ergänzten beiden
Grenzfälle für Berichtsüberläufe bestanden in 5,9 Sekunden. Der abschließende
gemeinsame Lauf oben prüft den endgültigen Code einschließlich aller 33
Empfangsfälle, 34 VerifyDocument-Fälle und der bestehenden DTA-/KIM-Regressionen.

Die Tests verwenden tatsächliche lokale HTTPS-/mTLS-/LDAPS-Verbindungen,
synthetische Zertifikate, signierte OCSP-Belege und Software-Schlüssel ausschließlich
in der Gegenstelle. Geprüft sind Postfach-/C.ENC-Zuordnung, DecryptDocument,
unabhängige Signatur-/Headerprüfung, VerifyDocument, beide VZD-/AUT-Zweige und
eine vollständige Nachprüfung von Karte, drei Zertifikaten und PIN.
Fremde Schlüssel, veränderte Entschlüsselungsantworten, Kartenentnahme/-wechsel,
negative Senderstatusbelege, TSL-Wechsel während LDAP, Abbruch und konkurrierende
Anfragen geben keine normale Nachricht frei. Eingabemutation ändert weder das
gesicherte Original noch die Karte. Es gibt keinen Software-Schlüssel-Fallback.

Negative oder widersprüchliche Dokumentenberichte werden nur nach Signatur-,
Zertifikats-, Zeit-, Client- und CMS-Bindung als originaler kanonisierter XML-
Teilbaum angehängt. Ein kopierter Fehler, eine fremde Clientinstanz, ein anderer
CMS-Hash, ein veralteter oder fehlender Bericht liefert keinen Anhang. Der
Klartextanhang ist standardmäßig aus; explizite Anhänge bleiben bytegleich.
Ein übergroßer Diagnoseheader scheitert sowohl nach positivem als auch negativem
Dokumentenbefund, statt einen angeforderten Originalanhang still wegzulassen.

Zusätzlich bestanden 670 Web-Elternroutenmuster und `git diff --check`. Diese
Erweiterung ändert keine Oberflächen oder TypeScript-Dateien. Die lokale
Abhängigkeitslücke für die frühere React-Erweiterung besteht weiter; keine
Neuinstallation. GitHub bestätigt inzwischen alle vier erfolgreichen
Vercel-Builds von **ca4b6db2**. Diese Bestätigung gilt für den vorherigen
VerifyDocument-/Hoststatus-Commit, nicht automatisch für diesen Kartenempfang.
Eine breite/schmale visuelle Abnahme bleibt offen.

Das erneut abgefragte verbundene Gerät ChristianLaptop war offline. Es entstand
kein physischer Karten-/Konnektor-/TI-Nachweis, kein Produktivanschluss und keine
Zulassungsbestätigung. Der [Kartenempfangsvertrag](konnektor-card-receive.md)
beschreibt die tatsächlich verbundene interne Pipeline und die offenen Grenzen.

## Historischer Stand: VerifyDocument und Hoststatus am 22.10.2026

**42 neue Fälle** ergänzen die bisherigen 1.028: 28 SOAP-/Berichts-/mTLS-/
Signaturbindungsfälle, 12 Antwortvertragsfälle und 2 vollständige Kartenabläufe.
Der gezielte VerifyDocument-Lauf bestand mit 28 Fällen in 7,0 Sekunden;
der Gateway-/Vertragslauf mit 31 Fällen in 3,0 Sekunden. Der vollständige Lauf
oben enthält sämtliche finalen Dienständerungen und alle neuen Fälle.

Geprüft sind das offizielle Request-Schema für enveloping CMS, der zusätzliche
Konnektorbericht und seine Signatur-/Leaf-/Zeitbindung, widersprüchliche positive
Gesamt- und negative Detailergebnisse, INVALID/INCONCLUSIVE, fehlende/mehrfache
Berichte, fremde Erweiterungen, ungültige Zeitangaben, Größenlimit und DTDs.
Kopierte Zertifikatsbelege, ungültiges CMS und abgebrochene Anfragen erreichen
keinen Dokumentenaufruf. Eingabepuffer können nicht nachträglich geändert werden;
gleichzeitige Dokumentoperationen werden abgewehrt.

Der vollständige Hosttest umfasst jetzt fünf frische Karten-/TSL-/OCSP-/PIN-
Vor-/Nachprüfungen und zusätzlich VerifyDocument. Eine unvollständige Verifikation
oder Kartenentnahme nach positivem Bericht verhindert den Erfolgsstatus.
Version-1-Protokolle bleiben lesbar; Version 2 benötigt die zusätzliche
Bestätigung. Sperrzeit, persistente Start-ID und ausdrücklich überprüfte
Wiederherstellung werden geprüft. Ein zu früher Start über API/mTLS liefert den
bestehenden Status, ohne einen weiteren Auftrag zu reservieren.

Zusätzlich bestanden TS-/JSX-Syntaxprüfung mit dem vorhandenen Babel-Parser,
670 Web-Elternroutenmuster und `git diff --check`. Das ist keine vollständige
TypeScript- oder React-Bedienprüfung. Die automatische Arbeitsbereichsbereinigung
entfernte während dieser Änderung die vorher vorhandenen Projektabhängigkeiten.
Der Code wurde aus GitHub wiederhergestellt. Der erneute React-Lauf scheitert
lokal bereits am fehlenden esbuild-Paket, das Vercel-/Public-Route-Audit am
fehlenden expo-router-Paket. Keine Neuinstallation; aktuelle TypeScript-/React-
und visuelle Abnahme bleiben offen. Die früheren erfolgreichen Prüfungen unten
werden nicht als Beleg für diese Erweiterung übernommen.

Das verbundene Gerät war erneut offline. Es entstand kein echter Hardware-/
TI-Nachweis und keine Produktionsfreischaltung. GitHub meldete für den
Vorgänger 1c2462ae alle vier Vercel-Builds erfolgreich; Deploymentdetails waren
wegen fehlender Teamfreigabe (403) nicht abrufbar. Das ist kein Buildbeleg für
diesen Folgecommit. Der [VerifyDocument-Vertrag](konnektor-verify-document.md)
beschreibt Prüfumfang, Berichtsbindung und verbleibende Profilgrenzen.

## Historischer Stand vor VerifyDocument

**1.028/1.028 Prüfungen** bestanden damals in 230,6 Sekunden. Vorhandene
Projektabhängigkeiten wurden für TypeScript, esbuild, ESLint und die
React-DOM-Prüfung wiederverwendet. Die nachfolgenden Angaben gelten für diesen
früheren Umfang.

## CMS, Kartenentschlüsselung, Host und Web am 22.10.2026

**53 neue Dienst-/API-Fälle** ergänzen die bisherigen 975: 25 CMS-SOAP-/
Kartenfälle, 19 Host-Gateway-/mTLS-/Antwortvertragsfälle und 9 vollständige
Karten-/Hostabläufe. Der erste gemeinsame Lauf mit 1.019 Fällen bestand in
257,3 Sekunden. Danach wurden 9 weitere direkte Kartenfälle ergänzt; ihr
gezielter Lauf mit allen 25 CMS-Fällen bestand in 8,9 Sekunden.

Der vollständige Hosttest führt die tatsächliche Kette API-Berechtigungsprüfung
(lokale Auth-/RPC-Antwortfixtures), mTLS-Verbindung, dauerhafte SQLite-Reservierung,
vier vollständige SMC-B-/TSL-/OCSP-/PIN-Vorprüfungen, GetJobNumber, SignDocument,
EncryptDocument, DecryptDocument und Originalvergleich aus. Wiederholte Start-IDs
lösen keine zweite Signatur aus. Nach Wiederöffnen des Journals bleibt der Auftrag
zugeordnet. Fehlgeschlagene Durchläufe bleiben gesperrt, bis eine ausdrückliche
administrative Überprüfung mit passender Anfrage-ID vermerkt wurde.

Weitere Prüfungen betreffen falsche Abholadresse, OSIG statt ENC, kopierte PIN-/
Zertifikatsbelege, ungültige Daten, verbotene Software-Schlüsseloptionen,
Eingabemutation, Abbruch, Kartenentnahme, manipulierte Signatur/Chiffre/Klartext,
falsche RequestID, zusätzliche SOAP-Antworten/Erweiterungen, Warnungen,
Namespaces, Base64, externe Referenzen und DTDs. Ein 15-MB-Signaturdokument besteht
die XML-Prüfung; derselbe Umfang bleibt am CertificateService abgewiesen.

API-Tests kontrollieren Anmeldung, aktuelle Mandantenrechte, fehlenden Host,
falschen Peerpin, Redirects, Komprimierung, Antwortgrößen und einen fremden
Mandanten in der Antwort. Der Benutzer-Bearer-Token erreicht den Diensthost nicht.
Browserbehauptungen über Hardware oder TI werden vom Antwortvertrag abgewiesen.
Alle 31 festgeschriebenen Schema-/WSDL-/Lizenzdateien und der Manifestpin stimmen.

Zusätzlich bestanden:

- vollständige TypeScript-Prüfung mit 8-GiB-Heap; der erste Versuch mit dem
  2-GiB-Standardheap endete wegen Speichermangel, nicht wegen eines Typfehlers;
- ESLint für die neue TSX-Komponente, den Antwortvertrag und die API-Route;
- esbuild-Bündelprüfung der Web-API und des Host-Einstiegs;
- vorhandene Vercel-Konfigurations-/Public-Route-Prüfung und 670 Web-Routenmuster;
- `node tests/gkv-exchange/kim-host-ui-check.mjs`: tatsächliche React-Komponente
  mit synthetischen API-Zuständen für Rechte, Laden, fehlenden Host, Start-Sperre,
  Ergebnis, Fehler und Mandantenwechsel. DOM-Verhalten ist kein Layoutnachweis.

Keine visuelle Freigabe: lokal fehlt Chromium. Der Cloudbrowser kann den lokalen
HTTP-Server nicht erreichen und blockiert lokale Dateiadressen durch seine
Protokollrichtlinie. Diese Sperre wurde nicht umgangen. Die breite und schmale
Darstellung bleibt tatsächlich visuell zu prüfen.

Keine Hardware-/TI-Freigabe: Die verbundene Geräteverwaltung meldete nur einen
offline befindlichen Rechner. Vercel-Projekte konnten gelesen werden, ihre
Umgebungsmetadaten jedoch nicht (fehlende Teamfreigabe, 403). Weder ein vorhandener
TI-Anschluss noch dessen Fehlen lässt sich daraus ableiten. Die lokalen Erfolge
bleiben ausdrücklich ohne Hardwareattestierung, Zulassung und echten Versand.
Der [technische Vertrag und die verbleibenden Profilgrenzen](konnektor-cms-host.md)
sind gesondert dokumentiert. Keine Veröffentlichung auf main/Produktion und keine
Änderung produktiver Datenbankeinträge oder Zugangsdaten.

## SMC-B-Authentisierung am 22.10.2026

**70 neue Fälle** ergänzen die bisherigen 905 Prüfungen: 47 Transport-/Profil-/
Signaturfälle und 23 vollständige Abläufe. Der erste gezielte Transportlauf
bestand mit 45 Fällen in rund 21,1 Sekunden. Danach kamen Profilabweisung für
HBA/falsche Kurve und Fristablauf während der Anfragevorbereitung hinzu.
Der gezielte Integrationslauf bestand mit 23 Fällen in rund 45,9 Sekunden.
Der erste Gesamtlauf bestand mit 974 Fällen in rund 212,3 Sekunden. Nach
Ergänzung der Prüfung unmittelbar vor dem Netzaufruf bestand der abschließende
Gesamtlauf mit 975 Fällen in rund 216,2 Sekunden: 0 Fehler, 0 übersprungene
oder abgebrochene Fälle.

Die lokale mTLS-Gegenstelle prüft SOAPAction, AuthSignatureService-Route,
Kontext, CardHandle, MIME-Typ, ECDSA-Anforderung und den tatsächlichen 32-Byte-
SHA-256-Hash. Sie signiert diesen unabhängig mit OpenSSL `pkeyutl`, ohne ihn
nochmals zu hashen. Der Client prüft die Signatur gegen Originaldaten und
AUT-Zertifikat und erzeugt daraus ein 64-Byte-JOSE-Ergebnis. Das erzeugte
X-KIM-Auth-Token besteht anschließend den vorhandenen Empfangsprüfer.

Ein falscher Schlüssel, andere Daten, doppelte Hash-Bildung, RSA-Rückgabetyp,
Warning, SOAP Fault und ungültige DER-Signatur liefern keinen verwendbaren
Signaturwert und sperren weitere Versuche derselben Instanz. Malforme/negative/
Null-Skalare, überflüssige DER-Nullbytes, nichtkanonische Länge, Restbytes,
zusätzliche Skalare und die Gruppenordnung als Skalar werden abgewiesen.
XML-Fälle prüfen fehlende/doppelte Signaturen, zusätzliche Attribute, falsche
Namespaces, fehlenden Typ, Größen-/Base64-Grenzen, DTDs, falschen Digest,
MIME-Typ, RSA-Scheme und implizite Algorithmusdefaults.

Nur ursprüngliche aktuelle PIN- und Zertifikatsbelege desselben Clients können
einen Aufruf auslösen. Kopien, andere Clients, Zertifikatswechsel, HBA-/NIST-
Profile, fehlender Endpunkt, abweichender Ursprung und zusätzliche Secret-/
Softwareschlüsseloptionen scheitern. VERIFIABLE, BLOCKED, TRANSPORT_PIN und
EMPTY_PIN starten keine implizite PIN-Eingabe. Ein PIN-Beleg wird nur einmal
verwendet; Abbruch, Timeout, Schließen, Konkurrenz und Kartenaktualisierung
geben keine verspätete Signatur frei. Eingabemutationen verändern keine
laufende Anfrage. Ablauf während der asynchronen XML-Prüfung verhindert
bereits die tatsächliche Übermittlung der Schlüsselanfrage.

Der vollständige Ablauf prüft vor und nach der einzelnen Schlüsseloperation
Karte, AUT/ENC/OSIG, lokale TSL-/OCSP-Belege, Konnektorbefunde und PIN.
Entfernung, neue Kartenreferenz, andere ICCSN, anderes gültiges ENC-Zertifikat,
negativer Konnektorbefund, veränderter PIN-Status, TSL-Wechsel oder Abbruch
während der Nachprüfung verhindern die Signatur-/Tokenausgabe. Auch ein
Abbruch der ursprünglichen Vorbereitung bleibt wirksam. Ergebnisbelege sind
an Daten und beide Clients gebunden; Kopien, neue Kartenabfragen und spätere
TSL-Wechsel entwerten sie. Parallele Signaturen erzeugen keinen zweiten
Schlüsselaufruf. Token- und Signaturergebnisse bleiben gesperrt; die
VZD-Absenderbindung wird ausdrücklich als ungeprüft ausgewiesen.

Acht neue offizielle Vertragsdateien einschließlich transitiver Importe wurden
gegen den festgeschriebenen GitHub-Commit verglichen. Insgesamt 26 Schema-/
Lizenzdateien sind mit SHA-256 gebunden. Es wurden keine Pakete, zusätzliche
Software oder Testinfrastruktur installiert. Die Prüfungen verwenden die
bestehende lokale mTLS-/TSL-/OCSP-Umgebung und synthetische Identitäten.
Keine echte SMC-B, keine produktiven TI-/KIM-Aufrufe und kein unabhängiger
Zulassungsnachweis. [Implementierung und offene Integration](konnektor-auth.md).

## SMC-B-PIN-Verwaltung am 22.10.2026 (vorheriger Stand)

**92 neue Fälle** ergänzen die bisherigen 813 Prüfungen: 60 Schnittstellen-/
Status-/XML-Fälle und 32 integrierte Verwaltungsabläufe. Der gezielte erste
Schnittstellenlauf bestand mit 103 Fällen, darunter 45 bestehende PIN-Fälle,
in rund 21,3 Sekunden. Danach wurden zwei Fälle für Initialisierung bei
widersprüchlichem Null-Restzähler ergänzt. Der gezielte Integrationslauf bestand
mit 32 Fällen in rund 55,7 Sekunden. Es wurden keine neuen Schemata, Pakete oder
Testdienste installiert; ChangePin/UnblockPin verwenden den vorhandenen
festgeschriebenen CardService-Vertrag.
Der abschließende Gesamtlauf prüft alle 905 Fälle gemeinsam: 0 Fehler,
0 übersprungene oder abgebrochene Fälle, rund 162,7 Sekunden.

Echte lokale mTLS-Anfragen belegen ChangePin für Transport-/Leer-PIN sowie
für eine reguläre verifizierbare oder bereits verifizierte PIN. UnblockPin
sendet SetNewPin ausdrücklich mit false und true. PIN-/PUK-Werte fehlen in
den SOAP-Anfragen. Fehlende oder implizite Aktionsparameter, falsche Typen,
frei gewählte PIN-Typen und Geheimzahloptionen scheitern vor dem Netzaufruf.
Nicht zur Aktion passende PIN-Zustände lösen keine Ersatzoperation aus.

PIN-Fehlversuche und PUK-Fehlversuche bleiben getrennt. Eine zurückgewiesene PUK
mit neun Restversuchen wird korrekt ausgewertet; sie unterliegt nicht dem
PIN-Limit von drei. Widersprüchliche Zähler, nicht vorgesehene Ergebniswerte,
fehlende strukturierte Fehler, doppelte/fremde Reset-Flags und zusätzliche
PUK-Elemente werden abgewiesen. Eine Transport-/Leer-PIN mit ausdrücklich
null Restversuchen kann keine Initialisierung starten. Eine gemeldete
PUK-Sperre bleibt trotz neuer Karten-/Statusabfragen an die ICCSN gebunden;
für eine andere Kartenseriennummer wird sie nicht übernommen.

Kopierte, fremde und veraltete Statusbelege können keine Verwaltung auslösen.
ChangePin/UnblockPin sperren während der Eingabe auch VerifyPin und neue
Statusabfragen. Abbruch, Zeitüberschreitung, Schließen, SOAP-Fehler und
PinResult ERROR geben keinen verwendbaren Ausgang zurück und sperren weitere
Versuche der Instanz. Fremde Fehlertexte fehlen in den Fehlerobjekten.
Eine Kartenaktualisierung während einer anschließend mit OK beantworteten
Verwaltungsoperation meldet den bereits erhaltenen Konnektorbefund ausdrücklich
als unbestätigte Änderung.

Der integrierte Ablauf prüft Initialisierung aus Transport-/Leer-PIN, reguläre
Änderung und Entsperrung mit alter oder neuer PIN. Ein erfolgreicher Durchlauf
umfasst 15 SOAP-Aufrufe mit genau einer Verwaltungsoperation. Ein Nur-Lese-
Aufruf umfasst sieben und startet keinen Terminaldialog. Der Dienst löst
kein automatisches VerifyPin aus. Auch nach beobachtetem VERIFIED akzeptiert
der vorhandene Vorbereitungsprüfer den Verwaltungsbeleg nicht als Freigabebeleg.

Falsche PIN/PUK und neu oder vorher gesperrte PIN/PUK ergeben getrennte
Zustände mit dem jeweiligen Restzähler. Eine bereits bekannte PUK-Sperre
verhindert einen erneuten Entsperrversuch auch im vollständigen Workflow.
Abweichender PIN-Zustand nach OK, entfernte/gewechselte Karte, ein abweichendes
gültiges ENC-Zertifikat, ein negativer erneuter Konnektorbefund, TSL-Wechsel
oder Abbruch während der Nachprüfung liefern
`KIM_CONNECTOR_PIN_MAINTENANCE_UNCONFIRMED` samt bereits erhaltenem OK und
begrenztem Fehlergrund. Es wird nicht behauptet, die alte PIN sei unverändert.

Kopierte Gesamtbelege, vertauschte Konnektor-/Statusclients und neue
Statusabfragen entwerten die Bestätigung. Verwaltung und Vorbereitung können
nicht parallel auf derselben Instanz laufen. Mutationen der übergebenen
Rollenliste, Aktion oder SetNewPin-Option ändern keine laufende Operation.
Eine logische Uhrverschiebung um 45 Sekunden für ChangePin und UnblockPin
belegt jeweils frisch beschaffte Nachprüfungen statt verlängerter alter Belege;
es ist kein echter 45-Sekunden-Hardwareversuch. Eine fremde konfigurierte
Einrichtungsidentität verhindert die Verwaltungsoperation schon davor.

Die Nachweise betreffen Dienstlogik und lokale Gegenstellen. Oberfläche,
dauerhafte Hostkoordination über Instanzen/Neustarts, tatsächliche PIN-Pad-/TI-
Interoperabilität, weitere Kartenprofile, Schlüsseloperationen und unabhängige
Prüfung/Zulassung bleiben offen. Status bleibt `held-for-trust-validation` und
`unverified`. [Vertrag und Fehlersemantik](konnektor-pin-maintenance.md).

## Vorheriger Stand: SMC-B-PIN-Status und Terminalversuch am 22.10.2026

**68 neue Fälle** ergänzen die bisherigen 745 Prüfungen: 45 CardService-/PIN-/
XML-Fälle und 23 Integrationen mit dem bestehenden SMC-B-/TSL-/OCSP-Testverbund.
Der gezielte Integrationslauf bestand mit 23 Fällen in rund 43,6 Sekunden.
Der abschließende Gesamtlauf prüft alle 813 Fälle gemeinsam: 0 Fehler,
0 übersprungene oder abgebrochene Fälle, rund 109,1 Sekunden.
Die offizielle CardService-WSDL 8.1.0 wurde nach LF-Normalisierung bytegenau
mit dem abgerufenen Original verglichen; alle 18 Manifestdateien haben passende
SHA-256-Werte. Die vorhandene Infrastruktur wurde weiterverwendet.

Echte lokale mTLS-Anfragen prüfen Endpunkt, SOAPAction, Kontext, Kartenbezug
und das feste PIN.SMC-Profil. Die API nimmt keine PIN, PUK oder frei gewählte
PIN-Referenz an. VERIFIED, gesperrte und noch nicht initialisierte PIN-Objekte
lösen keine Terminalaktion aus. REJECTED mit einem oder zwei verbleibenden
Versuchen, WASBLOCKED, NOWBLOCKED und TRANSPORT_PIN werden als getrennte
Ergebnisse ohne Wiederholung behandelt. Widersprüchliche oder fehlende
Restzähler, Warn-Erfolge, falsche Namespaces, fehlende/doppelte Zustände und
fremde Operationen scheitern vor einer positiven Ausgabe.

Kopierte Belege und fremde Clients können keinen Versuch starten. Ablauf,
Uhr-Rücksprung, Kartenaktualisierung, fehlgeschlagene Statusaktualisierung,
Abbruch und Schließen entwerten ältere Ergebnisse. Verspätete alte Antworten
ersetzen keinen neueren Status. Gleichzeitige Eingabeversuche/Statusabfragen
während VerifyPin sowie parallele Vorbereitungen werden abgewiesen. Eine
Kartenaktualisierung während der Eingabe macht den alten Kartenbezug ungültig.
Zeitüberschreitung, Abbruch, SOAP-/XML-Fehler und PinResult ERROR liefern kein
Ergebnis; weitere Versuche derselben Clientinstanz bleiben gesperrt.

Die integrierte Vorbereitung führt bei bereits VERIFIED sieben SOAP-Aufrufe
aus. Mit ausdrücklich angeforderter Eingabe sind es 15: vorangehende Karten-/
Zertifikatsprüfung, PIN-Status, ein VerifyPin, eine vollständige erneute
Karten-/Zertifikatsprüfung und abschließender PIN-Status. Eine kontrollierte
Uhrverschiebung um 45 Sekunden während der Terminalantwort belegt die erneute
Beschaffung statt einer Verlängerung alter Belege; sie simuliert keine echte
45 Sekunden dauernde Hardwarebedienung.

Entfernung, neues Handle oder Änderung der Einsteckzeit während der Eingabe,
ein danach abweichendes gültiges ENC-Zertifikat, ein negatives VerifyCertificate
oder eine echte signierte Sperrauskunft für das danach gelesene AUT verhindern
ein vorbereitetes Ergebnis. Der Sperrfall bestätigt ausdrücklich, dass zuvor
genau ein PIN-Versuch und anschließend ein zweites Zertifikatslesen stattfanden.
VerifyPin OK ohne abschließendes VERIFIED reicht nicht. TSL-Aktualisierung oder
Abbruch während der letzten Statusabfrage lassen keine frühere Freigabe gelten.
Kopierte Gesamtbelege, fremde Statusclients und spätere Statusabfragen können
den privaten Vorbereitungsbeleg nicht weiterverwenden. Änderungen der
übergebenen Rollenliste verändern den laufenden Ablauf nicht.

Alle Ausgaben bleiben `held-for-trust-validation` und `unverified`. Nachgewiesen
ist eine Dienstschnittstelle gegen lokale Gegenstellen, keine physische
PIN-Pad-Bedienung, verteilte Terminalsperre, entfernte Dialogstornierung oder
Kartenabmeldung. Hardware-/TI-Anschluss, Hostkoordination, Oberfläche,
PIN-Initialisierung/-Entsperrung, Karten-Schlüsseloperationen und unabhängige
Prüfung/Zulassung bleiben offen. [Vertrag und Grenzen](konnektor-pin.md).

## GetCards und SMC-B-Zertifikatsablauf am 22.10.2026

**61 neue Fälle** erweitern die bisherigen 684 Prüfungen: 36 Kartenabfrage-/
Auswahl-/XML-Fälle sowie 25 Integrationen im vorhandenen TSL-/OCSP-Testverbund.
Der gezielte Karten-/Zertifikatslauf bestand mit 91 Fällen in rund 10,0 Sekunden;
der damalige Gesamtlauf prüfte alle 745 Fälle gemeinsam. Es wurde keine neue
Laufzeit oder Testinfrastruktur eingerichtet.

GetCards sendet echte mTLS-Anfragen an den eigenen EventService-Endpunkt mit
offizieller SOAPAction, Kontext, Terminal-/Steckplatz-/Typfiltern und ausdrücklich
gewähltem Arbeitsplatz- oder Mandantenbereich. Die Antworten werden gegen die
festgeschriebenen offiziellen Schemata geprüft. Alle sechs ergänzten Dateien
wurden nach LF-Normalisierung zusätzlich mit den abgerufenen Originalen
bytegenau verglichen. Namen und KVNR aus den Antwortbytes fehlen in der Ausgabe.
Leere Listen bleiben leer; mehrere Karten erfordern eine passende Auswahl.
Doppelte Handles, Terminal-/Steckplatzpaare oder ICCSN, fehlende
Identifikationsdaten, ignorierte Filter und fremde Kartentypen scheitern.

Kopierte Listen/Auswahlen und fremde Clients erhalten keinen privaten
Kartensitzungsbeleg. Ablauf, Uhr-Rücksprung, Abbruch und Schließen entwerten ihn.
Eine fehlgeschlagene Aktualisierung lässt die vorherige Auswahl nicht weiter
gelten. Eine ältere Antwort, die zuletzt eintrifft, kann einen neueren Snapshot
nicht ersetzen. Ungültige Eingaben und fehlende/fremde Endpunkte senden keine
Anfrage. Falsche Operationen, Namespaces, doppelte Listen, ungültige Werte,
Zeitangaben ohne Zeitzone, übergroße Listen und Warnbefunde werden abgewiesen.

Der gemeinsame Ablauf liest tatsächliche AUT-/ENC-/OSIG-Zertifikate, fragt
signierte lokale OCSP-Belege ab und führt für jedes Zertifikat VerifyCertificate
aus. Eine zweite GetCards-Abfrage bestätigt dieselbe Kartensitzung, bevor die
Rohbelege erneut ausgewertet werden. Die explizite Auswahl unter zwei Karten
übergibt das richtige CardHandle. Gesperrte/unbekannte Statuswerte, fremde
erwartete oder enthaltene Telematik-IDs, falsche Rollen, vertauschte Referenzen,
fehlende Zertifikate und negative Konnektorbefunde verhindern ein Ergebnis.
Ein unabhängig positiv geprüftes HBA-AUT wird trotz passenden Rollen nicht
als SMC-B-AUT akzeptiert.

Entfernen, neues Handle, geänderte Einsteckzeit, Seriennummer, Terminal oder
Kartenversion während der Prüfung verhindern die alte Zuordnung. Auch
Zeitänderungen unterhalb einer Millisekunde bleiben im Vergleich erhalten.
TSL-Wechsel und Abbruch während der abschließenden Kartenabfrage lassen keinen
früheren Erfolg bestehen. Spätere Kartenaktualisierung oder mutierte
Zertifikatsausgabe entwerten das Gesamtpaket. Veränderung der übergebenen
Rollenliste beeinflusst keinen bereits gestarteten Ablauf. Fehlende
Einrichtungs-ID, leere/ungültige Rollen, erfundene Instanzen und ein Wechsel
zwischen Test-/Produktionsumgebung scheitern vor dem ersten Netzaufruf.

Die Ausgabe bleibt `held-for-trust-validation` mit `identityStatus: unverified`.
Die Kartensitzungsprüfung besteht aus zwei Momentaufnahmen; sie ersetzt keine
physische Entnahmeüberwachung oder atomare Bindung an eine spätere
Schlüsseloperation. Reale Hardware-/TI-Interoperabilität, Kartenschlüssel und
PIN-Betrieb, Auswahloberfläche und unabhängige Prüfung/Zulassung bleiben offen.
Keine Änderung produktiver Daten, UI oder Android und keine echten Empfänger.
[Schnittstellen, Quellen und Grenzen](konnektor-smcb.md).

## Konnektor-CertificateService am 22.10.2026

**65 neue Fälle** erweitern die bisherigen 619 Prüfungen: 55 SOAP-/XML-/mTLS-
und Clientfälle sowie zehn Empfangsintegrationen. Der gezielte gemeinsame
65-Fälle-Lauf bestand in rund 19,2 Sekunden; der damalige Abschlusslauf
prüfte alle 684 Fälle gemeinsam in rund 62,1 Sekunden.

Die lokale Gegenstelle verlangt ein tatsächliches Clientzertifikat und prüft
die empfangenen SOAPAction-, Kontext- und DER-Bytes. Offizielle festgeschriebene
Schemata prüfen beide Operationen, nicht nur die erzeugenden Hilfsfunktionen.
ReadCardCertificate wird mit allen drei Standardreferenzen und explizitem ECC
ausgeführt; fehlende/fremde/doppelte Referenzen, falsche Schlüsselart und
ungültiges DER scheitern. Ausdrücklich gewähltes RSA-Lesen ist getrennt geprüft.
Anzeigenamen im Antwort-XML werden nicht als Zertifikatsidentität verwendet.

HTTP 200 mit INVALID/INCONCLUSIVE, fehlende Rollen und widersprüchliche
Ausführungs-/Zertifikatsstatus bestehen keine Belegprüfung. SOAP Faults bei
HTTP 200/500 geben ausschließlich begrenzte numerische Codes aus. Fremde
Operationen/Namensräume, SOAP 1.2, doppelte Bodies/Ergebnisse, verschachtelte
Nutzlasten, Zusatzfelder, nichtleere Header, Encoding, DTD/Entitäten,
Verarbeitungsanweisungen, UTF-16 und überschrittene Rollenlimits werden
abgewiesen. Namespace-Aliase, zulässiger Leerraum und ein leerer Header bestehen.
Redirects, HTTP-Fehler, falsche Medien-/Kompressionsformate, Übergröße und
abgebrochene Antworten scheitern. Falsche CA, Hostname, Serverpin oder
Clientschlüssel erzeugen keine SOAP-Anwendungsdaten am Server.

Die Tests binden Belege an tatsächliche Zertifikatbytes und Clientkontexte,
verwerfen Kopien und erfundene Ergebnisse und prüfen Uhr-Rücksprung, Ablauf,
Abbruch, Timeout und Schließen. Die achte parallele Anfrage wird verarbeitet,
die neunte vor weiterer SOAP-Arbeit abgewiesen; Schließen beendet alle acht
wartenden Vorgänge. Der gemeinsame Kartenablauf prüft frühere Belege nach der
letzten asynchronen Antwort erneut. Mutierte Eingabepuffer/Rollen/Kontexte
verändern keine laufende Anfrage; mutierte Ausgabepuffer bestehen keine
nachträgliche Belegprüfung.

Der Empfang verwendet reale signierte CMS-/TSL-/OCSP-Bytes und tatsächliche
LDAPS-/mTLS-Verbindungen. Der passende OSIG-Zweig benötigt nur einen
VerifyCertificate-Aufruf; der abweichende Zweig prüft OSIG und das tatsächliche
AUT-x5c-Leaf. Beide PEM- und DER-Eingaben des bisherigen Empfangs sind dabei
abgedeckt. Negative, unbestimmte, rollenfremde oder fehlerhafte Konnektorantworten
erlauben trotz guten lokalen OCSP keinen Ausweichpfad und vor positivem OSIG
keine LDAP-Abfrage. Schließen während LDAP entwertet den früheren Konnektor-
Erfolg. Falsche Umgebung, fehlendes Verzeichnis und ein erfundener Client
scheitern vor dem Netzaufruf.

Alle erfolgreichen lokalen Empfangszweige bleiben Diagnose 07 mit
`identityStatus: unverified` und `deliveryStatus: diagnostic-only`.
Keine Installation, echte TI-/Konnektor-/Kartenabfrage oder Änderung an
Produktionsdaten, UI oder Android. Reale TI-/SMC-B-Interoperabilität,
Karten-Schlüsseloperationen und unabhängige Prüfung/Zulassung bleiben offen.
[Vertrag, Verwendung, Quellen und genaue Profilgrenzen](konnektor-certificates.md).

## Bedingte AUT-Prüfung beim Empfang am 22.10.2026

**45 neue Fälle** erweitern die bisherigen 574 Prüfungen. Der abschließende
`npm run verify:gkv:services`-Lauf prüft den gesamten Bestand gemeinsam.
Die Nachrichten enthalten echte CMS-Signaturen und Ciphertextbytes. Geänderte
AUT-Werte werden erneut in die signierte innere Nachricht eingebaut; die
Verzweigung wird durch tatsächliche LDAPS-Einträge und signierte OCSP-Belege
ausgelöst.

Bei passender OSIG-/VZD-ID entfallen AUT-Prüfung und Statusanfrage auch bei
fehlendem, einseitigem, doppeltem, ungleichem oder manipuliertem AUT. Audience,
Absender, nbf, Produktkennung, Algorithmus und doppelte Claims sind als
Fehlvarianten in beiden Empfangszweigen geprüft. Bei abweichender OSIG-ID
scheitern dieselben Tokens mit Diagnose 10 vor der AUT-Statusabfrage.
Ein übersprungener AUT-Befund wird nicht als positiv dargestellt.

Das tatsächliche x5c-Leaf funktioniert im erforderlichen AUT-Zweig ohne
vorgegebenes Leaf und ohne erneute FD-Annahmefrist. Ein zusätzlich übergebener
Pin muss exakt passen. Manipulierte Ausstellersignatur, falsche Zertifikatsrolle,
fehlende Admission, gesperrter/unbekannter Status und HTTP-Ausfall werden
abgelehnt. OSIG-/VZD-Fehler erlauben keinen AUT-Ausweichpfad. Aufruferflags,
überschriebene Statusmethoden und kopierte Inspektionsobjekte erzeugen keine
Prüfbelege. Andere geschützte Header bleiben vor jeder Netzabfrage verpflichtend.

Ein TSL-Wechsel während AUT-OCSP entwertet vorherige Belege. Der getrennte
Ablauffall verwendet einen noch gültigen, älteren Serverbeleg und eine passend
rückdatierte Test-Responderurkunde: Läuft nur der Serverbeleg während AUT-OCSP
ab, bleibt das Ergebnis trotz positiver OSIG-/AUT-Belege `XCS_DIRECTORY`.
Abbruch während AUT-OCSP sowie nach LDAP-Bind verhindert die Fortsetzung.
Nachträgliche Eingabe-/Zertifikats-/Berichtsänderungen verändern die kopierte
Prüfgrundlage nicht. Der ausdrücklich angeforderte Diagnoseanhang enthält die
unveränderten geschützten Originalbytes; standardmäßig bleibt er aus.

Alle positiven lokalen Zweige bleiben Diagnose 07 mit `identityStatus:
unverified` und `deliveryStatus: diagnostic-only`. Keine Installation,
UI-/Android-/Supabase-/Produktionsänderung oder echte TI-Abfrage. Die vier
Vercel-Builds des Vorgängers `fe4c3fbb` sind erfolgreich bestätigt; dies ist
kein Buildnachweis für den neuen Commit. [Schnittstelle, Normbezug und offene
Profil-/Integrationsgrenzen](conditional-aut-receive.md).

## VZD-Serverzertifikat vor LDAP am 22.10.2026

32 neue Zertifikats-/Admission-Fälle und 19 neue Integrationsfälle erweitern
den Bestand um 51 Fälle. Der Gesamtlauf bestand zunächst mit **573 Fällen**,
0 Fehlern und 0 übersprungenen Fällen in rund 29,9 Sekunden. Anschließend wurde
die Nachprüfung des Serverbelegs nach der letzten asynchronen Grenze des
Empfangs ergänzt. Der dafür erneut ausgeführte vollständige
`tsl-ocsp.test.mjs`-Lauf bestand mit **80 Fällen**, einschließlich des zusätzlich
ergänzten Falls, in rund 23,1 Sekunden. Damit sind 574 unterschiedliche Fälle
erfolgreich geprüft; für dieses frühere Inkrement gab es keinen gemeinsamen
574-Fälle-Lauf. Der aktuelle gemeinsame Gesamtlauf ist oben dokumentiert.

OpenSSL stellt echte ECC-Serverzertifikate mit C.ZD.TLS-S, gematik-Policy und
technischer VZD-Admission aus. Geänderte Erweiterungen werden erneut mit der
isolierten CA signiert. Fehlende/falsche Rollen, Teilnehmer-IDs im technischen
Admission, falsche KU/EKU, SAN/CN-Abweichungen, doppelte Erweiterungen, fremde
Subject-Felder und nicht unterstützte Schlüsselprofile scheitern trotz gültiger
CA-Signatur. P-256 und Brainpool-P256 sind geprüft. Fehlende CA-Typberechtigung,
gesperrte CA und veränderte Signatur geben keinen Serverpfad frei.

Die Integration prüft echte LDAPS-Sockets und tatsächliche OCSP-Antworten.
Vor positivem Serverbefund erhält der Peer weder Bind noch Search. Negative
Cachebelege, falsche Rollen trotz früherem positivem Cache, gewöhnliche gepinnte
TLS-Zertifikate, HTTP-Ausfälle und fremde Statusbelege verhindern LDAP.
Listenwechsel während OCSP verhindern Bind; Wechsel nach Bind verhindern Search.
Ablauf während Search verhindert die Ausgabe eines Eintrags. Abbruch, absolute
Frist und unaufgeforderte frühe Serverdaten können keine spätere Anfrage freigeben.
TLS 1.2 und TLS 1.3 mit AES-GCM funktionieren; eine nicht angebotene Kurve scheitert.
Kopierte/erfundene Evidenzobjekte und reine Pin-Prüfungen bestehen die interne
Servernachprüfung nicht. Der Empfang behält den Rohbeleg bis zur letzten
Nachprüfung und gibt weiterhin ausschließlich Diagnosen aus.

Die Statusfrist entspricht der vorhandenen nonQES-Regel A_23225 mit einer
Stunde ab `producedAt`; sie ist kein Konnektor-VerifyCertificate-Ergebnis-Cache.
Keine Installation, echte TI-Abfrage, Produktions- oder UI-/Android-Änderung.
Für den Vorgänger `6d2ce3b2` waren bei der Prüfung zwei Vercel-Projekte erfolgreich
und zwei noch ausstehend; dies belegt keinen Build des neuen Commits.
[Schnittstellen, Quellen und verbleibende Profilgrenzen](vzd-server-certificate.md).

## Verzeichnisabfrage und Adressbindung am 22.10.2026

Die bisherigen 473 Fälle und **50 neue Prüfungen** bestehen gemeinsam:
**523 bestanden, 0 fehlgeschlagen, 0 übersprungen**, rund 24,6 Sekunden.
Der gezielte Lauf von `vzd.test.mjs` und `tsl-ocsp.test.mjs` besteht mit
96 Fällen. Davon sind 35 LDAP- und 15 Integrationsfälle neu.

Die lokale Gegenstelle prüft echte TLS-Verbindungen und die tatsächlichen
LDAPv3-Anfragen. Bind-Antworten und Ergebnisabschlüsse verwenden feste
Protokollbytes. Fragmentierte und zusammengefasste Antworten, nichtminimale
definite BER-Längen, wörtliche Sterne in Adressen, reine kimData-Einträge und
Versions-/Anwendungsdaten sind geprüft. Fehlende, doppelte, mehrdeutige und
widersprüchliche Zuordnungen, fremde Message-IDs, Referenzen, Teilantworten,
Größen-/Wertgrenzen, ungültiges UTF8, Timeout und Abbruch werden zurückgewiesen.
Falscher TLS-Pin und Hostname verhindern LDAP-Anwendungsdaten. Nicht konfigurierte
CA-Daten, Umgebungswechsel und überzählige parallele Abfragen werden blockiert.

Der Zertifikatsresolver erhält echte ENC-Zertifikate über LDAPS, prüft aktuelle
signierte TSL-/OCSP-Belege und gleicht jede Admission-ID mit dem Verzeichniseintrag
ab. Die daraus erzeugte ECC-Nachricht lässt sich mit beiden Schlüsseln eines
Empfänger-Schlüsselwechsels entschlüsseln. Gesperrte/unbekannte Statuswerte,
abweichende IDs, falscher Zertifikatstyp und PEM statt DER werden abgelehnt.
Ein TSL-Wechsel während späterer LDAP-Abfragen und veränderte Ausgabepuffer
machen die ursprüngliche Auswahl ungültig.

Beim Empfang sind der direkte OSIG-Abgleich und der getrennte AUT-Abgleich
belegt. Die OSIG-/AUT-IDs dürfen verschieden sein; ein positiver Status allein
genügt nicht. Fehlende Zuordnung ergibt `XCS_DIRECTORY`; negative oder nach
LDAP ungültige Rohbelege ergeben weiterhin `XCS_CERT_STATUS`. Fehlerhafte
Nachrichten und negative Zertifikatsbefunde lösen keine Verzeichnisabfrage aus.
Positive lokale Zuordnung bleibt Diagnose 07, ohne normale Zustellung.

Keine Installation, echte TI-Abfrage, Produktionsänderung oder Änderung an
Oberflächen/Android. Die vier Vercel-Builds des Vorgängers `c7f5f997` sind
am 22.10.2026 erfolgreich bestätigt; dies ist kein Buildnachweis für den neuen
Commit. Die damals noch offene TI-VZD-Serverrolle/-Sperrprüfung ist im obigen
Abschnitt als begrenzter eigener Pfad ergänzt. Konnektor, unabhängige
Interoperabilität und Produktivbetrieb bleiben offen. [Schnittstellen und Grenzen](vzd.md).

## Admission-Rollen und Telematik-ID am 21.10.2026

Die bisherigen 418 Fälle und **55 neue Prüfungen** bestehen gemeinsam:
**473 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Davon prüft
`certificate-admission.test.mjs` 51 neue Fälle; vier weitere ergänzen die
bestehenden TSL-/OCSP-Integrationstests. Der Gesamtlauf dauert rund 19,5 Sekunden.

Geprüft sind alle fünf unterstützten KIM-Zertifikatstypen, passende und
unpassende Berufs-/Institutionenrollen, mehrere Berufe mit gleicher ID,
fehlende/widersprüchliche IDs, exakter Zeichenvergleich und die Längengrenzen.
Ungültige DER-/UTF8-Kodierung, doppelte Rollen, unbekannte Typen/Rollen,
fehlgeformte optionale Felder und verschachtelte Scheinidentitäten werden
abgelehnt oder als ausdrücklich opake Zusatzdaten behandelt. Die tatsächlichen
CA-Signaturen werden bei Teständerungen neu erzeugt; eine gültige Signatur
ersetzt die Admission-Prüfung nicht.
Der festgeschriebene Rollenbestand wurde zusätzlich direkt mit den amtlichen
Tabellen aus gemSpec_OID 3.26.0 abgeglichen: 42 Berufsgruppen und 64 Institutionen
stimmen exakt überein; die Versichertenrolle bleibt ausdrücklich ausgeschlossen.

OpenSSL erzeugt eine Admission aus eigener ASN.1-Konfiguration, die der neue
Parser auswertet. OpenSSL liest ihre Rollen-OID und Telematik-ID unabhängig
aus dem neu signierten Zertifikat. Reale lokale HTTPS-/OCSP-Abfragen belegen,
dass fehlerhafte AUT-Attribute beide Anfragen vor dem ersten Netzaufruf
blockieren und ein früher gespeicherter positiver Beleg ohne Admission nicht
mehr verwendet wird. Alte Managerzugriffe scheitern nach Listenwechsel.
OSIG-/AUT-IDs werden getrennt ausgegeben und nicht pauschal gleichgesetzt.

Zwei Empfängerzertifikate derselben ID können ihre tatsächlich verschlüsselten
Kopien entschlüsseln. Unterschiedliche IDs für dieselbe Adresse blockieren
die Erzeugung. Ein mathematisch gültiges AUT-Token mit einer fehlenden Admission
scheitert beim Empfang. Die bestehende Diagnose gibt weiterhin keine normale
Zustellung frei; Klartextanhänge bleiben standardmäßig ausgeschaltet.

Vorhandene Laufzeiten, keine Installation, UI-/Android-/Produktionsänderung
oder Anfrage an echte TI-Gegenstellen. Das FD-Inventar bleibt bei 106 Kennungen:
28 teilweise lokal belegt, 78 offen. [Schnittstellen und verbleibende Grenzen](certificate-admission.md).

## Zertifikatstyp und CA-Freigabe am 21.10.2026

Die bisherigen 378 Fälle und **40 neue Prüfungen** bestehen gemeinsam:
**418 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Der gemeinsame Policy-Parser
wird durch `certificate-policy.test.mjs` geprüft. Die bestehende
`tsl-ocsp.test.mjs` ergänzt vier Fälle mit tatsächlichen HTTPS-Anfragen und
geänderten signierten Listen.

Geprüft sind die fünf unterstützten OSIG-/AUT-/ENC-Typen, die Unterscheidung zur
Ausstellungsrichtlinie, Typ-Qualifier, doppelte und mehrdeutige Kennungen,
nichtminimale/abgeschnittene DER-OIDs, fehlerhafte erlaubte Listen und Größen.
Zertifikate mit absichtlich geänderten Erweiterungen werden tatsächlich neu
signiert; ihre gültige CA-Signatur hebt Typfehler nicht auf. OpenSSL liest die
Typ- und Richtlinienkennungen eines gültigen Testzertifikats unabhängig vom
eigenen DER-Parser. ECC-CMS und AUT lehnen ungültige Typstrukturen vor dem
Signieren ab.

Die vollständige TSL-Signatur-/XSD-Prüfung verarbeitet CA-ExtensionOIDs.
Fehlende Freigaben, OIDs in fremden Namespaces, verschachtelte Kennungen und
richtige Textetiketten mit falscher numerischer OID autorisieren keinen Typ.
Doppelte oder fehlerhafte Erweiterungen und kritische Angaben werden abgelehnt.
Opake komplexe Werte geben keine zusätzlichen OIDs frei. Ein OCSP-Diensteintrag
kann einer CA keine Typberechtigung erteilen.

Fehlender Zweck, Zweckwechsel und fehlende AUT-CA-Freigabe erzeugen keine
Statusanfrage. Wird die Typfreigabe entzogen, scheitert auch der vorhandene
positive Cachebeleg. Erst eine neue ausdrücklich erlaubende Liste ermöglicht
seine erneute Prüfung. Ein Entzug während der HTTPS-Anfrage verhindert eine
spätere positive Speicherung. Die Empfangsdiagnose enthält die geprüften Typen;
TI-Identität und normale Zustellung bleiben unbestätigt.

Zehn betroffene MJS-Dateien und beide geänderten Python-Dateien sind syntaktisch
geprüft; das Anforderungs-JSON ist gültig und `git diff --check` ohne Befund.
FD-Inventar unverändert: 106 Kennungen, 28 teilweise lokal belegt und 78 offen.
Vorhandene Laufzeiten, keine Installation und keine produktive TI-Abfrage.
Alle vier Vercel-Projekte haben den vorherigen Commit **3d8ba15** erfolgreich
gebaut. Der neue Commit wird separat in PR #129 geprüft.
[Schnittstellenänderung, Grenzen und Primärquellen](certificate-types.md).

## TSL-gebundene Statusprüfung am 21.10.2026

Die bisherigen 340 Fälle und **38 neue Prüfungen** bestehen gemeinsam.
`tsl-ocsp.test.mjs` verwendet echte lokale HTTPS-Verbindungen, authentisierte
TSL-Originale samt XSD, signierte OCSP-Antworten, verschlüsselte SQLite-Ablage
und eine tatsächlich ECC-verschlüsselte KIM-Nachricht. Gesamtlauf:
**378 bestanden, 0 fehlgeschlagen, 0 übersprungen**.

Geprüft sind die CA-ServiceSupplyPoint-Auswahl unabhängig von Leaf-AIA und
Responder-Service-URL, fehlende/unzulässige/mehrdeutige Routen, CA-Eingaben,
veränderte Zertifikate, fehlende AKI und das ausdrücklich gewählte
CA-Kompromissmodell mit Ausstellungszeitgrenze. Ein neuer CA-Endpunkt kann
keinen Beleg aus dem vorherigen Routencache übernehmen.

Die Cacheprüfungen umfassen Neustart, gleiche Listen mit erneuerten Handles,
negative Befunde, manipulierte Verschlüsselung, Konfigurations-/Namespacewechsel,
parallele Clients, Quoten, Timeout, Abbruch und dauerhaftes Protokollfehler-Backoff.
Entfernte Responder sowie Listenwechsel während eines laufenden Abrufs können
keine alten Belege freigeben. Neue Responder mit gleichem Namen werden über
ihre tatsächliche Signatur ausgewählt; eine frische Antwort vom entfernten
Schlüssel bleibt gesperrt. Das vorherige verschlüsselte Cacheformat bleibt
lesbar, scheitert beim gleichnamigen Schlüsselwechsel aber ohne neue
Respondermetadaten bis zum Ablauf. Diese Rollback-/Migrationsgrenze ist
ausdrücklich [dokumentiert](tsl-ocsp.md).

Der tatsächliche Empfang prüft beide Rohbelege erneut und erhält Diagnose 07
ohne Klartextanhang. Sperrung, unbekannter Status und Fehler einer Einzelrolle
werden getrennt berichtet. Fehlerhafte Nachrichten, fehlende Schlüssel und
ungültige Berichtsoptionen lösen keine Statusanfragen aus. Vorgetäuschte
`good`-Flags und asynchrone Änderungen an Originalbytes/Zertifikaten/Berichtsflags
geben keinen anderen Inhalt frei. Unverschlüsselte Nachrichten bleiben bytegleich.

Neun betroffene MJS-Dateien bestehen `node --check`, die geänderte Python-Fixture
und das Anforderungs-JSON die Syntaxprüfung. Die Änderungen bestehen
`git diff --check`. Das FD-Inventar bleibt bei 106 Kennungen: 28 teilweise lokal
belegt, 78 offen. Keine Installation, UI-/Android-/Supabase-/Produktionsänderung
oder echte TI-/Statusabfrage. Alle vier Vercel-Projekte haben den vorherigen
Commit **176a9b1** erfolgreich gebaut. Inzwischen haben alle vier Vercel-Projekte
auch diesen Stand **3d8ba15** erfolgreich gebaut.

## Automatische TSL-Aktualisierung am 21.10.2026

Die bisherigen 292 Fälle und **48 neue Prüfungen** bestehen gemeinsam.
`tsl-refresh.test.mjs` verwendet eine echte lokale HTTPS-Gegenstelle, isolierte
Zertifikate mit AIA, signierte OCSP-Rohbelege, beide TSL-Signaturen, das komplette
XSD und die verschlüsselte SQLite-Ablage. Der vollständige Lauf ergibt
**340 bestanden, 0 fehlgeschlagen, 0 übersprungen**.

Geprüft sind Erstabruf, zwingender Hashvergleich ohne XML-Fallback, unveränderte
Originale mit erneutem Statuscheck, Statuserneuerung nach Ablauf, spätere Sperrung,
Neustart und Migration des bisherigen verschlüsselten v1-Ablageformats.
Listen-/Signaturspiegelabweichungen, gebrochene innere Signatur, ungültige Hashes,
fehlende/mehrdeutige/unzulässige AIA, unbekannter oder gesperrter Signierer sowie
vier OCSP-Protokollfehler mit anschließendem dauerhaftem Backoff scheitern.

Ein Listenwechsel entfernt bisherige Dienste auch aus bereits ausgegebenen
OCSP-Prüfern. Eine konkurrierende Store-Aktivierung, manipulierte Metadaten,
Quellenwechsel, gelöschte Kontroll-/Quellendatensätze und ein Zeitrücksprung geben
keinen alten Stand frei. Ablauf und Fehler erhalten den dauerhaften höchsten
Listenstand. Gleichzeitig gestartete Updates teilen einen Lauf. Gesamtabbruch,
Schließen und Abbruch im XML-Worker verhindern verspätete TSL-Aktivierung; ein
geteilter Statuscache kann seinen eigenen Abruf trotzdem gültig abschließen.

HTTPS-CA und Hostname bleiben bei fester IP geprüft. Getestet sind Weiterleitungen,
falsche/mehrfache Header, Medientypen, Komprimierung, Größen, unvollständige und
hängende Antworten, Abbruch, Konfigurationskopien und explizite HTTP-Freigabe für
separate Signaturen. Der periodische Ablauf einschließlich Fehlerwiederholung
und Schließen ist mit echten Netzwerkabrufen und kontrollierten Timern geprüft.

Neun betroffene MJS-Dateien bestehen `node --check`; Anforderungs-JSON und eigene
Änderungen bestehen Syntax-/Whitespace-Prüfung. Das FD-Inventar bleibt bei
106 Kennungen: 28 teilweise lokal belegt, 78 offen. Vorhandene Laufzeiten,
keine Installation oder neue Infrastruktur. Keine UI-/Android-/Supabase- oder
Produktionsänderung und keine Abfrage echter TSL-/OCSP-Dienste.
Alle vier Vercel-Projekte haben diesen Stand **176a9b1** erfolgreich gebaut.
Ein Web-Build belegt keine Python-/lxml-Laufzeit des Diensthosts.
[Ablauf und Betriebsgrenzen](tsl-refresh.md).

## TSL-Import und Versionskontrolle am 21.10.2026

Die bisherigen 249 Fälle und **43 neue Prüfungen** bestehen gemeinsam.
`tsl.test.mjs` prüft echte separate und eingebettete ECC-/RSA-PSS-Signaturen,
Signierer-EKU/KeyUsage, fremde CA-Schlüssel, tatsächliche OCSP-Rohbelege und
vier XML-Kanonisierungsvarianten mit Namespaces, Einrückung und Kommentaren.
OpenSSL bestätigt die separate ECC-Signatur unabhängig vom Node-Verifier.
Die vollständige XSD-Prüfung verwendet das fest gebundene gematik-Schema-Bündel
mit der vorhandenen lxml-6.1.1-/libxml2-2.14.6-Laufzeit. Kein vereinfachter
Testparser und keine Installation.

Manipulierte XML-/Signaturbytes, DTD/XXE, externe Referenzen, doppelte IDs,
Signatur-Wrapping, fremde kritische Erweiterungen, unzulässige Signierer,
gesperrte/unbekannte/veraltete Statusbelege und abgelaufene Listen scheitern.
Die Vorbereitung des Signiererstatus gibt noch keinen TSL-Snapshot frei.
Eingabekopien und nach der XML-Verarbeitung wiederholte Fristprüfungen schützen
gegen Änderungen während der asynchronen Prüfung.

Geprüft sind aktuelle und gesperrte CA-Dienste einschließlich expliziter
Ausstellungszeitgrenze, fehlende/zukünftige Responder und doppelte Identitäten.
Die verschlüsselte Ablage wird erneut geöffnet und vollständig nachgeprüft.
Falscher Schlüssel, Umgebungs-/Profilwechsel, veränderte Versionsmetadaten,
Rücksprünge und widersprüchliche gleiche Versionen werden abgewiesen.
Konkurrierende Instanzen können keinen höheren Stand überschreiben; Ablauf
löscht die Versionsgrenze nicht, und Schließen verhindert verspätete Aktivierung.

Gesamtlauf: **292 bestanden, 0 fehlgeschlagen, 0 übersprungen**.
Vier MJS-Dateien, beide Python-Dateien und das Anforderungs-JSON sind syntaktisch
geprüft. Die eigenen Änderungen bestehen `git diff --cached --check`;
vorhandene Leerzeichen am Zeilenende in den bytegleich übernommenen und
hashgebundenen Original-XSDs bleiben absichtlich erhalten.
Keine UI-/Android-/Supabase- oder Produktionsänderung; keine echte TI-/OCSP-
Abfrage. Die Anker sind lokal provisioniert. Die in diesem Zwischenstand noch fehlende
automatische TSL-Beschaffung ist oben ergänzt; Ankerrotation, vollständige
TI-Pfad-/Rollenprüfung, VZD und Konnektorintegration bleiben offen. [Schnittstellen, Laufzeit und genaue Grenzen](tsl.md).
Alle vier Vercel-Projekte haben inzwischen auch diesen Stand **62bd8ba**
erfolgreich gebaut.
Die Python-Diensthost-Laufzeit wird durch einen Web-Build nicht nachgewiesen.

## OCSP-Abruf und dauerhafte Belege am 21.10.2026

Die bisherigen 223 Fälle und **26 neue Prüfungen** bestehen gemeinsam.
`kim-ocsp-online.test.mjs` verwendet echte HTTP-/HTTPS-Verbindungen auf Loopback
mit eigener Test-PKI. Geprüft sind CA-/Hostnamenprüfung trotz fester Verbindungs-IP,
exakte POST-Bytes, Weiterleitungsablehnung, Header-/Format-/Größengrenzen,
unvollständige Antworten, absolute Frist bei tröpfelndem Body und Abbruch.

Die verschlüsselte SQLite-Ablage überlebt Wiederöffnen und Prozesswechsel.
Falsche Schlüssel, Konfigurationswechsel, verschobene Datensätze und veränderte
Ablaufdaten scheitern. Aktuelle Rohbelege werden mit erneuerten Pins erneut
geprüft, auch negative Befunde; Zeitablauf und Rücksprünge werden kontrolliert.
Vier Protokollfehler erzeugen einen über Neustart wirksamen fünfminütigen Backoff.
Quoten, Timeout und Schließen geben keine verspäteten Belege frei.

Getrennte Instanzen und Prozesse teilen eine Beschaffung. Tatsächliches SIGKILL
während einer HTTP-Anfrage hinterlässt einen befristeten Claim; nach Ablauf
kann ein anderer Prozess sicher übernehmen. Ein alter Eigentümer kann weder
den neuen Claim löschen noch dessen Ergebnis mit seiner späten Antwort ersetzen.
Wieder geöffnete OSIG-/AUT-Belege durchlaufen den echten verschlüsselten
KIM-Empfang: Originalhashbindung, Diagnose 07 und kein Klartextanhang bleiben erhalten.

Gesamtprozess: **249 bestanden, 0 fehlgeschlagen, 0 übersprungen**.
Vier neue MJS-Dateien bestehen `node --check`; `git diff --check` ist ohne Befund.
Keine Installation, UI-/Android-/Supabase- oder Produktionsänderung; keine Abfrage
echter OCSP-Dienste. Authentisierte TSL, produktiver Dienstanschluss und
Konnektorintegration bleiben offen. [Details](ocsp-online.md).
Alle vier Vercel-Projekte haben den Vorgänger **2cb559a** erfolgreich gebaut;
der Buildstatus des neuen Commits wird gesondert in PR #129 dokumentiert.

## Vorherige OCSP-Statusprüfung am 21.10.2026

Die bisherigen 198 Fälle und **25 neue Prüfungen** bestehen gemeinsam.
`kim-ocsp.test.mjs` prüft reale ECDSA-/RSA-PSS-Antworten, CertID-/certHash-
Bindung, Sperrstatus, strikte Zeitgrenzen, falsche Signierer, Manipulationen,
DER-/Erweiterungs-/Größenfehler, Snapshotablauf und den KIM-Empfangsbericht.
Positive Statusbelege allein erzeugen weiterhin keine TI-Identität oder Zustellung.

OpenSSL liest die eigene Anfrage und prüft die eigene Antwort samt Status.
Eine von OpenSSL erzeugte Antwort wird umgekehrt bis zu ihrer fehlenden
TI-certHash-Erweiterung verarbeitet und dort abgelehnt. Cacheprüfungen belegen
Wiederverwendung, gemeinsame laufende Beschaffung, negative Befunde, Ablauf,
Kapazität, Timeout und Schließen ohne Übernahme verspäteter Antworten.

Gesamtprozess: **223 bestanden, 0 fehlgeschlagen, 0 übersprungen**.
Vorhandene Laufzeit, keine Installation, UI-/Android-/Datenbank- oder
Produktionsänderung. Der damalige Stand enthielt noch keinen dauerhaften Abruf;
dieser ist oben gesondert belegt. Vollständige TI-Vertrauensprüfung und
Konnektorintegration bleiben offen. [Details](ocsp.md).
Alle vier Vercel-Projekte haben den Vorgänger **9746200** erfolgreich gebaut.

## KIM-Empfangsdiagnosen am 21.10.2026

Die bisherigen 179 Fälle und **19 neue Prüfungen** bestehen gemeinsam.
`kim-receive-error.test.mjs` prüft Versions-/Format-/Schlüsselfehler, GCM- und
Signaturmanipulationen, eigene Codes bei unklaren Ursachen, Headerbereinigung,
Ergebnis 07 bei ausstehendem Vertrauen, einmalige UUID-Referenzen, unveränderte
Originalbytes und den standardmäßig ausgeschalteten Klartextanhang.

Pythons eigenständiger Standardbibliotheksparser liest die tatsächlichen
MIME-Nachrichten, Unicode-Betreffzeilen, Quoted-Printable-Texte und Base64-Berichte.
RFC822-Anhänge werden zusätzlich bytegenau geprüft, auch mit Binärbytes und
fehlenden/abschließenden CRLFs. XML-Berichte sind an den Originalhash gebunden;
das belegt keine XSD- oder Echtheitsprüfung dieser externen Berichte.

Der bestehende echte SMTP-/POP3-/Inbox-Test erzeugt daraus die 07- und 4009-
Diagnosen. Das gespeicherte Original bleibt unverändert, es wird keine weitere
Mail an den Sender erzeugt. Eingabegrenze 21 MiB und Diagnosegrenze 22 MiB sind
einschließlich eines Originals an der SMTP-Grenze geprüft. Überschreitungen von
Headergrenzen führen zum Fehler, nicht zum Abschneiden von Belegen.

Die strikten Öffner geben nach Prüfungsfehlern weiterhin keinen Klartext zurück.
Eine gesonderte Diagnoseoption erlaubt einen ausdrücklich ungeprüften
Originalanhang erst nach erfolgreicher GCM-Authentisierung.
Weitere Grenzen: [kim-receive-errors.md](kim-receive-errors.md).
Alle vier Vercel-Projekte haben den Vorgänger **817a673** erfolgreich gebaut.

## KIM-Nachrichtenablauf und Headerbindung am 21.10.2026

Die bisherigen 162 Fälle und **17 neue Prüfungen** bestehen gemeinsam.
16 Fälle in `kim-client-message.test.mjs` prüfen tatsächliche AUT-Signaturen,
Rollen-/Schlüssel-/Versionsfehler, erneutes Tokenisieren, doppelte Header,
Absender-/Empfänger-/Zertifikatszuordnung, geschützte Metadaten, Folding und
Manipulationen, binäre Nutzdaten, Größen- und MIME-Grenzen. Ein zusätzlicher
ECC-Test prüft Base64-SignedData mit gefalteten und anders angeordneten MIME-Headern.

Nachrichten werden auch zwei Tage nach Erstellung mathematisch geprüft, ohne
fälschlich die FD-AUT-Annahmefrist anzuwenden. Zukunftstokens werden weiterhin
abgelehnt. Die Ergebnisse behalten ausdrücklich unbestätigte Identität und
`held-for-trust-validation`; Fehler liefern keine Klartextnachricht.

Der vorhandene echte mTLS-SMTP-/Mailstore-/mTLS-POP3-/Inbox-Test verwendet jetzt
den vollständigen neuen Inline-Erzeuger mit AUT-Token und den neuen Empfangspfad.
Wire-Bytes, Hash der geschützten Nachricht und ursprünglicher Body stimmen
überein. Wiederholung nach POP3-Löschung erzeugt keine Dublette.

Grenzen und Quellen: [kim-client-message.md](kim-client-message.md).
TSL/OCSP/VZD, SMC-B/Konnektor, weitere Profile/KAS, vollständige normative
Fehlerprofile und normale Clientzustellung fehlen weiterhin. Die später ergänzten
lokalen Diagnosemails sind oben gesondert belegt. Der CareSuite-Worker bleibt
für KIM gesperrt. Keine UI-/Android-/Datenbankänderung.
Alle vier Vercel-Projekte haben den Vorgänger **280be44** erfolgreich gebaut.

## ECC-CMS und durchgehender lokaler Transport am 21.10.2026

Die 146 bisherigen Fälle und **16 neue Prüfungen** bestehen gemeinsam, ohne
übersprungene Fälle. `kim-ecc.test.mjs` prüft echte Brainpool-Schlüssel,
TI-ECIES-Kartenformat, CMAC, AES-GCM, ECDSA und signierte Empfängerzuordnung.
Vier veröffentlichte NIST-Vektoren, das veröffentlichte gematik-Strukturbeispiel
und eine getrennte OpenSSL-CLI-Zusammensetzung in beiden Richtungen ergänzen die
eigenen Roundtrips. OpenSSL `cms -verify -cades` prüft die innere Signatur und
ESS-Zertifikatsbindung gegen die isolierte Test-CA.

Eine zusätzliche Prüfung transportiert eine tatsächlich signierte und ECC-
verschlüsselte Nachricht durch den eigenen mTLS-SMTP-Listener, das dauerhafte
Postfach und den mTLS-POP3-Abruf. Entschlüsselung und Signaturprüfung ergeben die
exakten Originalbytes. Wiederholung nach POP3-Löschung erzeugt keine Dublette.

**Grenzen:** Die neuen Tests enthalten eine echte innere Testsignatur; die ältere
RSA-Fixture darunter bleibt opak. Software-Schlüssel und Test-CA sind keine
SMC-B/TI-Identitäten. Der neue Empfänger liefert immer `identityStatus: unverified`.
TI-PKI/OCSP/VZD, allgemeine MIME-Verarbeitung, Fach-XML und Konnektoranbindung fehlen.
Der danach ergänzte Headerabgleich ist oben gesondert belegt. Der gesamte äußere ECC-Container wurde
noch nicht von einem zweiten KIM-Client verarbeitet; die CLI-Gegenprüfung
verwendet dieselbe OpenSSL-Kryptoprimitivenbibliothek wie Node.

Details und Quellen: [ecc-cms.md](ecc-cms.md). Keine UI-/Android-/Datenbankänderung.
Alle acht geänderten/neuen MJS-Dateien bestehen `node --check`;
`git diff --check` ist ohne Befund.
Der Vorgänger **6667975** hat vier erfolgreiche Vercel-Builds. Der neue Commit
wird gesondert geprüft; diese Aussage ist keine Freigabe eines Produktivbetriebs.

## Eigener lokaler KIM-SMTP-Pfad am 20.10.2026

Die 127 bisherigen Fälle und **19 neue Prüfungen** aus `kim-smtp.test.mjs` wurden
gemeinsam erfolgreich ausgeführt. Es gab keine übersprungenen oder ausstehenden Tests.

- Tatsächliche Brainpool-P256r1- und RSA-PSS-Token-Signaturen, Aussteller-Pins,
  AUT-Zertifikatspolicy, Signaturmanipulation, Sender/Audience/Gültigkeit und
  doppelte JSON-Schlüssel einschließlich maskierter Schreibweise.
- Echter mTLS-SMTP-Listener mit LOGIN/PLAIN, Groß-/Kleinschreibung, Senderbindung,
  geschlossenen Empfängerdomains, Zustandswechseln und unzulässiger Authorization-ID.
  Fehlendes Clientzertifikat, falscher TLS-Hostname und fehlende Hostfreigabe
  scheitern, bevor Zugangsdaten abgefragt werden; die Verbindungsdauer ist begrenzt.
- Prüfung der äußeren OAEP/GCM-Struktur und Empfängerzuordnung; tatsächlicher
  verschlüsselter Testinhalt. Manipulierte/fehlende Zuordnung wird erkannt.
  Erkannte nicht unterstützte CMS-Varianten und abgelaufenes Vertrauen werden
  nicht als gültige Zustellung behandelt.
- From/Sender/Reply-To, ungültiger/doppelter AUT-Header und die normativ vorgegebene
  Self-Send-Ausnahme. Betreff-/Versions-/Content-Type-/CMS-Fehler erzeugen nur die
  zugehörige fdgerr-DSN. Die erlaubte fdgerr_6-Plaintextkopie bleibt begrenzt.
- Original und selbst erzeugte DSN landen tatsächlich im eigenen Postfach;
  der eigene mTLS-POP3-Client ruft die exakten Bytes in die verschlüsselte Inbox ab.
  DSNs enthalten Arrival-Date, In-Reply-To, Empfängerblöcke, ENVID/ORCPT und keinen
  AUT-Token oder gewöhnlichen Originalbody. NOTIFY NEVER erzeugt keine Erfolgs-DSN.
- Mehrere lokale Empfänger, doppelte RCPT-Adressen, volle/deaktivierte Postfächer
  und ein volles Absenderpostfach für die notwendige DSN. Beim letzten Fehler
  wird auch eine bereits innerhalb der Transaktion geschriebene Zustellung zurückgerollt.
- Gleichzeitige Wiederholung, geänderte Bytes/ENVID, Journalquote, Wiederöffnen
  und POP3-Löschung. Ein eigener Serverprozess stirbt per SIGKILL nach SQLite-COMMIT
  vor der 250-Antwort; danach erzeugt die Wiederholung weder Original noch DSN erneut.
- Passwortwechsel während DATA entzieht die Annahmeberechtigung. Alte gemischte
  Adressschreibweisen bleiben mit ihrer Verschlüsselungsbindung lesbar; neue
  Case-Aliase erzeugen kein zweites Konto.
- Echte Übertragung von mehr als 21 MiB ohne SIZE-Ankündigung, Überschreitung eines
  kleineren SIZE, Bare-LF/SMTP-Smuggling-Versuch und abgebrochene DATA-Eingabe.
  Keine dieser Eingaben erzeugt eine gespeicherte Zustellung.
- POP3 TOP liefert nur Header und die angeforderte Zahl Bodyzeilen, korrekt
  dot-escaped, ohne implizite Löschung.

**Beleggrenzen:** Testkonten und Test-PKI haben keine TI-Identität/Zulassung.
AUT-Aussteller sind lokal gepinnt, nicht durch einen fertigen TSL-Prüfer gewonnen.
Der CMS-Testinhalt ist eine ausdrücklich opake Fixture, keine gültige innere
KIM-Signatur oder Pflege-XML. Die echte Verschlüsselung wird unabhängig entschlüsselt,
bevor das normgerechte unauthAttrs-Attribut ergänzt wird. Der installierte
OpenSSL-3.0.13-Decoder hat dort eine von RFC 5083 abweichende Tagdefinition;
dieser vollständige CMS-Roundtrip bleibt offen (Details in `own-services.md`).
Zum damaligen Stand waren ECC-CMS, vollständige TI-PKI, FD-zu-FD-Weiterleitung,
fdgerr_5, übrige MIME-Varianten, AccountManager/VZD und Betrieb noch nicht vollständig
implementiert. Den inzwischen ergänzten ECC-Kern beschreibt der Eintrag vom 21.10.2026.

Alle elf geänderten/neuen MJS-Dateien wurden mit `node --check`, der Diff mit
`git diff --check` geprüft. Keine Oberflächen-/Android-Änderung in diesem Inkrement.
Am Vorgänger **e211462** waren beim letzten Abruf zwei Vercel-Projekte erfolgreich
und zwei noch ausstehend. Der Status des neuen Commits wird separat im PR dokumentiert.

## Versandworker und Empfang am 20.10.2026

Die 108 bisherigen Fälle plus **19 neue Dienstprüfungen** wurden gemeinsam
erfolgreich ausgeführt (`npm run verify:gkv:services`). Die neuen Tests belegen:

- Message-ID, DSN-ENVID, Ziel und AUF-Dateifakten liegen vor SMTP dauerhaft vor;
  zwei konkurrierende Worker versenden nur einmal. Fehlende DATA-Bestätigung
  bleibt auch nach Wiederöffnen unklar und löst keine Wiederholung aus.
- Veraltete Freigaben, mehrdeutige/abgeschaltete/fremde Routen und nachträglich
  geänderte Empfänger werden vor dem Versand blockiert; ENVID-Injektion scheitert.
  Andere Groß-/Kleinschreibung einer Rechnungs-UUID umgeht keine Reservierung.
- RFC-3464-Aktionen bleiben getrennt. Doppelte/kollidierende Kennungen, widersprüchlicher
  Status, falscher Empfänger und ein Hinweis auf einen noch ungesendeten Auftrag
  führen zur Quarantäne. ENVID allein kann einen zuvor damit versendeten Auftrag zuordnen.
- Anlage-7-Rückmeldung wird nur über beide Dateifakten, AUF-Zeit, DAV-IK und
  Transfernummer zugeordnet. Zitierte Originale/Dubletten reichen nicht aus;
  Base64 und Quoted-Printable werden vor der Prüfung dekodiert.
- Originalbytes und Auswertung bleiben verschlüsselt erhalten. Falscher
  Speicherschlüssel, andere Mandanten, UID-Inhaltskonflikt und geänderte
  Postfachidentität werden erkannt. Unausgewertete Originale sind wiederaufnehmbar.
- Echter mTLS-POP3-Listener des eigenen Mailstore mit dem eigenen TLS-Abrufclient:
  Clientfreigabe, Authentisierung, UIDL/LIST/RETR, Dot-Transparenz, Speicherung,
  Auswertung, DELE und QUIT. Die entfernte Löschung erfolgt erst nach lokaler Persistenz.
- Tatsächliches SIGKILL eines separaten Abrufprozesses nach dem Speichern:
  Original bleibt im Postfach, Neustart erkennt Dublette und schließt den Abruf ab.
- Falscher TLS-Hostname, fehlendes/nicht freigegebenes Clientzertifikat,
  Inbox-Quote, übergroße Nachrichten, doppelte UID, falsche RETR-Größe,
  verlorene QUIT-Antwort und geänderte Bytes beim Wiederabruf.
- Zeitgrenzen für eine stumme TLS-Gegenstelle und eine hängende Passwortabfrage.
- Gemeinsamer Dienstlauf: echte TLS-SMTP-Übermittlung des SECON-Pakets, synthetische
  DSN vom lokalen Testserver, eigenes mTLS-POP3, verschlüsselte Inbox und genaue
  Zuordnung. Der nächste Lauf versendet und verarbeitet nichts erneut.

**Grenzen:** Es handelt sich um lokale Integration mit fiktiver PKI und Testkonten,
nicht um TI-/Annahmestellen-Interoperabilität. Auch korrekt korrelierte Quittungen
bleiben `unverified`; die Tests prüfen ausdrücklich, dass weder Rechnungsstatus
noch Versandreservierung verändert werden. Vollständige Herkunftsprüfung,
PFL/FEH-XML/CMS, TA-6-Fachrückmeldungen und die kanonische Office-/Supabase-
Übernahme fehlen weiterhin. Der eigene Dienst ist noch nicht bereitgestellt.

Die geänderten/neuen MJS-Dateien wurden mit `node --check` geprüft;
`git diff --check` bestand. Keine neue Software oder Testinfrastruktur installiert.
Der vorherige Commit **51d15b2** hat vier erfolgreiche Vercel-Deployments.
Für dieses Inkrement wird der Buildstatus ausschließlich am neuen Commit gelesen
und im PR #129 festgehalten.

## Vorheriger eigener Dienstkern am 20.10.2026 (51d15b2)

Die 87 bisherigen Fälle plus **21 neue Dienstprüfungen** wurden gemeinsam
ausgeführt (`npm run verify:gkv:services`). Der neue Dienstkern verwendet echte
Implementierungen von OpenSSL, TLS/STARTTLS und SQLite. Geprüft sind:

- SECON RSA-PSS/OAEP/SHA-256/AES-256-CBC, DER-Parameter, unabhängige Entschlüsselung
  mit dem Empfängerschlüssel, Byteidentität, frische Zufallswerte und manipulierte Daten.
- Tatsächlich signierte CA-/Teilnehmerzertifikate und Sperrlisten; gesperrter Empfänger,
  falsche IK, falscher Vertrauensanker, abgelaufene Gültigkeit und unsichere Key-Dateirechte.
- PKCS#10-Antrag, verschlüsseltes RSA-4096-Schlüsselmaterial, mathematischer
  Besitznachweis, Schutz vor Überschreiben und DN-Injektion.
- Persistenz nach Wiederöffnen, datensatzgebundene Verschlüsselung, falscher
  Speicherschlüssel, Mandantentrennung und doppelte Rechnungsreservierung.
- Gleichzeitiger Claim aus zwei separaten Prozessen und tatsächliches SIGKILL
  unmittelbar nach einem Claim: kein erneuter Versand nach Wiederöffnen.
- Echte TLS-/STARTTLS-Verbindung auf Loopback, genau zwei DTA-Anhänge, EHLO nach
  TLS, Authentisierung erst nach TLS, DSN-Envelope, Dot-Transparenz, falscher Host,
  Empfängerablehnung, Handshake-Timeout und Verbindungsabbruch nach DATA.
- KIM-Kontokern: echte scrypt-Passworthashes, atomare Fehlversuchszähler,
  persistente Sperre, Passwortwechsel, Sitzungsinvalidierung und Deaktivierung.
- KIM-Mailstore/POP3: Quote, stabile UID, Inhaltskonflikt, Postfachsperre,
  RETR/DELE/RSET/QUIT, kein Löschen bei Abbruch und keine Löschung durch alte Sitzung.
- KAS-Speicher: Ressourcenkennung, Empfänger-/Besitzerbindung, HEAD-Metadaten,
  Quoten und Ablauf einschließlich einstündiger Karenz.

**Nachweisgrenze:** Lokale, fiktive Test-PKI; keine produktiv vertrauten
Trust-Center-/TI-Zertifikate. Kein TI-Konnektor, keine SMC-B und kein KIM-Netzverkehr.
Die zusätzlichen KIM-Tests prüfen Speicher- und Protokollkern, keine vollständige
gematik-Konformität. Quellen-/Vertrags-/Teilnahme-/E2E-Freigaben im DTA-Pakettest
bleiben Fixtures. Die PostgreSQL-Reservierung und Übergabe an den eigenen Dienst
sind nicht implementiert. Unabhängige Prüfung und Inbetriebnahme bleiben offen.

Die 13 neuen MJS-Quelldateien werden durch die nativen Prüfläufe eingelesen;
zusätzlich erfolgt `node --check`. Web-/Android-Oberflächen wurden in diesem
Inkrement nicht verändert. Vercel-Buildstatus wird getrennt am neuen Commit
ausgelesen; grüne Builds älterer Commits werden nicht übertragen.

| Bereich | Nachweis |
| --- | --- |
| Dateiaufbau | Vollständige erwartete PLGA-/PLAA-Referenzdatei mit einem fiktiven Beratungsfall |
| Auftragsdatei | 348 Bytes, feste Positionen, Byteanzahl, deutsche Ortszeit und getrennte Empfängerrollen |
| Zeichensatz | Latin-1, Umlaute, EDIFACT-Aufhebungszeichen, Ablehnung nicht darstellbarer Zeichen |
| Parser | Abgebrochene Segmente, falsche Zähler, doppelte/falsche Referenzen |
| Fachprüfung | Beträge, Dubletten innerhalb des Pakets, Nachweise, Beschäftigtennummern, Steuer- und Versionsgrenzen |
| Berechnung | Sechs Zeit-Einheiten, anteilige/angefangene Einheiten, Kilometergrenzen, fünfstellige Punktwerte, halbe Centbeträge und Überlaufablehnung |
| Pflegeprofile | Tatsächliche Endzeit, Halbtag mit eigenem Vertragspreis, Nachtpflege über Mitternacht, expliziter Folgetag, stationäre Tagesbereiche/Abwesenheit, Monatspauschale mit ESK 99, Schaltjahr, Überschneidungen, Anbietergruppe und DiPA-Zeitart |
| Monatliche Quellen | Originaler Positionstag bleibt erhalten, vollständiger Quellrechnungszeitraum erforderlich, einzelner Einsatznachweis reicht nicht für eine Monatspauschale |
| Zuschläge/Abzüge | Prozent/fester Betrag, unveränderter Basisbetrag, einzelne Cent-Rundung, Vorzeichen, ZUS-Feldpositionen und Ende-Kennzeichen, fünf Dezimalstellen, Tarifbereiche, Pflichtangaben, negative Summen, Feldgrenzen und weiterhin genauer Quellrechnungsabgleich |
| Routing | Mehrstufige Zuordnung, Ablaufdaten, falscher Übermittlungsweg, Mehrdeutigkeit, UEM-Gültigkeit, VZD-Kennzeichen |
| Rückmeldemodell | Korrelation, wiederholte Zustellmeldung, unzulässige Statussprünge |
| Export-API | Authentifizierung, Berechtigung, kein vom Client eingereichter Dateikörper, Mandant, Revision und parallele Änderung |
| Quellen | Rechnung und vollständige Positionen, Steuer, Datum, Person, Revisionen, Leistungsdauer, Nachweisauswahl und Hash |
| Original-PDF | Tatsächliche Byteprüfung, geänderte/fehlende PDF, Größenlimit, fremde Pfade, Traversal und URL-Ablehnung |
| Fehlerausgabe | Keine Nutzdaten bei Fehlern, keine Details aus internen Ausnahmen, kein alternativer Versandpfad |

## Vorherige Erweiterung am 20.10.2026 (943ceaa)

Die 87 Tests wurden nach den Änderungen an Hilfsmitteln, Sondervereinbarungen,
Quellprüfung und Transportvorbereitung vollständig erneut ausgeführt. Sie enthalten
23 neue Tests gegenüber dem vorherigen Stand mit 64 Tests:

- HIL-Feldfolge, Einzelsteuer, enthaltene Steuer ohne doppelte Addition,
  ausdrückliche Befreiung, Genehmigung, reservierte Schlüssel, Wiedereinsatz,
  Produktnummer, Mengen und Zuzahlungen.
- Steuerpflichtige Quellübernahme und tatsächlicher Prüfexport-API-Handler:
  exakter Abgleich von Netto, Steuer, Brutto, Stückpreis, Menge und Steuersatz;
  geänderte Werte liefern keine Datei.
- Sonderprofile 08/11/12/14, Bewilligungs-/Vertragszeitraum, Fallhöchstbetrag,
  Vereinbarung zum Datenaustausch und vollständige Monatspauschale.
- DTA-AUF mit tatsächlicher Ciphertext-Länge, falsche Signatur-/Empfängerbindung,
  KIM-Dateiname, MIME-Anhang, DSN-Optionen, Größen-/UTF-8-Grenzen, manipulierte
  Dateien/Empfänger und veraltete Prüfstände.
- Gleichzeitige Versandversuche, Timeout, fehlende Quittung, Speicherfehler nach
  Versand und fehlender Provider: kein blinder zweiter Aufruf.

**Grenze der damaligen 87 Transporttests:** Kryptografie, XSD-/CMS-Prüfung, Provider und
atomarer dauerhafter Journalzugriff sind injizierte Testdoubles. Der Prüflauf
belegt die Aufruf- und Ablehnungslogik, keine echte Verschlüsselung, SMC-B-Signatur,
dauerhafte Outbox, Annahmestellenvalidierung oder Ende-zu-Ende-Übermittlung.

Die 11 geänderten/neuen TS-/TSX-Dateien wurden zusätzlich mit dem bereits in
Playwright vorhandenen Babel-Transform verarbeitet. Das ist eine Syntaxprüfung,
kein TypeScript-Typcheck. Die lokale Umgebung enthält diesmal weder den Compiler
noch die React-/happy-dom-/esbuild-/PGlite-Abhängigkeiten der früheren Zusatzläufe.
Gemäß `AGENTS.md` wurde nichts installiert. Die folgenden DOM-/Datenbank-/gezielten
Typprüfungen stammen daher aus dem vorherigen Stand und sind **kein neuer Nachweis
für diese Erweiterung**. Der neue vollständige Build wird über die bestehende
Vercel-Anbindung geprüft; Ergebnis siehe PR #129.

Die verbundene Tabelle `public.ti_providers` war am 20.10.2026 leer. Kein DTA-/KIM-
Dienst ist in den vorhandenen Edge-Funktionen implementiert. GitHub-Zugriff ist
verfügbar; der Vercel-Pluginzugriff auf das Projektteam liefert 403 wegen fehlendem
Scope. Die Vorschau bleibt geschützt. Es erfolgte kein erneuter Passkey-/Login-
Versuch; eine visuelle Prüfung der neuen Eingabefelder ist weiter offen.

## Frühere Zusatzprüfungen (Stand vor dieser Erweiterung)

Zusätzlich wurden **19 Datenbankfälle (20 Testeinträge einschließlich Suite)** mit der bereits vorhandenen PGlite-Laufzeit auf PostgreSQL 17.5 ausgeführt:

```bash
node --import ./tests/gkv-exchange/register.mjs tests/gkv-exchange/database.mjs /pfad/zur/vorhandenen/pglite/dist/index.js
```

Alle drei tatsächlichen GKV-Migrationen werden im Arbeitsspeicher ausgeführt. Geprüft sind RLS, Mandanten-/Portal-/Rollenwechsel, entzogenes Direkt-Schreibrecht, private Wiederholungsquittungen, idempotente Aufträge, Inhaltskonflikte, Revisionen, Fremdrechnungen, Profilrevisionen, Abbruch bei ungültigen Quellen und fehlende Berechtigung öffentlicher RPCs. Die Revisionsmigration wird im Test nach dem ersten Paket angewendet: Übernahme des vorhandenen Stands, spätere unveränderte Historie, Datenstand-Hashes, Herkunftsverknüpfung, neue Entwurfskennung, zurückgesetzte Bestätigungen, wiederholte Kopieraufträge und Seiten über 20 Revisionen werden tatsächlich in PostgreSQL geprüft. Authentifizierte Benutzer können die Historie weder ändern noch löschen oder ergänzen; Portal-, Fremdmandanten- und anonyme Zugriffe scheitern. Die Tests für veraltete Revisionen verwenden aufeinanderfolgende Konflikte; ein Lasttest konkurrierender Datenbankverbindungen ist damit nicht belegt.

In dieser isolierten Datenbanksuite sind Office-Helfer und Auth-Claims ausdrücklich
Vertragsdoubles. Ergänzend bestehen **fünf Integrationsszenarien** mit den
tatsächlichen vorhandenen Office-SQL-Funktionen und dem GKV-API-Handler:

```bash
node --import ./tests/gkv-exchange/register.mjs tests/gkv-exchange/office-flow.mjs /pfad/zur/vorhandenen/pglite
```

Geprüft: Entwurf aus Leistungs-/Nachweisdaten, Ausstellen über Office-RPCs,
Quellübernahme, GKV-Speicherung, EDIFACT-/AUF-Bytes und SHA-256; Ablehnung
geänderter Dokumente, Unterschriften, Leistungsabschlüsse und Attestierungen;
fehlende/geänderte Original-PDFs sowie Änderungen während des Exports;
entzogene Rechte, inaktive Profile, Portal-/Fremdmandanten-/anonyme Zugriffe;
historische Kopie mit zurückgesetzter Nachweisbestätigung und erneuter Prüfung.
Der Legacy-Einsatzpfad wird tatsächlich durch die Office-Nachweisprüfer geführt.
Auth-Claims, HTTP/Storage-Transport und PDF-Erzeugung sind Doubles. Der alternative
Assist-Visit-Nachweispfad und echte Supabase-Auth-/PostgREST-Requests sind damit
nicht belegt. Im Remoteprojekt wurden keine fachlichen Testdaten angelegt.

Die echten Komponenten `CaseEditor` und `RevisionHistory` wurden zusätzlich mit den vorhandenen React-/happy-dom-/esbuild-Paketen bedient (`editor-check.mjs`): Zeitberechnung, ungültiger Geldwert und Korrektur, Kilometer, Rückkehr zur Wegepauschale, Punktwerte und Entfernen der Punktregel, erneute Quellübernahme, Zuschlag/Abzug mit ungültiger Eingabe/Korrektur/Entfernen bestanden. Neu geprüft sind halber Pflegesatz ohne automatische Halbierung, Nachtpflege-Folgetag, Tageszählung aus Von/Bis, Monatspauschale mit Kennzeichen 99 und Rücksetzen ungeeigneter Angaben beim Profilwechsel. Historie: Nachladeaktion, schreibgeschützter Stand, Auswahl einzelner Fälle, erforderliche Übernahmebegründung, Leser ohne Kopieraktion, Ladefehler/Wiederholung und Schließen bestanden. Transportcallbacks der Historienoberfläche sind ausdrücklich Doubles. **Dies sind DOM-Funktionsprüfungen, keine visuellen oder vollständigen Ende-zu-Ende-Prüfungen.**

Ein gezielter strenger TypeScript-Check für Fachkern einschließlich Pflegeprofilen, Quellprüfung, Export-API, `GkvEditors.web.tsx` und `GkvRevisionHistory.web.tsx` mit den vorhandenen echten Node-/React-Typen besteht. Er umfasst nicht den gesamten Expo-Abhängigkeitsbaum. Die beiden im Vercel-Log gemeldeten Fehler wurden mit Commit `a1e122d` korrigiert: explizite Env-Felder und ein ausdrücklich als `string` deklarierter Request-Identifier. Am 20.10.2026 meldeten alle vier Vercel-Projekte für den vorherigen Stand `4f28da4` erfolgreiche Deployments. Dieser Build enthält die Pflegeprofile, aber noch nicht die in diesem Dokument neu beschriebenen Hilfsmittel-/Sonder- und Transportänderungen.

Die TSX-/TypeScript-Quelldateien der neuen Oberfläche, der Eingabekomponenten,
des Datenzugriffs und der geänderten Rechnungsnavigation wurden mit dem bereits
in Playwright enthaltenen Babel-Parser und Transform geprüft. Das belegt
syntaktische Verarbeitbarkeit, **keinen vollständigen TypeScript-Typcheck**.

Die drei GKV-Migrationen wurden am 19.10.2026 im verbundenen Projekt
`euagyyztvmemuaiumvxm` angewendet. Anschließend wurden die bestätigten Versionen
`20261019214752`, `20261019214757` und `20261019214802`, Tabellen, RLS,
direkte Rollenrechte, RPC-Ausführungsrechte und feste Suchpfade ausgelesen.
Alle fünf öffentlichen Tabellen haben RLS und keine direkten Schreibrechte für
Anwendungsbenutzer. Öffentliche RPCs laufen als Invoker; anonyme Aufrufe haben
kein Ausführungsrecht. Die private Quittungstabelle ist direkt unzugänglich.
Die Advisor-Zahlen auf Warnstufe blieben unverändert. Hinzu kam ausschließlich
der erwartete Infohinweis `rls_enabled_no_policy` für die absichtlich direkt
gesperrte private Quittungstabelle. Bestehende, nicht durch GKV eingeführte
Advisor-Warnungen wurden nicht geändert.

## Nicht ausgeführt / noch erforderlich

- **Visuelle Prüfung und Browserinteraktionen:** Die tatsächliche Vercel-Vorschau
  wurde im vorhandenen Cloud-Browser geöffnet und leitet zur Vercel-Anmeldung
  weiter. Der lokale Umgebung fehlt außerdem Chromium; gemäß `AGENTS.md` wurde
  keine zusätzliche Software installiert. Damit liegen keine Screenshots oder
  Layoutfreigabe für die neue Oberfläche vor.
- **Vollständiger Projektbuild und Typcheck:** Die Projektabhängigkeiten sind in
  dieser Arbeitsumgebung nicht vollständig vorhanden. Die zusätzliche Babel-
  Prüfung ersetzt weder Metro/Expo-Build noch `tsc`.
- **Supabase-Integration:** Migrationen sind remote angewendet und katalogseitig geprüft. Der vollständige Weg mit echter Anmeldung, Office-Autorisierung, PostgREST und Storage bleibt erforderlich. Die tatsächlichen Office-Nachweisprüfer sind im isolierten Integrationslauf für den Legacy-Einsatzpfad geprüft. Das vorhandene Stagingprojekt benötigt zuvor die aktuelle Office-Rechnungsstruktur.
- **Echte Dienstintegration:** DTA-Kryptografie, lokaler TLS-/STARTTLS-Transport
  und dauerhafte lokale Outbox sind neu tatsächlich getestet. Kanonischer
  Supabase-Versandablauf, Annahmestellenverkehr, SMC-B/KIM-TI und fachliche
  Ende-zu-Ende-Abnahme bleiben offen. Die Test-PKI ist keine amtliche Freigabe.

## Verbindliche Abnahme vor dem Zusammenführen

1. Bestehenden Web-Build und Typcheck ausführen.
2. Migration im vorgesehenen Test-/Releaseablauf prüfen. Owner, berechtigter
   Office-Leser, Office-Ersteller, Benutzer ohne Recht und Portalzugang testen.
   Mandantenwechsel, Null-Mandant und fremde Rechnungsreferenzen einschließen.
3. Derselbe Auftrag muss dasselbe Ergebnis ohne zweite Mutation liefern;
   abweichender Inhalt unter derselben Auftragskennung muss scheitern. Parallele
   Speicherungen mit gleicher Revision dürfen höchstens einmal erfolgreich sein.
4. Oberfläche bei breitem Fenster, geöffneter Navigation, schmalem Bereich und
   vergrößerter Schrift prüfen. Keine horizontalen Überläufe oder überdeckten
   Aktionen; Speicher-, Fehler-, Leer- und Ladezustände sowie Tastaturbedienung prüfen.
5. Paket anlegen, Profil speichern, Rechnung übernehmen, Positionen ergänzen,
   speichern, Prüfdateien erzeugen/herunterladen und nach Neuladen wieder öffnen.
   Zuschläge anhand vertraglich freigegebener Referenzfälle prüfen. Frühere
   Paketstände ansehen, nachladen und mit Begründung in einen neuen Prüfentwurf
   übernehmen; Original, Herkunft und zurückgesetzte Nachweisbestätigung prüfen.
   Unvollständige Zahlen, veraltete Rechnungen und fehlende Nachweise müssen
   die vorgesehenen Aktionen blockieren.
6. Rollen-/Mandantenwechsel während laufender Requests darf keine fremden Daten
   anzeigen oder Downloads aus dem alten Arbeitsbereich auslösen. Ungespeicherte
   Änderungen und ein unklarer Speicherausgang müssen erkennbar bleiben.
7. Freigegebene amtliche Testfälle gegen einen unabhängigen Validator und die
   Annahmestelle prüfen. Die verbleibenden Fachprofile und Versandanschlüsse aus
   `implementation.md` sind weiterhin gesondert umzusetzen.

**Freigabeentscheidung:** Draft-Review geeignet; produktiver Echtbetrieb und
vollständige Ende-zu-Ende-Funktion derzeit nicht belegt.
