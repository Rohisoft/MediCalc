import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, TextInput, Alert, Modal,
} from 'react-native';
import { COLORS } from '../data/medicines';
import { useAuth } from '../auth/AuthContext';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const { user, profile, tenant, logout, refreshTenant } = useAuth();
  const { state, dispatch } = useStore();
  const settings = state.settings;

  const [showEdit, setShowEdit] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({
    shopName:  settings.shopName  || '',
    ownerName: settings.ownerName || '',
    address:   settings.address   || '',
    phone:     settings.phone     || '',
    gstNumber: settings.gstNumber || '',
  });

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const openEdit = () => {
    setForm({
      shopName:  settings.shopName  || '',
      ownerName: settings.ownerName || '',
      address:   settings.address   || '',
      phone:     settings.phone     || '',
      gstNumber: settings.gstNumber || '',
    });
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!form.shopName.trim()) {
      Alert.alert('Required', 'Shop name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      dispatch({ type: 'UPDATE_SETTINGS', settings: form });

      if (tenant?.id) {
        await supabase.from('tenants').update({
          shop_name:  form.shopName.trim(),
          owner_name: form.ownerName.trim(),
          address:    form.address.trim(),
          phone:      form.phone.trim(),
          gst_number: form.gstNumber.trim(),
        }).eq('id', tenant.id);
        await refreshTenant();
      }
      setShowEdit(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    // Alert.alert multi-button is a no-op on web; use window.confirm instead
    if (typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to sign out?')) logout();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]);
    }
  };

  const subStatus  = profile?.role === 'superadmin' ? 'active'
    : tenant?.status === 'suspended' ? 'suspended'
    : !tenant?.subscription_end ? 'unknown'
    : Math.ceil((new Date(tenant.subscription_end) - new Date()) / 86400000) <= 0 ? 'expired'
    : 'active';

  const daysLeft = tenant?.subscription_end
    ? Math.ceil((new Date(tenant.subscription_end) - new Date()) / 86400000)
    : null;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={s.topbar}>
        <Text style={s.title}>👤 My Profile</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Shop Info Card */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>🏥 Shop Information</Text>
            <TouchableOpacity style={s.editBtn} onPress={openEdit}>
              <Text style={s.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={s.card}>
            <InfoRow label="Shop Name"   value={settings.shopName  || '—'} />
            <InfoRow label="Owner Name"  value={settings.ownerName || '—'} />
            <InfoRow label="Address"     value={settings.address   || '—'} />
            <InfoRow label="Phone"       value={settings.phone     || '—'} />
            <InfoRow label="GST Number"  value={settings.gstNumber || '—'} last />
          </View>
        </View>

        {/* Account Card */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🔐 Account</Text>
          <View style={s.card}>
            <InfoRow label="Email"  value={user?.email || '—'} />
            <InfoRow label="Role"   value={profile?.role === 'superadmin' ? 'Super Admin' : profile?.role === 'owner' ? 'Owner' : 'Staff'} last />
          </View>
        </View>

        {/* Subscription Card */}
        {profile?.role !== 'superadmin' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>📋 Subscription</Text>
            <View style={s.card}>
              <InfoRow label="Plan"   value={tenant?.plan ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1) : '—'} />
              <InfoRow label="Status" value={
                subStatus === 'active'    ? '✅ Active' :
                subStatus === 'suspended' ? '🚫 Suspended' :
                subStatus === 'expired'   ? '❌ Expired' : '—'
              } />
              {daysLeft !== null && (
                <InfoRow
                  label="Expires"
                  value={daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` : 'Expired'}
                  valueColor={daysLeft <= 7 ? COLORS.danger : daysLeft <= 30 ? COLORS.warning : COLORS.primary}
                  last
                />
              )}
            </View>
            {daysLeft !== null && daysLeft <= 30 && (
              <View style={s.renewBanner}>
                <Text style={s.renewText}>⚠️ Subscription expiring soon — contact Samrath to renew</Text>
                <Text style={s.renewContact}>📞 8878069736</Text>
              </View>
            )}
          </View>
        )}

        {/* Logout */}
        <View style={s.section}>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>⏻  Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Watermark */}
        <View style={{ alignItems: 'center', paddingBottom: 24 }}>
          <Text style={{ fontSize: 10, color: COLORS.border, letterSpacing: 0.3 }}>Powered by VRNDAI · vrndai.com</Text>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <View style={m.overlay}>
          <ScrollView>
            <View style={m.sheet}>
              <View style={m.sheetHeader}>
                <Text style={m.sheetTitle}>Edit Shop Details</Text>
                <TouchableOpacity onPress={() => setShowEdit(false)}>
                  <Text style={{ color: COLORS.textMuted, fontSize: 22 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={m.label}>Shop Name *</Text>
              <TextInput style={m.input} value={form.shopName} onChangeText={set('shopName')} placeholder="e.g. Sahdev Medical Center" placeholderTextColor={COLORS.textMuted} />

              <Text style={m.label}>Owner Name</Text>
              <TextInput style={m.input} value={form.ownerName} onChangeText={set('ownerName')} placeholder="e.g. Milan Roy" placeholderTextColor={COLORS.textMuted} />

              <Text style={m.label}>Address</Text>
              <TextInput style={m.input} value={form.address} onChangeText={set('address')} placeholder="Shop address" placeholderTextColor={COLORS.textMuted} multiline numberOfLines={2} />

              <Text style={m.label}>Phone Number</Text>
              <TextInput style={m.input} value={form.phone} onChangeText={set('phone')} placeholder="10-digit mobile number" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />

              <Text style={m.label}>GST Number</Text>
              <TextInput style={m.input} value={form.gstNumber} onChangeText={set('gstNumber')} placeholder="e.g. 23ABCDE1234F1Z5" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={m.cancelBtn} onPress={() => setShowEdit(false)}>
                  <Text style={{ color: COLORS.textMuted, fontWeight: '500' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[m.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, valueColor, last }) {
  return (
    <View style={[r.row, last && r.rowLast]}>
      <Text style={r.label}>{label}</Text>
      <Text style={[r.value, valueColor && { color: valueColor }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.primary },
  topbar:       { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14 },
  title:        { color: '#fff', fontSize: 18, fontWeight: '700' },
  scroll:       { flex: 1, backgroundColor: COLORS.bg },
  section:      { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  card:         { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  editBtn:      { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnText:  { color: '#fff', fontSize: 12, fontWeight: '600' },
  renewBanner:  { backgroundColor: COLORS.warningLight, borderRadius: 10, padding: 12, marginTop: 10 },
  renewText:    { fontSize: 12, color: '#92400e', fontWeight: '500' },
  renewContact: { fontSize: 12, color: '#92400e', fontWeight: '700', marginTop: 4 },
  logoutBtn:    { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.danger, padding: 15, alignItems: 'center' },
  logoutText:   { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
});

const r = StyleSheet.create({
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  rowLast: { borderBottomWidth: 0 },
  label:   { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  value:   { fontSize: 13, fontWeight: '500', color: COLORS.text, flex: 2, textAlign: 'right' },
});

const m = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 17, fontWeight: '700', color: COLORS.text },
  label:       { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.bg },
  cancelBtn:   { flex: 1, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  saveBtn:     { flex: 2, backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
});
