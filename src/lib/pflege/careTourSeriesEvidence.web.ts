export type CareTourSeriesEvidence = Readonly<{
  singleTourDate: 'provided';
  singleStopWallClockTimes: 'provided';
  nativeSeriesRule: 'not_provided';
  versionedTimezoneRules: 'not_provided';
  holidayDecision: 'not_provided';
  occurrenceExceptionHistory: 'not_provided';
  singleEditMayRewriteSeries: false;
  assistanceRecurrenceIsCareTourProof: false;
  missingEvidence: readonly string[];
}>;

const MISSING_EVIDENCE = Object.freeze([
  'versionierte Serienregel mit Zeitzone, Beginn und Endbedingung',
  'mandantenbezogener Feiertagskalender mit ausdrücklicher Entscheidung',
  'unveränderliche erzeugte Vorkommen und einzelne datierte Ausnahmen',
  'atomare Änderung genau eines Vorkommens ohne Umschreiben der übrigen Serie',
]);

const EVIDENCE: CareTourSeriesEvidence = Object.freeze({
  singleTourDate: 'provided',
  singleStopWallClockTimes: 'provided',
  nativeSeriesRule: 'not_provided',
  versionedTimezoneRules: 'not_provided',
  holidayDecision: 'not_provided',
  occurrenceExceptionHistory: 'not_provided',
  singleEditMayRewriteSeries: false,
  assistanceRecurrenceIsCareTourProof: false,
  missingEvidence: MISSING_EVIDENCE,
});

/** Static Web/Desktop boundary for the single-date care-tour workflow. */
export function getCareTourSeriesEvidence(): CareTourSeriesEvidence {
  return EVIDENCE;
}
