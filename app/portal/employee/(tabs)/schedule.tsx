import { Redirect } from 'expo-router';

/** Legacy route — Dienstplan wurde durch Kalender ersetzt. */
export default function EmployeeScheduleRedirectRoute() {
  return <Redirect href="/portal/employee/calendar" />;
}
