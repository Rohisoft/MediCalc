import React, { useState, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, TextInput, SafeAreaView,
} from 'react-native';
import { COLORS } from '../data/medicines';
import { fuzzyMatch } from '../utils/fuzzyMatch';
import { parseVoiceText } from '../utils/parseVoiceText';
import { supabase } from '../lib/supabase';

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

async function runAIParse(transcript) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/parse-voice-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({ transcript }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error || 'AI Parse failed. Try again.');
  }
  return json.items || [];
}

export default function VoiceBillModal({ visible, onClose, medicines, onConfirm }) {
  const [stage,    setStage]    = useState('idle'); // idle | listening | processing | review
  const [liveText, setLiveText] = useState('');
  const [finalText,setFinalText]= useState('');
  const [items,    setItems]    = useState([]);
  const [error,    setError]    = useState('');
  const [useAI,    setUseAI]    = useState(false);
  const recognitionRef = useRef(null);

  const reset = () => {
    setStage('idle'); setLiveText(''); setFinalText('');
    setItems([]); setError('');
  };
  const handleClose = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
    reset(); onClose();
  };

  const processTranscript = async (text) => {
    setStage('processing');
    try {
      let parsed;
      if (useAI) {
        const raw = await runAIParse(text);
        parsed = raw.map((r, i) => ({
          id: i, name: r.name, qty: String(Math.max(1, r.qty || 1)),
          match: fuzzyMatch(r.name, medicines), included: true,
        }));
      } else {
        parsed = parseVoiceText(text, medicines).map((r) => ({ ...r, qty: String(r.qty), included: true }));
      }
      setItems(parsed);
      setStage('review');
    } catch (err) {
      setError(String(err.message || err));
      setStage('idle');
    }
  };

  const startListening = () => {
    setError('');
    if (!SpeechRecognitionAPI) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalTranscript = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t + ' ';
        else interim += t;
      }
      setLiveText(interim);
      if (finalTranscript) setFinalText(finalTranscript.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        setError("Didn't catch that — try again, speak clearly.");
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Allow mic access in your browser settings.');
      } else {
        setError('Voice recognition error: ' + event.error);
      }
      setStage('idle');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (finalTranscript.trim()) {
        processTranscript(finalTranscript.trim());
      } else {
        setError("Didn't catch anything — try again.");
        setStage('idle');
      }
    };

    recognitionRef.current = recognition;
    setStage('listening');
    setLiveText(''); setFinalText('');
    // Called synchronously inside this tap handler — Chrome/Safari require a
    // direct user gesture to grant microphone access, same constraint that
    // affects the file-picker buttons in ScanBillModal.
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
  };

  const updateItem = (id, key, val) =>
    setItems(p => p.map(x => x.id === id ? { ...x, [key]: val } : x));
  const toggleItem = (id) =>
    setItems(p => p.map(x => x.id === id ? { ...x, included: !x.included } : x));
  const removeItem = (id) => setItems(p => p.filter(x => x.id !== id));

  const handleConfirm = () => {
    const valid = items.filter(x => x.included && x.match && parseInt(x.qty) > 0);
    onConfirm(valid.map(x => ({ medicineId: x.match.id, qty: parseInt(x.qty) })));
    handleClose();
  };

  const included = items.filter(x => x.included && x.match && parseInt(x.qty) > 0).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>🎙️ Voice Billing</Text>
          <TouchableOpacity onPress={handleClose}><Text style={s.close}>✕</Text></TouchableOpacity>
        </View>

        {(stage === 'idle' || stage === 'listening') && (
          <View style={s.center}>
            <Text style={s.heroIcon}>{stage === 'listening' ? '🔴' : '🎙️'}</Text>
            <Text style={s.heroTitle}>{stage === 'listening' ? 'Listening…' : 'Say what to add'}</Text>
            <Text style={s.heroSub}>
              {stage === 'listening'
                ? (liveText || 'e.g. "2 strips Paracetamol, 1 cough syrup"')
                : 'Tap the mic and say the medicines and quantities you want to bill.'}
            </Text>

            {!!error && (
              <View style={s.errorBox}><Text style={s.errorText}>⚠️  {error}</Text></View>
            )}

            {stage === 'idle' ? (
              <TouchableOpacity style={s.micBtn} onPress={startListening}>
                <Text style={s.micBtnText}>🎙️  Tap to Speak</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[s.micBtn, s.micBtnActive]} onPress={stopListening}>
                <Text style={s.micBtnText}>⏹  Stop</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.aiToggleRow} onPress={() => setUseAI(v => !v)}>
              <Text style={{ fontSize: 18 }}>{useAI ? '☑️' : '⬜'}</Text>
              <Text style={s.aiToggleText}>✨ Use AI Parse (better with tricky phrasing)</Text>
            </TouchableOpacity>

            <View style={[s.freePill, useAI && s.aiPill]}>
              <Text style={[s.freePillText, useAI && s.aiPillText]}>
                {useAI ? '✨  AI Parse · ~₹0.10 per command' : '✅  Free · Runs on your device'}
              </Text>
            </View>
          </View>
        )}

        {stage === 'processing' && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={s.processingTitle}>{useAI ? 'Parsing with AI…' : 'Matching medicines…'}</Text>
            <Text style={s.processingSub}>"{finalText}"</Text>
          </View>
        )}

        {stage === 'review' && (
          <>
            <View style={s.reviewTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.reviewTitle}>
                  {items.length === 0 ? '⚠️ Nothing understood' : `${items.length} item${items.length !== 1 ? 's' : ''} heard`}
                </Text>
                <Text style={s.reviewSub} numberOfLines={1}>"{finalText}"</Text>
              </View>
              <TouchableOpacity onPress={reset}>
                <Text style={s.rescanBtn}>Try Again</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 16 }}>
              {items.length === 0 && (
                <View style={s.emptyHint}>
                  <Text style={s.emptyHintText}>Didn't catch any medicines. Try again, speaking clearly.</Text>
                </View>
              )}

              {items.map(item => (
                <View key={item.id} style={[s.itemCard, (!item.included || !item.match) && s.itemDim]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => item.match && toggleItem(item.id)} disabled={!item.match}>
                      <Text style={{ fontSize: 20 }}>{item.included && item.match ? '☑️' : '⬜'}</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1, gap: 3 }}>
                      <TextInput
                        style={s.nameInput}
                        value={item.name}
                        onChangeText={v => updateItem(item.id, 'name', v)}
                        placeholder="Medicine name"
                        placeholderTextColor="#9ca3af"
                      />
                      {item.match
                        ? <Text style={s.matchText}>✅ {item.match.name} — ₹{item.match.price} · {item.match.stock} in stock</Text>
                        : <Text style={s.newText}>❌ Not found in inventory</Text>
                      }
                    </View>

                    <View style={s.qtyCol}>
                      <TextInput
                        style={s.qtyBox}
                        value={item.qty}
                        onChangeText={v => updateItem(item.id, 'qty', v)}
                        keyboardType="numeric"
                        selectTextOnFocus
                      />
                    </View>

                    <TouchableOpacity onPress={() => removeItem(item.id)} style={{ paddingLeft: 2 }}>
                      <Text style={{ color: '#ef4444', fontSize: 18, lineHeight: 22 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity
                style={[s.confirmBtn, included === 0 && { opacity: 0.4 }]}
                onPress={handleConfirm}
                disabled={included === 0}
              >
                <Text style={s.confirmText}>
                  ✅  Add {included} item{included !== 1 ? 's' : ''} to Bill
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#fff' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  title:          { fontSize: 16, fontWeight: '700', color: '#111' },
  close:          { fontSize: 20, color: '#9ca3af', padding: 4 },

  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  heroIcon:       { fontSize: 52, marginBottom: 16 },
  heroTitle:      { fontSize: 19, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 8 },
  heroSub:        { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  errorBox:       { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 18, width: '100%' },
  errorText:      { color: '#dc2626', fontSize: 13, lineHeight: 18 },

  micBtn:         { width: '100%', backgroundColor: COLORS.primary, borderRadius: 12,
                    padding: 16, alignItems: 'center', marginBottom: 20 },
  micBtnActive:   { backgroundColor: '#dc2626' },
  micBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  aiToggleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  aiToggleText:   { fontSize: 13, color: '#374151', fontWeight: '500' },
  freePill:       { backgroundColor: '#EFF8FF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  freePillText:   { fontSize: 11, color: '#1565C0', fontWeight: '500' },
  aiPill:         { backgroundColor: '#FBEFFF' },
  aiPillText:     { color: '#9333EA' },

  processingTitle:{ fontSize: 16, fontWeight: '600', color: '#111', marginTop: 18 },
  processingSub:  { fontSize: 13, color: '#6b7280', marginTop: 4, textAlign: 'center' },

  reviewTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 10,
                    backgroundColor: '#f9fafb', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  reviewTitle:    { fontSize: 14, fontWeight: '700', color: '#111' },
  reviewSub:      { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rescanBtn:      { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  emptyHint:      { backgroundColor: '#fffbeb', borderRadius: 10, padding: 14, marginBottom: 12 },
  emptyHintText:  { fontSize: 13, color: '#92400e', lineHeight: 20, textAlign: 'center' },

  itemCard:       { gap: 8,
                    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
                    borderWidth: 1, borderColor: '#e5e7eb',
                    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  itemDim:        { opacity: 0.5 },
  nameInput:      { fontSize: 13, fontWeight: '600', color: '#111', paddingBottom: 3,
                    borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  matchText:      { fontSize: 11, color: '#1565C0' },
  newText:        { fontSize: 11, color: '#dc2626' },
  qtyCol:         { alignItems: 'center', gap: 2 },
  qtyBox:         { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 8,
                    paddingHorizontal: 6, paddingVertical: 4,
                    fontSize: 15, fontWeight: '700', textAlign: 'center', width: 58 },

  footer:         { padding: 14, borderTopWidth: 0.5, borderTopColor: '#e5e7eb' },
  confirmBtn:     { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  confirmText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
});
