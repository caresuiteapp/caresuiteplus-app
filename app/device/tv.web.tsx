import { useRouter } from 'expo-router';
import { TvDeviceLogin } from '@/components/auth/TvDeviceLogin.web';

/** Outside the automatic home redirect so session installation can finish atomically. */
export default function TvLoginRoute() {
  const router = useRouter();
  return <TvDeviceLogin onExit={() => router.replace('/' as never)} />;
}
