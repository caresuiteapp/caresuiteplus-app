import { PortalSignatureDetailScreen } from '@/product-workflows/screens/portal/PortalSignatureDetailScreen';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function EmployeeSignatureDetailRoute() {
  return <PortalTabScreen title="Unterschrift" scroll={false}>
    <PortalSignatureDetailScreen />
  </PortalTabScreen>;
}
