import { getServiceMode } from '@/lib/services/mode';
import {
  ClientPortalOfficeConversationScreen,
  ClientPortalOfficeMessagesScreen,
  EmployeePortalOfficeConversationScreen,
  EmployeePortalOfficeMessagesScreen,
} from '@/screens/portal/portalofficemessagesscreens';
import {
  EmployeePortalMessagesScreen as LegacyEmployeePortalMessagesScreen,
  ClientPortalMessagesScreen as LegacyClientPortalMessagesScreen,
} from './PortalMessagesScreens';
import {
  ConversationScreen as LegacyEmployeePortalConversationScreen,
  ConversationScreen as LegacyClientPortalConversationScreen,
} from './ConversationScreen';

function useLivePortalMessaging(): boolean {
  return getServiceMode() === 'supabase';
}

export function EmployeePortalMessagesScreen() {
  if (useLivePortalMessaging()) {
    return <EmployeePortalOfficeMessagesScreen />;
  }
  return <LegacyEmployeePortalMessagesScreen />;
}

export function ClientPortalMessagesScreen() {
  if (useLivePortalMessaging()) {
    return <ClientPortalOfficeMessagesScreen />;
  }
  return <LegacyClientPortalMessagesScreen />;
}

export function EmployeePortalConversationScreen() {
  if (useLivePortalMessaging()) {
    return <EmployeePortalOfficeConversationScreen />;
  }
  return <LegacyEmployeePortalConversationScreen />;
}

export function ClientPortalConversationScreen() {
  if (useLivePortalMessaging()) {
    return <ClientPortalOfficeConversationScreen />;
  }
  return <LegacyClientPortalConversationScreen />;
}

export { RelativePortalMessagesScreen } from './PortalMessagesScreens';
export { RelativePortalConversationScreen } from './PortalConversationScreens';
