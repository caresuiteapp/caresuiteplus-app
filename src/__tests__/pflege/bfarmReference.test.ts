import { describe,it,expect } from 'vitest';
import { bfarmReferenceIsStale,decodeBfarmReference,nextBfarmDeliveryOn } from '@/lib/pflege/bfarmReference';
import { parseBfarmReference } from '@/lib/pflege/bfarmCatalogImport';

const row={product:{pzn:'00000017',name:'Test',ingredient:'Wirkstoff',strength:null,dosageForm:'Tablette',brand:null,manufacturer:null,packageSize:null,source:'bfarm-31b',sourceVersion:'2026-11-15'},
  components:[{number:1,dosageForm:'Tablette',description:null,substances:[{name:'Wirkstoff',strength:null,id:'00127',rank:0}]}],
  nextExpectedOn:'2026-12-01',checkedAt:'2026-11-24T12:00:00Z',stale:false};
describe('BfArM single-record contract',()=>{
  it('accepts rank zero and absent strength and refuses a list, wrong PZN or mixed version',()=>{
    expect(decodeBfarmReference(row,'00000017')).toEqual(row);
    for(const invalid of [[row],{...row,product:{...row.product,pzn:'01234562'}},{...row,nextExpectedOn:'2027-01-01'},
      {...row,components:[...row.components,...row.components]}])expect(decodeBfarmReference(invalid,'00000017')).toBeNull();
  });
  it('marks the preceding delivery stale from the next scheduled day in Berlin, including month/year rollover',()=>{
    expect(nextBfarmDeliveryOn('2026-11-01')).toBe('2026-11-15');
    expect(nextBfarmDeliveryOn('2026-12-15')).toBe('2027-01-01');
    expect(bfarmReferenceIsStale('2026-11-15',new Date('2026-11-30T22:59:59Z'))).toBe(false);
    expect(bfarmReferenceIsStale('2026-11-15',new Date('2026-11-30T23:00:00Z'))).toBe(true);
    expect(bfarmReferenceIsStale('2026-02-30')).toBe(true);
  });
  it('preserves components and their rank zero rather than inferring a single combination strength',()=>{
    const parsed=parseBfarmReference([
      {name:'20261115-REFERENCE_MEDICINAL_PRODUCT.dsv',text:'RMP_KEY|RMP_PZN|RMP_MPD_NAME|RMP_PFM_NAME|RMP_MULTIPLE_PPT\n00000017|00000017|Test|Kombipackung|1\n'},
      {name:'20261115-REFERENCE_PHARMACEUTICAL_PRODUCT.dsv',text:'RPP_KEY|RMP_KEY|RPP_NUMBER|RPP_PFM_NAME\n00000017-1|00000017|1|Tablette\n00000017-2|00000017|2|Lösung\n'},
      {name:'20261115-REFERENCE_SUBSTANCE.dsv',text:'RSE_KEY|RPP_KEY|RSE_SUBSTANCE_NAME|RSE_SUBSTANCE_STRENGTH|RSE_SUBSTANCE_ID|RSE_SUBSTANCE_RANK\n00000017-1-0|00000017-1|Wirkstoff||00127|0\n00000017-2-1|00000017-2|Wirkstoff|5 mg|00127|1\n'},
    ]);
    expect(parsed.rows[0].strength).toBeNull();
    expect(parsed.componentsByPzn['00000017'][0].substances[0]).toEqual({name:'Wirkstoff',strength:null,id:'00127',rank:0});
    expect(parsed.componentsByPzn['00000017'][1].substances[0].strength).toBe('5 mg');
  });
});
