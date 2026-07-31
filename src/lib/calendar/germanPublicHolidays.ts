export type GermanFederalState =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV'
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

export type GermanPublicHoliday = {
  key: string;
  name: string;
  date: string;
};

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function easterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function offsetDate(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function add(list: GermanPublicHoliday[], key: string, name: string, date: string): void {
  list.push({ key, name, date });
}

/** Gesetzliche Feiertage. Default NW entspricht dem Mandantenstandort Dortmund. */
export function getGermanPublicHolidays(
  year: number,
  state: GermanFederalState = 'NW',
): GermanPublicHoliday[] {
  const easter = easterSundayUtc(year);
  const holidays: GermanPublicHoliday[] = [];

  add(holidays, 'new-year', 'Neujahr', isoDate(year, 1, 1));
  add(holidays, 'good-friday', 'Karfreitag', offsetDate(easter, -2));
  add(holidays, 'easter-monday', 'Ostermontag', offsetDate(easter, 1));
  add(holidays, 'labour-day', 'Tag der Arbeit', isoDate(year, 5, 1));
  add(holidays, 'ascension', 'Christi Himmelfahrt', offsetDate(easter, 39));
  add(holidays, 'whit-monday', 'Pfingstmontag', offsetDate(easter, 50));
  add(holidays, 'unity-day', 'Tag der Deutschen Einheit', isoDate(year, 10, 3));
  add(holidays, 'christmas-1', '1. Weihnachtstag', isoDate(year, 12, 25));
  add(holidays, 'christmas-2', '2. Weihnachtstag', isoDate(year, 12, 26));

  if (['BW', 'BY', 'ST'].includes(state)) {
    add(holidays, 'epiphany', 'Heilige Drei Könige', isoDate(year, 1, 6));
  }
  if (['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(state)) {
    add(holidays, 'corpus-christi', 'Fronleichnam', offsetDate(easter, 60));
  }
  if (state === 'SL') add(holidays, 'assumption', 'Mariä Himmelfahrt', isoDate(year, 8, 15));
  if (state === 'TH') add(holidays, 'childrens-day', 'Weltkindertag', isoDate(year, 9, 20));
  if (['BB', 'HB', 'HH', 'MV', 'NI', 'SH', 'SN', 'ST', 'TH'].includes(state)) {
    add(holidays, 'reformation-day', 'Reformationstag', isoDate(year, 10, 31));
  }
  if (['BW', 'BY', 'NW', 'RP', 'SL'].includes(state)) {
    add(holidays, 'all-saints', 'Allerheiligen', isoDate(year, 11, 1));
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

