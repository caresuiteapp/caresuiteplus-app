// The academy workspace is a Web-only release. Existing native portal stays unchanged.
import { Redirect } from 'expo-router';
export default function AcademyNativeRoute() { return <Redirect href="/portal/client" />; }
