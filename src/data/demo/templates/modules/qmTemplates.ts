import { seriesTpl } from '../helpers';

export const QM_TEMPLATES = seriesTpl(
  'tpl-qm',
  'core',
  'checklist',
  'qm',
  [
    'Hygiene-Checkliste', 'Medikamenten-Check', 'Dokumentations-Check', 'Einsatzqualität',
    'Beschwerdemanagement', 'Risikoanalyse Review', 'Fortbildungsnachweis', 'Notfallübung',
  ],
  (title) => `☐ QM — ${title} ({{date}}, {{employeeName}})`,
);
