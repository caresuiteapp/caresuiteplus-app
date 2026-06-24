/** Systemvorlagen für Pflegekassen / Krankenkassen (Stammdaten inkl. Adresse). */
export type SystemCostCarrierType =
  | 'pflegekasse'
  | 'krankenkasse'
  | 'privatversicherung'
  | 'sozialamt'
  | 'berufsgenossenschaft'
  | 'unfallversicherung';

export type SystemCostCarrierTemplate = {
  id: string;
  name: string;
  type: SystemCostCarrierType;
  department: string | null;
  street: string;
  zip: string;
  city: string;
  ikNumber: string;
};

export const SYSTEM_COST_CARRIER_TEMPLATES: SystemCostCarrierTemplate[] = [
  {
    id: 'aok-nordost-pflege',
    name: 'AOK Nordost — Die Gesundheitskasse',
    type: 'pflegekasse',
    department: 'Pflegekasse',
    street: 'Reinhardtstraße 28',
    zip: '10117',
    city: 'Berlin',
    ikNumber: '109519005',
  },
  {
    id: 'aok-nordost-kk',
    name: 'AOK Nordost — Die Gesundheitskasse',
    type: 'krankenkasse',
    department: null,
    street: 'Reinhardtstraße 28',
    zip: '10117',
    city: 'Berlin',
    ikNumber: '109519005',
  },
  {
    id: 'tk-kk',
    name: 'Techniker Krankenkasse',
    type: 'krankenkasse',
    department: null,
    street: 'Bramfelder Straße 140',
    zip: '22305',
    city: 'Hamburg',
    ikNumber: '101575519',
  },
  {
    id: 'tk-pflege',
    name: 'Techniker Krankenkasse',
    type: 'pflegekasse',
    department: 'Pflegekasse',
    street: 'Bramfelder Straße 140',
    zip: '22305',
    city: 'Hamburg',
    ikNumber: '101575519',
  },
  {
    id: 'barmer-kk',
    name: 'BARMER',
    type: 'krankenkasse',
    department: null,
    street: 'Lichtscheider Straße 89',
    zip: '42285',
    city: 'Wuppertal',
    ikNumber: '104940005',
  },
  {
    id: 'barmer-pflege',
    name: 'BARMER',
    type: 'pflegekasse',
    department: 'Pflegekasse',
    street: 'Lichtscheider Straße 89',
    zip: '42285',
    city: 'Wuppertal',
    ikNumber: '104940005',
  },
  {
    id: 'dak-kk',
    name: 'DAK-Gesundheit',
    type: 'krankenkasse',
    department: null,
    street: 'Nagelsweg 27-31',
    zip: '20097',
    city: 'Hamburg',
    ikNumber: '101560000',
  },
  {
    id: 'dak-pflege',
    name: 'DAK-Gesundheit',
    type: 'pflegekasse',
    department: 'Pflegekasse',
    street: 'Nagelsweg 27-31',
    zip: '20097',
    city: 'Hamburg',
    ikNumber: '101560000',
  },
  {
    id: 'knappschaft-kk',
    name: 'Knappschaft',
    type: 'krankenkasse',
    department: null,
    street: 'Karl-Wiechert-Allee 28',
    zip: '30625',
    city: 'Hannover',
    ikNumber: '109905003',
  },
  {
    id: 'knappschaft-pflege',
    name: 'Knappschaft',
    type: 'pflegekasse',
    department: 'Pflegekasse',
    street: 'Karl-Wiechert-Allee 28',
    zip: '30625',
    city: 'Hannover',
    ikNumber: '109905003',
  },
  {
    id: 'aok-bayern-kk',
    name: 'AOK Bayern — Die Gesundheitskasse',
    type: 'krankenkasse',
    department: null,
    street: 'Bodenseestraße 166',
    zip: '81241',
    city: 'München',
    ikNumber: '108310400',
  },
  {
    id: 'aok-bayern-pflege',
    name: 'AOK Bayern — Die Gesundheitskasse',
    type: 'pflegekasse',
    department: 'Pflegekasse',
    street: 'Bodenseestraße 166',
    zip: '81241',
    city: 'München',
    ikNumber: '108310400',
  },
  {
    id: 'ikk-classic-kk',
    name: 'IKK classic',
    type: 'krankenkasse',
    department: null,
    street: 'Wilhelmstraße 2',
    zip: '65185',
    city: 'Wiesbaden',
    ikNumber: '101570104',
  },
  {
    id: 'bkk-vbu-kk',
    name: 'BKK VBU',
    type: 'krankenkasse',
    department: null,
    street: 'Am Kümmerling 24-32',
    zip: '55294',
    city: 'Bodenheim',
    ikNumber: '101531011',
  },
  {
    id: 'hkk-kk',
    name: 'hkk Krankenkasse',
    type: 'krankenkasse',
    department: null,
    street: 'Martinistraße 26',
    zip: '28195',
    city: 'Bremen',
    ikNumber: '103170002',
  },
  {
    id: 'hkk-pflege',
    name: 'hkk Krankenkasse',
    type: 'pflegekasse',
    department: 'Pflegekasse',
    street: 'Martinistraße 26',
    zip: '28195',
    city: 'Bremen',
    ikNumber: '103170002',
  },
];

export function formatSystemCostCarrierAddress(template: Pick<SystemCostCarrierTemplate, 'street' | 'zip' | 'city'>): string {
  return `${template.street}, ${template.zip} ${template.city}`;
}
