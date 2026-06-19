/** Structured portal request payloads stored in portal_requests.payload (jsonb). */

export type PortalWeekdayKey = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';

export type PortalTimeOfDayKey = 'vormittag' | 'mittag' | 'nachmittag' | 'abend';

export type PortalUrgencyKey = 'normal' | 'bald' | 'dringend';

export type ZusatzterminPayload = {
  leistungsart: string;
  wochentag: PortalWeekdayKey;
  tageszeit: PortalTimeOfDayKey;
  dringlichkeit: PortalUrgencyKey;
  nachricht?: string | null;
};

export type TerminAendernChangeType =
  | 'uhrzeit_aendern'
  | 'tag_aendern'
  | 'tag_und_uhrzeit_aendern'
  | 'absagen';

export type TerminAendernAbsagegrundKey =
  | 'krankheit'
  | 'arzttermin'
  | 'hospitalisierung'
  | 'sonstiges';

/** Weekday or flexible next-week preference for appointment reschedule. */
export type PortalWunschtagKey = PortalWeekdayKey | 'naechste_woche';

export type TerminAendernPayload = {
  appointmentId: string | null;
  appointmentLabel: string;
  aenderungsart: TerminAendernChangeType;
  wochentag?: PortalWunschtagKey | null;
  tageszeit?: PortalTimeOfDayKey | null;
  absagegrund?: TerminAendernAbsagegrundKey | null;
  nachricht?: string | null;
};

export type RueckrufTopicKey = 'termin' | 'dokument' | 'rechnung' | 'sonstiges';

export type RueckrufCallbackTimeKey = 'vormittag' | 'nachmittag' | 'abend';

export type RueckrufPayload = {
  thema: RueckrufTopicKey;
  rueckrufzeit: RueckrufCallbackTimeKey;
  telefonnummer?: string | null;
  nachricht?: string | null;
};

export type StammdatenFieldKey =
  | 'adresse'
  | 'telefon'
  | 'email'
  | 'bankverbindung'
  | 'ansprechpartner'
  | 'sonstiges';

export type StammdatenPayload = {
  feld: StammdatenFieldKey;
  nachricht?: string | null;
};

export type FeedbackBereichKey = 'termin' | 'mitarbeiter' | 'leistung' | 'kommunikation' | 'sonstiges';

export type BeschwerdePayload = {
  bereich: FeedbackBereichKey;
  dringlichkeit: PortalUrgencyKey;
  nachricht?: string | null;
};

export type LobPayload = {
  bereich: FeedbackBereichKey;
  nachricht?: string | null;
};

export type SonstigesPayload = {
  kategorie: string;
  nachricht?: string | null;
};

export type PortalStructuredRequestPayload =
  | ZusatzterminPayload
  | TerminAendernPayload
  | RueckrufPayload
  | StammdatenPayload
  | BeschwerdePayload
  | LobPayload
  | SonstigesPayload;
