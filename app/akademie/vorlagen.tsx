import { Redirect } from 'expo-router';

/** The authoring library is a Web workspace; native keeps its existing course entry. */
export default function AcademyTemplatesFallback() {
  return <Redirect href="/akademie/kurse" />;
}
