import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmployeePortalExecutionErrorBoundary } from '@/components/portal/EmployeePortalExecutionErrorBoundary';
import { EmployeePortalVisitExecutionScreen } from '@/screens/portal/EmployeePortalVisitExecutionScreen';

export default function EmployeePortalVisitExecuteRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const assignmentId = Array.isArray(id) ? id[0] : id;
  return (
    <EmployeePortalExecutionErrorBoundary
      key={assignmentId}
      assignmentId={assignmentId}
      onExit={() => router.replace('/portal/employee/assignments' as never)}
    >
      <EmployeePortalVisitExecutionScreen key={assignmentId} />
    </EmployeePortalExecutionErrorBoundary>
  );
}
