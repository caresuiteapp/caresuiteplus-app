import { describe, expect, it } from 'vitest';
import { parseBfarmCatalog } from '@/lib/pflege/bfarmCatalogImport';
import { validateMedicationPackageFeed } from '@/lib/pflege/medicationMasterDataValidation';

const reference = () => [
  { name: '20261101-REFERENCE_MEDICINAL_PRODUCT.dsv', text: '\uFEFFRMP_KEY|RMP_PZN|RMP_MPD_NAME|RMP_PFM_NAME|RMP_MULTIPLE_PPT\r\n1234562|01234562|Testpräparat|Filmtablette|0\r\n12345678|12345678|Testkombination|Kombipackung|1\r\n' },
  { name: '20261101-REFERENCE_PHARMACEUTICAL_PRODUCT.dsv', text: 'RPP_KEY|RMP_KEY|RPP_NUMBER\r\n01234562-1|1234562|1\r\n12345678-1|12345678|1\r\n12345678-2|12345678|2\r\n' },
  { name: '20261101-REFERENCE_SUBSTANCE.dsv', text: 'RSE_KEY|RPP_KEY|RSE_SUBSTANCE_NAME|RSE_SUBSTANCE_STRENGTH|RSE_SUBSTANCE_RANK\r\n01234562-1-1|01234562-1|Testwirkstoff|2,5 mg/ml|1\r\n12345678-1-1|12345678-1|Testwirkstoff A|10 mg|1\r\n12345678-2-1|12345678-2|Testwirkstoff A|20 mg|1\r\n' },
];

describe('BfArM reference catalog import', () => {
  it('joins all three files, preserves leading zeros and source strength, and emits importable rows', () => {
    const actual = parseBfarmCatalog(reference().reverse());
    expect(actual.source).toBe('bfarm-31b');
    expect(actual.sourceVersion).toBe('2026-11-01');
    expect(actual.rows[0]).toEqual({ pzn: '01234562', name: 'Testpräparat', dosageForm: 'Filmtablette', ingredient: 'Testwirkstoff', strength: '2,5 mg/ml' });
    expect(actual.rows[1]).toMatchObject({ pzn: '12345678', ingredient: 'Testwirkstoff A', strength: null });
    expect(validateMedicationPackageFeed(actual).ok).toBe(true);
  });

  it('rejects mixed delivery dates, missing tables and invalid delivery dates', () => {
    const files = reference();
    expect(() => parseBfarmCatalog(files.slice(0, 2))).toThrow(/drei/);
    files[1].name = files[1].name.replace('20261101', '20261115');
    expect(() => parseBfarmCatalog(files)).toThrow(/Lieferdatum/);
    expect(() => parseBfarmCatalog(reference().map(file => ({ ...file, name: file.name.replace('20261101', '20260230') })))).toThrow(/Lieferdatum/);
  });

  it('refuses malformed PZN and duplicates before any batch can be saved', () => {
    const files = reference();
    files[0].text = files[0].text.replace('01234562', '01234563');
    expect(() => parseBfarmCatalog(files)).toThrow(/Prüfziffer/);
    files[0] = reference()[0];
    files[0].text += '01234562|01234562|Doppelt|Tablette|0\r\n';
    expect(() => parseBfarmCatalog(files)).toThrow(/Doppelte/);
  });

  it('fails closed on broken component references and invalid DSV structure', () => {
    const files = reference();
    files[2].text = files[2].text.replace(/01234562-1/g, '01234562-2');
    expect(() => parseBfarmCatalog(files)).toThrow(/Komponente/);
    files[2] = reference()[2];
    files[2].text += '01234562-1-2|01234562-1|Fehlendes Feld\r\n';
    expect(() => parseBfarmCatalog(files)).toThrow(/DSV-Zeile/);
  });
});
