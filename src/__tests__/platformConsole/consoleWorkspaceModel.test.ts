import { describe, expect, it } from 'vitest';
import { consoleCsv, consoleEuros, consoleInvoiceBalance, consoleMoney, consoleSettingValue, isSensitiveSetting, redactConsoleValue, validConsoleDay } from '@/lib/platformConsole/consoleWorkspaceModel';

describe('Console amounts, exports and settings',()=>{
  it('distinguishes missing amounts from zero and uses integer cents',()=>{
    expect(consoleMoney(null)).toBe('—');expect(consoleMoney(undefined)).toBe('—');
    expect(consoleMoney(0)).toContain('0,00');expect(consoleEuros('1.234,56')).toBe(123456);expect(consoleEuros('0,29')).toBe(29);
    for(const value of ['-1,00','1e4','1,234','1.23','NaN','', '999999999999999'])expect(()=>consoleEuros(value)).toThrow();
  });
  it('validates real calendar dates including leap days',()=>{
    expect(validConsoleDay('2028-02-29')).toBe(true);expect(validConsoleDay('2026-02-29')).toBe(false);expect(validConsoleDay('2026-04-31')).toBe(false);
  });
  it('neutralizes formula injection while preserving CSV quoting and newlines',()=>{
    const csv=consoleCsv(['Name','Notiz'],[['=HYPERLINK("https://invalid")','Zeile 1\nZeile 2'],['  +1','"Zitat"']]);
    expect(csv).toContain('"\'=HYPERLINK');expect(csv).toContain('"\'  +1"');expect(csv).toContain('""Zitat""');expect(csv).toContain('Zeile 1\nZeile 2');
  });
  it('protects explicitly sensitive settings and nested audit values',()=>{
    expect(isSensitiveSetting({setting_key:'mail_configuration',is_sensitive:true})).toBe(true);
    expect(redactConsoleValue({before:{setting_key:'service_token',value:'never-show'},after:{settings:{api_key:'private',name:'Allowed'}}})).toEqual({before:{setting_key:'service_token',value:'[geschützt]'},after:{settings:{api_key:'[geschützt]',name:'Allowed'}}});
  });
  it('preserves setting types instead of converting invalid JSON to text',()=>{
    expect(consoleSettingValue(false,'true')).toBe(true);expect(consoleSettingValue(10,'25')).toBe(25);expect(consoleSettingValue('false','false')).toBe('false');
    expect(()=>consoleSettingValue(10,'')).toThrow();expect(()=>consoleSettingValue({},'broken')).toThrow();expect(()=>consoleSettingValue([], '{}')).toThrow();
  });
  it('counts only successful payments belonging to the selected invoice',()=>{
    expect(consoleInvoiceBalance({id:'i1',amount_cents:10000},[{invoice_id:'i1',amount_cents:2500,status:'succeeded'},{invoice_id:'i1',amount_cents:5000,status:'failed'},{invoice_id:'i2',amount_cents:10000,status:'succeeded'}])).toBe(7500);
  });
});
