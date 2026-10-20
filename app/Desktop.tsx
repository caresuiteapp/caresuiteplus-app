import { Redirect } from 'expo-router';

/** Expo requires a non-platform route; native keeps its existing business home. */
export default function DesktopRoute() { return <Redirect href="/business" />; }
