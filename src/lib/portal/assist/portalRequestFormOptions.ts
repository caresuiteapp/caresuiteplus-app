import { ASSIST_CATALOG_TASKS } from '@/data/assist/assistTaskCatalog';
import { TASK_CATALOG } from '@/data/demo/clients/taskCatalog';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import type { ListFilterOption } from '@/components/ui';
import type { PortalNextAppointment, PortalRequestType } from '@/types/portal/assist';
import type {
  BeschwerdePayload,
  LobPayload,
  PortalStructuredRequestPayload,
  PortalTimeOfDayKey,
  PortalUrgencyKey,
  PortalWeekdayKey,
  RueckrufPayload,
  SonstigesPayload,
  StammdatenPayload,
  TerminAendernPayload,
  ZusatzterminPayload,
} from '@/types/portal/requestPayloads';
import {
  ASSIST_LEISTUNGSBEREICH_LABELS,
  type AssistLeistungsbereichKey,
} from '@/types/modules/assist/assistTaskCatalog';
import { TASK_CATEGORY_LABELS } from '@/types/modules/client';

export const PORTAL_FORM_REQUEST_TYPES = [
  'zusatztermin',
  'termin_aendern',
  'rueckruf',
  'stammdaten',
  'beschwerde',
  'lob',
  'sonstiges',
] as const;

export type PortalFormRequestType = (typeof PORTAL_FORM_REQUEST_TYPES)[number];

export function isPortalFormRequestType(type: PortalRequestType): type is PortalFormRequestType {
  return (PORTAL_FORM_REQUEST_TYPES as readonly string[]).includes(type);
}

export const WEEKDAY_OPTIONS: ListFilterOption[] = [
  { key: 'mo', label: 'Montag' },
  { key: 'di', label: 'Dienstag' },
  { key: 'mi', label: 'Mittwoch' },
  { key: 'do', label: 'Donnerstag' },
  { key: 'fr', label: 'Freitag' },
  { key: 'sa', label: 'Samstag' },
  { key: 'so', label: 'Sonntag' },
];

export const TIME_OF_DAY_OPTIONS: ListFilterOption[] = [
  { key: 'vormittag', label: 'Vormittag' },
  { key: 'mittag', label: 'Mittag' },
  { key: 'nachmittag', label: 'Nachmittag' },
  { key: 'abend', label: 'Abend' },
];

export const URGENCY_OPTIONS: ListFilterOption[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'bald', label: 'Bald' },
  { key: 'dringend', label: 'Dringend' },
];

export const CHANGE_TYPE_OPTIONS: ListFilterOption[] = [
  { key: 'uhrzeit_aendern', label: 'Uhrzeit ändern' },
  { key: 'tag_aendern', label: 'Tag ändern' },
  { key: 'tag_und_uhrzeit_aendern', label: 'Tag und Uhrzeit ändern' },
  { key: 'absagen', label: 'Einsatz absagen' },
];

export const ABSAGEGRUND_OPTIONS: ListFilterOption[] = [
  { key: 'krankheit', label: 'Krankheit' },
  { key: 'arzttermin', label: 'Arzttermin' },
  { key: 'hospitalisierung', label: 'Hospitalisierung' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

export const WUNSCHTAG_OPTIONS: ListFilterOption[] = [
  ...WEEKDAY_OPTIONS,
  { key: 'naechste_woche', label: 'Nächste Woche (flexibel)' },
];

export function showsNeueTageszeit(aenderungsart: TerminAendernPayload['aenderungsart']): boolean {
  return aenderungsart === 'uhrzeit_aendern' || aenderungsart === 'tag_und_uhrzeit_aendern';
}

export function showsNeuerWunschtag(aenderungsart: TerminAendernPayload['aenderungsart']): boolean {
  return aenderungsart === 'tag_aendern' || aenderungsart === 'tag_und_uhrzeit_aendern';
}

export const RUECKRUF_TOPIC_OPTIONS: ListFilterOption[] = [
  { key: 'termin', label: 'Einsatz' },
  { key: 'dokument', label: 'Dokument' },
  { key: 'rechnung', label: 'Rechnung' },
  { key: 'allgemeine_frage', label: 'Allgemeine Frage' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

export const RUECKRUF_TIME_OPTIONS: ListFilterOption[] = [
  { key: 'vormittag', label: 'Vormittags' },
  { key: 'mittag', label: 'Mittags' },
  { key: 'nachmittag', label: 'Nachmittags' },
  { key: 'abend', label: 'Abends' },
];

export const STAMMDATEN_FIELD_OPTIONS: ListFilterOption[] = [
  { key: 'adresse', label: 'Adresse' },
  { key: 'telefon', label: 'Telefon' },
  { key: 'email', label: 'E-Mail' },
  { key: 'bankverbindung', label: 'Bankverbindung' },
  { key: 'ansprechpartner', label: 'Ansprechpartner' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

export const FEEDBACK_BEREICH_OPTIONS: ListFilterOption[] = [
  { key: 'termin', label: 'Einsatz' },
  { key: 'mitarbeiter', label: 'Mitarbeiter:in' },
  { key: 'leistung', label: 'Leistung' },
  { key: 'kommunikation', label: 'Kommunikation' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

export const SONSTIGES_CATEGORY_OPTIONS: ListFilterOption[] = [
  { key: 'allgemein', label: 'Allgemeine Anfrage' },
  { key: 'dokument', label: 'Dokument' },
  { key: 'rechnung', label: 'Rechnung' },
  { key: 'leistung', label: 'Leistung' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

const CARE_CONTEXT_LEISTUNGSBEREICH: Partial<Record<ClientCareContext, AssistLeistungsbereichKey[]>> = {
  daily_assistance: ['alltagsbegleitung', 'hauswirtschaft'],
  support_care: ['betreuung'],
  companionship: ['begleitung'],
};

function labelForKey(options: ListFilterOption[], key: string): string {
  return options.find((opt) => opt.key === key)?.label ?? key;
}

/** Leistungsarten from visible Assist catalog tasks, scoped by care context when available. */
export function buildLeistungsartOptions(careContexts: ClientCareContext[] = []): ListFilterOption[] {
  const visibleTasks = ASSIST_CATALOG_TASKS.filter((task) => task.visibleToClient);
  let bereiche = new Set<AssistLeistungsbereichKey>(
    visibleTasks.map((task) => task.leistungsbereich),
  );

  if (careContexts.length > 0) {
    const scoped = new Set<AssistLeistungsbereichKey>();
    for (const context of careContexts) {
      const mapped = CARE_CONTEXT_LEISTUNGSBEREICH[context];
      if (mapped) {
        mapped.forEach((key) => scoped.add(key));
      }
    }
    if (scoped.size > 0) {
      bereiche = new Set([...bereiche].filter((key) => scoped.has(key)));
    }
  }

  const options: ListFilterOption[] = [...bereiche]
    .sort((a, b) =>
      (ASSIST_LEISTUNGSBEREICH_LABELS[a] ?? a).localeCompare(
        ASSIST_LEISTUNGSBEREICH_LABELS[b] ?? b,
        'de',
      ),
    )
    .map((key) => ({
      key,
      label: ASSIST_LEISTUNGSBEREICH_LABELS[key] ?? key,
    }));

  if (options.length === 0) {
    return Object.entries(TASK_CATEGORY_LABELS).map(([key, label]) => ({ key, label }));
  }

  const taskTitles = [...new Set(visibleTasks.map((task) => task.title))].sort((a, b) =>
    a.localeCompare(b, 'de'),
  );
  if (taskTitles.length > 0 && options.length <= 2) {
    return taskTitles.map((title) => {
      const task = visibleTasks.find((item) => item.title === title);
      return {
        key: task?.id ?? title,
        label: title,
      };
    });
  }

  options.push({ key: 'sonstige', label: 'Sonstige Leistung' });
  return options;
}

export function formatAppointmentOptionLabel(appointment: PortalNextAppointment): string {
  const date = new Date(appointment.startsAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? appointment.startsAt
    : date.toLocaleString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
  return `${appointment.title} · ${dateLabel}`;
}

export function buildAppointmentOptions(
  appointments: PortalNextAppointment[],
): ListFilterOption[] {
  if (appointments.length === 0) {
    return [
      { key: 'none', label: 'Kein geplanter Einsatz' },
      { key: 'allgemein', label: 'Allgemeine Anfrage' },
    ];
  }

  return appointments.map((appointment) => ({
    key: appointment.id,
    label: formatAppointmentOptionLabel(appointment),
  }));
}

export function createDefaultFormState(
  requestType: PortalFormRequestType,
  options: {
    leistungsartOptions: ListFilterOption[];
    appointmentOptions: ListFilterOption[];
    contactPhone?: string | null;
  },
): PortalStructuredRequestPayload {
  switch (requestType) {
    case 'zusatztermin':
      return {
        leistungsart: options.leistungsartOptions[0]?.key ?? '',
        wochentag: 'mo',
        tageszeit: 'vormittag',
        dringlichkeit: 'normal',
        nachricht: '',
      } satisfies ZusatzterminPayload;
    case 'termin_aendern': {
      const firstAppointment = options.appointmentOptions[0];
      const hasRealAppointment =
        firstAppointment &&
        firstAppointment.key !== 'none' &&
        firstAppointment.key !== 'allgemein';
      return {
        appointmentId: hasRealAppointment ? firstAppointment.key : null,
        appointmentLabel: firstAppointment?.label ?? 'Kein geplanter Einsatz',
        aenderungsart: 'uhrzeit_aendern',
        wochentag: 'mo',
        tageszeit: 'vormittag',
        absagegrund: null,
        nachricht: '',
      } satisfies TerminAendernPayload;
    }
    case 'rueckruf':
      return {
        thema: 'termin',
        rueckrufzeit: 'vormittag',
        telefonnummer: options.contactPhone?.trim() ?? '',
        nachricht: '',
      } satisfies RueckrufPayload;
    case 'stammdaten':
      return { feld: 'adresse', nachricht: '' } satisfies StammdatenPayload;
    case 'beschwerde':
      return { bereich: 'termin', dringlichkeit: 'normal', nachricht: '' } satisfies BeschwerdePayload;
    case 'lob':
      return { bereich: 'leistung', nachricht: '' } satisfies LobPayload;
    case 'sonstiges':
      return { kategorie: 'allgemein', nachricht: '' } satisfies SonstigesPayload;
    default:
      return { kategorie: 'allgemein', nachricht: '' } satisfies SonstigesPayload;
  }
}

export function validatePortalRequestPayload(
  requestType: PortalFormRequestType,
  payload: PortalStructuredRequestPayload,
): string | null {
  switch (requestType) {
    case 'zusatztermin': {
      const data = payload as ZusatzterminPayload;
      if (!data.leistungsart) return 'Bitte wählen Sie eine Leistungsart.';
      if (!data.wochentag) return 'Bitte wählen Sie einen Wochentag.';
      if (!data.tageszeit) return 'Bitte wählen Sie eine Tageszeit.';
      if (!data.dringlichkeit) return 'Bitte wählen Sie eine Dringlichkeit.';
      return null;
    }
    case 'termin_aendern': {
      const data = payload as TerminAendernPayload;
      if (!data.aenderungsart) return 'Bitte wählen Sie die Art der Änderung.';
      if (!data.appointmentId) {
        const isGeneral =
          data.appointmentLabel.includes('Allgemeine Anfrage') ||
          data.appointmentLabel === 'Allgemeine Anfrage';
        if (!isGeneral) {
          return 'Bitte wählen Sie einen geplanten Einsatz oder Allgemeine Anfrage.';
        }
      }
      if (data.aenderungsart === 'absagen') {
        if (!data.absagegrund) return 'Bitte wählen Sie einen Absagegrund.';
        return null;
      }
      if (showsNeueTageszeit(data.aenderungsart) && !data.tageszeit) {
        return 'Bitte wählen Sie eine neue Tageszeit.';
      }
      if (showsNeuerWunschtag(data.aenderungsart) && !data.wochentag) {
        return 'Bitte wählen Sie einen Wunschtag.';
      }
      return null;
    }
    case 'rueckruf': {
      const data = payload as RueckrufPayload;
      if (!data.thema) return 'Bitte wählen Sie ein Thema.';
      if (!data.rueckrufzeit) return 'Bitte wählen Sie eine Rückrufzeit.';
      return null;
    }
    case 'stammdaten': {
      const data = payload as StammdatenPayload;
      if (!data.feld) return 'Bitte wählen Sie, was geändert werden soll.';
      return null;
    }
    case 'beschwerde': {
      const data = payload as BeschwerdePayload;
      if (!data.bereich) return 'Bitte wählen Sie einen Bereich.';
      if (!data.dringlichkeit) return 'Bitte wählen Sie eine Dringlichkeit.';
      return null;
    }
    case 'lob': {
      const data = payload as LobPayload;
      if (!data.bereich) return 'Bitte wählen Sie einen Bereich.';
      return null;
    }
    case 'sonstiges': {
      const data = payload as SonstigesPayload;
      if (!data.kategorie) return 'Bitte wählen Sie eine Kategorie.';
      return null;
    }
    default:
      return null;
  }
}

export function serializePortalRequestPayload(
  requestType: PortalFormRequestType,
  payload: PortalStructuredRequestPayload,
): Record<string, unknown> {
  const base = { formVersion: 1, requestType };
  switch (requestType) {
    case 'zusatztermin': {
      const data = payload as ZusatzterminPayload;
      return {
        ...base,
        leistungsart: data.leistungsart,
        wochentag: data.wochentag,
        tageszeit: data.tageszeit,
        dringlichkeit: data.dringlichkeit,
        nachricht: data.nachricht?.trim() || null,
      };
    }
    case 'termin_aendern': {
      const data = payload as TerminAendernPayload;
      return {
        ...base,
        appointmentId: data.appointmentId,
        appointmentLabel: data.appointmentLabel,
        aenderungsart: data.aenderungsart,
        wochentag: showsNeuerWunschtag(data.aenderungsart) ? data.wochentag ?? null : null,
        tageszeit: showsNeueTageszeit(data.aenderungsart) ? data.tageszeit ?? null : null,
        absagegrund: data.aenderungsart === 'absagen' ? data.absagegrund ?? null : null,
        nachricht: data.nachricht?.trim() || null,
      };
    }
    case 'rueckruf': {
      const data = payload as RueckrufPayload;
      return {
        ...base,
        thema: data.thema,
        rueckrufzeit: data.rueckrufzeit,
        telefonnummer: data.telefonnummer?.trim() || null,
        nachricht: data.nachricht?.trim() || null,
      };
    }
    case 'stammdaten': {
      const data = payload as StammdatenPayload;
      return {
        ...base,
        feld: data.feld,
        nachricht: data.nachricht?.trim() || null,
      };
    }
    case 'beschwerde': {
      const data = payload as BeschwerdePayload;
      return {
        ...base,
        bereich: data.bereich,
        dringlichkeit: data.dringlichkeit,
        nachricht: data.nachricht?.trim() || null,
      };
    }
    case 'lob': {
      const data = payload as LobPayload;
      return {
        ...base,
        bereich: data.bereich,
        nachricht: data.nachricht?.trim() || null,
      };
    }
    case 'sonstiges': {
      const data = payload as SonstigesPayload;
      return {
        ...base,
        kategorie: data.kategorie,
        nachricht: data.nachricht?.trim() || null,
      };
    }
    default:
      return base;
  }
}

export function buildPortalRequestDescription(
  requestType: PortalFormRequestType,
  payload: PortalStructuredRequestPayload,
): string | null {
  switch (requestType) {
    case 'zusatztermin': {
      const data = payload as ZusatzterminPayload;
      const parts = [
        `Leistung: ${labelForKey(buildLeistungsartOptions(), data.leistungsart) || data.leistungsart}`,
        `Wochentag: ${labelForKey(WEEKDAY_OPTIONS, data.wochentag)}`,
        `Tageszeit: ${labelForKey(TIME_OF_DAY_OPTIONS, data.tageszeit)}`,
        `Dringlichkeit: ${labelForKey(URGENCY_OPTIONS, data.dringlichkeit)}`,
      ];
      if (data.nachricht?.trim()) parts.push(`Nachricht: ${data.nachricht.trim()}`);
      return parts.join(' · ');
    }
    case 'termin_aendern': {
      const data = payload as TerminAendernPayload;
      const parts = [
        `Einsatz: ${data.appointmentLabel}`,
        `Änderung: ${labelForKey(CHANGE_TYPE_OPTIONS, data.aenderungsart)}`,
      ];
      if (data.aenderungsart === 'absagen' && data.absagegrund) {
        parts.push(`Absagegrund: ${labelForKey(ABSAGEGRUND_OPTIONS, data.absagegrund)}`);
      }
      if (showsNeuerWunschtag(data.aenderungsart) && data.wochentag) {
        parts.push(`Wunschtag: ${labelForKey(WUNSCHTAG_OPTIONS, data.wochentag)}`);
      }
      if (showsNeueTageszeit(data.aenderungsart) && data.tageszeit) {
        parts.push(`Tageszeit: ${labelForKey(TIME_OF_DAY_OPTIONS, data.tageszeit)}`);
      }
      if (data.nachricht?.trim()) parts.push(`Nachricht: ${data.nachricht.trim()}`);
      return parts.join(' · ');
    }
    case 'rueckruf': {
      const data = payload as RueckrufPayload;
      const parts = [
        `Thema: ${labelForKey(RUECKRUF_TOPIC_OPTIONS, data.thema)}`,
        `Rückruf: ${labelForKey(RUECKRUF_TIME_OPTIONS, data.rueckrufzeit)}`,
      ];
      if (data.telefonnummer?.trim()) parts.push(`Tel.: ${data.telefonnummer.trim()}`);
      if (data.nachricht?.trim()) parts.push(`Nachricht: ${data.nachricht.trim()}`);
      return parts.join(' · ');
    }
    case 'stammdaten': {
      const data = payload as StammdatenPayload;
      const parts = [`Feld: ${labelForKey(STAMMDATEN_FIELD_OPTIONS, data.feld)}`];
      if (data.nachricht?.trim()) parts.push(`Details: ${data.nachricht.trim()}`);
      return parts.join(' · ');
    }
    case 'beschwerde': {
      const data = payload as BeschwerdePayload;
      const parts = [
        `Bereich: ${labelForKey(FEEDBACK_BEREICH_OPTIONS, data.bereich)}`,
        `Dringlichkeit: ${labelForKey(URGENCY_OPTIONS, data.dringlichkeit)}`,
      ];
      if (data.nachricht?.trim()) parts.push(`Nachricht: ${data.nachricht.trim()}`);
      return parts.join(' · ');
    }
    case 'lob': {
      const data = payload as LobPayload;
      const parts = [`Bereich: ${labelForKey(FEEDBACK_BEREICH_OPTIONS, data.bereich)}`];
      if (data.nachricht?.trim()) parts.push(`Nachricht: ${data.nachricht.trim()}`);
      return parts.join(' · ');
    }
    case 'sonstiges': {
      const data = payload as SonstigesPayload;
      const parts = [`Kategorie: ${labelForKey(SONSTIGES_CATEGORY_OPTIONS, data.kategorie)}`];
      if (data.nachricht?.trim()) parts.push(`Nachricht: ${data.nachricht.trim()}`);
      return parts.join(' · ');
    }
    default:
      return null;
  }
}

export function isWeekdayKey(value: string): value is PortalWeekdayKey {
  return WEEKDAY_OPTIONS.some((opt) => opt.key === value);
}

export function isTimeOfDayKey(value: string): value is PortalTimeOfDayKey {
  return TIME_OF_DAY_OPTIONS.some((opt) => opt.key === value);
}

export function isUrgencyKey(value: string): value is PortalUrgencyKey {
  return URGENCY_OPTIONS.some((opt) => opt.key === value);
}
