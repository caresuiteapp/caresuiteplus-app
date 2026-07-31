import { Redirect } from 'expo-router';

export default function AssignmentCreateRedirect() {
  return <Redirect href="/assist/assignments?create=1" />;
}
