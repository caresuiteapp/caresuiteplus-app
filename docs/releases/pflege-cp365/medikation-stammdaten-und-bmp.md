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

## Medikationsplan

Der strukturierte BMP wird als eigener Entwurf verarbeitet. Ein Plan kann nur einem zulässigen Klienten des eigenen Mandanten zugeordnet werden. Automatische Zuordnung setzt eine eindeutige Übereinstimmung der Identität voraus. Der Originalinhalt und die gelesenen Werte dienen als Prüfgrundlage. Jede Position wird einzeln geprüft. Das Speichern oder Bestätigen einer Planposition legt keine aktive Verordnung an und erfasst keine Gabe.

Die App liest BMP 2.6 bis 2.8 als XML. Im Web lassen sich zusätzlich PDFs mit lesbarer BMP-Struktur und Bilder mit lesbarem Data-Matrix-Code auswählen. Die Auswertung erfolgt auf dem Gerät. Ein unstrukturiertes Dokument oder ein Foto ohne lesbaren Code liefert keinen Dosierungsvorschlag. Fehlen Identitätsangaben, muss die Zuordnung begründet werden. Ein widersprüchliches Geburtsdatum oder eine widersprüchliche Versichertennummer blockiert die Ablage.

## Veröffentlichung

Die beiden beiliegenden, versionierten Supabase-Migrationen müssen für das richtige Zielprojekt separat eingespielt und geprüft werden. Der Git-Push aktualisiert die Webanwendung über die bestehende Vercel-Integration; er ersetzt keine Datenbankmigration und befüllt keine lizenzierten Kataloge. Nach dem Release: berechtigter Nutzer und anderer Mandant, Präparat- und Arztwahl, eigener Kontakt, BMP-Zuordnung und Einzelbestätigung anhand synthetischer Testdaten prüfen. Eine Live-Prüfung mit realen Medikationsdaten ist damit nicht vorweggenommen.
