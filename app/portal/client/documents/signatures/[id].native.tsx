import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CsDocumentRequestDetailScreen } from "../../../../../src/screens/documents/CsDocumentRequestDetailScreen.native.tsx";
import { useAuth } from '@/lib/auth/context';
function ClientDocumentSignatureDetailRoute() {
    const { profile } = useAuth();
    return (<CsDocumentRequestDetailScreen mode="client" signerRole="client" signerNameDefault={profile?.displayName ?? undefined}/>);
}
export default withNativeWorkflowPage(ClientDocumentSignatureDetailRoute);
