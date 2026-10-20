export const SIS_TOPIC_FIELDS = [
  'Kognitive und kommunikative Fähigkeiten',
  'Mobilität und Beweglichkeit',
  'Krankheitsbezogene Anforderungen und Belastungen',
  'Selbstversorgung',
  'Leben in sozialen Beziehungen',
  'Wohnen / Häuslichkeit',
] as const;

export type SisTopicKey = (typeof SIS_TOPIC_FIELDS)[number];

export type SisTopicEntry = {
  resources: string;
  problems: string;
  wishes: string;
  habits: string;
  observations: string;
  actionNeeded: string;
};

export type SisRiskLevel =
  | 'kein_risiko'
  | 'niedrig'
  | 'mittel'
  | 'hoch'
  | 'akut'
  | 'unbekannt';

export type SisRiskEntry = {
  id: string;
  riskType: string;
  level: SisRiskLevel;
  measureRef: string;
  notes: string;
};

export type SisFormDetail = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  assessorName: string;
  status: 'entwurf' | 'in_bearbeitung' | 'fertiggestellt' | 'freigegeben';
  topics: Record<SisTopicKey, SisTopicEntry>;
  risks: SisRiskEntry[];
  overallScore: number;
  assessedAt: string;
  nextReviewAt: string | null;
};
