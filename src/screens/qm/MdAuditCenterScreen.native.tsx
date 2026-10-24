// Generated native presentation from src/screens/qm/MdAuditCenterScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from "./QmRegisterScreen.native.tsx";
import { MdAuditCenterScreen as DemoScreen } from './MdAuditCenterScreen.tsx';
export function MdAuditCenterScreen() {
    return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="md"/>;
}
