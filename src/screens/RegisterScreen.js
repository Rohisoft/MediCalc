import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../data/medicines';

export default function RegisterScreen({ inviteCode }) {
  const { refreshTenant } = useAuth();
  const [tenantInfo, setTenantInfo] = useState(null);
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [error,      setError]      = useState('');
  const [busy,       setBusy]       = useState(false);
  const [codeError,  setCodeError]  = useState('');

  useEffect(() => {
    if (!inviteCode) { setCodeError('No invite code found in the URL.'); return; }
    supabase.rpc('get_tenant_by_invite', { code: inviteCode })
      .then(({ data, error: e }) => {
        if (e || !data?.length) setCodeError('Invalid or expired invite link. Contact Samrath.');
        else setTenantInfo(data[0]);
      });
  }, [inviteCode]);

  const handleRegister = async () => {
    if (!email.trim() || !password) return setError('Enter email and password');
    if (password.length < 6)        return setError('Password must be at least 6 characters');
    if (password !== confirm)        return setError('Passwords do not match');

    setError(''); setBusy(true);
    try {
      // Create auth user
      const { data: { user }, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signUpErr) throw signUpErr;
      if (!user) throw new Error('Account creation failed. Try again.');

      // Claim invite — creates user_profile and links to tenant
      const { error: claimErr } = await supabase.rpc('claim_invite', {
        code: inviteCode,
        user_id: user.id,
      });
      if (claimErr) throw claimErr;
      // Profile now exists — reload it so App.js routes correctly
      await refreshTenant();
    } catch (err) {
      setError(err.message || 'Registration failed. Contact Samrath.');
      setBusy(false);
    }
  };

  if (codeError) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.wrap}>
          <Text style={s.heroIcon}>🔗</Text>
          <Text style={s.errorTitle}>Invalid Invite Link</Text>
          <Text style={s.errorMsg}>{codeError}</Text>
          <Text style={s.contact}>Contact Samrath Panchal · 8878069736</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tenantInfo) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.wrap}><ActivityIndicator color="#fff" size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.wrap}>
          <View style={s.hero}>
            <Text style={s.heroIcon}>💊</Text>
            <Text style={s.heroTitle}>MedicalC Setup</Text>
            <Text style={s.heroSub}>Setting up for {tenantInfo.shop_name}</Text>
          </View>

          <View style={s.card}>
            <View style={s.shopBadge}>
              <Text style={s.shopBadgeText}>🏥 {tenantInfo.shop_name}</Text>
              <Text style={s.shopPlan}>{tenantInfo.plan.toUpperCase()} plan</Text>
            </View>

            <Text style={s.cardTitle}>Create your account</Text>

            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input} placeholder="your@email.com"
              placeholderTextColor={COLORS.textMuted}
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />

            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input} placeholder="At least 6 characters"
              placeholderTextColor={COLORS.textMuted}
              value={password} onChangeText={setPassword} secureTextEntry
            />

            <Text style={s.label}>Confirm Password</Text>
            <TextInput
              style={s.input} placeholder="Re-enter password"
              placeholderTextColor={COLORS.textMuted}
              value={confirm} onChangeText={setConfirm} secureTextEntry
            />

            {!!error && <Text style={s.error}>{error}</Text>}

            <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Create Account  →</Text>}
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>Powered by VRNDAI · vrndai.com</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.primary },
  wrap:        { flex: 1, justifyContent: 'center', padding: 24 },
  hero:        { alignItems: 'center', marginBottom: 24 },
  heroIcon:    { fontSize: 48, marginBottom: 8 },
  heroTitle:   { fontSize: 26, fontWeight: '700', color: '#fff' },
  heroSub:     { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card:        { backgroundColor: '#fff', borderRadius: 18, padding: 24,
                 shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, elevation: 6 },
  shopBadge:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                 backgroundColor: '#EFF8FF', borderRadius: 10, padding: 12, marginBottom: 20 },
  shopBadgeText:{ fontSize: 13, fontWeight: '600', color: COLORS.primary },
  shopPlan:    { fontSize: 11, fontWeight: '700', color: COLORS.primary,
                 backgroundColor: '#BBDEFB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardTitle:   { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  label:       { fontSize: 11, fontWeight: '600', color: COLORS.textMuted,
                 textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
                 padding: 12, fontSize: 15, marginBottom: 14, color: COLORS.text,
                 backgroundColor: COLORS.bg },
  error:       { color: COLORS.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn:         { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14,
                 alignItems: 'center', marginTop: 4 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  errorTitle:  { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 12 },
  errorMsg:    { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 20 },
  contact:     { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  footer:      { textAlign: 'center', marginTop: 24, color: 'rgba(255,255,255,0.4)', fontSize: 11 },
});
