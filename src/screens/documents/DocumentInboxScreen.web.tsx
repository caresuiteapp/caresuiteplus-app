import { Redirect } from 'expo-router';

/** The former inbox used an in-memory demo store. Real uploads are reviewed in the document library. */
export function DocumentInboxScreen() {
  return <Redirect href="/business/office/documents" />;
}
