import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CsDocumentRequestDetailScreen } from "../../../../../src/screens/documents/CsDocumentRequestDetailScreen.native.tsx";
import { useAuth } from '@/lib/auth/context';
function EmployeeDocumentSignatureDetailRoute() {
    const { profile } = useAuth();
    return (<CsDocumentRequestDetailScreen mode="employee" signerRole="employee" signerNameDefault={profile?.displayName ?? undefined}/>);
}
export default withNativeWorkflowPage(EmployeeDocumentSignatureDetailRoute);
