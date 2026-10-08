// @vitest-environment happy-dom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {it,expect,vi} from 'vitest';
import {useStableMapMarkers} from '@/components/maps/useStableMapMarkers';import type {GoogleMapsNamespace} from '@/lib/maps/googleMapsLoader';
it('moves markers and opens current escaped content after a GPS refresh',async()=>{
 (globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
 let click:()=>void=()=>{};const select=vi.fn(),setPosition=vi.fn(),setContent=vi.fn(),setMap=vi.fn();
 const map={panTo:vi.fn(),setCenter:vi.fn(),fitBounds:vi.fn()};
 const google={maps:{Marker:class{addListener(_event:string,handler:()=>void){click=handler;}setPosition=setPosition;setMap=setMap;},InfoWindow:class{setContent=setContent;open(){}close(){}},LatLngBounds:class{extend(){}}}} as unknown as GoogleMapsNamespace;
 function Probe({lat,label}:{lat:number;label:string}){useStableMapMarkers({map,google,markers:[{id:'employee',latitude:lat,longitude:13,label}],onMarkerSelect:select});return null;}
 const root=createRoot(document.createElement('div'));try{await act(async()=>root.render(<Probe lat={52} label="Alt"/>));await act(async()=>root.render(<Probe lat={53} label="<script>Neu</script>"/>));click();expect(select).toHaveBeenCalledWith('employee');expect(setPosition).toHaveBeenCalledWith({lat:53,lng:13});expect(setContent).toHaveBeenCalledWith('<strong>&lt;script&gt;Neu&lt;/script&gt;</strong>');expect(map.setCenter).toHaveBeenCalledTimes(1);}finally{await act(async()=>root.unmount());}expect(setMap).toHaveBeenLastCalledWith(null);
});
