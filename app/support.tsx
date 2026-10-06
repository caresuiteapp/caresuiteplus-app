import {Linking,Pressable,Text,View} from 'react-native';
/** Native fallback for this new public web route; existing app screens stay intact. */
export default function PublicSupportLink() {
  return <View style={{flex:1,justifyContent:'center',padding:28,backgroundColor:'#091324'}}><Text style={{color:'#fff',fontSize:24,marginBottom:18}}>CareSuite HealthOS Support</Text><Text style={{color:'#bacce4',fontSize:16,lineHeight:25,marginBottom:24}}>Unser öffentliches Supportformular ist ohne Anmeldung erreichbar.</Text><Pressable onPress={()=>void Linking.openURL('https://www.caresuiteplus.app/support')} style={{padding:18,borderRadius:14,backgroundColor:'#126cff'}}><Text style={{color:'#fff',fontWeight:'700'}}>Öffentliches Supportformular öffnen</Text></Pressable></View>;
}
