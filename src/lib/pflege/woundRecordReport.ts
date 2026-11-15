import { Platform } from 'react-native';
import { CARESUITE_PDF_FONT, registerCareSuitePdfFont } from '@/lib/documents/centuryGothicPdf';
import type { AmbulatoryWound } from './ambulatoryWoundService';
import type { WoundCareContext } from './woundCareService';
import {
  CLINICAL_FIELDS, COMPLICATING_FACTORS, ENTRY_LABELS, formatWoundDate, formatWoundNumber, materialCost, object,
  RISK_SCALES, scorePressureRisk, woundBmi, type RecordPayload, type RiskScale, type WoundEntry, type WoundMedia,
} from './woundRecordDomain';
import { TISSUE_LABELS } from './woundPlanimetry';

export const FOOT_SIDE_LABELS = { left: 'Links', right: 'Rechts', both: 'Beide Füße' };
export const TRACHEOSTOMY_LABELS = { admission: 'Aufnahme', follow_up: 'Verlauf', training: 'Schulung und Einweisung' };
export const MATERIAL_LABELS = { used: 'Verbrauch', delivered: 'Lieferung', proposed: 'Rezeptvorschlag' };

export const ASSESSMENT_FIELDS = [
  ['length_cm', 'Länge (cm)'], ['width_cm', 'Breite (cm)'], ['depth_cm', 'Tiefe (cm)'],
  ['wound_bed', 'Wundbett'], ['exudate', 'Exsudat'], ['odor', 'Geruch'], ['wound_edge', 'Wundrand'],
  ['surrounding_skin', 'Wundumgebung'], ['pain_score', 'Erfasster Schmerzwert'], ['infection_signs', 'Infektionsbeobachtung'],
  ['intervention', 'Erfasste Intervention'], ['response', 'Beobachtete Reaktion'],
] as const;

export type WoundDisplayLine = [label: string, value: string];
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? formatWoundDate(value) : 'Zeitpunkt nicht dokumentiert';
const getText = (value: unknown) => typeof value === 'string' ? value : typeof value === 'number' ? formatWoundNumber(value, 3) : '';
const labeled = (source: RecordPayload, fields: readonly (readonly [string, string])[]): WoundDisplayLine[] =>
  fields.flatMap(([field, label]) => {
    const value = getText(source[field]).trim();
    return value ? [[label, value]] : [];
  });
const used = (items: WoundEntry[]) => items.filter(entry => entry.kind === 'material' && entry.payload.mode === 'used');
export const euro = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export function describeWoundEntry(entry: WoundEntry): WoundDisplayLine[] {
  const d = entry.payload;
  switch (entry.kind) {
    case 'measurement': {
      const trace = object(d.trace);
      if (!trace) return [];
      return [...labeled(trace, [['areaCm2', 'Fläche (cm²)'], ['lengthCm', 'Länge (cm)'], ['widthCm', 'Breite (cm)']]),
        ...labeled(object(trace.shares) ?? {}, Object.entries(TISSUE_LABELS).map(([key, label]) => [key, label + ' (%)']))];
    }
    case 'risk': {
      const scale = d.scale as RiskScale;
      const score = scorePressureRisk(scale, d.scores);
      const domains = RISK_SCALES[scale]?.domains ?? [];
      return [...(score == null ? [] : [[RISK_SCALES[scale].label, String(score) + ' Punkte'] as WoundDisplayLine]),
        ...domains.flatMap(([label], i): WoundDisplayLine[] => Array.isArray(d.scores) ? [[label, getText(d.scores[i])]] : []),
        ...labeled(d, [['assessment', 'Fachliche Beurteilung'], ['plan', 'Prophylaxe und Kontrolle']])];
    }
    case 'anamnesis': {
      const bmi = woundBmi(d.heightCm, d.weightKg);
      return [...labeled(d, [...CLINICAL_FIELDS.anamnesis, ['heightCm', 'Körpergröße (cm)'], ['weightKg', 'Gewicht (kg)'], ['vas', 'VAS (mm)']]),
        ...(bmi == null ? [] : [['BMI (kg/m²)', formatWoundNumber(bmi, 1)] as WoundDisplayLine]),
        ...(Array.isArray(d.factors) && d.factors.length ? [['Einflussfaktoren',
          d.factors.map(key => COMPLICATING_FACTORS[key as keyof typeof COMPLICATING_FACTORS]).filter(Boolean).join(', ')] as WoundDisplayLine] : [])];
    }
    case 'diabetic_foot': return [['Untersuchte Seite', FOOT_SIDE_LABELS[d.side as keyof typeof FOOT_SIDE_LABELS] ?? '—'],
      ...labeled(d, CLINICAL_FIELDS.diabetic_foot)];
    case 'tracheostomy': return [['Protokollart', TRACHEOSTOMY_LABELS[d.mode as keyof typeof TRACHEOSTOMY_LABELS] ?? '—'],
      ...labeled(d, CLINICAL_FIELDS.tracheostomy)];
    case 'material': {
      const cost = materialCost(d);
      return [['Vorgang', MATERIAL_LABELS[d.mode as keyof typeof MATERIAL_LABELS] ?? '—'],
        ...labeled(d, [['name', 'Artikel'], ['supplier', 'Lieferant / Hersteller'], ['code', 'PZN / Artikelnummer'],
          ['quantity', 'Menge'], ['unit', 'Einheit'], ['reference', 'Belegbezug']]),
        ...(cost === null ? [] : [['Betrag', euro(cost)] as WoundDisplayLine])];
    }
    case 'note': return labeled(d, [['description', 'Wundbeschreibung'], ['treatment', 'Wundbehandlung']]);
    case 'body_mark': return labeled(d, [['name', 'Lokalisation'], ['kind', 'Kategorie'], ['text', 'Beobachtung']]);
  }
}

type Point = { at: string; value: number; id: string };
export type WoundSeries = { key: string; title: string; unit: string; points: Point[] };
export function woundRecordSeries(entries: WoundEntry[], assessments: RecordPayload[]): WoundSeries[] {
  const list: WoundSeries[] = [
    { key: 'area', title: 'Wundfläche', unit: 'cm²', points: [] },
    { key: 'length', title: 'Länge aus Fotovermessung', unit: 'cm', points: [] },
    { key: 'width', title: 'Breite aus Fotovermessung', unit: 'cm', points: [] },
    ...Object.entries(TISSUE_LABELS).map(([key, title]) => ({ key, title, unit: '%', points: [] })),
    { key: 'lengthManual', title: 'Länge aus Wundbefund', unit: 'cm', points: [] },
    { key: 'widthManual', title: 'Breite aus Wundbefund', unit: 'cm', points: [] },
    { key: 'depth', title: 'Tiefe aus Wundbefund', unit: 'cm', points: [] },
    { key: 'norton', title: 'Norton', unit: 'Punkte', points: [] },
    { key: 'braden', title: 'Braden', unit: 'Punkte', points: [] },
    ...Object.entries(RISK_SCALES).flatMap(([key, scale]) => scale.domains.map(([domain], index) =>
      ({ key: key + ':' + index, title: scale.label + ' · ' + domain, unit: 'Punkte', points: [] }))),

    { key: 'vas', title: 'Schmerz (VAS 0–100)', unit: 'mm', points: [] },
    { key: 'nrs', title: 'Schmerz (NRS 0–10)', unit: 'Punkte', points: [] },
    { key: 'bmi', title: 'BMI', unit: 'kg/m²', points: [] },
    { key: 'cost', title: 'Kosten des dokumentierten Materialverbrauchs', unit: '€', points: [] },
  ];
  const byKey = new Map(list.map(series => [series.key, series.points]));
  const add = (key: string, value: unknown, at: unknown, id: string) => {
    if (typeof value === 'number' && Number.isFinite(value) && typeof at === 'string' && Number.isFinite(Date.parse(at))) {
      byKey.get(key)?.push({ at, value, id });
    }
  };
  for (const e of entries) {
    const d = e.payload, at = e.observed_at;
    if (e.kind === 'measurement') {
      const trace = object(d.trace);
      if (!trace) continue;
      add('area', trace.areaCm2, at, e.id); add('length', trace.lengthCm, at, e.id); add('width', trace.widthCm, at, e.id);
      for (const [key, value] of Object.entries(object(trace.shares) ?? {})) add(key, value, at, e.id);
    } else if (e.kind === 'risk') {
      const score = scorePressureRisk(d.scale as RiskScale, d.scores);
      add(String(d.scale), score, at, e.id);
      if (score !== null && Array.isArray(d.scores)) {
        d.scores.forEach((value, index) => add(String(d.scale) + ':' + index, value, at, e.id));
      }
    } else if (e.kind === 'anamnesis') {
      add('vas', d.vas, at, e.id);
      add('bmi', woundBmi(d.heightCm, d.weightKg), at, e.id);
    } else if (e.kind === 'material' && d.mode === 'used') {
      const cents = materialCost(d);
      if (cents !== null) add('cost', cents / 100, at, e.id);
    }
  }
  for (const a of assessments) {
    const id = String(a.id);
    add('lengthManual', a.length_cm, a.observed_at, id); add('widthManual', a.width_cm, a.observed_at, id); add('depth', a.depth_cm, a.observed_at, id);
    if (object(a.documentation_details)?.painState === 'NRS') add('nrs', a.pain_score, a.observed_at, id);
  }
  return list.filter(series => series.points.length).map(series => ({ ...series,
    points: series.points.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id)) }));
}

export type WoundReportMode = 'timeline' | 'assessment' | 'entry' | 'prescription' | 'delivery';
type ReportArgs = {
  wound: AmbulatoryWound & { corrections: RecordPayload[] };
  entries: WoundEntry[];
  media?: WoundMedia[];
  care?: Pick<WoundCareContext, 'plans' | 'dressings'>;
  treatmentCorrections?: RecordPayload[];
  mode: WoundReportMode;
  selected?: string;
};
const TITLES: Record<WoundReportMode, string> = {
  timeline: 'Wundakte · Verlauf', assessment: 'Wundbefund · Einzelansicht', entry: 'Wundakte · Einzeleintrag',
  prescription: 'Rezeptvorschlag zur ärztlichen Prüfung', delivery: 'Lieferschein · dokumentierte Lieferung',
};

export async function generateWoundReport({ wound, entries, media = [], care, treatmentCorrections, mode, selected }: ReportArgs) {
  const jsPdfModule = await import('jspdf/dist/jspdf.es.min.js');
  const { jsPDF } = jsPdfModule as unknown as typeof import('jspdf');
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
  registerCareSuitePdfFont(pdf);
  pdf.setFont(CARESUITE_PDF_FONT, 'normal');
  let y = 22;
  function space(height: number) { if (y + height > 270) { pdf.addPage(); y = 22; } }
  function text(value: string, role: 'heading' | 'body' | 'small' = 'body') {
    if (!value) return;
    const large = role === 'heading';
    pdf.setFontSize(large ? 14 : role === 'small' ? 9 : 10); pdf.setTextColor(large ? '#124a70' : '#1e3447');
    const rows = pdf.splitTextToSize(value, 170) as string[];
    for (const row of rows) {
      space(large ? 8 : 5);
      pdf.text(row, 20, y); y += large ? 7.2 : 5;
    }
  }
  function fields(rows: WoundDisplayLine[]) { for (const [label, value] of rows) text(label + '  ·  ' + value); }
  function section(title: string) { space(24); y += 4; text(title, 'heading'); }
  text('CareSuite HealthOS · Pflege', 'small');
  text(TITLES[mode], 'heading');
  fields([['Klient:in', wound.clientName], ['Wunde', getText(wound.row.body_location)],
    ['Fallnummer', String(wound.row.id)], ['Ausgabe', formatWoundDate(new Date().toISOString())]]);

  if (mode === 'prescription' || mode === 'delivery') {
    const record = entries.find(e => e.id === selected && e.kind === 'material' &&
      e.payload.mode === (mode === 'delivery' ? 'delivered' : 'proposed'));
    if (!record) throw Error('Bitte den jeweiligen Materialvorgang auswählen.');
    text(mode === 'prescription' ? 'Entwurf zur ärztlichen Prüfung. Eine ärztliche Verordnung wird hier nicht ausgestellt.' :
      'Ausgabe der dokumentierten Lieferung mit ihrem Belegbezug.');
    section('Artikel und Menge');
    fields(describeWoundEntry(record)); fields([['Datum', date(record.observed_at)], ['Erfasst durch', record.recorded_by_name]]);
  } else {
    if (mode === 'timeline') {
      section('Aufnahme des Wundfalls');
      fields(labeled(wound.row, [['wound_type', 'Wundart'], ['etiology', 'Ursache'], ['onset_date', 'Entstehung'], ['acquired_where', 'Umstände'], ['treatment_plan', 'Planangabe']]));
      fields(labeled(object(wound.row.documentation_details) ?? {}, [['description', 'Aufnahmezustand'], ['basisReference', 'Anordnungsbezug']]));
      for (const e of wound.lifecycle.slice().reverse()) {
        section(e.action === 'reopen' ? 'Fall wieder geöffnet' : 'Fallabschluss');
        text(date(e.occurred_at) + ' · ' + getText(e.recorded_by_name), 'small');
        fields(labeled(e, [['reason', 'Grund'], ['decision_basis', 'Beurteilung'], ['handover', 'Übergabe']]));
      }
    }
    const originalAssessments = mode === 'timeline' ? wound.assessments :
      mode === 'assessment' ? wound.assessments.filter(a => a.id === selected) : [];
    for (const assess of originalAssessments.slice().reverse()) {
      section('Wundbefund · ' + date(assess.observed_at));
      text('Original erfasst am ' + date(assess.created_at) + ' · ' + getText(assess.recorded_by_name), 'small');
      fields(labeled(assess, ASSESSMENT_FIELDS));
      fields(labeled(object(assess.documentation_details) ?? {}, [['measurementMethod', 'Messmethode'],
        ['lengthReason', 'Hinweis zur Länge'], ['widthReason', 'Hinweis zur Breite'], ['depthReason', 'Hinweis zur Tiefe'],
        ['painReason', 'Hinweis zur Schmerzerhebung'], ['personalImpact', 'Persönliche Auswirkungen'],
        ['preferences', 'Wünsche'], ['selfManagement', 'Unterstützungsbedarf']]));
      for (const correction of wound.corrections.filter(c => c.assessment_id === assess.id)) {
        text('Berichtigung · ' + date(correction.created_at), 'small');
        fields(labeled(correction, [['corrected_statement', 'Berichtigte Aussage'], ['reason', 'Begründung'],
          ['evidence_basis', 'Erkenntnisgrundlage'], ['clinical_impact', 'Auswirkungen'], ['communication', 'Rücksprache'],
          ['person_decision', 'Personenbezug'], ['recorded_by_name', 'Erfasst durch']]));
      }
    }
    const selectedEntries = mode === 'timeline' ? entries : mode === 'entry' ? entries.filter(e => e.id === selected)
      : entries.filter(e => e.kind === 'measurement' && e.payload.assessmentId === selected);
    for (const e of selectedEntries.slice().sort((a,b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))) {
      section(ENTRY_LABELS[e.kind] + ' · ' + date(e.observed_at));
      text(e.recorded_by_name, 'small'); fields(describeWoundEntry(e));
    }
    const linkedFiles = mode === 'timeline' ? media :
      mode === 'assessment' ? media.filter(file => file.assessment_id === selected) :
        media.filter(file => selectedEntries.some(entry => entry.payload.photoId === file.id));
    if (linkedFiles.length) {
      section('Zugeordnete Dateien');
      for (const file of linkedFiles) text(file.file_name + ' · ' + date(file.observed_at));
    }
    if (mode === 'timeline') {
      for (const plan of care?.plans.slice().reverse() ?? []) {
        section('Versorgungsplan · Fassung ' + getText(plan.version));
        text(date(plan.effective_from), 'small');
        fields(labeled(object(plan.details) ?? {}, [['goal', 'Ziel'], ['plannedCare', 'Versorgung'], ['plannedMaterials', 'Material'],
          ['frequency', 'Wechselintervall'], ['hygienePlan', 'Hygiene'], ['painPlan', 'Schmerzmanagement']]));
      }
      for (const dressing of care?.dressings.slice().reverse() ?? []) {
        section('Versorgungsereignis · ' + date(dressing.occurred_at));
        fields(labeled(object(dressing.details) ?? {}, [['actualCleaning', 'Reinigung'],
          ['actualTechnique', 'Verbandtechnik'], ['hygiene', 'Hygiene'], ['response', 'Verträglichkeit'], ['deviation', 'Abweichung']]));
        for (const correction of treatmentCorrections?.filter(item => item.dressing_id === dressing.id) ?? []) {
          text('Berichtigung · ' + date(correction.created_at), 'small'); fields(labeled(correction, [['reason', 'Begründung']]));
        }
      }
      section('Materialkosten');
      const consumptions = used(entries);
      const documented = consumptions.flatMap(e => { const cents = materialCost(e.payload); return cents === null ? [] : [cents]; });
      fields([['Erfasste Kosten', documented.length ? euro(documented.reduce((a,b) => a + b,0)) : 'Kein Einheitspreis erfasst'],
        ['Verbrauchseinträge ohne Preis', String(consumptions.length - documented.length)]]);
      for (const series of woundRecordSeries(entries, wound.assessments)) {
        space(66); section(series.title + ' (' + series.unit + ')');
        const points = series.points.slice(-35), base = y + 40;
        const high = Math.max(1, ...points.map(p => p.value));
        const span = 158 / Math.max(1, points.length);
        pdf.setDrawColor('#a3b5c5');
        pdf.line(22, base, 22 + span * points.length, base);
        pdf.setFillColor('#337aa8');
        for (const [i, point] of points.entries()) {
          const h = 34 * point.value / high;
          pdf.rect(22 + i * span + 1, base - h, Math.max(1, span - 2), Math.max(.3,h), 'F');
        }
        y = base + 7;
        text(formatWoundNumber(high) + ' ' + series.unit + ' · ' + points.length + ' dargestellte Messwerte', 'small');
        text(date(points[0].at) + ' bis ' + date(points.at(-1)?.at), 'small');
      }
    }
  }

  const fileName = 'CareSuite_Wundakte_' + mode + '_' + String(wound.row.id) + '.pdf';
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    pdf.setPage(page); pdf.setFontSize(9); pdf.setTextColor('#556d82');
    pdf.text('CareSuite HealthOS · Wundakte', 20, 283);
    pdf.text(String(page) + ' / ' + total, 190, 283, { align: 'right' });
  }
  return { fileName, bytes: pdf.output('arraybuffer'), base64: pdf.output('datauristring').split(',')[1] };
}

export async function downloadWoundReport(args: ReportArgs, isCurrent: () => boolean) {
  const payload = await generateWoundReport(args);
  if (!isCurrent()) return;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([payload.bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = payload.fileName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const [files, sharing] = await Promise.all([import('expo-file-system/legacy'), import('expo-sharing')]);
    if (!files.cacheDirectory || !await sharing.isAvailableAsync()) throw Error('PDF-Weitergabe ist auf diesem Gerät nicht verfügbar.');
    const path = files.cacheDirectory + payload.fileName;
    try {
      await files.writeAsStringAsync(path, payload.base64, { encoding: files.EncodingType.Base64 });
      if (isCurrent()) await sharing.shareAsync(path, { mimeType: 'application/pdf', dialogTitle: TITLES[args.mode] });
    } finally { await files.deleteAsync(path, { idempotent: true }); }
  }
}
