import { CENTRAL_CATALOG_GROUPS } from './centralCatalogTitles';
import { centralDocumentSections } from './centralDocumentSections';
import { careSuiteRelatedSections, careSuiteSoftwareContent } from './careSuiteSoftwareContent';
import { clientLegalEdition2027 } from './clientLegalEdition2027';
import type { CentralDocumentDefinition, CentralDocumentField, CentralDocumentLayout, CentralDocumentTarget } from '@/types/documents/centralCatalog';

const CATEGORY_FIELDS: Record<string, string[]> = {
  aufnahme: ['Anlass und Versorgungsbeginn', 'Unterstützungsbedarf und vorhandene Ressourcen', 'Beteiligte Personen und Zuständigkeiten', 'Offene Unterlagen und nächste Schritte'],
  vertraege: ['Vereinbarter Leistungsumfang und Grenzen', 'Beginn, Laufzeit und Durchführung', 'Vergütung, Eigenanteile und Abrechnungsverfahren', 'Laufzeit, Absagen und Kündigungsbedingungen', 'Anlagen und besondere Vereinbarungen'],
  vollmachten: ['Gegenstand und konkreter Zweck', 'Berechtigte beziehungsweise empfangende Personen', 'Umfang, Grenzen und Gültigkeit', 'Aufklärung, Entscheidung und Widerruf'],
  pflegeplanung: ['Sichtweise, Wünsche und Gewohnheiten der Person', 'Ressourcen und pflegerischer Unterstützungsbedarf', 'Beobachtungen und fachliche Einschätzung', 'Vereinbarte Maßnahmen und Zuständigkeit', 'Evaluation, Termin und Anpassungsbedarf'],
  risiken: ['Beobachtung und relevante Einflussfaktoren', 'Individuelle Risikoeinschätzung', 'Vereinbarte Maßnahmen und Beratung', 'Wirksamkeit und erneute Beurteilung'],
  behandlungspflege: ['Verordnung oder Anordnung mit Datum und anordnender Person', 'Maßnahme, Umfang und Durchführung', 'Beobachtungen und Abweichungen', 'Rücksprache, Reaktion und weiteres Vorgehen'],
  medikamente: ['Ärztliche Anordnung und gültiger Planstand', 'Arzneimittel, Dosierung und Applikationsweg', 'Durchführung, Einnahme und Abweichungen', 'Beobachtete Wirkung und Rücksprache'],
  wunden: ['Versorgungsstelle und Ausgangsbefund', 'Ärztliche Anordnung und Versorgungsmaterial', 'Durchführung und Verlauf', 'Schmerz, Infektionszeichen und Rücksprache'],
  betreuung: ['Interessen, Wünsche und Teilhabeziele', 'Angebot, Dauer und erforderliche Unterstützung', 'Teilnahme und individuelle Beobachtung', 'Rückmeldung und Anpassung des Angebots'],
  alltag: ['Vereinbarte Aufgaben und Grenzen', 'Durchgeführte Unterstützung', 'Auslagen, Schlüssel und Besonderheiten', 'Rückmeldung und weiterer Unterstützungsbedarf'],
  antraege: ['Beantragte Leistung und Anlass', 'Leistungszeitraum und beteiligte Pflegeperson', 'Vorliegende Nachweise und Anlagen', 'Bearbeitungsstand, Rückfragen und Fristen'],
  einsatz: ['Auftrag, Zeitraum und zuständige Mitarbeitende', 'Geplante und tatsächlich erbrachte Leistungen', 'Abweichungen, Kontaktversuche und Begründung', 'Übergabe und weiterer Handlungsbedarf'],
  stationaer: ['Wohnbereich, Zimmer und Zeitraum', 'Vereinbarte Leistungen oder übernommene Gegenstände', 'Beobachtungen, Abweichungen und Anliegen', 'Beteiligung, Zuständigkeit und nächster Schritt'],
  teilstationaer: ['Besuchstage, Zeitraum und Beförderung', 'Versorgungsbedarf und Tagesstruktur', 'Übergabe, Medikamente und Hilfsmittel', 'Verlauf und Rückmeldung an die Häuslichkeit'],
  notfall: ['Zeitpunkt, Ort und beteiligte Personen', 'Sachverhalt und konkrete Beobachtungen', 'Sofortmaßnahmen und Verständigungen', 'Ergebnis, Übergabe und Nachbereitung'],
  palliativ: ['Wünsche, Behandlungsziele und Vertretung', 'Symptome und belastende Situation', 'Abgestimmte Maßnahmen und ärztliche Anordnungen', 'Kontakt, Angehörigenbegleitung und Verlauf'],
  hygiene: ['Geltungsbereich und betroffene Tätigkeit', 'Verfahren, Mittel und Schutzmaßnahmen', 'Durchführung, Kontrolle und Abweichung', 'Zuständigkeit, Schulung und Überprüfung'],
  personal: ['Tätigkeit, Zeitraum und Anlass', 'Qualifikation, Aufgaben und Zuständigkeit', 'Vereinbarungen und festgestellter Bedarf', 'Nachweise, Freigabe und Wiedervorlage'],
  qm: ['Geltungsbereich und Ziel des Verfahrens', 'Ablauf und Verantwortlichkeiten', 'Feststellungen, Risiken und Nachweise', 'Verbesserungsmaßnahme, Termin und Wirksamkeitskontrolle'],
  zulassung: ['Angebot, Rechtsgrundlage und zuständige Stelle', 'Voraussetzungen, Nachweise und Anlagen', 'Vertrags- oder Anerkennungsumfang', 'Bearbeitungsstand, Änderungsbedarf und Fristen'],
  abrechnung: ['Leistungszeitraum und Abrechnungsgrundlage', 'Leistungen, Beträge und Kostenträger', 'Prüfung, Zahlung oder Absetzung', 'Belege, Korrekturen und offene Punkte'],
  datenschutz: ['Verarbeitung, Zweck und betroffene Daten', 'Rechtsgrundlage, Empfänger und Verantwortlichkeit', 'Schutzmaßnahmen, Berechtigungen und Aufbewahrung', 'Prüfung, Umsetzung und Änderungsbedarf'],
  arbeitsschutz: ['Arbeitsbereich, Gerät oder Gefährdung', 'Beurteilung, Schutzmaßnahme und Verantwortlichkeit', 'Unterweisung, Prüfung und Ergebnis', 'Mangel, Maßnahme und nächster Prüftermin'],
  abschluss: ['Anlass, Zeitpunkt und übernehmende Stelle', 'Versorgungsstand und offene Aufgaben', 'Übergebene Unterlagen, Gegenstände und Werte', 'Abschlusskontrolle, Rückgabe und Archivierung'],
};

/** Originalunterlagen werden katalogisiert, aber nicht als Behörden-/Arzturkunden erzeugt. */
const ORIGINAL_TITLES = new Set([
  'Pflegegradbescheid und Änderungsbescheide', 'Pflegegutachten',
  'Betreuerausweis beziehungsweise gerichtlicher Betreuungsbeschluss',
  'Vorsorgevollmacht', 'Patientenverfügung', 'Betreuungsverfügung',
  'Verordnung häuslicher Krankenpflege', 'Folgeverordnung beziehungsweise Änderungsverordnung',
  'Genehmigung oder Ablehnung der Krankenkasse', 'Ärztliche Anordnung',
  'Befunde, Arztbriefe und Krankenhausentlassberichte', 'Aktueller Medikationsplan',
  'Ärztliche Medikamentenanordnungen', 'Bedarfsmedikationsanordnung mit Anlass, Dosierung und Grenzen',
  'Ärztliche Anordnung zur Wundversorgung', 'Bewilligung beziehungsweise Kostenzusage',
  'Bescheide und Widerspruchsunterlagen', 'Gerichtliche Genehmigungen',
  'Ärztlicher Krisen- und Bedarfsmedikationsplan', 'SAPV-Verordnung und Versorgungsunterlagen',
  'Berufsabschluss- und Qualifikationsnachweise', 'Berufszulassung beziehungsweise Anerkennungsnachweise',
  'Nachweise besonderer Fachqualifikationen', 'Führungszeugnis',
  'Qualifikationsnachweise für Alltagsbegleitung nach Landesrecht',
  'Prüfberichte des Medizinischen Dienstes beziehungsweise anderer Prüfstellen',
  'Anerkennungsbescheid', 'Gewerbe- und Unternehmensunterlagen', 'Versicherungsnachweise',
  'Versorgungsvertrag nach SGB XI', 'Vergütungsvereinbarungen',
  'Verträge zur häuslichen Krankenpflege nach SGB V', 'Institutionskennzeichen und zugehörige Unterlagen',
  'Sicherheitsdatenblätter', 'Rückmeldungen und Auswertungen der Datenauswertungsstelle',
  'Elektronischer Abrechnungsdatensatz und Übertragungsprotokoll', 'Buchungsbelege',
  'Kostenzusagen und Bewilligungen',
]);

function slug(label: string): string {
  return label.toLocaleLowerCase('de-DE').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function field(label: string, index: number, required = false): CentralDocumentField {
  return { key: `f${index}_${slug(label).slice(0, 50)}`, label, type: 'multiline', required };
}
function inferLayout(title: string, category: string): CentralDocumentLayout {
  if (title === 'Information zu Ausfällen, Absagen und Kündigungen') return 'form';
  if (/vertrag|verträge|Verpflichtung|Abtretung|Einwilligung|Vollmacht|Lastschriftmandat|Schweigepflichtentbindung|Vereinbarung/i.test(title)) return 'contract';
  if (/Kündigung|Mitteilung|Mahnung|Änderungsanzeige|Schriftverkehr|Widerruf/i.test(title)) return 'letter';
  if (/checkliste|kontrolle der Akte|Aufnahmecheckliste|Abschlusskontrolle/i.test(title)) return 'checklist';
  if (/nachweis|protokoll|verlauf|übersicht|verzeichnis|konto|kassenbuch|plan$|Rechnung|abrechnung|Gutschrift|Storno/i.test(title) || category === 'abrechnung') return 'table';
  return 'form';
}

function documentFields(title: string, category: string): string[] {
  if (/Leistungsnachweis|Leistungsbestätigung|Tätigkeitsnachweis/i.test(title)) return ['Leistungszeitraum', 'Abrechnungsgrundlage und Kostenträger', 'Abweichungen und besondere Hinweise'];
  if (/Sturzprotokoll/.test(title)) return ['Zeitpunkt, Ort und beobachteter Hergang', 'Verletzungen, Beschwerden und Vitalzeichen', 'Sofortmaßnahmen und ärztliche Abklärung', 'Verständigte Personen und Uhrzeiten', 'Ursachenanalyse und angepasste Maßnahmen'];
  if (/Wund(anamnese|assessment|verlaufs|foto|bericht)/i.test(title)) return ['Lokalisation, Wundart und Entstehung', 'Länge, Breite, Tiefe und Messverfahren', 'Wundgrund, Wundrand und Wundumgebung', 'Exsudat, Geruch, Schmerz und Infektionszeichen', 'Versorgung, Material und Anordnung', 'Verlauf, Fotoverweis und nächste Kontrolle'];
  if (/Notfallblatt|Notfallkontakte/.test(title)) return ['Notfallkontakte und Vertretungsumfang', 'Behandelnde Ärzt:innen und Telefonnummern', 'Allergien und relevante Versorgungsinformationen', 'Notfallplan und Aufbewahrungsort gültiger Verfügungen'];
  if (/Bargeld|Haushaltskassenbuch|Verwahrgeld|Quittungen|Auszahlungen/.test(title)) return ['Übergebender und empfangender Personenkreis', 'Anfangsbestand, übernommener Betrag und Zweck', 'Ausgaben, Belege und Rückgeld', 'Endbestand, Rückgabe und Bestätigung'];
  if (/Schlüssel/.test(title)) return ['Schlüsselart, Kennung und Anzahl', 'Übergebende und empfangende Person', 'Erlaubter Zweck, Verwahrung und Zugangsberechtigung', 'Rückgabezeitpunkt, Verlust oder Besonderheiten'];
  if (/SEPA/.test(title)) return ['Gläubiger-ID und Mandatsreferenz', 'Kontoinhaber:in und IBAN', 'Zahlungsart und Mandatsdatum', 'Mandatstext, Aufklärung und Unterschrift'];
  if (/Schweigepflichtentbindung|Einwilligung/.test(title)) return ['Konkreter Zweck und betroffene Daten beziehungsweise Aufnahmen', 'Benannte Empfänger, Veröffentlichungswege und Umfang', 'Freiwilligkeit, Gültigkeit und Widerrufsweg', 'Aufklärung und konkrete Entscheidung der berechtigten Person'];
  if (/Medikamentengabenachweis|Medikamentenrichtplan|Insulin/.test(title)) return ['Verweis auf gültige ärztliche Anordnung', 'Arzneimittel, Stärke, Dosis und Applikationsweg', 'Vorgesehene Gabezeit und tatsächliche Durchführung', 'Abweichung, Wirkungskontrolle und Rücksprache'];
  if (/Gewichtsverlauf/.test(title)) return ['Messbedingungen, Messgerät und Zeitraum', 'Ausgangsgewicht und beobachteter Verlauf', 'Einschätzung und erforderliche Rücksprache', 'Vereinbarte Maßnahme und Kontrolle'];
  if (/Trinkprotokoll/.test(title)) return ['Zeitraum und individuell vereinbartes Trinkziel', 'Angebot, tatsächlich getrunkene Menge und Einheit', 'Bilanz, Besonderheiten und Rücksprache', 'Vereinbarte Unterstützung und Auswertung'];
  if (/Verarbeitungstätigkeiten/.test(title)) return ['Verantwortliche und Datenschutzkontakt', 'Zweck, Kategorien betroffener Personen und Daten', 'Empfänger, Übermittlungen und Rechtsgrundlage', 'Löschfristen sowie technische und organisatorische Maßnahmen'];
  if (/Datenschutzverletzungen/.test(title)) return ['Feststellungszeitpunkt, Ereignis und betroffene Daten', 'Umfang, betroffene Personen und Risikobeurteilung', 'Sofortmaßnahmen und Zuständigkeit', 'Meldeprüfung, Fristen, Benachrichtigung und Nachbereitung'];
  if (/Gefährdungsbeurteilungen/.test(title)) return ['Arbeitsbereich, Tätigkeiten und betroffene Personengruppen', 'Ermittelte Gefährdungen und Risikobeurteilung', 'Schutzmaßnahmen, Zuständigkeiten und Fristen', 'Wirksamkeitskontrolle und Fortschreibung'];
  return CATEGORY_FIELDS[category] ?? ['Anlass', 'Inhalt', 'Ergebnis'];
}

function columns(title: string): string[] {
  if (/Trink/.test(title)) return ['Datum / Uhrzeit', 'Getränk', 'Angeboten (ml)', 'Getrunken (ml)', 'Beobachtung', 'Handzeichen'];
  if (/Vitalwerte/.test(title)) return ['Datum / Uhrzeit', 'Messgröße', 'Wert / Einheit', 'Beobachtung', 'Maßnahme', 'Handzeichen'];
  if (/Blutzucker/.test(title)) return ['Datum / Uhrzeit', 'Wert / Einheit', 'Messbedingungen', 'Anordnung / Maßnahme', 'Rücksprache', 'Handzeichen'];
  if (/Medikament|Insulin/.test(title)) return ['Datum / Uhrzeit', 'Arzneimittel / Stärke', 'Dosis / Einheit', 'Applikationsweg', 'Gabe / Abweichung', 'Handzeichen'];
  if (/Leistungsnachweis|Tätigkeitsnachweis|Ersatzpflegenachweis|Leistungsbestätigung/.test(title)) return ['Datum', 'Beginn', 'Ende', 'Leistung', 'Menge / Einheit', 'Mitarbeitende', 'Bestätigung'];
  if (/Bargeld|Kassenbuch|Verwahrgeld|Beleg|Auslagen/.test(title)) return ['Datum', 'Zweck / Beleg', 'Einnahme (€)', 'Ausgabe (€)', 'Bestand (€)', 'Bestätigung'];
  if (/Fahrtenbuch|Kilometer/.test(title)) return ['Datum', 'Fahrtzweck', 'Start / Ziel', 'Km Beginn', 'Km Ende', 'Strecke (km)', 'Fahrer:in'];
  if (/Gewicht/.test(title)) return ['Datum / Uhrzeit', 'Gewicht (kg)', 'Messbedingungen', 'Beobachtung', 'Maßnahme', 'Handzeichen'];
  if (/Temperatur/.test(title)) return ['Datum / Uhrzeit', 'Ort / Gerät', 'Temperatur (°C)', 'Abweichung', 'Maßnahme', 'Handzeichen'];
  return ['Datum / Zeitraum', 'Gegenstand / Maßnahme', 'Ergebnis / Menge', 'Abweichung / Hinweis', 'Zuständigkeit'];
}

export const CENTRAL_DOCUMENT_CATALOG: readonly CentralDocumentDefinition[] = CENTRAL_CATALOG_GROUPS.flatMap((group) =>
  group.titles.trim().split('\n').map((entry) => {
    const match = entry.match(/^(\d{3})\|(.+)$/);
    if (!match) throw new Error(`Dokument ohne feste Katalog-ID in ${group.key}.`);
    const [, stableNumber, title] = match;
    const key = `csdc_${group.key}_${stableNumber}`;
    const content = careSuiteSoftwareContent(key);
    const sourceMode = ORIGINAL_TITLES.has(title) ? 'original' : 'create';
    const layout = sourceMode === 'original' ? 'form' : content?.layout ?? (group.key === 'software' ? 'form' : inferLayout(title, group.key));
    const target = (content?.target ?? (['Tourenplan', 'Dienst- und Einsatzplan', 'Rufbereitschaftsplan', 'Fahrzeugübergabe- und Fahrzeugkontrollbogen', 'Belegungs- und Zimmerübersicht', 'Hausordnung'].includes(title) ? 'company' : group.target)) as CentralDocumentTarget;
    const clinicalReviewRequired = ['pflegeplanung', 'risiken', 'behandlungspflege', 'medikamente', 'wunden', 'palliativ'].includes(group.key);
    const legal2027 = target === 'client' && sourceMode === 'create' && (['vertraege', 'vollmachten'].includes(group.key) || layout === 'contract') ? clientLegalEdition2027(title, group.key) : null;
    const fields = content?.fields ?? (layout === 'letter' ? [
      { key: 'letterSubject', label: 'Betreff', type: 'text', required: true, defaultValue: title } as CentralDocumentField,
      { key: 'reference', label: 'Aktenzeichen / Ihr Zeichen', type: 'text', required: false } as CentralDocumentField,
      { key: 'enclosures', label: 'Anlagen', type: 'multiline', required: false } as CentralDocumentField,
    ] : sourceMode === 'original'
      ? ['Aussteller und Ausstellungsdatum', 'Aktenzeichen und Gültigkeit', 'Erforderliche Folgemaßnahmen', 'Originaldatei und Aufbewahrungsort'].map((label, n) => field(label, n, n === 0))
      : documentFields(title, group.key).map((label, n) => field(label, n, n === 0)));
    const related = content ? [] : careSuiteRelatedSections(title, group.key, layout, sourceMode);
    const replacesGeneric = /Datenschutzinformation|Kommunikationsvereinbarung|Verpflichtung auf Vertraulichkeit/.test(title)
      || Boolean(legal2027 && /selbstständigen Medikamentenverwaltung|Nutzung von Haushaltsgeräten|Besuchs- und Kontaktvereinbarungen|Empfangsbestätigung|Kündigung und Vertragsbeendigungsbestätigung|Widerruf einer/.test(title));
    const legalFieldsOnly = legal2027 && /Datenschutzinformation|selbstständigen Medikamentenverwaltung|Nutzung von Haushaltsgeräten|Besuchs- und Kontaktvereinbarungen|Empfangsbestätigung|Kündigung und Vertragsbeendigungsbestätigung|Widerruf einer/.test(title);
    const sections = content?.sections ?? [...(replacesGeneric ? [] : centralDocumentSections(title, group.key, layout, sourceMode)), ...related];
    return {
      key,
      categoryKey: group.key, categoryName: group.name, title, version: legal2027 ? 3 : group.key !== 'software' && (content || related.length) ? 2 : 1, ...(legal2027 ? { edition: '2027' as const } : {}), modules: group.modules,
      target, sourceMode, layout, orientation: layout === 'table' ? 'landscape' : 'portrait',
      fields: [
        { key: 'date', label: 'Dokumentdatum', type: 'date', required: true },
        { key: 'author', label: 'Verantwortliche Person', type: 'text', required: true },
        { key: 'companyName', label: 'Unternehmen / Vertragspartner', type: 'text', required: true, sourcePath: 'company.name' },
        { key: 'companyAddress', label: 'Unternehmensanschrift', type: 'multiline', required: true, sourcePath: 'company.address' },
        { key: 'subjectName', label: layout === 'letter' ? 'Empfänger:in / Stelle' : target === 'employee' ? 'Mitarbeiter:in' : target === 'company' ? 'Organisation / Standort' : 'Klient:in / Patient:in', type: 'text', required: true, sourcePath: 'subject.name' },
        { key: 'subjectAddress', label: layout === 'letter' ? 'Empfängeranschrift' : 'Anschrift der zugeordneten Person / Organisation', type: 'multiline', required: layout === 'letter' || layout === 'contract', sourcePath: 'subject.address' },
        ...(target === 'client' && layout !== 'letter' && group.key !== 'software' ? [
          { key: 'birthDate', label: 'Geburtsdatum', type: 'date', required: false, sourcePath: 'subject.birthDate' } as CentralDocumentField,
          { key: 'careLevel', label: 'Pflegegrad', type: 'text', required: false, sourcePath: 'subject.careLevel' } as CentralDocumentField,
          { key: 'payorName', label: 'Kostenträger', type: 'text', required: false, sourcePath: 'payor.name' } as CentralDocumentField,
          { key: 'insuranceNumber', label: 'Versichertennummer', type: 'text', required: false, sourcePath: 'subject.insuranceNumber' } as CentralDocumentField,
        ] : target === 'employee' && layout !== 'letter' ? [
          { key: 'personnelNumber', label: 'Personalnummer', type: 'text', required: false, sourcePath: 'subject.personnelNumber' } as CentralDocumentField,
          { key: 'jobTitle', label: 'Tätigkeit / Berufsbezeichnung', type: 'text', required: false, sourcePath: 'subject.jobTitle' } as CentralDocumentField,
        ] : []),
        ...(legalFieldsOnly ? [] : fields.map(item => legal2027 ? { ...item, required: true } : item)),
        ...(legal2027?.fields ?? []),
      ],
      columns: layout === 'table' || layout === 'checklist' ? columns(title) : [],
      reviewStatus: 'draft',
      legalReviewRequired: layout === 'contract' || ['vollmachten', 'zulassung', 'datenschutz', 'software'].includes(group.key),
      clinicalReviewRequired,
      sections: [...sections, ...(legal2027?.sections ?? [])],
      instructions: sourceMode === 'original'
        ? 'Originalunterlage der ausstellenden Stelle hinterlegen. Das CareSuite-Begleitblatt ersetzt dieses Original nicht.'
        : clinicalReviewRequired
          ? 'Fachlicher Vorlagenentwurf. Inhalte und Maßnahmen durch die zuständige qualifizierte Person prüfen; keine automatische medizinische Entscheidung.'
          : 'Vorlagenentwurf. Angaben und individuelle Vereinbarungen vor Verwendung prüfen.',
    } satisfies CentralDocumentDefinition;
  }),
);

export function findCentralDocument(key: string): CentralDocumentDefinition | undefined {
  return CENTRAL_DOCUMENT_CATALOG.find((item) => item.key === key);
}
export function filterCentralDocuments(input: { query?: string; category?: string; module?: string; target?: CentralDocumentTarget }): CentralDocumentDefinition[] {
  const words = (input.query ?? '').trim().toLocaleLowerCase('de-DE').split(/\s+/).filter(Boolean);
  return CENTRAL_DOCUMENT_CATALOG.filter((item) =>
    (!input.category || item.categoryKey === input.category) &&
    (!input.module || item.modules.includes(input.module)) &&
    (!input.target || item.target === input.target) &&
    words.every((word) => `${item.title} ${item.categoryName}`.toLocaleLowerCase('de-DE').includes(word)),
  );
}

/** Gemeinsamer Aufruf aus Modulen, ohne eine Kopie ihrer Vorlagenbestände. */
export function centralDocumentCatalogHref(input: { module?: string; clientId?: string; employeeId?: string; templateKey?: string } = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value) params.set(key, value);
  return `/business/office/document-catalog${params.size ? `?${params.toString()}` : ''}`;
}
