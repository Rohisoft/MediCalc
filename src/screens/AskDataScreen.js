import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { COLORS } from '../data/medicines';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { buildDataSummary } from '../utils/dataSummary';

const SUGGESTIONS = [
  "What's losing me money?",
  'What should I stock more of?',
  'Which customers owe me the most?',
];

export default function AskDataScreen({ navigation }) {
  const { state } = useStore();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dataSummary = useMemo(
    () => buildDataSummary(state.medicines, state.bills, state.customers),
    [state.medicines, state.bills, state.customers],
  );

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (!text || busy) return;
    setBusy(true); setError(''); setAnswer('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ask-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ question: text, dataSummary }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Something went wrong. Try again.');
      } else {
        setAnswer(json.answer || '');
      }
    } catch (e) {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>✨ Ask Your Data</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <Text style={s.label}>Ask a question about your shop</Text>
        <TextInput
          style={s.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="e.g. What's losing me money?"
          placeholderTextColor={COLORS.textMuted}
          multiline
          onSubmitEditing={() => ask()}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {SUGGESTIONS.map((sug) => (
            <TouchableOpacity key={sug} style={s.chip} onPress={() => { setQuestion(sug); ask(sug); }}>
              <Text style={s.chipText}>{sug}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[s.askBtn, busy && { opacity: 0.6 }]} onPress={() => ask()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.askBtnText}>Ask</Text>}
        </TouchableOpacity>

        {!!error && (
          <View style={s.errorBox}><Text style={s.errorText}>⚠️ {error}</Text></View>
        )}

        {!!answer && (
          <View style={s.answerBox}>
            <Text style={s.answerText}>{answer}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.primary },
  topbar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { color: '#fff', fontSize: 13, width: 44 },
  title:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll:      { flex: 1, backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  label:       { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.white, minHeight: 70, textAlignVertical: 'top' },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipText:    { fontSize: 12, color: COLORS.textMuted },
  askBtn:      { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  askBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorBox:    { backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 14, marginTop: 16 },
  errorText:   { color: COLORS.danger, fontSize: 13 },
  answerBox:   { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 0.5, borderColor: COLORS.border },
  answerText:  { fontSize: 14, color: COLORS.text, lineHeight: 21 },
});
