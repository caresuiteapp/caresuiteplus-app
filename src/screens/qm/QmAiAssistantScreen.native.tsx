// Generated native presentation from src/screens/qm/QmAiAssistantScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { getServiceMode } from '@/lib/services/mode';
import { QmPreparedFeatureScreen } from "./QmPreparedFeatureScreen.native.tsx";
import { QmAiAssistantScreen as DemoScreen } from './QmAiAssistantScreen.tsx';
export function QmAiAssistantScreen() {
    return getServiceMode() === 'demo' ? <DemoScreen /> : <QmPreparedFeatureScreen feature="ai"/>;
}
