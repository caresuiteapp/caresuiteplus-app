import { Redirect } from 'expo-router';

/** Legacy route — weiterleiten zur Einsatzplanung und Create-Formular öffnen. */
export default function AssistEinsatzNewRedirect() {
  return <Redirect href="/assist/assignments?create=1" />;
}
