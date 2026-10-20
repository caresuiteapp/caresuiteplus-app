import { PortalEmptyState } from '@/product-workflows/components/portal/PortalEmptyState';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';
import { useRouter } from 'expo-router';
import { PremiumButton } from '@/components/ui';

export default function EmployeePortalHelpRoute() {
  const router = useRouter();
  return (
    <PortalTabScreen title="Hilfe">
      <PortalEmptyState
        icon="❓"
        title="Einsatzhilfe & Support"
        message="Bei technischen Problemen oder Einsatzfragen wenden Sie sich an Ihr Pflegebüro."
      />
      <PremiumButton title="Verwaltung kontaktieren"
        onPress={() => router.push('/portal/employee/messages?compose=1' as never)} />
    </PortalTabScreen>
  );
}
