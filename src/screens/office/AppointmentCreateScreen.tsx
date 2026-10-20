import { Redirect } from 'expo-router';

/** Legacy screen — redirects to unified modal flow on appointments list. */
export function AppointmentCreateScreen() {
  return <Redirect href="/office/appointments?create=1" />;
}
