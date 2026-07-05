import { CsDocumentRequestDetailScreen } from '@/screens/documents/CsDocumentRequestDetailScreen';
import { useAuth } from '@/lib/auth/context';

export default function ClientDocumentSignatureDetailRoute() {
  const { profile } = useAuth();
  return (
    <CsDocumentRequestDetailScreen
      mode="client"
      signerRole="client"
      signerNameDefault={profile?.displayName}
    />
  );
}
