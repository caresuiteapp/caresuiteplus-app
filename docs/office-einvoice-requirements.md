# Office-Rechnungen: Anforderungen an E-Rechnungen

Stand: 18. Oktober 2026. Ergänzung des Nutzerauftrags zur Rechnungsverwaltung; diese Datei dokumentiert Anforderungen und den geprüften Iststand. Sie schaltet keine E-Rechnungsfunktion frei und ersetzt keine steuerliche Einordnung eines einzelnen Umsatzes.

## Geprüfter Iststand

- Der produktive Office-Web-Ablauf erstellt, zeigt und archiviert PDF-Rechnungen. Eine gewöhnliche PDF enthält damit noch keinen strukturierten E-Rechnungsdatensatz.
- `src/lib/documents/eInvoiceService.ts` ist keine produktive Export- oder Validierungsengine: Beide Verfügbarkeitskennzeichen sind `false`; die vorbereiteten Daten sind JSON, enthalten einen Demo-Verkäufernamen und erzeugen kein normgerechtes XML. Der dortige Status `validated` wird lediglich aus einer leeren Fehlerliste abgeleitet. Dieser Status ist kein Normnachweis und darf nicht für eine produktive Freigabe übernommen werden.
- Die neue Office-Rechnungsoberfläche verwendet diesen vorbereiteten Baustein nicht. Der bestehende Dokumenten-Upload ist kein vollständiger Rechnungseingang für das Unternehmen.
- Die Rechnungsspeicherung besitzt bereits eingefrorene Rechnungsdaten und einen Hash der ausgestellten PDF. Das belegt allein weder die Aufbewahrung eines strukturierten Originals noch eine vollständige GoBD-Konformität des Gesamtverfahrens.

Für die Umsetzung die bestehende Kette aus `office_invoice_issue_preview`, `invoiceIssuePdf.web.ts` und atomarer Freigabe erweitern. XML-Dateien nicht nachträglich aus veränderlichen Firmen- oder Klientendaten zu einer bereits ausgestellten Rechnung erzeugen. Steuernummer und USt-ID stammen aus `tenants`; steuerliche Einstellungen wie die Kleinunternehmerregelung aus `tenant_tax_profiles`. Derzeit fehlen insbesondere strukturierte Steuerkategorien je Position sowie die eindeutige geschäftliche Rolle und elektronische Adresse des Leistungsempfängers. Vor einem XML-Import die tatsächlich produktiven Storage-MIME-Einstellungen und Zugriffsregeln prüfen; eine vorhandene Dateiauswahl ist kein Beleg, dass XML sicher gespeichert werden kann.

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

- Ziel: produktive XRechnung; ZUGFeRD als zusätzlicher geprüfter Ausgabeweg. Erzeugung und Validierung sind echte Implementierungsaufgaben und derzeit noch offen.
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
- Die Begriffe „E-Rechnung“, „validiert“ und „revisionssicher“ werden nur im nachgewiesenen Umfang verwendet. Bis zur tatsächlichen Umsetzung lautet der Produktstatus: PDF-Rechnungen verfügbar, vollständiger E-Rechnungsein- und -ausgang noch offen.

## Amtliche Grundlagen

- [§ 14 UStG – Rechnungsbegriff, strukturierte Formate, Leistungsempfänger und Pflichtangaben](https://www.gesetze-im-internet.de/ustg_1980/__14.html)
- [§ 27 Abs. 38 UStG – Übergangsregelungen](https://www.gesetze-im-internet.de/ustg_1980/__27.html)
- [§ 34a UStDV – Kleinunternehmer](https://www.gesetze-im-internet.de/ustdv_1980/__34a.html)
- [Bayerisches Landesamt für Steuern – E-Rechnung, Ausnahmen, Empfang und Aufbewahrung](https://www.lfst.bayern.de/steuerinfos/weitere-themen/e-rechnung)
- [BMF-FAQ – Formate, Profile und Bedeutung der Validierung](https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html)
- [FeRD – ZUGFeRD-Profile und hybrides Dateiformat](https://www.ferd-net.de/standards/zugferd-faq)
- [KoSIT – Versionen und Prüf-Bundles für XRechnung](https://xeinkauf.de/xrechnung/versionen-und-bundles/)

Vor der Implementierung beziehungsweise Freigabe erneut auf Rechts- und Versionsänderungen prüfen. Die genannten Quellen ersetzen keinen geprüften technischen Validator.
