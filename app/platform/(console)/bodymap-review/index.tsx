import { Redirect } from 'expo-router';

// Former review URLs resolve safely after removal of the feature.
export default function RetiredReviewRoute() { return <Redirect href="/platform/dashboard" />; }
