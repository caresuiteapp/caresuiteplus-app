import {
  ClientPortalOfficeConversationScreen,
  ClientPortalOfficeMessagesScreen,
  EmployeePortalOfficeConversationScreen,
  EmployeePortalOfficeMessagesScreen,
} from '@/screens/portal/portalofficemessagesscreens';

export function EmployeePortalMessagesScreen() {
  return <EmployeePortalOfficeMessagesScreen />;
}

export function ClientPortalMessagesScreen() {
  return <ClientPortalOfficeMessagesScreen />;
}

export function EmployeePortalConversationScreen() {
  return <EmployeePortalOfficeConversationScreen />;
}

export function ClientPortalConversationScreen() {
  return <ClientPortalOfficeConversationScreen />;
}

export { RelativePortalMessagesScreen } from './PortalMessagesScreens';
export { RelativePortalConversationScreen } from './PortalConversationScreens';
