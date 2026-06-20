import { useRouter } from 'expo-router';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { useModalStack } from '@/hooks/useModalStack';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';

/** Opens client record in modal stack on web/desktop; falls back to route navigation on mobile. */
export function useOpenClientRecordModal() {
  const router = useRouter();
  const { adaptiveShell } = usePlatformLayout();
  const { pushModal } = useModalStack();

  return (clientId: string) => {
    if (adaptiveShell === 'web' || adaptiveShell === 'desktop') {
      pushModal({
        modalKey: 'prep.client.record',
        title: 'Klient:in',
        payload: { clientId },
      });
      return;
    }
    router.push(clientRecordRoute(clientId) as never);
  };
}

/** Opens employee record in modal stack on web/desktop; falls back to route navigation on mobile. */
export function useOpenEmployeeRecordModal() {
  const router = useRouter();
  const { adaptiveShell } = usePlatformLayout();
  const { pushModal } = useModalStack();

  return (employeeId: string) => {
    if (adaptiveShell === 'web' || adaptiveShell === 'desktop') {
      pushModal({
        modalKey: 'prep.employee.record',
        title: 'Mitarbeiter:in',
        payload: { employeeId },
      });
      return;
    }
    router.push(`/office/employees/${employeeId}` as never);
  };
}
