import type { TaskCategory } from '@/types/modules/client';
import type { AssistLeistungsbereichKey } from '@/types/modules/assist/assistTaskCatalog';

/** Mappt Assist-Leistungsbereich auf legacy TaskCategory für client_tasks */
export function mapLeistungsbereichToTaskCategory(
  leistungsbereich: AssistLeistungsbereichKey,
): TaskCategory {
  switch (leistungsbereich) {
    case 'alltagsbegleitung':
      return 'begleitung';
    case 'betreuung':
      return 'sonstige';
    case 'begleitung':
      return 'begleitung';
    case 'hauswirtschaft':
      return 'haushalt';
    case 'einkauf':
      return 'einkauf';
    case 'angehoerigenentlastung':
      return 'sonstige';
    default:
      return 'sonstige';
  }
}
