import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, TextInput, SafeAreaView,
} from 'react-native';
import { COLORS } from '../data/medicines';

// ─── OCR via window.Tesseract (loaded from CDN in index.html) ──
async function runOCR(dataUrl, onStatus, onProgress) {
  const Tesseract = typeof window !== 'undefined' && window.Tesseract;
  if (!Tesseract) {
    // CDN script still loading — wait up to 10s
    await new Promise((resolve, reject) => {
      let waited = 0;
      const interval = setInterval(() => {
        if (window.Tesseract) { clearInterval(interval); resolve(); }
        waited += 200;
        if (waited > 10000) { clearInterval(interval); reject(new Error('OCR library failed to load. Check your internet connection.')); }
      }, 200);
    });
  }

  onStatus('Reading text from image…');
  const { data: { text } } = await window.Tesseract.recognize(dataUrl, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100));
      } else if (m.status) {
        onStatus(m.status.replace(/_/g, ' '));
      }
    },
  });
  return text;
}

// ─── Bill parser ──────────────────────────────────────────────
const SKIP_LINE = [
  /^(total|sub.?total|grand|invoice|date|s\.?no|sr\.?no|batch|expiry|mrp|rate|disc|gst|cgst|sgst|igst|tax|bill|party|address|phone|mob|dl|gstin|pan|fax|email|thank|terms|page|original|duplicate)/i,
  /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
  /^[₹$\d\s.,\-+*=:]+$/,
  /^(cash|credit|debit|paid|balance|net|hsn|sac|qty|pack|free|amount|unit)/i,
];

const UNIT_MAP = {
  tab: 'Tablet', tablet: 'Tablet', tabs: 'Tablet', tablets: 'Tablet',
  cap: 'Capsule', capsule: 'Capsule', caps: 'Capsule',
  strip: 'Strip', strips: 'Strip',
  bottle: 'Bottle',
  vial: 'Vial',
  inj: 'Injection', injection: 'Injection',
  syr: 'Syrup', syrup: 'Syrup',
  cream: 'Cream',
  oint: 'Ointment', ointment: 'Ointment',
  sachet: 'Sachet',
  powder: 'Powder',
  drop: 'Drops', drops: 'Drops',
};

function detectUnit(line) {
  const m = line.match(/\b(tab(?:let)?s?|cap(?:sule)?s?|strip[s]?|bottle[s]?|vial[s]?|inj(?:ection)?|syr(?:up)?|cream|oint(?:ment)?|sachet[s]?|powder|drops?)\b/i);
  if (!m) return 'Strip';
  const k = m[1].toLowerCase().replace(/s$/, '');
  return UNIT_MAP[k] || 'Strip';
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Wholesale bills print expiry as MM/YY or MM/YYYY (batch expiry, not a full
// date) — distinct from a full invoice date (DD/MM/YYYY, 3 parts), which is
// already excluded at the line level by SKIP_LINE. Converts to the "MMM YYYY"
// format the rest of the app already uses (see InventoryScreen's expiryColor).
function detectExpiry(tokens) {
  for (const t of tokens) {
    const m = t.match(/^(\d{1,2})[\/\-](\d{2}|\d{4})$/);
    if (!m) continue;
    const month = parseInt(m[1], 10);
    if (month < 1 || month > 12) continue;
    const year = m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10);
    return `${MONTHS[month - 1]} ${year}`;
  }
  return null;
}

// Rate/price columns are almost always printed with paise (e.g. 15.50),
// distinguishing them from bare-integer qty/serial columns. Takes the first
// decimal-looking token after the quantity, which is typically the
// immediate next column in the common qty → rate → amount layout — so this
// picks up the per-unit rate rather than the line-total amount.
function detectPrice(tokens, fromIndex) {
  for (let i = fromIndex; i < tokens.length; i++) {
    const m = tokens[i].match(/^\d+\.\d{1,2}$/);
    if (m) return parseFloat(tokens[i]);
  }
  return null;
}

function parseBillText(raw) {
  const results = [];
  const seen = new Set();

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (line.length < 4) continue;
    if (SKIP_LINE.some(p => p.test(line))) continue;

    const tokens = line.split(/\s+/);
    let start = /^\d{1,3}[\.\)]?$/.test(tokens[0]) ? 1 : 0;

    // Find first standalone integer (1-9999) as quantity
    let qtyIndex = -1, qty = 0;
    for (let i = start + 1; i < tokens.length; i++) {
      if (/^\d+$/.test(tokens[i])) {
        const n = parseInt(tokens[i], 10);
        if (n >= 1 && n <= 9999) { qtyIndex = i; qty = n; break; }
      }
    }
    if (qtyIndex < 1 || qty === 0) continue;

    const name = tokens.slice(start, qtyIndex).join(' ').trim();
    if (!name || name.length < 3 || /^\d+$/.test(name)) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      name, qty, unit: detectUnit(line),
      price: detectPrice(tokens, qtyIndex + 1),
      expiry: detectExpiry(tokens),
    });
  }
  return results;
}

function fuzzyMatch(name, medicines) {
  const q = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  let m = medicines.find(x => x.name.toLowerCase() === q);
  if (m) return m;
  m = medicines.find(x => x.name.toLowerCase().includes(q) || q.includes(x.name.toLowerCase()));
  if (m) return m;
  const first = q.split(' ')[0];
  if (first.length > 3) m = medicines.find(x => x.name.toLowerCase().startsWith(first));
  return m || null;
}

// ─── Component ────────────────────────────────────────────────
export default function ScanBillModal({ visible, onClose, medicines, onConfirm }) {
  const [stage,    setStage]    = useState('pick');
  const [preview,  setPreview]  = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusMsg,setStatusMsg]= useState('');
  const [items,    setItems]    = useState([]);
  const [rawText,  setRawText]  = useState('');
  const [showRaw,  setShowRaw]  = useState(false);
  const [error,    setError]    = useState('');

  const reset = () => {
    setStage('pick'); setPreview(null); setItems([]);
    setError(''); setProgress(0); setRawText(''); setShowRaw(false); setStatusMsg('');
  };
  const handleClose = () => { reset(); onClose(); };

  const processFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      setStage('processing');
      setProgress(0);
      setError('');
      setStatusMsg('Starting…');

      try {
        const raw = await runOCR(
          dataUrl,
          (msg) => setStatusMsg(msg),
          (pct) => setProgress(pct),
        );

        setRawText(raw || '');
        const extracted = parseBillText(raw || '');

        const mapped = extracted.map((e, i) => ({
          id: i, name: e.name, qty: String(e.qty), unit: e.unit,
          price: e.price != null ? String(e.price) : '',
          expiry: e.expiry || '',
          match: fuzzyMatch(e.name, medicines), included: true,
        }));

        setItems(mapped);
        setStage('review');  // always reach review — even if 0 items
      } catch (err) {
        setError(String(err.message || err));
        setStage('pick');
      }
    };
    reader.readAsDataURL(file);
  };

  const updateItem = (id, key, val) =>
    setItems(p => p.map(x => x.id === id ? { ...x, [key]: val } : x));
  const toggleItem = (id) =>
    setItems(p => p.map(x => x.id === id ? { ...x, included: !x.included } : x));
  const removeItem = (id) => setItems(p => p.filter(x => x.id !== id));
  const addRow = () => setItems(p => [
    ...p,
    { id: Date.now(), name: '', qty: '1', unit: 'Strip', price: '', expiry: '', match: null, included: true },
  ]);

  const handleConfirm = () => {
    const valid = items.filter(x => x.included && x.name.trim() && parseInt(x.qty) > 0);
    onConfirm(valid);
    handleClose();
  };

  const included = items.filter(x => x.included).length;

  const isWeb = typeof document !== 'undefined';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      {isWeb && (
        <>
          {/* Two separate inputs (camera vs gallery) so each can be wired to its
              own <label>. Labels open their file input natively on click — no
              JS .click() call involved, which mobile Safari/Chrome silently
              block when triggered from a React Native Web touch handler
              (the tap loses "direct user gesture" status by the time onPress
              fires), i.e. the exact "nothing happens when tapped" symptom. */}
          <input id="scan-camera-input" type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }}
            onChange={e => processFile(e.target.files[0])} />
          <input id="scan-gallery-input" type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={e => processFile(e.target.files[0])} />
        </>
      )}

      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>📄 Scan Wholesale Bill</Text>
          <TouchableOpacity onPress={handleClose}><Text style={s.close}>✕</Text></TouchableOpacity>
        </View>

        {/* ── PICK ── */}
        {stage === 'pick' && (
          <View style={s.center}>
            <Text style={s.heroIcon}>🧾</Text>
            <Text style={s.heroTitle}>Scan your wholesale bill</Text>
            <Text style={s.heroSub}>Take a clear photo of the printed bill. Lay it flat, good lighting, hold phone directly above it.</Text>

            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>⚠️  {error}</Text>
              </View>
            )}

            {isWeb ? (
              <>
                <label htmlFor="scan-camera-input" style={s.btnPrimary}>
                  <span style={s.btnPrimaryText}>📷  Open Camera</span>
                </label>
                <label htmlFor="scan-gallery-input" style={s.btnOutline}>
                  <span style={s.btnOutlineText}>🖼️  Upload from Gallery / Files</span>
                </label>
              </>
            ) : (
              <View style={s.errorBox}>
                <Text style={s.errorText}>⚠️  Bill scanning is available in the web app for now.</Text>
              </View>
            )}

            <View style={s.freePill}>
              <Text style={s.freePillText}>✅  Free · No API key · Runs on your device</Text>
            </View>
          </View>
        )}

        {/* ── PROCESSING ── */}
        {stage === 'processing' && (
          <View style={s.center}>
            {preview && (
              <img src={preview} alt="bill"
                style={{ maxWidth: '88%', maxHeight: 180, borderRadius: 12, objectFit: 'contain', marginBottom: 20 }} />
            )}
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={s.processingTitle}>{statusMsg || 'Processing…'}</Text>
            <Text style={s.processingSub}>
              {progress > 0 ? `${progress}% complete` : 'First time loads OCR engine (~5 sec)'}
            </Text>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${Math.max(progress, 5)}%` }]} />
            </View>
            <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 12 }}>
              Do not close this screen
            </Text>
          </View>
        )}

        {/* ── REVIEW ── */}
        {stage === 'review' && (
          <>
            <View style={s.reviewTop}>
              <View>
                <Text style={s.reviewTitle}>
                  {items.length === 0
                    ? '⚠️ Nothing auto-detected'
                    : `✅ ${items.length} items found`}
                </Text>
                <Text style={s.reviewSub}>
                  {items.length === 0
                    ? 'Add medicines manually below'
                    : `${included} selected · edit name/qty if wrong`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setStage('pick')}>
                <Text style={s.rescanBtn}>Rescan</Text>
              </TouchableOpacity>
            </View>

            {/* Raw OCR toggle */}
            {rawText.trim().length > 0 && (
              <TouchableOpacity style={s.rawToggle} onPress={() => setShowRaw(v => !v)}>
                <Text style={s.rawToggleText}>
                  {showRaw ? '▲ Hide raw OCR text' : '▼ Show what OCR read (debug)'}
                </Text>
              </TouchableOpacity>
            )}
            {showRaw && (
              <ScrollView style={s.rawBox} nestedScrollEnabled>
                <Text style={s.rawText} selectable>{rawText}</Text>
              </ScrollView>
            )}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 16 }}>
              {items.length === 0 && (
                <View style={s.emptyHint}>
                  <Text style={s.emptyHintText}>
                    The parser didn't find medicine rows.{'\n'}
                    Try "Show raw OCR text" to see what was read, then add medicines below.
                  </Text>
                </View>
              )}

              {items.map(item => (
                <View key={item.id} style={[s.itemCard, !item.included && s.itemDim]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => toggleItem(item.id)}>
                      <Text style={{ fontSize: 20 }}>{item.included ? '☑️' : '⬜'}</Text>
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
                        ? <Text style={s.matchText}>✅ {item.match.name} — current stock: {item.match.stock}</Text>
                        : <Text style={s.newText}>🆕 New entry will be created</Text>
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
                      <Text style={s.qtyUnit}>{item.unit}</Text>
                    </View>

                    <TouchableOpacity onPress={() => removeItem(item.id)} style={{ paddingLeft: 2 }}>
                      <Text style={{ color: '#ef4444', fontSize: 18, lineHeight: 22 }}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.subRow}>
                    <View style={s.subField}>
                      <Text style={s.subLabel}>Price ₹</Text>
                      <TextInput
                        style={s.subInput}
                        value={item.price}
                        onChangeText={v => updateItem(item.id, 'price', v)}
                        keyboardType="decimal-pad"
                        placeholder={item.match ? String(item.match.price) : '0.00'}
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    <View style={s.subField}>
                      <Text style={s.subLabel}>Expiry</Text>
                      <TextInput
                        style={s.subInput}
                        value={item.expiry}
                        onChangeText={v => updateItem(item.id, 'expiry', v)}
                        placeholder={item.match ? (item.match.expiry || 'e.g. Jun 2027') : 'e.g. Jun 2027'}
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={s.addRowBtn} onPress={addRow}>
                <Text style={s.addRowText}>＋  Add row manually</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity
                style={[s.confirmBtn, included === 0 && { opacity: 0.4 }]}
                onPress={handleConfirm}
                disabled={included === 0}
              >
                <Text style={s.confirmText}>
                  ✅  Add {included} item{included !== 1 ? 's' : ''} to Stock
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
  btnPrimary:     { width: '100%', backgroundColor: COLORS.primary, borderRadius: 12,
                    padding: 14, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnOutline:     { width: '100%', borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12,
                    padding: 14, alignItems: 'center', marginBottom: 20 },
  btnOutlineText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  freePill:       { backgroundColor: '#EFF8FF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  freePillText:   { fontSize: 11, color: '#1565C0', fontWeight: '500' },

  processingTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginTop: 18 },
  processingSub:   { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 14 },
  bar:             { width: '78%', height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill:         { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },

  reviewTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 10,
                    backgroundColor: '#f9fafb', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  reviewTitle:    { fontSize: 14, fontWeight: '700', color: '#111' },
  reviewSub:      { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rescanBtn:      { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  rawToggle:      { paddingHorizontal: 16, paddingVertical: 7, backgroundColor: '#f3f4f6',
                    borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  rawToggleText:  { fontSize: 11, color: '#6b7280' },
  rawBox:         { maxHeight: 110, backgroundColor: '#f9fafb', paddingHorizontal: 12, paddingVertical: 6,
                    borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  rawText:        { fontSize: 10, color: '#374151', lineHeight: 16 },

  emptyHint:      { backgroundColor: '#fffbeb', borderRadius: 10, padding: 14, marginBottom: 12 },
  emptyHintText:  { fontSize: 13, color: '#92400e', lineHeight: 20, textAlign: 'center' },

  itemCard:       { gap: 8,
                    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
                    borderWidth: 1, borderColor: '#e5e7eb',
                    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  itemDim:        { opacity: 0.35 },
  nameInput:      { fontSize: 13, fontWeight: '600', color: '#111', paddingBottom: 3,
                    borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  matchText:      { fontSize: 11, color: '#1565C0' },
  newText:        { fontSize: 11, color: '#d97706' },
  qtyCol:         { alignItems: 'center', gap: 2 },
  qtyBox:         { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 8,
                    paddingHorizontal: 6, paddingVertical: 4,
                    fontSize: 15, fontWeight: '700', textAlign: 'center', width: 58 },
  subRow:         { flexDirection: 'row', gap: 10, paddingLeft: 28 },
  subField:       { flex: 1 },
  subLabel:       { fontSize: 10, color: '#9ca3af', marginBottom: 2 },
  subInput:       { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 5,
                    fontSize: 12, color: '#111', backgroundColor: '#f9fafb' },
  qtyUnit:        { fontSize: 10, color: '#6b7280' },

  addRowBtn:      { borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
                    borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  addRowText:     { color: COLORS.primary, fontSize: 14, fontWeight: '600' },

  footer:         { padding: 14, borderTopWidth: 0.5, borderTopColor: '#e5e7eb' },
  confirmBtn:     { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  confirmText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
});
