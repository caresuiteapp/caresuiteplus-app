import { Redirect } from 'expo-router';

/** German alias → canonical live-tracking route (Durchführung tab). */
export default function AssistLiveStatusRedirect() {
  return <Redirect href="/assist/durchfuehrung" />;
}
