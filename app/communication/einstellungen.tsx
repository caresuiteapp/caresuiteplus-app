import { Redirect } from 'expo-router';

/** German alias for communication settings. */
export default function CommunicationEinstellungenRedirect() {
  return <Redirect href="/business/messages/settings" />;
}
