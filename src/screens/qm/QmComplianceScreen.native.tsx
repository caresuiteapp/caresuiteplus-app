// Generated native presentation from src/screens/qm/QmComplianceScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from "./QmRegisterScreen.native.tsx";
import { QmComplianceScreen as DemoScreen } from './QmComplianceScreen.tsx';
export function QmComplianceScreen() {
    return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="compliance"/>;
}
