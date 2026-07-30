import { Redirect } from 'expo-router';

/** Historischer Office-Link: Einsatzplanung liegt verbindlich in Assist. */
export default function OfficeCalendarRedirect() {
  return <Redirect href="/assist/kalender" />;
}
