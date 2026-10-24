// Generated native presentation from src/screens/qm/QmAuditsScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from "./QmRegisterScreen.native.tsx";
import { QmAuditsScreen as DemoScreen } from './QmAuditsScreen.tsx';
export function QmAuditsScreen() {
    return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="audits"/>;
}
