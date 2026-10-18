# Office-Rechnungen: Anforderungen an E-Rechnungen

Stand: 18. Oktober 2026. Diese Datei beschreibt die Anforderungen und den Implementierungsstand der Office-E-Rechnungen. Eine erfolgreiche Prüfung des Codes ersetzt weder den Nachweis einer veröffentlichten Version noch die steuerliche Einordnung eines einzelnen Umsatzes.

## Implementierungsstand

Der Arbeitsstand enthält inzwischen einen eigenen Rechnungseingang und die Ausstellung von XRechnung im Office-Web-Ablauf. Die folgenden Angaben beschreiben den vorhandenen Code. Eine produktive Freigabe und vollständige Ende-zu-Ende-Abnahme dürfen erst nach den unten genannten Prüfungen behauptet werden.

| Bereich | Implementierter Ablauf | Grenze |
| --- | --- | --- |
| Rechnungseingang | Unternehmensbezogener XML-/Hybrid-PDF-Import ohne Klientenzwang; Originalbytes und extrahierte XML getrennt mit Hashes; strukturierte Vorschau, sachlicher Prüfstatus, Originaldownload | Kein automatischer Abruf aus einem E-Mail-Postfach, keine automatische Buchung oder Zahlung |
| Eingangsprüfung | Serverseitige erneute Extraktion hybrider Originale; Prüfung der passenden XML-Syntax und unterstützten Profilkennung; getrennte technische und sachliche Prüfung | Nicht unterstützte Profile bleiben als solche erkennbar; keine pauschale ZUGFeRD-, PDF/A- oder Signaturfreigabe |
| Rechnung bearbeiten | PDF/XRechnung, tatsächlicher Leistungsempfänger getrennt vom Kostenträger, elektronische Adressen, Referenzen, Verkäuferkontakt und Steuerkategorie je Position | Unbekannte Rechtsangaben werden nicht aus Pflegebereich, Kostenträger oder 0 % Umsatzsteuer abgeleitet |
| XML-Vorschau | XML aus erneut gelesenen Entwurfsdaten, eigener Entwurfshinweis und Download | Noch keine ausgestellte Rechnung; die vorgeschlagene Nummer ist nicht vergeben und die Vorschau besitzt keinen abschließenden Normnachweis |
| XRechnung ausstellen | UBL aus dem bestätigten Rechnungsstand, echte XSD-/Schematron-Prüfung; Serverbeleg bindet XML-Hash, Datenstand und vorgeschlagene Nummer; atomare Freigabe mit PDF und XML | Eine fehlgeschlagene oder nicht verfügbare Prüfung verhindert die Ausstellung; keine automatische Ersatzfreigabe als PDF |
| Ausgestellte Rechnung | Unveränderliches XML-Original mit passendem gespeicherten Prüfbeleg herunterladen; PDF bleibt als lesbare Darstellung verfügbar | Keine nachträgliche Neuerzeugung aus aktuellen Unternehmens- oder Klientendaten |
| Leistungsnachweise | Optional ausgewählte Original-PDFs in der XML; ausgewählte PDF-Kopien als lesbare Rechnungsanlage | Größenlimits gelten für die gesamte strukturierte Datei; fehlerhafte Anlagen werden nicht still entfernt |

Die Normprüfung verwendet versionierte lokale KoSIT-Regeln, XML-Schemata und EN-16931-/XRechnung-Schematron-Regeln. Das Regelpaket `2026-08-31` und seine Dateien sind mit Prüfsummen gebunden. `libxml2-wasm` verarbeitet die Schemata; `saxon-js` verarbeitet die vorbereiteten Regeldateien. Herkunft, Lizenzen und notwendige, dokumentierte Anpassungen der Regeln stehen unter `api/_lib/einvoice-rules/2026-08-31/`. Gegenfälle und unabhängige KoSIT-Prüfergebnisse müssen die tatsächliche Ausführung der Geschäftsregeln belegen. Ein bloß erfolgreicher Transformationsaufruf reicht nicht aus.

Die derzeit implementierten Grenzen sind 10 MB für ein eingehendes Original, 5 MB für dessen XML und 2,5 MB für eine auszustellende XML einschließlich eingebetteter Anlagen. Ein hybrides Original wird nicht durch die PDF.js-Bildkonvertierung für Leistungsnachweis-Kopien ersetzt. PDF/A-Eigenschaften, Signaturen und die vollständige formale Konformität eines ZUGFeRD-Containers werden nicht als geprüft ausgewiesen. Die Ausgabe von ZUGFeRD-PDF/A-3 ist weiterhin offen. Der Rechnungslauf erstellt weiterhin prüfbare Entwürfe; die E-Rechnungsangaben werden vor der Einzel-Ausstellung ergänzt und geprüft. Ein automatischer Versand, Peppol-Zugang oder Zugang zu einem B2G-Portal ist nicht Bestandteil dieses Ablaufs.

Die neue Datenbanklogik liegt in `scripts/sql/office-einvoice-workspace.sql`. Eingangsoriginale und ausgestellte XML werden innerhalb des abgegrenzten Rechnungsarchivs gespeichert; dafür wird keine allgemeine XML-Uploadberechtigung des Dokumenten-Storage vorausgesetzt. Signierte Leistungsnachweise bleiben in ihrem vorhandenen Originalspeicher. Zugriffe sind an Mandant, Person, Rolle und Rechnung gebunden. Der vorhandene Edge-Dienst bestätigt serverseitige Prüfbelege; selbst übermittelte XML oder Browser-Prüfergebnisse dürfen keine Freigabe begründen.

Die bestehenden Funktionen `office_invoice_issue_preview`, `invoiceIssuePdf.web.ts` und die atomare Freigabe bleiben der gemeinsame Ausstellungsweg. Steuernummer und USt-ID stammen aus `tenants`; die für diesen Vorgang maßgebliche steuerliche Einordnung wird ausdrücklich an der Rechnung erfasst. Ein automatischer Abgleich sämtlicher Angaben mit `tenant_tax_profiles` ist damit noch nicht belegt. Die PDF zeigt den bestätigten tatsächlichen Leistungsempfänger und positionsbezogene Befreiungsgründe. Interne Office-Notizen werden nicht in die weiterzugebende Rechnung übernommen.

Der alte Baustein `src/lib/documents/eInvoiceService.ts` bleibt außerhalb dieses produktiven Ablaufs. Seine Demo-Daten und der dort aus einer leeren Fehlerliste abgeleitete Status `validated` sind weiterhin kein Normnachweis und dürfen nicht verwendet werden. Eine normale PDF sowie ein XML-Entwurf bleiben von einer ausgestellten und tatsächlich geprüften E-Rechnung zu unterscheiden. Auch ein unverändertes Original mit Hash belegt allein keine vollständige GoBD-Konformität des gesamten Verfahrens.

## Rechtliche Einordnung für die Produktlogik

1. Empfang und Ausstellung sind getrennte Anforderungen. Seit 2025 müssen inländische Unternehmer grundsätzlich E-Rechnungen empfangen können; für den Empfang kann ein E-Mail-Postfach genügen. Ein automatisches Buchungs- oder Verarbeitungssystem folgt daraus nicht als allgemeine Pflicht. Für CareSuite sind Import, Sichtprüfung und nachvollziehbare Ablage trotzdem eigene Produktanforderungen.
2. Die allgemeine Übergangsregel für sonstige Rechnungen läuft Ende 2026 aus. Für 2027 besteht unter anderem die Umsatzgrenze von höchstens 800.000 Euro; maßgeblich ist der gesetzliche Vorjahresgesamtumsatz. Die Regelprüfung muss auch den zugrunde liegenden Umsatz und die Übermittlung berücksichtigen, nicht lediglich das Datum auf der Rechnung. Sonderfälle wie die befristete EDI-Regel separat behandeln.
3. Ab 2028 endet die allgemeine Übergangsfrist. Das bedeutet keine ausnahmslose Ausstellungspflicht für jeden Umsatz: B2C, Kleinunternehmer nach § 19 UStG, bestimmte steuerfreie Umsätze nach § 4 Nr. 8 bis 29 UStG, Kleinbetragsrechnungen bis 250 Euro und Fahrausweise müssen sachgerecht unterschieden werden. Öffentliche Auftraggeber können gesonderten B2G-Regeln unterliegen.
4. Entscheidend ist der tatsächliche Leistungsempfänger und gegebenenfalls dessen unternehmerischer Leistungsbezug. Rechnungsadresse, Zahlstelle und Kostenträger dürfen damit nicht ungeprüft gleichgesetzt werden. Eine Krankenkasse als Kostenträger begründet für sich noch keine B2B-Einordnung. Ebenso beweisen weder der Bereich „Pflege“ noch ein Steuersatz von 0 % eine bestimmte Steuerbefreiung.
5. Normgerechte strukturierte Daten sind von einer lesbaren Darstellung zu unterscheiden. XRechnung und geeignete ZUGFeRD-Profile sind Zielstandards. Bei ZUGFeRD ab Version 2.0.1 sind die Profile MINIMUM und BASIC-WL ausgenommen. Eine Dateiendung `.xml`, die Versionsnummer allein oder eine angehängte beliebige XML-Datei ist kein Konformitätsnachweis. Weitere gesetzlich zulässige vereinbarte Formate sind nicht pauschal auszuschließen. Für jede unterstützte Syntax, Version und jedes Profil die passenden Regeln verwenden; insbesondere nicht jedes ZUGFeRD-Dokument gegen XRechnung-spezifische Regeln prüfen.
6. Bei der Aufbewahrung muss insbesondere der strukturierte Originalteil unversehrt und maschinell lesbar erhalten bleiben. Umsatzsteuerlich beträgt die reguläre Rechnungsaufbewahrung acht Jahre; weitere Fristen und Aufbewahrungssperren sind separat zu prüfen. Eine gerenderte PDF oder ein Hash allein ersetzt das Original und das erforderliche Verfahren nicht.

Die Punkte 1–6 sind Produktanforderungen aus den unten genannten Rechtsgrundlagen. Eine automatische steuerliche Freigabe ohne ausreichende Stammdaten und Einordnung ist nicht vorgesehen.

## Funktionaler Ausbau

### Empfang und Originalablage

- Unternehmenbezogener Rechnungseingang mit Import strukturierter XML-Rechnungen und geeigneter hybrider PDF/XML-Dateien; keine erzwungene Zuordnung zu einem Pflegeklienten.
- Erkennung von Syntax, Profil und Version, sichere Verarbeitung ohne externe XML-Entitäten oder unkontrollierte Netzwerkzugriffe, Größen- und Ressourcenlimits sowie verständliche Fehlermeldungen.
- Originaldatei unverändert speichern. Bei hybriden Dokumenten Original-PDF und extrahierten XML-Inhalt eindeutig verbinden; die Extraktion darf das Original nicht ersetzen.
- Die vollständige Originalablage ist die gewählte Produktanforderung. Daraus keine pauschale Aussage ableiten, dass steuerrechtlich immer zusätzlich zum strukturierten Teil auch eine inhaltsgleiche Sichtdarstellung aufbewahrt werden muss.
- Eingehende hybride E-Rechnungen nicht durch die bestehende PDF.js-Bildkonvertierung für Leistungsnachweis-Kopien schicken: Diese Darstellung bewahrt weder eingebettetes XML noch eine vorhandene elektronische Signatur als Original.
- Lesbare Vorschau aus den strukturierten Daten, getrennte Anzeige von Datei-/Formatprüfung und fachlicher Prüfung; keine automatische Zahlung oder Buchung allein durch einen Import.
- Doppelte Importe, Mandantentrennung, Berechtigungen, Export der Originale und nachvollziehbare Verarbeitungsschritte berücksichtigen.

### Ausstellung und Rechnungslauf

- XRechnung ist als strukturierter Ausgabeweg implementiert; ihre Freigabe setzt die belegte Prüfung der gesamten Ausstellungsstrecke voraus. ZUGFeRD bleibt ein zusätzlicher, noch umzusetzender Ausgabeweg.
- Erforderliche Verkäufer-, Käufer-, Adress-, Steuer-, Zahlungs- und Referenzdaten vollständig aus bestätigten Daten beziehen. Elektronische Adressen und deren Kennzeichnung, Käuferreferenz sowie gegebenenfalls Leitweg-ID nach dem konkret gewählten Profil prüfen; keine erfundenen Ersatzwerte.
- B2B/B2C/B2G, Ansässigkeit, Kleinunternehmerregelung, Umsatzjahr und begründete Steuerbefreiung ausdrücklich erfassen beziehungsweise bestätigen. Unbekannte Werte bleiben „zu prüfen“.
- Steuerkategorie und gegebenenfalls Befreiungsgrund je Position beziehungsweise Steuergruppe unterstützen. Gemischte steuerpflichtige und steuerfreie Leistungen nicht mit einer einzigen pauschalen Ausnahme freigeben.
- Für eine PDF-Übermittlung erforderliche Empfängerzustimmung und die anwendbare Übergangsregel nachvollziehbar berücksichtigen.
- Einzelrechnung, manueller Editor und Rechnungslauf verwenden denselben Datenbestand und dieselben Prüfregeln. Vorschau und finale XML-/PDF-Ausgabe müssen dieselben Beträge, Positionen, Empfänger und Referenzen enthalten.
- Endgültige Nummer, eingefrorene Rechnungsdaten, Originaldateien, Hashes sowie tatsächliches Validierungsergebnis konsistent freigeben. Unterbrochene Vorgänge und Wiederholungen dürfen keine doppelte Rechnung erzeugen.

### Leistungsnachweise

- Leistungsnachweise bleiben optional und ausdrücklich auswählbar.
- Erforderliche Rechnungsangaben müssen im strukturierten Rechnungsdatensatz stehen; Anlagen ersetzen diese Angaben nicht.
- Anlagen nach dem gewählten Format zulässig einbetten oder eindeutig referenzieren. Signierte Originalnachweise bewahren; eine gerenderte PDF-Kopie ist als solche zu behandeln.
- Rechnung ohne Nachweise, mit einem Nachweis und mit mehreren Nachweisen getrennt prüfen. Ein Fehler in einer Anlage darf nicht stillschweigend zu einer anders ausgestellten Rechnung führen.

## Freigabekriterien

Die nachfolgende technische Validierung ist ein Abnahmekriterium von CareSuite. Sie ist nicht selbst eine allgemeine gesetzliche Pflicht und ersetzt keine inhaltliche beziehungsweise steuerliche Prüfung der Rechnung.

- Tatsächlich erzeugte Dateien bestehen eine geeignete, versionierte Prüfung gegen den gewählten Standard einschließlich einschlägiger Geschäftsregeln. Eine eigene Pflichtfeldliste allein reicht für die behauptete Formatkonformität nicht.
- Fehlende Daten, unzulässige Profile, Rundungsfehler, Steuergruppen, ungültige Einheiten und widersprüchliche Summen verhindern eine behauptete erfolgreiche Validierung; Warnungen bleiben sichtbar.
- Originaldateien lassen sich vollständig und unverändert wieder herunterladen. Tests decken Mandantentrennung, Wiederholung, unterbrochene Speicherung und Änderungen zwischen Vorschau und Freigabe ab.
- Empfang und Ausstellung besitzen jeweils einen belegten End-to-End-Nachweis mit freigegebenen Testdaten außerhalb produktiver Geschäftsdaten. Bestehende Beschränkungen zu Installationen, Infrastruktur und Android bleiben bestehen; fehlende Fähigkeiten werden als konkrete Lücke ausgewiesen.
- Die Begriffe „E-Rechnung“, „validiert“ und „revisionssicher“ werden nur im nachgewiesenen Umfang verwendet. Implementierung, erfolgreiche Formatprüfung einer konkreten Datei, Produktivveröffentlichung und vollständige Ende-zu-Ende-Abnahme werden getrennt dokumentiert. Eine nicht belegte Veröffentlichung oder Prüfung darf nicht als abgeschlossen gemeldet werden.

## Amtliche Grundlagen

- [§ 14 UStG – Rechnungsbegriff, strukturierte Formate, Leistungsempfänger und Pflichtangaben](https://www.gesetze-im-internet.de/ustg_1980/__14.html)
- [§ 27 Abs. 38 UStG – Übergangsregelungen](https://www.gesetze-im-internet.de/ustg_1980/__27.html)
- [§ 34a UStDV – Kleinunternehmer](https://www.gesetze-im-internet.de/ustdv_1980/__34a.html)
- [Bayerisches Landesamt für Steuern – E-Rechnung, Ausnahmen, Empfang und Aufbewahrung](https://www.lfst.bayern.de/steuerinfos/weitere-themen/e-rechnung)
- [BMF-FAQ – Formate, Profile und Bedeutung der Validierung](https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html)
- [FeRD – ZUGFeRD-Profile und hybrides Dateiformat](https://www.ferd-net.de/standards/zugferd-faq)
- [KoSIT – Versionen und Prüf-Bundles für XRechnung](https://xeinkauf.de/xrechnung/versionen-und-bundles/)

Vor jeder Freigabe erneut auf Rechts- und Versionsänderungen prüfen. Die genannten Quellen ersetzen keinen geprüften technischen Validator.
