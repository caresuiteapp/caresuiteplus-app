import { CsDocumentRequestDetailScreen } from '@/screens/documents/CsDocumentRequestDetailScreen';
import { useAuth } from '@/lib/auth/context';

export default function EmployeeDocumentSignatureDetailRoute() {
  const { profile } = useAuth();
  return (
    <CsDocumentRequestDetailScreen
      mode="employee"
      signerRole="employee"
      signerNameDefault={profile?.displayName ?? undefined}
    />
  );
}
