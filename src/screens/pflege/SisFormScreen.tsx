import { CareAssessmentWorkspaceScreen } from '@/screens/careAssessment';
export function SisFormScreen({ mode }: { mode: 'create' | 'edit' }) {
  return <CareAssessmentWorkspaceScreen subjectType="client" mode={mode === 'create' ? 'create' : 'workspace'} />;
}
