import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CsDocumentRequestDetailScreen } from "../../../../../src/screens/documents/CsDocumentRequestDetailScreen.native.tsx";
function OfficeDocumentSignatureDetailRoute() {
    return <CsDocumentRequestDetailScreen mode="office" signerRole="office"/>;
}
export default withNativeWorkflowPage(OfficeDocumentSignatureDetailRoute);
