import { Redirect } from 'expo-router';

/** Legacy/alternate path — canonical settings live under business messages. */
export default function CommunicationSettingsRedirect() {
  return <Redirect href="/business/messages/settings" />;
}
