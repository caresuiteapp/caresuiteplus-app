import type { TenantScopedEntity } from '../../core/base';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';

export type CareLevelGrade = 'kein' | 'pg1' | 'pg2' | 'pg3' | 'pg4' | 'pg5' | 'hospiz';

export const CARE_LEVEL_LABELS: Record<CareLevelGrade, string> = {
  kein: 'Kein Pflegegrad',
  pg1: formatCareLevel('pg1'),
  pg2: formatCareLevel('pg2'),
  pg3: formatCareLevel('pg3'),
  pg4: formatCareLevel('pg4'),
  pg5: formatCareLevel('pg5'),
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
