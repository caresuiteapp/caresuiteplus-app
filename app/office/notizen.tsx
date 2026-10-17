import { Redirect } from 'expo-router';

/** The notes workspace is Web-only; native keeps its existing Office screen. */
export default function OfficeNotesRoute() {
  return <Redirect href="/office" />;
}
