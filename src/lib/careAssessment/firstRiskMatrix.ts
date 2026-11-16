import {
  CARE_ASSESSMENT_TOPIC_KEYS,
  type CareRiskMatrix,
  type RiskMatrixRisk,
  type RiskMatrixTopic,
} from '../../types/modules/careAssessment.ts';

export const riskMatrixTopics = CARE_ASSESSMENT_TOPIC_KEYS.filter(
  (key): key is RiskMatrixTopic => key !== 'living_environment',
);

export const riskMatrixRisks = [
  { key: 'pressure_injury', label: 'Dekubitus' },
  { key: 'fall', label: 'Sturz' },
  { key: 'continence', label: 'Inkontinenz' },
  { key: 'pain', label: 'Schmerz' },
  { key: 'nutrition', label: 'Ernährung' },
  { key: 'other', label: 'Sonstiges' },
] as const satisfies ReadonlyArray<{ key: RiskMatrixRisk; label: string }>;

const cellKeys = riskMatrixTopics.flatMap(topic => riskMatrixRisks.map(risk => `${topic}:${risk.key}`));
const otherLabelLimit = 160;
export const emptyRiskMatrix: CareRiskMatrix = { otherLabel: '', cells: {}, counseling: {} };
export const riskMatrixCellCount = cellKeys.length;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isCareRiskMatrix(value: unknown): value is CareRiskMatrix {
  if (!isObject(value) || Object.keys(value).length !== 3 ||
      typeof value.otherLabel !== 'string' || [...value.otherLabel].length > otherLabelLimit ||
      !isObject(value.cells) || !isObject(value.counseling)) return false;
  return Object.entries(value.cells).every(([key, cell]) =>
    cellKeys.includes(key as (typeof cellKeys)[number]) && isObject(cell) &&
    Object.keys(cell).length === 2 && typeof cell.present === 'boolean' &&
    (cell.furtherAssessment === null || (cell.present && typeof cell.furtherAssessment === 'boolean')),
  ) && Object.entries(value.counseling).every(([key, choice]) =>
    riskMatrixTopics.includes(key as RiskMatrixTopic) && typeof choice === 'boolean',
  );
}

export function readCareRiskMatrix(value: unknown): CareRiskMatrix | null | undefined {
  if (value === undefined || value === null) return value;
  if (!isCareRiskMatrix(value)) throw Error('Die gespeicherte Risikomatrix ist unvollständig oder ungültig.');
  return value;
}

export function riskMatrixProgress(matrix: CareRiskMatrix) {
  const cells = Object.values(matrix.cells);
  return {
    assessed: cells.length,
    openFurtherAssessments: cells.filter(cell => cell.present && cell.furtherAssessment === null).length,
    needsOtherLabel: !matrix.otherLabel.trim() && riskMatrixTopics.some(topic => matrix.cells[`${topic}:other`]?.present),
  };
}
