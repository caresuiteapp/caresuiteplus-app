import { useRouter } from 'expo-router';
import { EmployeePortalExecutionErrorBoundary } from '@/components/portal/EmployeePortalExecutionErrorBoundary';
import { EmployeePortalVisitExecutionScreen } from '@/product-workflows/screens/portal/EmployeePortalVisitExecutionScreen';

export default function EmployeePortalVisitExecuteRoute() {
  const router = useRouter();
  return (
    <EmployeePortalExecutionErrorBoundary
      onExit={() => router.replace('/portal/employee/assignments' as never)}
    >
      <EmployeePortalVisitExecutionScreen />
    </EmployeePortalExecutionErrorBoundary>
  );
}
