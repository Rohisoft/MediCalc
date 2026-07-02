import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  StyleSheet, SafeAreaView, StatusBar, Alert, ActivityIndicator, Clipboard,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../data/medicines';

const PLANS = ['starter', 'pro', 'unlimited'];
const PLAN_PRICE = { starter: '₹299/mo', pro: '₹599/mo', unlimited: '₹999/mo' };

function genInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function daysBetween(a, b = new Date()) {
  return Math.ceil((new Date(a) - b) / 86_400_000);
}

function subColor(t) {
  const d = daysBetween(t.subscription_end);
  if (t.status === 'suspended') return '#ef4444';
  if (d <= 0)  return '#ef4444';
  if (d <= 7)  return '#f59e0b';
  return COLORS.primary;
}
function subLabel(t) {
  if (t.status === 'suspended') return 'Suspended';
  const d = daysBetween(t.subscription_end);
  if (d <= 0) return 'Expired';
  return `${d} day${d !== 1 ? 's' : ''} left`;
}

export default function AdminScreen() {
  const { logout } = useAuth();
  const [tenants,    setTenants]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [showManage, setShowManage] = useState(null); // tenant object
  const [inviteLink, setInviteLink] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    setTenants(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const activeCount  = tenants.filter(t => daysBetween(t.subscription_end) > 0 && t.status === 'active').length;
  const expiredCount = tenants.filter(t => daysBetween(t.subscription_end) <= 0 || t.status === 'suspended').length;
  const totalRevenue = tenants.filter(t => t.plan !== 'starter')
    .reduce((s, t) => s + (t.plan === 'pro' ? 599 : 999), 0);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={s.topbar}>
        <View>
          <Text style={s.topTitle}>⚙️  Admin Panel</Text>
          <Text style={s.topSub}>Samrath Panchal</Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statVal}>{tenants.length}</Text><Text style={s.statLabel}>Total Clients</Text></View>
        <View style={s.stat}><Text style={[s.statVal, { color: COLORS.primary }]}>{activeCount}</Text><Text style={s.statLabel}>Active</Text></View>
        <View style={s.stat}><Text style={[s.statVal, { color: '#ef4444' }]}>{expiredCount}</Text><Text style={s.statLabel}>Expired</Text></View>
        <View style={s.stat}><Text style={[s.statVal, { color: '#7c3aed' }]}>₹{totalRevenue}</Text><Text style={s.statLabel}>Monthly</Text></View>
      </View>

      <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
        <Text style={s.addBtnText}>＋  Add New Client</Text>
      </TouchableOpacity>

      {loading
        ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
            {tenants.map(t => (
              <TouchableOpacity key={t.id} style={s.tenantCard} onPress={() => setShowManage(t)}>
                <View style={s.tenantLeft}>
                  <Text style={s.tenantName}>{t.shop_name}</Text>
                  <Text style={s.tenantOwner}>{t.owner_name} · {t.phone}</Text>
                  <Text style={s.tenantPlan}>{t.plan.toUpperCase()} · {PLAN_PRICE[t.plan]}</Text>
                </View>
                <View style={[s.subBadge, { backgroundColor: subColor(t) + '18' }]}>
                  <Text style={[s.subBadgeText, { color: subColor(t) }]}>{subLabel(t)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      }

      {!!inviteLink && (
        <View style={s.inviteBanner}>
          <Text style={s.inviteTitle}>✅ Client created! Share this invite link:</Text>
          <Text style={s.inviteUrl} numberOfLines={2}>{inviteLink}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity style={s.copyBtn} onPress={() => {
              if (navigator?.clipboard) navigator.clipboard.writeText(inviteLink);
              else Clipboard.setString(inviteLink);
              Alert.alert('Copied!', 'Invite link copied to clipboard.');
            }}>
              <Text style={s.copyBtnText}>📋 Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.copyBtn, { backgroundColor: '#25D366' }]} onPress={() => {
              const msg = encodeURIComponent(`Here is your MedicalC app invite link:\n${inviteLink}\n\nTap to register and start using your store.`);
              if (typeof window !== 'undefined') window.open(`https://wa.me/?text=${msg}`, '_blank');
            }}>
              <Text style={s.copyBtnText}>💬 Send via WhatsApp</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setInviteLink('')} style={{ marginTop: 8 }}>
            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      <AddClientModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={(link) => { setInviteLink(link); setShowAdd(false); fetch(); }}
      />

      {!!showManage && (
        <ManageTenantModal
          tenant={showManage}
          onClose={() => setShowManage(null)}
          onSaved={() => { setShowManage(null); fetch(); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Add Client Modal ─────────────────────────────────────────
function AddClientModal({ visible, onClose, onCreated }) {
  const [form, setForm] = useState({ shopName: '', ownerName: '', address: '', phone: '', plan: 'starter', months: '1' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.shopName.trim() || !form.ownerName.trim()) return Alert.alert('Required', 'Shop name and owner name are required.');
    setBusy(true);
    try {
      const inviteCode = genInviteCode();
      const subEnd = new Date();
      subEnd.setMonth(subEnd.getMonth() + (parseInt(form.months) || 1));

      const { error } = await supabase.from('tenants').insert({
        shop_name:        form.shopName.trim(),
        owner_name:       form.ownerName.trim(),
        address:          form.address.trim(),
        phone:            form.phone.trim(),
        plan:             form.plan,
        status:           'pending',
        subscription_end: subEnd.toISOString(),
        invite_code:      inviteCode,
      });
      if (error) throw error;

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://vrndai.com';
      onCreated(`${baseUrl}/?code=${inviteCode}`);
      setForm({ shopName: '', ownerName: '', address: '', phone: '', plan: 'starter', months: '1' });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={m.safe}>
        <View style={m.header}>
          <Text style={m.title}>New Client</Text>
          <TouchableOpacity onPress={onClose}><Text style={m.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 16 }}>
          {[
            ['shopName',  'Shop Name *',   'Sahdev Medical Center', 'default'],
            ['ownerName', 'Owner Name *',  'Milan Roy',             'words'],
            ['address',   'Address',       'City, State',           'default'],
            ['phone',     'Phone',         '9876543210',            'phone-pad'],
          ].map(([key, label, ph, kb]) => (
            <View key={key} style={{ marginBottom: 14 }}>
              <Text style={m.label}>{label}</Text>
              <TextInput style={m.input} placeholder={ph} placeholderTextColor={COLORS.textMuted}
                value={form[key]} onChangeText={v => set(key, v)} keyboardType={kb} />
            </View>
          ))}

          <Text style={m.label}>Plan</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {PLANS.map(p => (
              <TouchableOpacity key={p} onPress={() => set('plan', p)}
                style={[m.planChip, form.plan === p && m.planChipActive]}>
                <Text style={[m.planChipText, form.plan === p && { color: '#fff' }]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}{'\n'}{PLAN_PRICE[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Subscription Duration (months)</Text>
          <TextInput style={m.input} value={form.months} onChangeText={v => set('months', v)} keyboardType="number-pad" />

          <TouchableOpacity style={m.submitBtn} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={m.submitText}>Create Client & Generate Invite →</Text>}
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Manage Tenant Modal ──────────────────────────────────────
function ManageTenantModal({ tenant, onClose, onSaved }) {
  const [months,     setMonths]     = useState('1');
  const [busy,       setBusy]       = useState(false);
  const [inviteCode, setInviteCode] = useState(tenant.invite_code || '');
  const [copied,     setCopied]     = useState(false);
  const dLeft = daysBetween(tenant.subscription_end);

  const baseUrl    = typeof window !== 'undefined' ? window.location.origin : 'https://vrndai.com';
  const inviteLink = inviteCode ? `${baseUrl}/?code=${inviteCode}` : '';

  const copyLink = () => {
    if (!inviteLink) return;
    if (navigator?.clipboard) navigator.clipboard.writeText(inviteLink);
    else Clipboard.setString(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Here is your MedicalC app invite link:\n${inviteLink}\n\nTap to register and start using your store.`);
    if (typeof window !== 'undefined') window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const regenerateLink = async () => {
    if (!window.confirm('Generate a new invite link? The old link will stop working.')) return;
    const newCode = genInviteCode();
    const { error } = await supabase.from('tenants').update({ invite_code: newCode }).eq('id', tenant.id);
    if (error) return alert('Error: ' + error.message);
    setInviteCode(newCode);
    setCopied(false);
  };

  const extend = async () => {
    setBusy(true);
    try {
      const base = dLeft > 0 ? new Date(tenant.subscription_end) : new Date();
      base.setMonth(base.getMonth() + (parseInt(months) || 1));
      const { error } = await supabase.from('tenants').update({
        subscription_end: base.toISOString(),
        status: 'active',
      }).eq('id', tenant.id);
      if (error) throw error;
      alert(`Subscription extended by ${months} month(s).`);
      onSaved();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setBusy(false); }
  };

  const toggleSuspend = async () => {
    const newStatus = tenant.status === 'suspended' ? 'active' : 'suspended';
    const { error } = await supabase.from('tenants').update({ status: newStatus }).eq('id', tenant.id);
    if (error) return alert('Error: ' + error.message);
    onSaved();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={m.safe}>
        <View style={m.header}>
          <Text style={m.title}>{tenant.shop_name}</Text>
          <TouchableOpacity onPress={onClose}><Text style={m.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 16 }}>
          <View style={m.infoRow}><Text style={m.infoLabel}>Owner</Text><Text style={m.infoVal}>{tenant.owner_name}</Text></View>
          <View style={m.infoRow}><Text style={m.infoLabel}>Phone</Text><Text style={m.infoVal}>{tenant.phone || '—'}</Text></View>
          <View style={m.infoRow}><Text style={m.infoLabel}>Plan</Text><Text style={m.infoVal}>{tenant.plan.toUpperCase()} · {PLAN_PRICE[tenant.plan]}</Text></View>
          <View style={m.infoRow}><Text style={m.infoLabel}>Status</Text><Text style={[m.infoVal, { color: subColor(tenant) }]}>{subLabel(tenant)}</Text></View>
          <View style={m.infoRow}><Text style={m.infoLabel}>Expires</Text><Text style={m.infoVal}>{new Date(tenant.subscription_end).toLocaleDateString('en-IN')}</Text></View>

          {/* Invite link section */}
          <View style={m.inviteSection}>
            <Text style={m.inviteSectionTitle}>🔗 Invite Link</Text>
            <Text style={m.inviteUrl} numberOfLines={2} selectable>{inviteLink || 'No invite code'}</Text>
            <View style={m.inviteActions}>
              <TouchableOpacity style={[m.inviteBtn, copied && { backgroundColor: '#1565C0' }]} onPress={copyLink}>
                <Text style={m.inviteBtnText}>{copied ? '✅ Copied!' : '📋 Copy'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.inviteBtn, { backgroundColor: '#25D366' }]} onPress={shareWhatsApp}>
                <Text style={m.inviteBtnText}>💬 WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.inviteBtn, { backgroundColor: '#6b7280' }]} onPress={regenerateLink}>
                <Text style={m.inviteBtnText}>🔄 New Link</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[m.label, { marginTop: 8 }]}>Extend subscription by (months)</Text>
          <TextInput style={m.input} value={months} onChangeText={setMonths} keyboardType="number-pad" />
          <TouchableOpacity style={m.submitBtn} onPress={extend} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={m.submitText}>Extend Subscription</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[m.submitBtn, { backgroundColor: tenant.status === 'suspended' ? COLORS.primary : '#ef4444', marginTop: 12 }]}
            onPress={toggleSuspend}
          >
            <Text style={m.submitText}>
              {tenant.status === 'suspended' ? '✅  Reactivate Account' : '🚫  Suspend Account'}
            </Text>
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.bg },
  topbar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12 },
  topTitle:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  topSub:        { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  logoutBtn:     { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  logoutText:    { color: '#fff', fontSize: 12 },
  statsRow:      { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 16,
                   borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  stat:          { flex: 1, alignItems: 'center' },
  statVal:       { fontSize: 22, fontWeight: '700', color: COLORS.text },
  statLabel:     { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  addBtn:        { margin: 16, backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
  addBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  tenantCard:    { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row',
                   alignItems: 'center', justifyContent: 'space-between',
                   borderWidth: 0.5, borderColor: COLORS.border },
  tenantLeft:    { flex: 1 },
  tenantName:    { fontSize: 14, fontWeight: '700', color: COLORS.text },
  tenantOwner:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  tenantPlan:    { fontSize: 11, color: COLORS.primary, marginTop: 4, fontWeight: '600' },
  subBadge:      { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  subBadgeText:  { fontSize: 12, fontWeight: '700' },
  inviteBanner:  { backgroundColor: '#EFF8FF', borderTopWidth: 1, borderTopColor: '#BBDEFB',
                   padding: 16, alignItems: 'center' },
  inviteTitle:   { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 6 },
  inviteUrl:     { fontSize: 12, color: COLORS.text, backgroundColor: '#fff',
                   borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border,
                   width: '100%', textAlign: 'center' },
  copyBtn:       { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  copyBtnText:   { color: '#fff', fontSize: 12, fontWeight: '600' },
});

const m = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#fff' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                 paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  title:       { fontSize: 17, fontWeight: '700', color: COLORS.text },
  close:       { fontSize: 18, color: COLORS.textMuted, padding: 4 },
  label:       { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase',
                 letterSpacing: 0.5, marginBottom: 6 },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12,
                 fontSize: 15, marginBottom: 4, color: COLORS.text, backgroundColor: COLORS.bg },
  planChip:    { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
                 padding: 10, alignItems: 'center' },
  planChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  planChipText:{ fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  submitBtn:   { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
  submitText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
                      borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  infoLabel:        { fontSize: 13, color: COLORS.textMuted },
  infoVal:          { fontSize: 13, fontWeight: '600', color: COLORS.text },
  inviteSection:    { backgroundColor: '#EFF8FF', borderRadius: 12, padding: 14, marginTop: 20, marginBottom: 4 },
  inviteSectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inviteUrl:        { fontSize: 12, color: COLORS.text, backgroundColor: '#fff', borderRadius: 8,
                      padding: 10, borderWidth: 1, borderColor: '#BBDEFB', marginBottom: 10 },
  inviteActions:    { flexDirection: 'row', gap: 8 },
  inviteBtn:        { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  inviteBtnText:    { color: '#fff', fontSize: 11, fontWeight: '600' },
});
