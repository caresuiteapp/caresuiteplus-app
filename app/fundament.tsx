import { FundamentScreen } from '@/screens';
import { DevToolGate } from '@/components/auth/DevToolGate';

export default function FundamentRoute() {
  return (
    <DevToolGate>
      <FundamentScreen />
    </DevToolGate>
  );
}
