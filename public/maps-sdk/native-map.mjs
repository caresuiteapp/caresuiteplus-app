import * as sdk from './maplibre-gl.mjs';
sdk.setWorkerUrl(new URL('./maplibre-gl-worker.mjs',import.meta.url).href);
const map=new sdk.Map({container:'map',style:'https://tiles.openfreemap.org/styles/bright',center:[7.5,51.5],zoom:13});
map.addControl(new sdk.NavigationControl(),'top-right');
const markers=new Map(); let lineIds=[]; let fitted=null; let latest;
const valid=p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
const pair=p=>[p.longitude,p.latitude];
const notify=data=>window.ReactNativeWebView?.postMessage(JSON.stringify(data));
function update(data){
 latest=data;if(!map.isStyleLoaded())return;
 const rows=(data.markers??[]).filter(valid);const keep=new Set(rows.map(r=>r.id));
 for(const [id,marker] of markers)if(!keep.has(id)){marker.remove();markers.delete(id);}
 for(const row of rows){let marker=markers.get(row.id);if(!marker){const el=document.createElement('button');el.type='button';el.className='marker';el.onclick=()=>notify({type:'select',id:row.id});marker=new sdk.Marker({element:el}).setLngLat(pair(row)).addTo(map);markers.set(row.id,marker);}marker.setLngLat(pair(row));marker.getElement().title=row.label;marker.getElement().setAttribute('aria-label',row.label);marker.getElement().classList.toggle('selected',row.id===data.selectedMarkerId);}
 for(const id of lineIds){if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);}lineIds=[];
 function line(points,color,dashed){const coords=points.filter(valid).map(pair);if(coords.length<2)return;const id=`route-${lineIds.length}`;lineIds.push(id);map.addSource(id,{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}});map.addLayer({id,type:'line',source:id,layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':color,'line-width':5,...(dashed?{'line-dasharray':[2,2]}:{})}});}
 for(const segment of data.segments??[])line(segment,'#0B63F3',false);line(data.planned??[],'#E88718',true);
 const points=[...rows,...(data.segments??[]).flat(),...(data.planned??[])].filter(valid);const identity=data.routeIdentity??rows.map(r=>r.id).join('|');
 if(points.length&&fitted!==identity){const bounds=new sdk.LngLatBounds();points.forEach(p=>bounds.extend(pair(p)));map.fitBounds(bounds,{padding:46,maxZoom:15,duration:0});fitted=identity;}
 document.getElementById('error').hidden=true;
}
window.careSuiteUpdateMap=update;
map.on('load',()=>{if(latest)update(latest);notify({type:'ready'});});
map.on('error',()=>{document.getElementById('error').hidden=false;notify({type:'error'});});
notify({type:'initialized'});
