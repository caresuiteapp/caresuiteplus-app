// Generated native presentation from src/screens/qm/QmChangesScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from "./QmRegisterScreen.native.tsx";
import { QmChangesScreen as DemoScreen } from './QmChangesScreen.tsx';
export function QmChangesScreen() {
    return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="changes"/>;
}
