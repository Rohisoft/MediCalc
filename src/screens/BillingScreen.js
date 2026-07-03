import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, Modal,
} from 'react-native';
import { CATEGORIES, COLORS } from '../data/medicines';
import { useStore } from '../store/useStore';
import VoiceBillModal from './VoiceBillModal';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Credit'];
const PAY_LABEL = { Cash: 'Cash 💵', UPI: 'UPI 📱', Card: 'Card 💳', Credit: 'Pay Later 📒' };

export default function BillingScreen({ navigation }) {
  const { state, dispatch } = useStore();
  const [search, setSearch]               = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showCart, setShowCart]           = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [discountInput, setDiscountInput]           = useState('');
  const [showVoice, setShowVoice]                   = useState(false);

  const billItems        = state.cart;
  const selectedCustomer = state.customers.find(c => c.id === selectedCustomerId) || null;
  const cartMap          = useMemo(() => Object.fromEntries(billItems.map(i => [i.id, i.qty])), [billItems]);

  const filtered = useMemo(() =>
    state.medicines.filter(m =>
      (activeCategory === 'All' || m.cat === activeCategory) &&
      m.name.toLowerCase().includes(search.toLowerCase())
    ), [search, activeCategory, state.medicines]);

  const subtotal        = billItems.reduce((s, i) => s + i.price * i.qty, 0);
  const discountPct     = Math.min(Math.max(parseFloat(discountInput) || 0, 0), 100);
  const discount        = Math.round(subtotal * discountPct / 100);
  const grandTotal      = subtotal - discount;

  const addItem = (med) => {
    if (med.stock === 0 || med.status === 'out') {
      Alert.alert('Out of Stock', `${med.name} is not available.`);
      return;
    }
    dispatch({ type: 'ADD_TO_CART', item: { id: med.id, name: med.name, price: med.price, unit: med.unit, stock: med.stock } });
  };

  const changeQty = (id, delta) => dispatch({ type: 'UPDATE_CART_QTY', id, delta });

  const handleVoiceConfirm = (voiceItems) => {
    voiceItems.forEach(({ medicineId, qty }) => {
      const med = state.medicines.find(m => m.id === medicineId);
      if (!med || med.stock === 0 || med.status === 'out') return;
      dispatch({ type: 'ADD_TO_CART', item: { id: med.id, name: med.name, price: med.price, unit: med.unit, stock: med.stock } });
      if (qty > 1) dispatch({ type: 'UPDATE_CART_QTY', id: med.id, delta: qty - 1 });
    });
  };

  const completeBill = () => {
    if (billItems.length === 0) return;
    if (paymentMethod === 'Credit' && !selectedCustomerId) {
      Alert.alert('Customer Required', 'Select a customer to use Pay Later.');
      return;
    }
    const bill = {
      id: `BILL-${Date.now()}`,
      date: new Date().toISOString(),
      items: billItems.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, stock: i.stock ?? 0 })),
      subtotal, discount, grandTotal, paymentMethod,
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || null,
    };
    dispatch({ type: 'COMPLETE_BILL', bill });
    setSelectedCustomerId(null);
    setPaymentMethod('Cash');
    setDiscountInput('');
    setShowCart(false);
    Alert.alert(
      paymentMethod === 'Credit' ? 'Bill Saved — Due Added 📒' : 'Bill Complete ✅',
      paymentMethod === 'Credit'
        ? `₹${grandTotal} added to ${selectedCustomer?.name}'s account.`
        : `₹${grandTotal} · ${PAY_LABEL[paymentMethod]}`,
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <View style={s.topbar}>
        <Text style={s.title}>🧾 New Bill</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {billItems.length > 0 && (
            <TouchableOpacity onPress={() => dispatch({ type: 'CLEAR_CART' })}>
              <Text style={s.clearBtn}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('BillHistory')}>
            <Text style={s.historyBtn}>📋 History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search medicine to add…"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.textMuted}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => setShowVoice(true)} style={{ paddingLeft: 10 }}>
          <Text style={{ fontSize: 18 }}>🎙️</Text>
        </TouchableOpacity>
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
      <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: billItems.length > 0 ? 90 : 20 }}>
        {state.medicines.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={{ fontSize: 40 }}>📦</Text>
            <Text style={s.emptyTitle}>No medicines in inventory</Text>
            <Text style={s.emptySub}>Go to Add Stock tab to add medicines first</Text>
          </View>
        ) : filtered.length === 0 ? (
          <Text style={s.emptyText}>No medicines found</Text>
        ) : filtered.map(m => {
          const inCart  = cartMap[m.id] || 0;
          const isOut   = m.status === 'out';
          return (
            <View key={m.id} style={[s.card, isOut && s.cardOut]}>
              <View style={s.cardIcon}>
                <Text style={{ fontSize: 20 }}>💊</Text>
              </View>
              <View style={s.cardInfo}>
                <Text style={s.cardName}>{m.name}</Text>
                <Text style={s.cardCat}>{m.cat} · {m.unit}</Text>
                <Text style={[s.cardStock, { color: isOut ? COLORS.danger : m.status === 'low' ? COLORS.warning : COLORS.primary }]}>
                  {isOut ? 'Out of stock' : m.status === 'low' ? `⚠ ${m.stock} left` : `${m.stock} in stock`}
                </Text>
              </View>
              <View style={s.cardRight}>
                <Text style={s.cardPrice}>₹{m.price}</Text>
                {isOut ? (
                  <View style={s.outBadge}><Text style={s.outBadgeText}>Out</Text></View>
                ) : inCart > 0 ? (
                  <View style={s.qtyRow}>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => changeQty(m.id, -1)}>
                      <Text style={s.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.qtyNum}>{inCart}</Text>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => addItem(m)}>
                      <Text style={s.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.addBtn} onPress={() => addItem(m)}>
                    <Text style={s.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Sticky bottom cart bar */}
      {billItems.length > 0 && (
        <TouchableOpacity style={s.cartBar} onPress={() => setShowCart(true)}>
          <View>
            <Text style={s.cartBarItems}>{billItems.length} item{billItems.length > 1 ? 's' : ''} in bill</Text>
            <Text style={s.cartBarSub}>{discount > 0 ? `${discountPct}% discount applied (−₹${discount})` : 'Tap to review & pay'}</Text>
          </View>
          <View style={s.cartBarRight}>
            <Text style={s.cartBarTotal}>₹{grandTotal}</Text>
            <Text style={s.cartBarAction}>Review & Pay →</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Cart / Payment Modal */}
      <Modal visible={showCart} transparent animationType="slide" onRequestClose={() => setShowCart(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>Review Bill</Text>
              <TouchableOpacity onPress={() => setShowCart(false)}>
                <Text style={{ color: COLORS.textMuted, fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Items */}
              {billItems.map(item => (
                <View key={item.id} style={m.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={m.rowName}>{item.name}</Text>
                    <Text style={m.rowSub}>₹{item.price} × {item.qty}</Text>
                  </View>
                  <View style={m.qtyCtrl}>
                    <TouchableOpacity style={m.qBtn} onPress={() => changeQty(item.id, -1)}>
                      <Text style={m.qBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={m.qNum}>{item.qty}</Text>
                    <TouchableOpacity style={m.qBtn} onPress={() => changeQty(item.id, 1)}>
                      <Text style={m.qBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={m.rowTotal}>₹{item.price * item.qty}</Text>
                </View>
              ))}

              {/* Customer */}
              <TouchableOpacity style={m.customerRow} onPress={() => { setShowCart(false); setShowCustomerPicker(true); }}>
                <Text style={m.customerLabel}>👤 Customer</Text>
                <Text style={[m.customerVal, selectedCustomer && { color: COLORS.primary }]}>
                  {selectedCustomer ? selectedCustomer.name : 'Walk-in (tap to select)'}
                </Text>
                <Text style={{ color: COLORS.textMuted }}>›</Text>
              </TouchableOpacity>

              {/* Payment */}
              <View style={m.payRow}>
                <Text style={m.payLabel}>Payment</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                  {PAYMENT_METHODS.map(pm => (
                    <TouchableOpacity
                      key={pm}
                      style={[m.pmChip, paymentMethod === pm && (pm === 'Credit' ? m.pmCredit : m.pmActive)]}
                      onPress={() => setPaymentMethod(pm)}
                    >
                      <Text style={[m.pmText, paymentMethod === pm && { color: '#fff' }]}>{PAY_LABEL[pm]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {paymentMethod === 'Credit' && !selectedCustomer && (
                <View style={m.warning}>
                  <Text style={m.warningText}>⚠️ Select a customer to use Pay Later</Text>
                </View>
              )}

              {/* Discount */}
              <View style={m.discountRow}>
                <Text style={m.discountLabel}>🏷️ Discount (%)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TextInput
                    style={m.discountInput}
                    value={discountInput}
                    onChangeText={setDiscountInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>%</Text>
                  {discount > 0 && <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600' }}>= −₹{discount}</Text>}
                </View>
              </View>

              {/* Totals */}
              <View style={m.totals}>
                <View style={m.totalRow}><Text style={m.totalLabel}>Subtotal</Text><Text style={m.totalVal}>₹{subtotal}</Text></View>
                {discount > 0 && (
                  <View style={m.totalRow}>
                    <Text style={[m.totalLabel, { color: COLORS.danger }]}>Discount</Text>
                    <Text style={[m.totalVal, { color: COLORS.danger, fontWeight: '600' }]}>−₹{discount}</Text>
                  </View>
                )}
                <View style={[m.totalRow, m.grandRow]}>
                  <Text style={m.grandLabel}>Grand Total</Text>
                  <Text style={m.grandVal}>₹{grandTotal}</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[m.completeBtn, paymentMethod === 'Credit' && m.completeBtnCredit]}
              onPress={completeBill}
            >
              <Text style={m.completeBtnText}>
                {paymentMethod === 'Credit' ? `📒 Save as Pay Later — ₹${grandTotal}` : `✓ Complete Bill — ₹${grandTotal}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Customer Picker */}
      <Modal visible={showCustomerPicker} transparent animationType="slide" onRequestClose={() => { setShowCustomerPicker(false); setShowCart(true); }}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.sheetTitle}>Select Customer</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <TouchableOpacity style={m.cpItem} onPress={() => { setSelectedCustomerId(null); setShowCustomerPicker(false); setShowCart(true); }}>
                <Text style={m.cpName}>Walk-in Customer</Text>
                <Text style={m.cpSub}>No account needed</Text>
              </TouchableOpacity>
              {state.customers.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[m.cpItem, selectedCustomerId === c.id && m.cpSelected]}
                  onPress={() => { setSelectedCustomerId(c.id); setShowCustomerPicker(false); setShowCart(true); }}
                >
                  <Text style={m.cpName}>{c.name}</Text>
                  <Text style={m.cpSub}>+91 {c.phone} · Due: ₹{c.due || 0}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={m.cpClose} onPress={() => { setShowCustomerPicker(false); setShowCart(true); }}>
              <Text style={{ color: COLORS.textMuted }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <VoiceBillModal
        visible={showVoice}
        onClose={() => setShowVoice(false)}
        medicines={state.medicines}
        onConfirm={handleVoiceConfirm}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.bg },
  topbar:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12 },
  title:          { color: '#fff', fontSize: 18, fontWeight: '700' },
  clearBtn:       { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  historyBtn:     { color: '#fff', fontSize: 13 },
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
  emptyText:      { textAlign: 'center', padding: 32, color: COLORS.textMuted, fontSize: 14 },
  card:           { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: COLORS.border },
  cardOut:        { opacity: 0.5 },
  cardIcon:       { width: 44, height: 44, borderRadius: 10, backgroundColor: '#EAF3DE', alignItems: 'center', justifyContent: 'center' },
  cardInfo:       { flex: 1 },
  cardName:       { fontSize: 14, fontWeight: '500', color: COLORS.text },
  cardCat:        { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  cardStock:      { fontSize: 11, marginTop: 3, fontWeight: '500' },
  cardRight:      { alignItems: 'flex-end', gap: 6 },
  cardPrice:      { fontSize: 15, fontWeight: '700', color: COLORS.text },
  addBtn:         { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText:     { color: '#fff', fontSize: 12, fontWeight: '600' },
  outBadge:       { backgroundColor: COLORS.dangerLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  outBadgeText:   { color: COLORS.danger, fontSize: 11, fontWeight: '600' },
  qtyRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EAF3DE', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  qtyBtn:         { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText:     { color: '#fff', fontSize: 14, lineHeight: 18 },
  qtyNum:         { fontSize: 13, fontWeight: '700', color: COLORS.primary, minWidth: 16, textAlign: 'center' },
  cartBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 20 },
  cartBarItems:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  cartBarSub:     { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  cartBarRight:   { alignItems: 'flex-end' },
  cartBarTotal:   { color: '#fff', fontWeight: '800', fontSize: 18 },
  cartBarAction:  { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
});

const m = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:     { fontSize: 17, fontWeight: '700', color: COLORS.text },
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  rowName:        { fontSize: 13, fontWeight: '500', color: COLORS.text },
  rowSub:         { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  qtyCtrl:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  qBtn:           { width: 24, height: 24, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  qBtnText:       { fontSize: 15, color: COLORS.text, lineHeight: 20 },
  qNum:           { fontSize: 14, fontWeight: '600', minWidth: 20, textAlign: 'center', color: COLORS.text },
  rowTotal:       { fontSize: 13, fontWeight: '600', color: COLORS.text, minWidth: 50, textAlign: 'right' },
  customerRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginTop: 10, gap: 8 },
  customerLabel:  { fontSize: 13, color: COLORS.textMuted },
  customerVal:    { flex: 1, fontSize: 13, color: COLORS.textMuted },
  payRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginTop: 8, gap: 10 },
  payLabel:       { fontSize: 13, color: COLORS.textMuted },
  pmChip:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.border, marginBottom: 4 },
  pmActive:       { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pmCredit:       { backgroundColor: '#854F0B', borderColor: '#854F0B' },
  pmText:         { fontSize: 11, color: COLORS.textMuted },
  warning:        { backgroundColor: '#FEF3E2', borderRadius: 8, padding: 10, marginTop: 6 },
  warningText:    { color: '#854F0B', fontSize: 12 },
  discountRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginTop: 8 },
  discountLabel:  { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  discountInput:  { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 15, color: COLORS.text, minWidth: 80, textAlign: 'center', backgroundColor: COLORS.white },
  totals:         { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginTop: 8 },
  totalRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel:     { fontSize: 13, color: COLORS.textMuted },
  totalVal:       { fontSize: 13, color: COLORS.text },
  grandRow:       { borderTopWidth: 0.5, borderTopColor: COLORS.border, marginTop: 6, paddingTop: 8 },
  grandLabel:     { fontSize: 15, fontWeight: '700', color: COLORS.text },
  grandVal:       { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  completeBtn:    { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 12 },
  completeBtnCredit: { backgroundColor: '#854F0B' },
  completeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cpItem:         { padding: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  cpSelected:     { backgroundColor: '#EAF3DE' },
  cpName:         { fontSize: 14, fontWeight: '500', color: COLORS.text },
  cpSub:          { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  cpClose:        { marginTop: 12, padding: 12, alignItems: 'center' },
});
