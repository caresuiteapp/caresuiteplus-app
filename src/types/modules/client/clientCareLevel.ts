import type { TenantScopedEntity } from '../../core/base';

export type CareLevelGrade = 'kein' | 'pg1' | 'pg2' | 'pg3' | 'pg4' | 'pg5' | 'hospiz';

export const CARE_LEVEL_LABELS: Record<CareLevelGrade, string> = {
  kein: 'Kein Pflegegrad',
  pg1: 'Pflegegrad 1',
  pg2: 'Pflegegrad 2',
  pg3: 'Pflegegrad 3',
  pg4: 'Pflegegrad 4',
  pg5: 'Pflegegrad 5',
  hospiz: 'Hospiz',
};

export type ClientCareLevel = TenantScopedEntity & {
  clientId: string;
  grade: CareLevelGrade;
  validFrom: string;
  validUntil: string | null;
  careFundName: string;
  careFundMemberId: string | null;
  mdAssessmentDate: string | null;
  notes: string | null;
};
