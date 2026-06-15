import { batchTpl, seriesTpl } from '../helpers';

const RESIDENT_STATUS = batchTpl('tpl-stat-resident', 'stationaer', 'dropdown_value', [
  { title: 'Bewohner aktiv', content: 'aktiv', categoryKey: 'resident_status' },
  { title: 'Bewohner kurz abwesend', content: 'abwesend', categoryKey: 'resident_status' },
  { title: 'Bewohner im Krankenhaus', content: 'krankenhaus', categoryKey: 'resident_status' },
  { title: 'Bewohner Kurzzeitpflege', content: 'kurzzeit', categoryKey: 'resident_status' },
  { title: 'Bewohner Entlassung geplant', content: 'entlassung', categoryKey: 'resident_status' },
  { title: 'Bewohner verstorben', content: 'verstorben', categoryKey: 'resident_status' },
]);

const AREAS = seriesTpl(
  'tpl-stat-area',
  'stationaer',
  'dropdown_value',
  'stationaer_living_area_type',
  ['Wohnbereich A — Demenz', 'Wohnbereich B — Gerontopsychiatrie', 'Wohnbereich C — Kurzzeit', 'Wohnbereich D — Palliativ', 'Wohnbereich E — Aktiv'],
  (title) => title.split(' — ')[1]?.toLowerCase().replace(/\s/g, '_') ?? title,
);

const ROOMS = seriesTpl(
  'tpl-stat-room',
  'stationaer',
  'documentation_text',
  'rooms',
  ['Zimmer Einzelzimmer', 'Zimmer Doppelzimmer', 'Zimmer Kurzzeit', 'Zimmer Isolierung', 'Zimmer Palliativ', 'Zimmer Übergang'],
  (title) => `${title}: Bewohner {{clientName}}, Zimmer {{roomNumber}}.`,
);

const DAILY = seriesTpl(
  'tpl-stat-daily',
  'stationaer',
  'documentation_text',
  'daily',
  [
    '06:30 Weckdienst', '07:00 Morgentoilette', '08:00 Frühstück', '09:00 Aktivierung',
    '10:30 Kaffeerunde', '12:00 Mittagessen', '14:00 Ruhephase', '15:00 Nachmittagsaktivität',
    '17:00 Kaffee und Kuchen', '18:00 Abendessen', '19:30 Abendtoilette', '21:00 Nachtruhe',
  ],
  (title) => `Tagesstruktur ${title} — Wohnbereich {{shift}}.`,
);

const MEALS = seriesTpl(
  'tpl-stat-meal',
  'stationaer',
  'documentation_text',
  'meals',
  ['Frühstück Vollkost', 'Frühstück Diabetiker', 'Mittag Vollkost', 'Mittag Püriert', 'Abend Vollkost', 'Abend Schonkost', 'Trinkprotokoll', 'Nahrungsverweigerung'],
  (title) => `Mahlzeit ${title}: {{clientName}}, Kostform {{dietType}}.`,
);

const ACTIVITIES = seriesTpl(
  'tpl-stat-activity',
  'stationaer',
  'documentation_text',
  'activities',
  ['Gedächtnistraining', 'Singsang', 'Gymnastik', 'Spaziergang Garten', 'Basteln', 'Tierbesuch', 'Musiktherapie', 'Biografiearbeit', 'Spiele', 'Gottesdienst'],
  (title) => `Aktivität ${title} — Teilnahme {{clientName}} am {{date}}.`,
);

const HANDOVER = batchTpl('tpl-stat-handover', 'stationaer', 'documentation_text', [
  { title: 'Übergabe Frühdienst', content: 'Frühdienst-Übergabe {{shift}}: {{summary}}', categoryKey: 'handover' },
  { title: 'Übergabe Spätdienst', content: 'Spätdienst-Übergabe: Besonderheiten bei {{clientName}}.', categoryKey: 'handover' },
  { title: 'Übergabe Nachtdienst', content: 'Nachtdienst: {{summary}}', categoryKey: 'handover' },
  { title: 'Übergabe Wochenende', content: 'Wochenend-Übergabe — offene Punkte: {{notes}}.', categoryKey: 'handover' },
  { title: 'Angehörigeninfo stationär', content: 'Information an Angehörige von {{clientName}}: {{message}}.', categoryKey: 'handover' },
  { title: 'Arztvisite Protokoll', content: 'Visite am {{date}} — Verlauf {{summary}}.', categoryKey: 'handover' },
]);

export const STATIONAER_TEMPLATES = [
  ...RESIDENT_STATUS,
  ...AREAS,
  ...ROOMS,
  ...DAILY,
  ...MEALS,
  ...ACTIVITIES,
  ...HANDOVER,
];
