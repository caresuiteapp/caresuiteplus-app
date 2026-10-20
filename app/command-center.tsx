import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { WEB_DESKTOP_ROUTE } from '@/lib/navigation/businessHome';

export default function LegacyCommandCenterRoute() { return <Redirect href={(Platform.OS === 'web' ? WEB_DESKTOP_ROUTE : '/') as never} />; }
