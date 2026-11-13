# Medikation: Stammdaten und Medikationsplanentwürfe

Die Präparate- und Arztauswahl wird aus den freigegebenen Stammdaten des eigenen Mandanten gespeist. Die PZN bleibt eine achtstellige Zeichenfolge. Bei der Auswahl werden Präparatdaten übernommen; Dosis, Einnahmezeit und Applikationsweg stammen weiterhin aus der Verordnung oder der ausdrücklichen Eingabe. Eine Katalogauswahl ist keine Verordnungsprüfung.

## Befüllung

Im Medikationsarbeitsbereich unter **Stammdaten importieren**:

- **BfArM-Referenz:** drei entpackte DSV-Dateien derselben Lieferung auswählen. Das BfArM stellt die Referenz nach § 31b SGB V auf Anfrage bereit. Der Import verbindet Packungen, pharmazeutische Komponenten und Wirkstoffe über ihre Quellschlüssel. Kombipackungen erhalten keine zusammengefasste Stärke. Hersteller, Marke und Packungsgröße werden aus dieser Quelle nicht abgeleitet.
- **Präparate (JSON):** für weitere vertraglich freigegebene Arzneimitteldaten, beispielsweise eine aufbereitete IFA-/ABDATA-Lieferung. Pro Zeile sind `pzn` und `name` erforderlich. `ingredient`, `strength`, `dosageForm`, `brand`, `manufacturer` und `packageSize` sind optional. Anbieter oder Zulassungsinhaber dürfen nicht als Hersteller ausgegeben werden, wenn die Datenquelle das nicht bestätigt.
- **Arztverzeichnis (JSON):** freigegebene Anbieterlieferung mit `externalId` und `displayName` pro Kontakt; optionale Felder: `practiceName`, `specialty`, `postalCode`, `city`, `street`, `phone`, `lanr`, `bsnr`. Für einen bundesweiten Datenbestand ist eine entsprechende Datenlieferung nötig. Eigene berufliche Arztkontakte können im Formular gespeichert und später erneut ausgewählt werden.

JSON-Dateien sind Objekte mit `source` (stabile Kleinschreibungskennung des Datenlieferanten), `sourceVersion` (Lieferstand) und `rows` (Array). Erst die Vorschau und die ausdrückliche Übernahme speichern Daten. Der Import bestätigt Abschnitte von höchstens 500 Zeilen und zeigt an, wie viele Zeilen bereits gespeichert sind. Eine unterbrochene Lieferung ist kein bestätigter Vollbestand. Die Aktualisierung löscht keine älteren Datensätze automatisch. Der Import enthält keine produktiven Beispieldaten und lädt keine öffentlichen Verzeichnisse automatisiert herunter.

Quellen:

- [BfArM: Referenzdatenbank nach § 31b SGB V](https://www.bfarm.de/DE/Arzneimittel/Arzneimittelinformationen/Referenzdatenbank/_node.html)
- [IFA: Interesse am Datenbezug](https://www.ifaffm.de/de/ifa-fuer-datenbezieher/ifa_informationsdienste_rohdaten/interesse-am-datenbezug.html)
- [Stiftung Gesundheit: Datenmanagement/Systemintegration](https://www.stiftung-gesundheit.de/services/datenmanagement/)
- [KBV: BMP-Spezifikation und Beispieldateien](https://update.kbv.de/ita-update/Verordnungen/Arzneimittel/BMP/)

## Frei nutzbare Startbestände

Die Präparatesuche kennzeichnet den Auszug aus der **FAIR IOP Medication Database** als Forschungsbestand von 2024. 60 achtstellige PZN und Originalnamen wurden aus Version 1 übernommen; führende Nullen sind wiederhergestellt. Der Bestand enthält keine Aussage zur heutigen Marktverfügbarkeit. Darreichungsform, Hersteller und Verordnungsdaten werden nicht aus dem Namen abgeleitet. Quelle: [Salgado et al., FAIR IOP Medication Database](https://doi.org/10.6084/m9.figshare.26142688.v1), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), Feldauszug.

Unter **Ärztin oder Arzt suchen → Praxissuche Ruhrgebiet** ist ein eigenes Verzeichnis für Standorte verfügbar. Der AVENTA-Startbestand umfasst 1.658 Standorte aus dem RVR-Datensatz, abgerufen am 12.11.2026. Daten ohne verwendbare Anschrift oder außerhalb des Ruhrgebiets wurden herausgefiltert. Das Änderungsdatum eines Eintrags wird angezeigt, wenn es vorliegt. Die Auswahl füllt ausschließlich die Praxisangaben für einen eigenen Kontakt vor. Den Namen der verordnenden Person muss man prüfen und selbst erfassen. Quelle: © Regionalverband Ruhr, [POI – Arztpraxen und Zentren](https://daten.geoportal.ruhr/srv/api/records/4ed7b8fa-2249-4a27-b901-4de837c1b97d), [dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0), Daten bearbeitet.

## Geprüfte deutsche Packungen

Für AVENTA wurden am 13.11.2026 180 einzeln belegte PZN unter `de-pack-verified`, Version `2026-11-13.1`, ergänzt. Insgesamt sind 240 verschiedene PZN verfügbar. Die neue Charge enthält 71 Candesartan-Packungen: 45 mit Candesartancilexetil als einzigem Wirkstoff, 26 mit Hydrochlorothiazid. Weitere Einträge sind unter anderem Metformin, Pantoprazol und Levothyroxin. Die [Quellen je PZN](./de-pack-verified-2026-11-13-evidence.json) dokumentieren die Zuordnung. Die Marke steht getrennt vom Hersteller; bei nicht eindeutig belegtem Hersteller bleibt dieses Feld leer. Eine erfasste PZN belegt keinen aktuellen Lagerbestand.

Die Packungssuche zeigt PZN, Marktname, Wirkstoff und Stärke. Die Zulassungssuche bleibt separat und ohne Packungsübernahme. Beide Suchen können weitere Treffer seitenweise laden. Die PZN wird achtstellig gespeichert, einschließlich führender Nullen.

Die amtliche Größenordnung von [rund 104.000 verkehrsfähigen Humanarzneimitteln im Zuständigkeitsbereich des BfArM](https://dserver.bundestag.de/btd/21/088/2108860.pdf) ist weder ein offener Packungsfeed noch ein Nachweis für aktuell erhältliche Packungen. Der vorhandene BfArM-Import nimmt die drei zusammengehörigen DSV-Referenzdateien nach § 31b SGB V an. Für Hersteller, enthaltene Packungsmenge und aktuelle Marktverfügbarkeit sind weitere belegte Quelldaten erforderlich.

## Deutschlandweite Suche

**Arzneimittelzulassungen suchen** nutzt einen getrennten Auszug aus dem [Artikel-57-Register der Europäischen Arzneimittel-Agentur (EMA)](https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/data-medicines-iso-idmp-standards-post-authorisation/public-data-article-57-database), Rev. 91, Datenstand 05.11.2026, veröffentlicht am 12.11.2026. Nach Bereinigung identischer Projektionen und Ausschluss dreier beschädigter Quellenzeilen enthält der Auszug 16.910 Einträge (15.233 Deutschland, 1.677 EU). Gesucht wird nach Produktname, Wirkstoff und Zulassungsinhaber. Der Zulassungsinhaber ist kein Hersteller. Die Treffer haben keine PZN, keine Packungs- oder Marktverfügbarkeit und ändern keine Angaben in einer Verordnung. Die Gelbe Liste bietet eine öffentliche Recherche; die Integration ihrer Rohdaten ist ein separates Angebot des Anbieters.

Unter **Ärztin oder Arzt suchen → Praxissuche Deutschland** durchsucht CareSuite 40.267 kartierte Standorte aus 16 Bundesländern. Sie verteilen sich auf 4.507 Gemeinden, darunter 1.838 von 2.057 amtlich als Stadt geführten Gemeinden. Die Suche akzeptiert Name, Ort, PLZ und vorhandenes Fachgebiet; ein Bundesland lässt sich als Filter setzen. Fehlende Treffer bedeuten, dass der offene Auszug dort keine passenden Einträge enthält. Er dient zur Orientierung und liefert keine amtlich bestätigten verordnenden Personen. Die [öffentliche Arztsuche](https://gesund.bund.de/suchen/aerztinnen-und-aerzte) und die [Quellen je Bundesland](./arztverzeichnisse-deutschland.md) helfen beim Nachschlagen einzelner Personen.

Praxisquelle: © OpenStreetMap-Mitwirkende, Deutschland-Auszug Geofabrik vom 12.11.2026, bearbeitet, [ODbL 1.0](https://www.openstreetmap.org/copyright). Geografische Zuordnung: © BKG 2026, VG250 Stand 01.01.2026 (Daten bearbeitet), [dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0), [BKG-Datenquellen](https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf). Der separate, maschinenlesbare Auszug ist im Web-Export unter `/open-data/osm-praxen-deutschland-2026-11-12.zip` verfügbar. RVR, persönliche Kontakte und Klientendaten sind nicht enthalten.

Die Praxissuche für Deutschland und das Ruhrgebiet lädt jeweils bis zu 30 Treffer auf einmal. Über **Weitere Treffer laden** erscheinen die folgenden Treffer derselben Suche. In der Trefferansicht stehen Quelle, Praxisdaten und fehlende Angaben getrennt. **Praxisdaten übernehmen** öffnet einen bearbeitbaren Kontaktentwurf. Erst **Im Verzeichnis speichern und auswählen** speichert ihn beim eigenen Unternehmen und verknüpft die verordnende Person mit der Verordnung. Für den Standort Dr. med. Uwe Wellbrock ergänzt CareSuite Straße, PLZ und Telefon anhand der [Praxiswebsite](https://www.praxis-wellbrock.de/index.php/kontakt.html) und weist diese Quelle gesondert aus.

Bei einer Packung zeigt die Vorschau PZN, Wirkstoff, Stärke, Darreichungsform, Marke, Hersteller und Packungsgröße an, soweit Daten vorliegen. Erst **Packung übernehmen** füllt die Präparatfelder. Packungsgröße bleibt eine Anzeige aus dem Katalog. Sie bestimmt keine Dosierung. Die Verordnung speichert den Bezug zur ausgewählten Packung und, bei Auswahl eines Kontakts, zur verordnenden Person.

## Medikationsplan

Der strukturierte BMP wird als eigener Entwurf verarbeitet. Ein Plan kann nur einem zulässigen Klienten des eigenen Mandanten zugeordnet werden. Automatische Zuordnung setzt eine eindeutige Übereinstimmung der Identität voraus. Der Originalinhalt und die gelesenen Werte dienen als Prüfgrundlage. Das Speichern und die Einzelbestätigung im Prüfentwurf erfassen keine Gabe und legen keine Verordnung an.

Bei einer bestätigten Position mit eindeutig abbildbarem Tagesschema öffnet **Verordnung vorbereiten** das Formular für genau diese Akte. Präparatdaten und Originalangaben stehen zur Prüfung bereit. Die Einzeldosis mit Einheit, der Applikationsweg, die verordnende Person und der bestätigte Therapiebeginn müssen geprüft beziehungsweise ergänzt werden. Nach Eingabe der passenden Einzeldosis lassen sich die originalen Tageswerte mit einem Klick übernehmen. Erst die ausdrückliche Bestätigung im Verordnungsformular legt eine aktive Verordnung mit Herkunftsbezug an. Für dieselbe Position eines gespeicherten Entwurfs ist eine zweite Anlage gesperrt. Bei unklarem Speicherausgang kann der Anlagenbeleg lesend gesucht werden.

Wochen-, Bedarfs- und Freitextschemata, unbekannte Einheiten, unterschiedlich hohe Tageszeitdosen sowie andere Angaben außerhalb des Tagesformulars verbleiben im Originalplan. Die PZN im Plan ist ein Originalwert. Nur eine ausdrückliche Auswahl aus dem Präparateverzeichnis bindet einen Katalogeintrag an die Verordnung.

Die App liest BMP 2.6 bis 2.8 als XML. Im Web lassen sich zusätzlich PDFs mit lesbarer BMP-Struktur und Bilder mit lesbarem Data-Matrix-Code auswählen. Die Auswertung erfolgt auf dem Gerät. Ein unstrukturiertes Dokument oder ein Foto ohne lesbaren Code liefert keinen Dosierungsvorschlag. Fehlen Identitätsangaben, muss die Zuordnung begründet werden. Ein widersprüchliches Geburtsdatum oder eine widersprüchliche Versichertennummer blockiert die Ablage.

## Veröffentlichung

Die versionierten Supabase-Migrationen `20261112104353` (BMP-Entwurf), `20261112104503` (Verzeichnisse) und `20261112111703` (Herkunftsbezug) im vorgesehenen Zielprojekt in dieser Reihenfolge anwenden und im Migrationsverlauf erfassen. Bereits angewendete Versionen überspringen. Der Git-Push startet die bestehende Vercel-Integration. Nach dem Release anhand synthetischer Testdaten prüfen: Berechtigung und Mandantengrenze, Verzeichniswahl, BMP-Zuordnung, Einzelbestätigung, Anlagenbeleg und erneutes Öffnen einer bereits übernommenen Position.
