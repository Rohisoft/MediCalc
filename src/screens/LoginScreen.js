import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../data/medicines';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  const handleLogin = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !password) return setError('Enter email and password');
    setError(''); setBusy(true);
    try { await login(e, password); }
    catch (err) { setError(err.message || 'Login failed — check credentials'); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.wrap}>

          <View style={s.hero}>
            <Text style={s.heroIcon}>💊</Text>
            <Text style={s.heroTitle}>MedicalC</Text>
            <Text style={s.heroSub}>Medical Store Management</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Sign in to your store</Text>

            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              placeholder="store@email.com"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onSubmitEditing={handleLogin}
            />

            {!!error && <Text style={s.error}>{error}</Text>}

            <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Sign in  →</Text>}
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>Powered by VRNDAI · vrndai.com</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.primary },
  wrap:      { flex: 1, justifyContent: 'center', padding: 24 },
  hero:      { alignItems: 'center', marginBottom: 32 },
  heroIcon:  { fontSize: 52, marginBottom: 10 },
  heroTitle: { fontSize: 28, fontWeight: '700', color: '#fff' },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card:      { backgroundColor: '#fff', borderRadius: 18, padding: 24,
               shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, elevation: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 22 },
  label:     { fontSize: 11, fontWeight: '600', color: COLORS.textMuted,
               textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:     { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
               padding: 12, fontSize: 15, marginBottom: 16, color: COLORS.text,
               backgroundColor: COLORS.bg },
  error:     { color: COLORS.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn:       { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14,
               alignItems: 'center', marginTop: 4 },
  btnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer:    { textAlign: 'center', marginTop: 28, color: 'rgba(255,255,255,0.45)', fontSize: 11 },
});
