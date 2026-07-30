import { Redirect } from 'expo-router';

/** Historischer Office-Link: Einsatzplanung liegt verbindlich in Assist. */
export default function OfficeKalenderRedirect() {
  return <Redirect href="/assist/kalender" />;
}
