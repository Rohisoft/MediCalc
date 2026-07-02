import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, Modal,
} from 'react-native';
import { CATEGORIES, COLORS } from '../data/medicines';
import { useStore } from '../store/useStore';
import ScanBillModal from './ScanBillModal';

const EMPTY_FORM = { name: '', cat: 'Analgesic', price: '', stock: '', unit: 'Strip', expiry: '' };

function expiryColor(expiry) {
  if (!expiry) return COLORS.textMuted;
  const parts = expiry.split(' ');
  if (parts.length < 2) return COLORS.textMuted;
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const d = new Date(parseInt(parts[1]), (months[parts[0]] ?? 0) + 1, 0);
  const daysLeft = Math.ceil((d - new Date()) / 86400000);
  if (daysLeft <= 0)  return COLORS.danger;
  if (daysLeft <= 30) return COLORS.danger;
  if (daysLeft <= 90) return COLORS.warning;
  return COLORS.primary;
}

export default function InventoryScreen() {
  const { state, dispatch } = useStore();
  const [search,          setSearch]          = useState('');
  const [activeCategory,  setActiveCategory]  = useState('All');
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [showEditModal,   setShowEditModal]   = useState(false);
  const [editMedicine,    setEditMedicine]    = useState(null);
  const [form,            setForm]            = useState(EMPTY_FORM);
  const [editStock,       setEditStock]       = useState('');
  const [showScan,        setShowScan]        = useState(false);

  const filtered = useMemo(() =>
    state.medicines.filter(m =>
      (activeCategory === 'All' || m.cat === activeCategory) &&
      m.name.toLowerCase().includes(search.toLowerCase())
    ), [search, activeCategory, state.medicines]);

  const lowCount  = state.medicines.filter(m => m.status === 'low').length;
  const outCount  = state.medicines.filter(m => m.status === 'out').length;
  const nearExpiry = state.medicines.filter(m => expiryColor(m.expiry) === COLORS.danger && m.expiry).length;

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const handleAddMedicine = () => {
    if (!form.name.trim() || !form.price || !form.stock) {
      Alert.alert('Missing fields', 'Name, Price and Stock quantity are required.');
      return;
    }
    dispatch({ type: 'ADD_MEDICINE', medicine: { ...form, expiry: form.expiry || 'Dec 2027' } });
    setForm(EMPTY_FORM);
    setShowAddModal(false);
  };

  const handleUpdateStock = () => {
    const qty = parseInt(editStock);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Invalid', 'Enter a valid stock quantity.');
      return;
    }
    dispatch({ type: 'UPDATE_MEDICINE_STOCK', id: editMedicine.id, stock: qty });
    setShowEditModal(false);
    setEditMedicine(null);
  };

  const openEdit = (med) => {
    setEditMedicine(med);
    setEditStock(String(med.stock));
    setShowEditModal(true);
  };

  const handleScanConfirm = (scannedItems) => {
    scannedItems.forEach(item => {
      const addQty = parseInt(item.qty) || 0;
      if (item.match) {
        // Add to existing medicine stock
        const newStock = (item.match.stock || 0) + addQty;
        dispatch({ type: 'UPDATE_MEDICINE_STOCK', id: item.match.id, stock: newStock });
      } else {
        // Create new medicine entry
        dispatch({
          type: 'ADD_MEDICINE',
          medicine: {
            name:   item.name,
            cat:    'Other',
            price:  '0',
            stock:  addQty,
            unit:   item.unit,
            expiry: 'Dec 2027',
          },
        });
      }
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <View style={s.topbar}>
        <Text style={s.title}>📦 Add Stock</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.scanBtn} onPress={() => setShowScan(true)}>
            <Text style={s.scanBtnText}>🤖 Scan Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addNewBtn} onPress={() => { setForm(EMPTY_FORM); setShowAddModal(true); }}>
            <Text style={s.addNewText}>+ Add New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stock alerts summary */}
      {(lowCount > 0 || outCount > 0 || nearExpiry > 0) && (
        <View style={s.alertBar}>
          {outCount > 0   && <View style={[s.alertChip, s.alertRed]}><Text style={s.alertText}>🚫 {outCount} Out of stock</Text></View>}
          {lowCount > 0   && <View style={[s.alertChip, s.alertYellow]}><Text style={s.alertText}>⚠ {lowCount} Low stock</Text></View>}
          {nearExpiry > 0 && <View style={[s.alertChip, s.alertRed]}><Text style={s.alertText}>📅 {nearExpiry} Expiring soon</Text></View>}
        </View>
      )}

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search medicine…"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.textMuted}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category chips */}
      <View style={s.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: 'center', height: 40 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[s.chip, activeCategory === cat && s.chipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[s.chipText, activeCategory === cat && s.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Medicine list */}
      <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 24 }}>
        {filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={{ fontSize: 40 }}>📦</Text>
            <Text style={s.emptyTitle}>No medicines yet</Text>
            <Text style={s.emptySub}>Tap "+ Add New" to add your first medicine</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => { setForm(EMPTY_FORM); setShowAddModal(true); }}>
              <Text style={s.emptyBtnText}>+ Add Medicine</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.map(m => {
          const ec = expiryColor(m.expiry);
          return (
            <TouchableOpacity key={m.id} style={s.card} onPress={() => openEdit(m)}>
              <View style={s.cardIcon}>
                <Text style={{ fontSize: 20 }}>💊</Text>
              </View>

              <View style={s.cardInfo}>
                <Text style={s.cardName}>{m.name}</Text>
                <Text style={s.cardCat}>{m.cat} · {m.unit}</Text>
              </View>

              {/* Stock quantity */}
              <View style={s.stockBox}>
                <Text style={[s.stockNum, {
                  color: m.status === 'out' ? COLORS.danger : m.status === 'low' ? COLORS.warning : COLORS.primary
                }]}>{m.stock}</Text>
                <Text style={s.stockLabel}>
                  {m.status === 'out' ? 'OUT' : m.status === 'low' ? 'LOW' : 'IN STOCK'}
                </Text>
              </View>

              {/* Expiry */}
              <View style={s.expiryBox}>
                <Text style={[s.expiryVal, { color: ec }]}>{m.expiry || '—'}</Text>
                <Text style={s.expiryLabel}>EXPIRY</Text>
              </View>

              <Text style={s.editHint}>✏️</Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Add New Medicine Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={modal.overlay}>
          <ScrollView>
            <View style={modal.sheet}>
              <Text style={modal.title}>Add New Medicine</Text>

              <Text style={modal.label}>Medicine Name *</Text>
              <TextInput style={modal.input} value={form.name} onChangeText={set('name')} placeholder="e.g. Paracetamol 500mg" placeholderTextColor={COLORS.textMuted} />

              <Text style={modal.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
                {CATEGORIES.filter(c => c !== 'All').map(cat => (
                  <TouchableOpacity key={cat} style={[modal.chip, form.cat === cat && modal.chipActive]} onPress={() => set('cat')(cat)}>
                    <Text style={[modal.chipText, form.cat === cat && { color: '#fff' }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={modal.label}>Price ₹ *</Text>
                  <TextInput style={modal.input} value={form.price} onChangeText={set('price')} keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modal.label}>Stock Qty *</Text>
                  <TextInput style={modal.input} value={form.stock} onChangeText={set('stock')} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textMuted} />
                </View>
              </View>

              <Text style={modal.label}>Unit</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {['Strip', 'Bottle', 'Sachet', 'Tablet'].map(u => (
                  <TouchableOpacity key={u} style={[modal.chip, form.unit === u && modal.chipActive]} onPress={() => set('unit')(u)}>
                    <Text style={[modal.chipText, form.unit === u && { color: '#fff' }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={modal.label}>Expiry Date (e.g. Dec 2027)</Text>
              <TextInput style={modal.input} value={form.expiry} onChangeText={set('expiry')} placeholder="Dec 2027" placeholderTextColor={COLORS.textMuted} />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={modal.cancelBtn} onPress={() => { setShowAddModal(false); setForm(EMPTY_FORM); }}>
                  <Text style={{ color: COLORS.textMuted, fontWeight: '500' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={modal.saveBtn} onPress={handleAddMedicine}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Save Medicine</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Stock Modal */}
      {editMedicine && (
        <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
          <View style={modal.overlay}>
            <View style={modal.sheet}>
              <Text style={modal.title}>Update Stock</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 }}>{editMedicine.name}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 16 }}>{editMedicine.cat} · Expiry: {editMedicine.expiry}</Text>

              <Text style={modal.label}>Current Stock</Text>
              <View style={{ backgroundColor: '#EAF3DE', borderRadius: 8, padding: 12, marginBottom: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, fontWeight: '700', color: COLORS.primary }}>{editMedicine.stock}</Text>
                <Text style={{ fontSize: 11, color: COLORS.textMuted }}>{editMedicine.unit}s in stock</Text>
              </View>

              <Text style={modal.label}>New Stock Quantity *</Text>
              <TextInput
                style={[modal.input, { fontSize: 18, textAlign: 'center' }]}
                value={editStock}
                onChangeText={setEditStock}
                keyboardType="numeric"
                placeholder="Enter new quantity"
                placeholderTextColor={COLORS.textMuted}
                selectTextOnFocus
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={modal.cancelBtn} onPress={() => setShowEditModal(false)}>
                  <Text style={{ color: COLORS.textMuted, fontWeight: '500' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={modal.saveBtn} onPress={handleUpdateStock}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Update Stock</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <ScanBillModal
        visible={showScan}
        onClose={() => setShowScan(false)}
        medicines={state.medicines}
        onConfirm={handleScanConfirm}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.bg },
  topbar:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12 },
  title:          { color: '#fff', fontSize: 18, fontWeight: '700' },
  scanBtn:        { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  scanBtnText:    { color: '#fff', fontSize: 12, fontWeight: '600' },
  addNewBtn:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  addNewText:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  alertBar:       { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2, backgroundColor: COLORS.bg, flexWrap: 'wrap' },
  alertChip:      { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  alertRed:       { backgroundColor: COLORS.dangerLight },
  alertYellow:    { backgroundColor: COLORS.warningLight },
  alertText:      { fontSize: 11, fontWeight: '600', color: COLORS.text },
  searchWrap:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 8, marginBottom: 0, backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: 12, borderWidth: 0.5, borderColor: COLORS.border },
  searchIcon:     { fontSize: 15, marginRight: 8 },
  searchInput:    { flex: 1, height: 38, fontSize: 14, color: COLORS.text },
  chipRow:        { height: 40, flexShrink: 0 },
  chip:           { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 12, color: COLORS.textMuted, lineHeight: 16, textAlign: 'center' },
  chipTextActive: { color: '#fff' },
  list:           { flex: 1, backgroundColor: COLORS.bg },
  emptyWrap:      { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle:     { fontSize: 15, fontWeight: '600', color: COLORS.text },
  emptySub:       { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  emptyBtn:       { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  emptyBtnText:   { color: '#fff', fontWeight: '600' },
  card:           { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: COLORS.border },
  cardIcon:       { width: 44, height: 44, borderRadius: 10, backgroundColor: '#EAF3DE', alignItems: 'center', justifyContent: 'center' },
  cardInfo:       { flex: 1 },
  cardName:       { fontSize: 14, fontWeight: '500', color: COLORS.text },
  cardCat:        { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  stockBox:       { alignItems: 'center', marginHorizontal: 4 },
  stockNum:       { fontSize: 22, fontWeight: '800' },
  stockLabel:     { fontSize: 8, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  expiryBox:      { alignItems: 'center', marginHorizontal: 4 },
  expiryVal:      { fontSize: 12, fontWeight: '600' },
  expiryLabel:    { fontSize: 8, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  editHint:       { fontSize: 14, marginLeft: 4 },
});

const modal = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  title:      { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  label:      { fontSize: 12, color: COLORS.textMuted, marginBottom: 5, marginTop: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.bg, marginBottom: 4 },
  chip:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:   { fontSize: 11, color: COLORS.textMuted },
  cancelBtn:  { flex: 1, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  saveBtn:    { flex: 2, backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
});
