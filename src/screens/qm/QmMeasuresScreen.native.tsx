// Generated native presentation from src/screens/qm/QmMeasuresScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from "./QmRegisterScreen.native.tsx";
import { QmMeasuresScreen as DemoScreen } from './QmMeasuresScreen.tsx';
export function QmMeasuresScreen() {
    return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="measures"/>;
}
