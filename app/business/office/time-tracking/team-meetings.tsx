import { WfmPlaceholderTabScreen } from '@/components/wfm/WfmPlaceholderTabScreen';

export default function OfficeTimeTrackingTeamMeetingsRoute() {
  return (
    <WfmPlaceholderTabScreen
      title="Team-Meetings"
      subtitle="Besprechungen und Sollzeiten"
      message="Team-Meetings und Sollzeitbuchungen werden in Phase 2 als eigener WFM-Work-Type mit Kalenderbrücke ergänzt."
      phaseNote="Phase 2: meeting_work_sessions, Kalender-Sync"
    />
  );
}
