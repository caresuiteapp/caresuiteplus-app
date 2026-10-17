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

it('preserves the camera when another marker arrives and closes removed selected details',async()=>{
 (globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
 const close=vi.fn(),open=vi.fn();
 const map={panTo:vi.fn(),setCenter:vi.fn(),fitBounds:vi.fn()};
 const google={maps:{Marker:class{addListener(){}setPosition(){}setMap(){}},InfoWindow:class{setContent(){}open=open;close=close;},LatLngBounds:class{extend(){}}}} as unknown as GoogleMapsNamespace;
 function Probe({ids,selected}:{ids:string[];selected:string|null}){useStableMapMarkers({map,google,markers:ids.map((id,index)=>({id,latitude:52+index,longitude:13,label:id})),selectedMarkerId:selected});return null;}
 const root=createRoot(document.createElement('div'));
 try{
  await act(async()=>root.render(<Probe ids={['one']} selected="one"/>));
  expect(map.setCenter).toHaveBeenCalledTimes(1);expect(map.panTo).toHaveBeenCalledTimes(1);
  await act(async()=>root.render(<Probe ids={['one','two']} selected="one"/>));
  expect(map.fitBounds).not.toHaveBeenCalled();expect(map.panTo).toHaveBeenCalledTimes(1);
  await act(async()=>root.render(<Probe ids={['two']} selected="one"/>));
  expect(close).toHaveBeenCalled();expect(map.panTo).toHaveBeenCalledTimes(1);
  await act(async()=>root.render(<Probe ids={['one','two']} selected="one"/>));
  expect(map.panTo).toHaveBeenCalledTimes(2);expect(open).toHaveBeenCalledTimes(2);
  await act(async()=>root.render(<Probe ids={['one','two']} selected={null}/>));
  expect(close).toHaveBeenCalledTimes(2);
 }finally{await act(async()=>root.unmount());}
});

it('waits for the explicitly selected marker to appear before opening its details',async()=>{
 (globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
 const open=vi.fn(),setContent=vi.fn();
 const map={panTo:vi.fn(),setCenter:vi.fn(),fitBounds:vi.fn()};
 const google={maps:{Marker:class{addListener(){}setPosition(){}setMap(){}},InfoWindow:class{setContent=setContent;open=open;close(){}},LatLngBounds:class{extend(){}}}} as unknown as GoogleMapsNamespace;
 function Probe({present}:{present:boolean}){useStableMapMarkers({map,google,markers:present?[{id:'selected',latitude:53,longitude:13,label:'Gewählt'}]:[{id:'other',latitude:52,longitude:13,label:'Andere'}],selectedMarkerId:'selected'});return null;}
 const root=createRoot(document.createElement('div'));
 try{await act(async()=>root.render(<Probe present={false}/>));expect(open).not.toHaveBeenCalled();await act(async()=>root.render(<Probe present/>));expect(open).toHaveBeenCalledTimes(1);expect(map.panTo).toHaveBeenCalledWith({lat:53,lng:13});expect(setContent).toHaveBeenCalledWith('<strong>Gewählt</strong>');}finally{await act(async()=>root.unmount());}
});

it('refreshes the open selected popup after new GPS data without panning or reopening it',async()=>{
 (globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
 const open=vi.fn(),setContent=vi.fn();
 const map={panTo:vi.fn(),setCenter:vi.fn(),fitBounds:vi.fn()};
 const google={maps:{Marker:class{addListener(){}setPosition(){}setMap(){}},InfoWindow:class{setContent=setContent;open=open;close(){}},LatLngBounds:class{extend(){}}}} as unknown as GoogleMapsNamespace;
 function Probe({lat,html}:{lat:number;html:string}){useStableMapMarkers({map,google,markers:[{id:'selected',latitude:lat,longitude:13,label:'Gewählt',infoHtml:html}],selectedMarkerId:'selected'});return null;}
 const root=createRoot(document.createElement('div'));
 try{
  await act(async()=>root.render(<Probe lat={52} html="Position 10:00:00"/>));
  expect(setContent).toHaveBeenLastCalledWith('Position 10:00:00');
  await act(async()=>root.render(<Probe lat={53} html="Position 10:00:15"/>));
  expect(setContent).toHaveBeenLastCalledWith('Position 10:00:15');
  expect(open).toHaveBeenCalledTimes(1);expect(map.panTo).toHaveBeenCalledTimes(1);
  expect(map.setCenter).toHaveBeenCalledTimes(1);expect(map.fitBounds).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());}
});
