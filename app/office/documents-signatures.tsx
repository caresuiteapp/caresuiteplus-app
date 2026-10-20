import { Redirect } from 'expo-router';

/** Legacy Office route — canonical Phase-2 hub lives under /business/office/documents/signatures. */
export default function OfficeDocumentsSignaturesRedirect() {
  return <Redirect href="/business/office/documents/signatures" />;
}
