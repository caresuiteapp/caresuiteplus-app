import {useState} from 'react';
import {Text,View} from 'react-native';
import {FilterChipGroup,PremiumButton,PremiumInput} from '@/components/ui';
import {useTreatmentCorrectionStyles} from './TreatmentCorrectionScreen.web';
/** Search within the fully loaded accessible source set; paging here affects display only. */
export function SourcePicker({label,rows,value,onChange,disabled}:{label:string;rows:{id:string;label:string}[];value:string;onChange:(v:string)=>void;disabled:boolean}){
 const [search,setSearch]=useState(''),[count,setCount]=useState(20),styles=useTreatmentCorrectionStyles(),filtered=rows.filter(r=>r.label.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))),selected=rows.find(r=>r.id===value);
 return <View style={styles.group}><PremiumInput label={`${label} suchen`} accessibilityLabel={`${label} suchen`} value={search} onChangeText={v=>{setSearch(v);setCount(20);}} editable={!disabled}/><Text style={styles.body}>{rows.length} zugängliche Quellen · {filtered.length} Suchtreffer{selected?` · ausgewählt: ${selected.label}`:''}</Text><FilterChipGroup wrap options={filtered.slice(0,count).map(r=>({key:r.id,label:r.label}))} value={value} onChange={disabled?undefined:onChange}/>{count<filtered.length?<PremiumButton title="Weitere Quellen anzeigen" variant="secondary" disabled={disabled} onPress={()=>setCount(n=>n+20)}/>:null}</View>;
}
