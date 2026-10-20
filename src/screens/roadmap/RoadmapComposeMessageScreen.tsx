import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP593 */
export function RoadmapComposeMessageScreen() {
  return <MessageComposeScreenShell wpNumber={593} domain="roadmap" permission="roadmap.manage" audienceScope="office" />;
}
