import type { VitalReadingType } from '@/types/modules/pflege';

type Preset = string | readonly [value: string, label: string];
export type VitalContextField = {
  key: string;
  label: string;
  options: readonly { key: string; label: string }[];
  required?: boolean;
};

function field(key: string, label: string, presets: readonly Preset[], required = false): VitalContextField {
  return {
    key, label, required,
    options: presets.map(preset => typeof preset === 'string' ? { key: preset, label: preset } : { key: preset[0], label: preset[1] }),
  };
}

const bodySide = field('side', 'Körperseite', [['links', 'Links'], ['rechts', 'Rechts'], 'Beidseits', 'Mittig']);
const bodyPosition = field('position', 'Körperlage', [
  ['sitzend', 'Sitzend'], ['stehend', 'Stehend'], ['liegend', 'Liegend'],
  'Rückenlage', 'Linke Seitenlage', 'Rechte Seitenlage', 'Bauchlage', 'Oberkörper erhöht',
]);
const situation = field('situation', 'Messsituation', [
  'In Ruhe', 'Bei Bewegung', 'Nach Belastung', 'Bei Lagerung', 'Während der Versorgung', 'Bei Beschwerden',
]);
const readingSource = field('readingSource', 'Herkunft des Messwerts', ['Am Gerät abgelesen', 'Aus dem Befund übernommen', 'Berechneten Wert übernommen']);
const labSource = field('readingSource', 'Herkunft des Messwerts', ['Point-of-Care-Gerät', 'Laborbefund', 'Geräteprotokoll']);
const oxygenSystems: readonly Preset[] = [
  'Nasenbrille', ['Maske', 'Sauerstoffmaske'], 'Venturi-Maske', 'Reservoirmaske', ['HFNC', 'High-Flow-Nasenkanüle (HFNC)'],
];
const oxygenSupport = field('oxygenSupport', 'Sauerstoffgabe / Atemunterstützung', [
  'Raumluft', ...oxygenSystems, 'Nichtinvasive Beatmung (NIV)', 'Invasive Beatmung',
]);
const periodOptions = [
  'Seit der letzten Erfassung', 'Seit Schichtbeginn', 'Frühdienst', 'Spätdienst', 'Nachtdienst',
  '1 Stunde', '2 Stunden', '4 Stunden', '6 Stunden', '8 Stunden', '12 Stunden', '24 Stunden',
];
const ventilatorMode = field('mode', 'Beatmungsmodus', [
  'VC', 'PCV', 'PSV', 'SIMV', 'CPAP', 'APRV',
]);
const ventilatorInterface = field('interface', 'Beatmungszugang', [
  'Endotrachealtubus', 'Trachealkanüle', 'Nasenmaske', 'Mund-Nasen-Maske', 'Beatmungshelm',
]);
const breathingMeasurements = [ventilatorMode, ventilatorInterface, readingSource];
const bloodGasSample = field('sample', 'Probenart', [
  ['arteriell', 'Arteriell'], ['venös', 'Venös'], ['kapillär', 'Kapillär'],
  'Peripher venös', 'Zentralvenös', 'Gemischtvenös',
]);
const bloodGasFields = [bloodGasSample, oxygenSupport, labSource];
const reactionOptions: readonly Preset[] = [
  ['prompt', 'Prompt'], ['träge', 'Träge'], ['keine', 'Keine Lichtreaktion'], 'Nicht beurteilbar',
];
const cardiacMethod = field('method', 'Messmethode', [
  'Thermodilution', 'Pulskonturanalyse', 'Echokardiografie', 'Fick-Methode', 'Übernommener Gerätewert',
]);
const computationSource = field('readingSource', 'Herkunft des Werts', ['Berechnet', 'Aus dem Befund übernommen', 'Am Gerät abgelesen']);

export const vitalContextFields: Record<VitalReadingType, readonly VitalContextField[]> = {
  blood_pressure: [
    bodyPosition,
    field('arm', 'Messarm', [['links', 'Links'], ['rechts', 'Rechts']]),
    field('site', 'Messstelle', ['Oberarm', 'Unterarm', 'Handgelenk']),
    field('cuff', 'Manschette', [['klein', 'Klein'], 'Standard', ['groß', 'Groß'], 'XL', 'Kindermanschette', 'Handgelenkmanschette']),
    field('method', 'Messmethode', ['Automatisch', 'Manuell mit Stethoskop', 'Manuell durch Tasten', 'Überwachungsmonitor']),
    situation,
  ],
  pulse: [
    field('rhythm', 'Pulsrhythmus', [['regelmäßig', 'Regelmäßig'], ['unregelmäßig', 'Unregelmäßig'], 'Einzelne Aussetzer', 'Nicht beurteilbar']),
    field('method', 'Messmethode', [['manuell', 'Manuell ertastet'], 'Monitor', 'Pulsoximeter', 'EKG', 'Blutdruckgerät']),
    field('site', 'Messstelle', ['Handgelenk', 'Oberarm', 'Hals', 'Fußrücken', 'Herzspitze']),
    bodySide, situation,
  ],
  respiratory_rate: [
    field('pattern', 'Atemmuster', [['regelmäßig', 'Regelmäßig'], 'Unregelmäßig', ['flach', 'Flach'], ['vertieft', 'Vertieft'], 'Mit Atempausen']),
    field('method', 'Messmethode', ['Manuell gezählt', 'Überwachungsmonitor', 'Kapnografie', 'Beatmungsgerät']),
    bodyPosition, oxygenSupport, situation,
  ],
  oxygen: [
    oxygenSupport, field('site', 'Sensorposition', ['Finger', 'Zehe', 'Ohrläppchen', 'Stirn']),
    field('perfusion', 'Signalqualität', [['gut', 'Stabil'], ['eingeschränkt', 'Eingeschränkt'], 'Wechselnd', 'Störanfällig bei Bewegung']),
    field('method', 'Messmethode', ['Pulsoximeter', 'Überwachungsmonitor']), bodySide, situation,
  ],
  temperature: [
    field('site', 'Messort', ['Ohr', 'Stirn', ['oral', 'Oral'], ['axillär', 'Axillär'], ['rektal', 'Rektal'], 'Haut', 'Körperkern']),
    field('method', 'Messmethode', ['Kontakt', ['kontaktlos', 'Kontaktlos'], 'Infrarot', 'Temperatursonde', 'Überwachungsmonitor']),
    bodySide, situation,
  ],
  weight: [
    field('clothing', 'Bekleidung', [['ohne Kleidung', 'Ohne Kleidung'], 'Unterwäsche', ['leicht bekleidet', 'Leicht bekleidet'], ['bekleidet', 'Bekleidet']]),
    field('scale', 'Waagentyp', ['Standwaage', 'Sitzwaage', 'Bettwaage', 'Rollstuhlwaage', 'Lifterwaage']),
    field('footwear', 'Schuhe', ['Ohne Schuhe', 'Mit Schuhen']),
    field('situation', 'Wiegezeitpunkt', ['Morgens', 'Mittags', 'Abends', 'Vor einer Mahlzeit', 'Nach einer Mahlzeit', 'Nach dem Toilettengang']),
  ],
  height: [field('method', 'Herkunft der Körpergröße', ['Stehend gemessen', 'Liegend gemessen', 'Angegeben', 'Aus dem Befund übernommen'])],
  bmi: [computationSource],
  body_surface_area: [computationSource],
  head_circumference: [field('method', 'Messmethode', ['Maßband', 'Aus dem Befund übernommen']), bodyPosition],
  blood_glucose: [
    field('mealContext', 'Mahlzeitenbezug', [
      ['nüchtern', 'Nüchtern'], ['präprandial', 'Vor einer Mahlzeit'], ['postprandial', 'Nach einer Mahlzeit'],
      'Vor dem Frühstück', 'Nach dem Frühstück', 'Vor dem Mittagessen', 'Nach dem Mittagessen',
      'Vor dem Abendessen', 'Nach dem Abendessen', 'Vor dem Schlafengehen', 'Ohne Mahlzeitenbezug',
    ]),
    field('sample', 'Probe / Sensor', [['kapillär', 'Kapillär'], ['venös', 'Venös'], 'Arteriell', ['Sensor', 'Gewebeglukose (CGM)']]),
    field('method', 'Messmethode', ['Blutzuckermessgerät', 'CGM-System', 'Laborbefund']), situation,
  ],
  blood_ketones: [field('sample', 'Probenart', ['Kapillär', 'Venös', 'Arteriell']), labSource, situation],
  pain_score: [
    field('location', 'Schmerzort', [
      'Kopf', 'Hals', 'Nacken', 'Brustkorb', 'Bauch', 'Rücken', 'Becken', 'Hüfte', 'Schulter', 'Arm',
      'Hand', 'Bein', 'Knie', 'Fuß', ['mehrere Regionen', 'Mehrere Regionen'],
    ]),
    bodySide, situation,
    field('character', 'Schmerzcharakter', ['Stechend', 'Brennend', 'Dumpf', 'Drückend', 'Ziehend', 'Krampfartig', 'Pulsierend']),
  ],
  capillary_refill: [field('site', 'Messstelle', ['Finger', 'Zehe', 'Sternum']), bodySide, situation],
  urine_output: [
    field('period', 'Erfassungszeitraum', periodOptions, true),
    field('route', 'Art der Erfassung', [['spontan', 'Spontan'], 'Dauerkatheter', 'Einmalkatheter', 'Urostoma', 'Nephrostomie']),
    field('method', 'Messmethode', ['Messbecher', 'Urinmesssystem', 'Wiegen', 'Übernommener Messwert']),
  ],
  fluid_balance: [
    field('period', 'Bilanzzeitraum', periodOptions, true),
    field('method', 'Erfassungsmethode', ['Gemessen', 'Gewogen', 'Gemessen und gewogen', 'Aus dem Protokoll übernommen']),
  ],
  gcs: [bodyPosition, field('assessmentContext', 'Beobachtungssituation', ['Bei Erstbeurteilung', 'Bei Verlaufskontrolle', 'Bei Übergabe'])],
  rass: [field('assessmentContext', 'Beobachtungssituation', ['In Ruhe', 'Während der Versorgung', 'Bei Verlaufskontrolle']), ventilatorInterface],
  pupils: [
    field('leftReaction', 'Lichtreaktion links', reactionOptions), field('rightReaction', 'Lichtreaktion rechts', reactionOptions),
    field('method', 'Messmethode', ['Pupillometer', 'Visuelle Prüfung']), bodyPosition,
  ],
  arterial_pressure: [
    field('site', 'Katheterlage', ['A. radialis', 'A. femoralis', 'A. brachialis', 'A. dorsalis pedis']),
    bodySide, bodyPosition,
  ],
  map: [field('method', 'Messmethode', ['Nichtinvasiv', 'Invasiv', 'Berechneten Wert übernommen']), bodyPosition],
  cvp: [
    field('reference', 'Referenz / Lage', ['Phlebostatische Achse', 'Rückenlage', 'Oberkörper erhöht']),
    field('method', 'Messmethode', ['Druckaufnehmer', 'Überwachungsmonitor', 'Übernommener Gerätewert']),
  ],
  cardiac_output: [cardiacMethod, bodyPosition],
  cardiac_index: [cardiacMethod, computationSource],
  svv: [readingSource, ventilatorMode],
  icp: [
    field('method', 'Messmethode', ['Intraventrikulär', 'Intraparenchymal', 'Übernommener Gerätewert']),
    bodyPosition,
  ],
  cpp: [computationSource, bodyPosition],
  etco2: [
    field('method', 'Messmethode', ['Hauptstrom', 'Nebenstrom']),
    ventilatorInterface, oxygenSupport,
  ],
  oxygen_flow: [field('device', 'Applikationssystem', oxygenSystems), situation],
  fio2: [oxygenSupport, ventilatorMode, readingSource],
  peep: breathingMeasurements,
  tidal_volume: [
    field('readingKind', 'Art des Gerätewerts', ['Inspiratorisch gemessen', 'Exspiratorisch gemessen']),
    ...breathingMeasurements,
  ],
  minute_ventilation: breathingMeasurements,
  peak_airway_pressure: breathingMeasurements,
  plateau_pressure: breathingMeasurements,
  ventilator_rate: [
    field('readingKind', 'Art der Frequenz', ['Gemessene Gesamtfrequenz', 'Gemessene Spontanfrequenz']),
    ...breathingMeasurements,
  ],
  ph: bloodGasFields,
  pco2: bloodGasFields,
  po2: bloodGasFields,
  bicarbonate: bloodGasFields,
  base_excess: bloodGasFields,
  lactate: bloodGasFields,
};
