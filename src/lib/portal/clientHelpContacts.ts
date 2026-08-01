export type ClientHelpCategory =
  | 'emergency'
  | 'medical'
  | 'crisis'
  | 'violence'
  | 'family'
  | 'daily';

export type ClientHelpContact = {
  id: string;
  category: ClientHelpCategory;
  name: string;
  displayNumber?: string;
  dialNumber?: string;
  availability: string;
  description: string;
  sourceLabel: string;
  sourceUrl: string;
  emergency?: boolean;
};

export const CLIENT_HELP_CATEGORY_LABELS: Record<ClientHelpCategory, string> = {
  emergency: 'Sofortige Notfälle',
  medical: 'Medizin & Gesundheit',
  crisis: 'Krisen & seelische Hilfe',
  violence: 'Gewalt, Opferhilfe & Schutz',
  family: 'Kinder, Eltern & Schwangerschaft',
  daily: 'Alltag, Pflege & Sicherheit',
};

/** Official nationwide contacts; poison centres cover every German federal state. */
export const CLIENT_HELP_CONTACTS: readonly ClientHelpContact[] = [
  {
    id: 'emergency-112', category: 'emergency', name: 'Feuerwehr & Rettungsdienst',
    displayNumber: '112', dialNumber: '112', availability: 'Rund um die Uhr', emergency: true,
    description: 'Bei Lebensgefahr, schwerer Verletzung, Brand oder akutem medizinischem Notfall.',
    sourceLabel: 'Bundesministerium des Innern', sourceUrl: 'https://www.bmi.bund.de/SharedDocs/pressemitteilungen/DE/2023/09/notrufnummern.html',
  },
  {
    id: 'police-110', category: 'emergency', name: 'Polizei',
    displayNumber: '110', dialNumber: '110', availability: 'Rund um die Uhr', emergency: true,
    description: 'Bei akuter Gefahr, Gewalt, Einbruch oder wenn sofort polizeiliche Hilfe nötig ist.',
    sourceLabel: 'Bundesministerium des Innern', sourceUrl: 'https://www.bmi.bund.de/SharedDocs/pressemitteilungen/DE/2023/09/notrufnummern.html',
  },
  {
    id: 'medical-116117', category: 'medical', name: 'Ärztlicher Bereitschaftsdienst',
    displayNumber: '116 117', dialNumber: '116117', availability: 'Rund um die Uhr, kostenfrei',
    description: 'Dringende Beschwerden außerhalb der Sprechzeiten, die nicht lebensbedrohlich sind.',
    sourceLabel: '116117', sourceUrl: 'https://www.116117.de/de/aerztlicher-bereitschaftsdienst.php',
  },
  {
    id: 'pharmacy', category: 'medical', name: 'Apotheken-Notdienst',
    displayNumber: '0800 00 22 8 33', dialNumber: '08000022833', availability: 'Rund um die Uhr, Festnetz kostenfrei',
    description: 'Findet die nächstgelegene dienstbereite Apotheke. Mobil ist zusätzlich 22 8 33 möglich (kostenpflichtig).',
    sourceLabel: 'aponet.de', sourceUrl: 'https://www.aponet.de/notdienstsuche',
  },
  {
    id: 'poison-berlin', category: 'medical', name: 'Giftnotruf Berlin',
    displayNumber: '030 19240', dialNumber: '03019240', availability: 'Rund um die Uhr',
    description: 'Giftinformationszentrum der Charité Berlin.', sourceLabel: 'BfR-Verzeichnis 2026', sourceUrl: 'https://www.bfr.bund.de/cm/343/verzeichnis-der-giftinformationszentren.pdf',
  },
  {
    id: 'poison-bonn', category: 'medical', name: 'Giftnotruf Bonn',
    displayNumber: '0228 19240', dialNumber: '022819240', availability: 'Rund um die Uhr',
    description: 'Informationszentrale gegen Vergiftungen Bonn.', sourceLabel: 'BfR-Verzeichnis 2026', sourceUrl: 'https://www.bfr.bund.de/cm/343/verzeichnis-der-giftinformationszentren.pdf',
  },
  {
    id: 'poison-erfurt', category: 'medical', name: 'Giftnotruf Erfurt',
    displayNumber: '0361 730730', dialNumber: '0361730730', availability: 'Rund um die Uhr',
    description: 'Gemeinsames Giftinformationszentrum der Länder in Erfurt.', sourceLabel: 'BfR-Verzeichnis 2026', sourceUrl: 'https://www.bfr.bund.de/cm/343/verzeichnis-der-giftinformationszentren.pdf',
  },
  {
    id: 'poison-freiburg', category: 'medical', name: 'Giftnotruf Freiburg',
    displayNumber: '0761 19240', dialNumber: '076119240', availability: 'Rund um die Uhr',
    description: 'Vergiftungs-Informations-Zentrale Freiburg.', sourceLabel: 'BfR-Verzeichnis 2026', sourceUrl: 'https://www.bfr.bund.de/cm/343/verzeichnis-der-giftinformationszentren.pdf',
  },
  {
    id: 'poison-goettingen', category: 'medical', name: 'Giftnotruf Göttingen',
    displayNumber: '0551 19240', dialNumber: '055119240', availability: 'Rund um die Uhr',
    description: 'Giftinformationszentrum-Nord Göttingen.', sourceLabel: 'BfR-Verzeichnis 2026', sourceUrl: 'https://www.bfr.bund.de/cm/343/verzeichnis-der-giftinformationszentren.pdf',
  },
  {
    id: 'poison-mainz', category: 'medical', name: 'Giftnotruf Mainz',
    displayNumber: '06131 19240', dialNumber: '0613119240', availability: 'Rund um die Uhr',
    description: 'Giftinformationszentrum Mainz.', sourceLabel: 'BfR-Verzeichnis 2026', sourceUrl: 'https://www.bfr.bund.de/cm/343/verzeichnis-der-giftinformationszentren.pdf',
  },
  {
    id: 'poison-munich', category: 'medical', name: 'Giftnotruf München',
    displayNumber: '089 19240', dialNumber: '08919240', availability: 'Rund um die Uhr',
    description: 'Giftnotruf München.', sourceLabel: 'BfR-Verzeichnis 2026', sourceUrl: 'https://www.bfr.bund.de/cm/343/verzeichnis-der-giftinformationszentren.pdf',
  },
  {
    id: 'telephone-counselling-1', category: 'crisis', name: 'TelefonSeelsorge',
    displayNumber: '116 123', dialNumber: '116123', availability: 'Rund um die Uhr, anonym und kostenfrei',
    description: 'Hilfe bei Einsamkeit, Sorgen, Krisen oder Suizidgedanken. Alternativ: 0800 111 0 111 oder 0800 111 0 222.',
    sourceLabel: 'TelefonSeelsorge Deutschland', sourceUrl: 'https://www.telefonseelsorge.de/',
  },
  {
    id: 'addiction', category: 'crisis', name: 'Sucht & Drogen Hotline',
    displayNumber: '01806 313031', dialNumber: '01806313031', availability: 'Täglich 8–24 Uhr, 0,20 € je Anruf',
    description: 'Beratung bei Alkohol-, Medikamenten-, Drogen- oder Verhaltenssucht.',
    sourceLabel: 'Deutsche Hauptstelle für Suchtfragen', sourceUrl: 'https://www.dhs.de/lebenswelten/sucht-im-alter/',
  },
  {
    id: 'violence-women', category: 'violence', name: 'Hilfetelefon Gewalt gegen Frauen',
    displayNumber: '116 016', dialNumber: '116016', availability: 'Rund um die Uhr, anonym und kostenfrei',
    description: 'Vertrauliche Beratung bei jeder Form von Gewalt, auch für Angehörige.',
    sourceLabel: 'Bundesamt für Familie', sourceUrl: 'https://www.hilfetelefon.de/',
  },
  {
    id: 'violence-men', category: 'violence', name: 'Hilfetelefon Gewalt an Männern',
    displayNumber: '0800 123 99 00', dialNumber: '08001239900', availability: 'Mo–Do 8–20 Uhr, Fr 8–15 Uhr',
    description: 'Vertrauliche Beratung für Männer, die Gewalt erleben oder erlebt haben.',
    sourceLabel: 'Hilfetelefon Gewalt an Männern', sourceUrl: 'https://www.maennerhilfetelefon.de/',
  },
  {
    id: 'victim-support', category: 'violence', name: 'WEISSER RING Opfer-Telefon',
    displayNumber: '116 006', dialNumber: '116006', availability: 'Täglich 7–22 Uhr, kostenfrei',
    description: 'Anonyme Hilfe für Opfer von Straftaten und deren Angehörige.',
    sourceLabel: 'WEISSER RING', sourceUrl: 'https://weisser-ring.de/hilfe-fuer-opfer/opfer-telefon',
  },
  {
    id: 'sexual-abuse', category: 'violence', name: 'Hilfe bei sexuellem Missbrauch',
    displayNumber: '0800 22 55 530', dialNumber: '08002255530', availability: 'Kostenfrei und anonym',
    description: 'Beratung für Betroffene, Angehörige und Menschen aus dem sozialen Umfeld.',
    sourceLabel: 'Bundesfamilienministerium', sourceUrl: 'https://www.bmbfsfj.bund.de/familienportal/lebenslagen/krise-und-konflikt/krisetelefone-anlaufstellen',
  },
  {
    id: 'children', category: 'family', name: 'Nummer gegen Kummer – Kinder & Jugendliche',
    displayNumber: '116 111', dialNumber: '116111', availability: 'Mo–Sa 14–20 Uhr, kostenfrei',
    description: 'Anonyme Beratung für Kinder und Jugendliche bei allen Sorgen und Problemen.',
    sourceLabel: 'Nummer gegen Kummer', sourceUrl: 'https://www.nummergegenkummer.de/',
  },
  {
    id: 'parents', category: 'family', name: 'Nummer gegen Kummer – Elterntelefon',
    displayNumber: '0800 111 0 550', dialNumber: '08001110550', availability: 'Mo/Mi/Fr 9–17 Uhr, Di/Do 9–19 Uhr',
    description: 'Anonyme Hilfe bei Erziehungsfragen, Überforderung oder Sorgen um ein Kind.',
    sourceLabel: 'Nummer gegen Kummer', sourceUrl: 'https://www.nummergegenkummer.de/',
  },
  {
    id: 'pregnancy', category: 'family', name: 'Hilfetelefon Schwangere in Not',
    displayNumber: '0800 40 40 020', dialNumber: '08004040020', availability: 'Rund um die Uhr, anonym und kostenfrei',
    description: 'Vertrauliche Beratung in 19 Sprachen für Schwangere in schwierigen Situationen.',
    sourceLabel: 'Bundeszentrale für gesundheitliche Aufklärung', sourceUrl: 'https://www.familienplanung.de/schwangerschaft/rechtliches-und-finanzielle-hilfen/wenn-sie-schwanger-sind-und-besondere-unterstuetzung-benoetigen/',
  },
  {
    id: 'care-phone', category: 'daily', name: 'Pflegetelefon des Bundes',
    displayNumber: '030 20179131', dialNumber: '03020179131', availability: 'Mo–Do 9–18 Uhr',
    description: 'Information und Orientierung für Pflegebedürftige und pflegende Angehörige.',
    sourceLabel: 'Bundesgesundheitsministerium', sourceUrl: 'https://www.bundesgesundheitsministerium.de/fileadmin/Dateien/5_Publikationen/Pflege/Broschueren/BMG_Ratgeber_Pflege.pdf',
  },
  {
    id: 'card-block', category: 'daily', name: 'Sperr-Notruf für Karten & Ausweise',
    displayNumber: '116 116', dialNumber: '116116', availability: 'Rund um die Uhr',
    description: 'Zum Sperren vieler Bankkarten, Mobilfunkkarten und elektronischer Identitätsfunktionen.',
    sourceLabel: 'Sperr-Notruf 116 116', sourceUrl: 'https://www.sperr-notruf.de/',
  },
  {
    id: 'authorities', category: 'daily', name: 'Behördenrufnummer',
    displayNumber: '115', dialNumber: '115', availability: 'In vielen Regionen Mo–Fr 8–18 Uhr',
    description: 'Auskunft zu Verwaltungsleistungen. Kein Notruf.',
    sourceLabel: 'Bundesnetzagentur', sourceUrl: 'https://www.bundesnetzagentur.de/DE/Fachthemen/Telekommunikation/Nummerierung/115/start.html',
  },
  {
    id: 'antidiscrimination', category: 'daily', name: 'Antidiskriminierungsstelle des Bundes',
    displayNumber: '0800 546 546 5', dialNumber: '08005465465', availability: 'Mo–Do 9–15 Uhr, kostenfrei',
    description: 'Erstberatung bei Benachteiligung oder Diskriminierung.',
    sourceLabel: 'Antidiskriminierungsstelle des Bundes', sourceUrl: 'https://www.antidiskriminierungsstelle.de/',
  },
  {
    id: 'nora', category: 'emergency', name: 'nora Notruf-App',
    availability: 'Notruf per App',
    description: 'Offizielle Notruf-App, besonders hilfreich für Menschen mit Hör- oder Sprachbehinderung.',
    sourceLabel: 'nora Notruf-App', sourceUrl: 'https://www.nora-notruf.de/de-as/startseite',
  },
] as const;
