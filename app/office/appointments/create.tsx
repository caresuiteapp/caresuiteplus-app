import { Redirect } from 'expo-router';

/** Legacy route — redirects to appointments list with create modal. */
export default function AppointmentCreateRedirect() {
  return <Redirect href="/office/appointments?create=1" />;
}
