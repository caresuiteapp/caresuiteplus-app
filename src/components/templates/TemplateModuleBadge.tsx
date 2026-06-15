import { PremiumBadge } from '@/components/ui';
import type { TemplateModuleKey } from '@/types/templates';

const MODULE_LABELS: Record<TemplateModuleKey, string> = {
  core: 'Core',
  office: 'Office',
  assist: 'Assist',
  pflege: 'Pflege',
  stationaer: 'Stationär',
  beratung: 'Beratung',
  akademie: 'Akademie',
  communication: 'Kommunikation',
  billing: 'Abrechnung',
  documents: 'Dokumente',
  ti: 'TI',
};

const MODULE_VARIANT: Record<TemplateModuleKey, 'cyan' | 'orange' | 'green' | 'muted' | 'red'> = {
  core: 'muted',
  office: 'cyan',
  assist: 'green',
  pflege: 'orange',
  stationaer: 'cyan',
  beratung: 'orange',
  akademie: 'green',
  communication: 'cyan',
  billing: 'muted',
  documents: 'muted',
  ti: 'cyan',
};

type Props = { moduleKey: TemplateModuleKey };

export function TemplateModuleBadge({ moduleKey }: Props) {
  return (
    <PremiumBadge label={MODULE_LABELS[moduleKey]} variant={MODULE_VARIANT[moduleKey]} />
  );
}

export function getModuleLabel(moduleKey: TemplateModuleKey): string {
  return MODULE_LABELS[moduleKey];
}
