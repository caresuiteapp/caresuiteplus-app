import { colors } from '@/theme';

export type OpsHubModule = {
  title: string;
  desc: string;
  href: string;
  color: string;
};

export const OPS_HUB_MODULES: OpsHubModule[] = [
  {
    title: 'Kommunikationszentrum',
    desc: 'Threads · Chat · Zuordnung · Portale',
    href: '/business/messages',
    color: colors.cyan,
  },
  {
    title: 'Live-Pilot Readiness',
    desc: '3 ambulante Mandanten · Checkliste rm-001',
    href: '/business/ops/pilot-readiness',
    color: colors.primary,
  },
  {
    title: 'Telematikinfrastruktur',
    desc: 'KIM · eGK · ePA · eMP · E-Rezept · TI-Sicherheit',
    href: '/business/ti',
    color: colors.cyan,
  },
  {
    title: 'Release & Deployment',
    desc: 'Version Manifest, Env-Profile, Checklisten',
    href: '/business/release',
    color: colors.cyan,
  },
  {
    title: 'Security & DSGVO',
    desc: 'Compliance, Performance, Findings',
    href: '/business/security',
    color: colors.warning,
  },
  {
    title: 'QA & Pilotbetrieb',
    desc: 'Bug-Triage, Pilot-Checkliste, Coverage',
    href: '/business/qa',
    color: colors.success,
  },
  {
    title: 'Roadmap & Markteintritt',
    desc: 'Meilensteine, Launch-Readiness',
    href: '/business/roadmap',
    color: colors.violet,
  },
];
