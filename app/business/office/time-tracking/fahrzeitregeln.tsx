import { WfmPlaceholderTabScreen } from '@/components/wfm/WfmPlaceholderTabScreen';

export default function OfficeTimeTrackingFahrzeitregelnRoute() {
  return (
    <WfmPlaceholderTabScreen
      title="Fahrzeitregeln"
      subtitle="Fahrzeit- und Wegezeitlogik"
      message="Die Konfiguration von Fahrzeitregeln und Wegezeiten wird in Phase 2 mit persistentem Schema und Assist-Anbindung ergänzt."
      phaseNote="Phase 2: workforce_travel_rules, Assist-Routenplanung"
    />
  );
}
