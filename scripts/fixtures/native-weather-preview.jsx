import React,{useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {DesktopWeatherLocationDialog} from '../../src/liquid-command/screens/DesktopWeatherLocationDialog.native.tsx';

/** The actual native dialog with a local async save; no device location or network. */
export function WeatherPreview(){
 const [visible,setVisible]=useState(true),[notice,setNotice]=useState('');
 const [place,setPlace]=useState({postcode:'44628',name:'Herne',region:'Nordrhein-Westfalen',district:'Reg.-Bez. Arnsberg',latitude:51.55,longitude:7.2167});
 const choose=async next=>{await Promise.resolve();setPlace(next);setNotice(next?`${next.postcode} ${next.name} als Wetterort ausgewählt.`:'Automatischer Standort ausgewählt.');return true;};
 return <View style={{flex:1,minHeight:0,padding:20,gap:14,backgroundColor:'#071629'}}>
  <Text style={{fontSize:22,color:'#eef8ff'}}>Standortwetter</Text><Text accessibilityLiveRegion="polite" style={{fontSize:16,color:'#b8d7ee'}}>{notice}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Wetterort ändern" onPress={()=>setVisible(true)} style={{padding:14,borderWidth:1,borderColor:'#4a829f',borderRadius:14,alignSelf:'flex-start'}}><Text style={{fontSize:16,color:'#eef8ff'}}>Wetterort ändern</Text></Pressable>
  <DesktopWeatherLocationDialog visible={visible} place={place} preferenceError={null} onChoose={choose} onClose={()=>setVisible(false)}/>
 </View>;
}
