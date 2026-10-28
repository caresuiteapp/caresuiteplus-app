// Generated native presentation from src/screens/qm/QmExportCenterScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { getServiceMode } from '@/lib/services/mode';
import { QmPreparedFeatureScreen } from "./QmPreparedFeatureScreen.native.tsx";
import { QmExportCenterScreen as DemoScreen } from './QmExportCenterScreen.tsx';
export function QmExportCenterScreen() {
    return getServiceMode() === 'demo' ? <DemoScreen /> : <QmPreparedFeatureScreen feature="export"/>;
}
