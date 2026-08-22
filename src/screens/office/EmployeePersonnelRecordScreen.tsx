import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmployeePersonnelFilePanel } from '@/components/office/EmployeePersonnelFilePanel';
import { PremiumButton } from '@/components/ui';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';

export function EmployeePersonnelRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id) {
    return (
      <ScreenShell title="Personalakte" subtitle="Nicht gefunden">
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Personalakte"
      subtitle="Mitarbeitende · Office"
      rightSlot={
        <PremiumButton title="Zur Liste" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <SurfaceContrastProvider tone="light">
        <EmployeePersonnelFilePanel employeeId={id} />
      </SurfaceContrastProvider>
    </ScreenShell>
  );
}
