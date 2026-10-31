// Generated native presentation from src/screens/qm/QmSettingsScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { getServiceMode } from '@/lib/services/mode';
import { QmPreparedFeatureScreen } from "./QmPreparedFeatureScreen.native.tsx";
import { QmSettingsScreen as DemoScreen } from './QmSettingsScreen.tsx';
export function QmSettingsScreen() {
    return getServiceMode() === 'demo' ? <DemoScreen /> : <QmPreparedFeatureScreen feature="settings"/>;
}
