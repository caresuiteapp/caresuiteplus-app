import { Redirect } from 'expo-router';

/** German alias → canonical trips route */
export default function AssistTourenRedirect() {
  return <Redirect href="/assist/fahrten" />;
}
