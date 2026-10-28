// Generated native presentation from src/screens/qm/QmLegalReferencesScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from "./QmRegisterScreen.native.tsx";
import { QmLegalReferencesScreen as DemoScreen } from './QmLegalReferencesScreen.tsx';
export function QmLegalReferencesScreen() {
    return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="legal"/>;
}
