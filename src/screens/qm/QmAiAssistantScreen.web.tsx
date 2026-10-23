import { getServiceMode } from '@/lib/services/mode';
import { QmPreparedFeatureScreen } from './QmPreparedFeatureScreen.web';
import { QmAiAssistantScreen as DemoScreen } from './QmAiAssistantScreen.tsx';

export function QmAiAssistantScreen() {
  return getServiceMode() === 'demo' ? <DemoScreen /> : <QmPreparedFeatureScreen feature="ai" />;
}
