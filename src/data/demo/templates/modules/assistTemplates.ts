import { seriesTpl } from '../helpers';

const HOUSEHOLD = seriesTpl(
  'tpl-assist-household',
  'assist',
  'task',
  'household',
  [
    'Küche reinigen', 'Geschirr spülen', 'Boden wischen', 'Staubsaugen', 'Bad reinigen',
    'Müll entsorgen', 'Bett beziehen', 'Wäsche sortieren', 'Wäsche waschen', 'Wäsche aufhängen',
    'Bügeln', 'Fenster putzen', 'Kühlschrank reinigen', 'Backofen reinigen', 'Schränke auswischen',
    'Einkaufsliste erstellen', 'Lebensmitteleinkauf', 'Apothekengang', 'Mülltonnen', 'Pflanzen gießen',
    'Post sortieren', 'Kleine Reparaturen melden',
  ],
  (title) => `Haushalt: ${title} bei {{clientName}}.`,
);

const CARE = seriesTpl(
  'tpl-assist-care',
  'assist',
  'task',
  'care',
  [
    'Aktivierendes Gespräch', 'Gedächtnistraining', 'Lesen vorlesen', 'Spiel / Beschäftigung',
    'Spaziergang', 'Telefonassistenz', 'Terminorganisation', 'Begleitung im Alltag',
    'Orientierung fördern', 'Soziale Kontakte', 'Routinen unterstützen', 'Motivation',
    'Angehörigenkontakt', 'Freizeitgestaltung', 'Kreative Beschäftigung', 'Musik / Radio',
    'Fotoalbum durchsehen', 'Erinnerungsarbeit',
  ],
  (title) => `Betreuung: ${title} mit {{clientName}}.`,
);

const ACCOMPANIMENT = seriesTpl(
  'tpl-assist-accomp',
  'assist',
  'task',
  'accompaniment',
  [
    'Arztbesuch Hausarzt', 'Facharztbesuch', 'Zahnarzt', 'Physiotherapie', 'Dialyse',
    'Apotheke', 'Behörde', 'Bank', 'Friseur', 'Einkauf begleiten',
    'Kirche / Gemeinde', 'Veranstaltung', 'Familienbesuch', 'Spaziergang außer Haus',
  ],
  (title) => `Begleitung: ${title} — {{clientName}}, Termin {{date}} {{time}}.`,
);

const DOC_BLOCKS = seriesTpl(
  'tpl-assist-doc',
  'assist',
  'documentation_text',
  'doc_blocks',
  [
    'Einsatzbeginn', 'Leistung durchgeführt', 'Klient ansprechbar', 'Angehörige informiert',
    'Material verbraucht', 'Besonderheiten', 'Stimmung gut', 'Stimmung reduziert',
    'Schmerzen angegeben', 'Medikamenten-Einnahme', 'Essen / Trinken', 'Mobilisation',
    'Hautbild unauffällig', 'Veränderung beobachtet', 'Übergabe an Team', 'Einsatzende',
  ],
  (title) => `${title}: {{clientName}} — {{employeeName}}, {{date}}.`,
);

const NOT_DONE = seriesTpl(
  'tpl-assist-notdone',
  'assist',
  'dropdown_value',
  'not_done',
  [
    'Klient:in abwesend', 'Klient:in verweigert Leistung', 'Kein Zutritt zur Wohnung',
    'Termin verschoben', 'Akuter Krankheitsfall', 'Notfall — Krankenhaus', 'Personal ausgefallen',
    'Verkehrsbehinderung', 'Falsche Adresse', 'Leistung nicht erforderlich', 'Sonstiger Grund',
  ],
  (title) => `Nicht erledigt — ${title}`,
);

const CHECKLIST = seriesTpl(
  'tpl-assist-check',
  'assist',
  'checklist',
  'checklist',
  [
    'Leistung dokumentiert', 'Material erfasst', 'Unterschrift eingeholt', 'Zeit erfasst',
    'Besonderheiten gemeldet', 'Übergabe erfolgt', 'Fotos (falls erlaubt)', 'Portal-Info',
    'Qualität geprüft', 'Einsatz abgeschlossen',
  ],
  (title) => `☐ ${title}`,
);

export const ASSIST_TEMPLATES = [
  ...HOUSEHOLD,
  ...CARE,
  ...ACCOMPANIMENT,
  ...DOC_BLOCKS,
  ...NOT_DONE,
  ...CHECKLIST,
];
