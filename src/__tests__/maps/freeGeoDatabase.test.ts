import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
it('enforces shared provider spacing, cache privacy, and preserves legacy distances',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create table tenants(id uuid primary key); create table employee_logbook_trips(distance_source text constraint employee_logbook_trips_distance_source_check check(distance_source in ('gps','google_fallback','manual','office_corrected')));insert into employee_logbook_trips values('google_fallback');`);
 await db.exec(readFileSync('supabase/migrations/20261008041530_free_geo_provider_cache_and_provenance.sql','utf8'));
 await db.exec('set role service_role');const first=await db.query<{delay:number}>("select reserve_free_geo_request('osrm') as delay"),second=await db.query<{delay:number}>("select reserve_free_geo_request('osrm') as delay");expect(first.rows[0].delay).toBe(0);expect(second.rows[0].delay).toBeGreaterThan(800);
 await db.exec('reset role');expect((await db.query<{distance_source:string}>('select distance_source from employee_logbook_trips')).rows[0].distance_source).toBe('google_fallback');
 await db.exec("insert into employee_logbook_trips values('osm_fallback')");
 const privileges=await db.query<{canread:boolean;canrequest:boolean}>("select has_table_privilege('authenticated','free_geo_cache','SELECT') as canread,has_function_privilege('authenticated','reserve_free_geo_request(text)','EXECUTE') as canrequest");expect(privileges.rows[0]).toEqual({canread:false,canrequest:false});
 }finally{await db.close();}
},15000);
