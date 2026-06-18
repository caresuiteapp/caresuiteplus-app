import { Redirect, type Href } from 'expo-router';

/** Zentrale alias — maps to business hub without breaking existing /business routes. */
export default function ZentraleIndexRoute() {
  return <Redirect href={'/business' as Href} />;
}
