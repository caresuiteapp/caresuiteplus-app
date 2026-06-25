import { Redirect } from 'expo-router';

/** Legacy route — weiterleiten zur neuen Einsatzplanung mit Katalog-Formular. */
export default function AssistEinsatzNewRedirect() {
  return <Redirect href="/assist/assignments" />;
}
