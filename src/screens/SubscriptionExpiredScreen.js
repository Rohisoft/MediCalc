import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Linking, SafeAreaView, StatusBar,
} from 'react-native';
import { COLORS } from '../data/medicines';
import { useAuth } from '../auth/AuthContext';

export default function SubscriptionExpiredScreen() {
  const { tenant, logout } = useAuth();

  const callSamrath = () => Linking.openURL('tel:8878069736');
  const whatsappSamrath = () => {
    const msg = encodeURIComponent(
      `Hi Samrath, I need to renew my MedicalC subscription for ${tenant?.shop_name || 'my store'}.`
    );
    Linking.openURL(`https://wa.me/918878069736?text=${msg}`);
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      <View style={s.container}>
        <Text style={s.icon}>🔒</Text>
        <Text style={s.title}>Subscription Expired</Text>
        <Text style={s.sub}>
          Your subscription for{'\n'}
          <Text style={s.shopName}>{tenant?.shop_name || 'your store'}</Text>
          {'\n'}has expired. Contact Samrath to renew.
        </Text>

        <View style={s.card}>
          <Text style={s.cardLabel}>Renew your plan</Text>
          <Text style={s.ownerName}>Samrath Panchal</Text>

          <TouchableOpacity style={s.callBtn} onPress={callSamrath}>
            <Text style={s.callBtnText}>📞  Call  8878069736</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.waBtn} onPress={whatsappSamrath}>
            <Text style={s.waBtnText}>💬  WhatsApp Samrath</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={s.watermark}>Powered by VRNDAI · vrndai.com</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#fff' },
  container:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  icon:       { fontSize: 72, marginBottom: 16 },
  title:      { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  sub:        { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  shopName:   { fontWeight: '700', color: COLORS.text },
  card:       { backgroundColor: COLORS.bg, borderRadius: 16, padding: 24, alignItems: 'center',
                width: '100%', borderWidth: 1, borderColor: COLORS.border },
  cardLabel:  { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase',
                letterSpacing: 0.5, marginBottom: 6 },
  ownerName:  { fontSize: 19, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  callBtn:    { width: '100%', backgroundColor: COLORS.primary, borderRadius: 10,
                padding: 13, alignItems: 'center', marginBottom: 10 },
  callBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  waBtn:      { width: '100%', backgroundColor: '#25D366', borderRadius: 10,
                padding: 13, alignItems: 'center' },
  waBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutBtn:  { marginTop: 28 },
  logoutText: { color: COLORS.textMuted, fontSize: 13 },
  watermark:  { position: 'absolute', bottom: 16, fontSize: 10, color: COLORS.border, letterSpacing: 0.5 },
});
