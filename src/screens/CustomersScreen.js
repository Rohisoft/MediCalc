import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, Modal,
} from 'react-native';
import { COLORS } from '../data/medicines';
import { useStore } from '../store/useStore';

const TIER_COLORS = {
  Gold:    { bg: '#FAEEDA', text: '#854F0B' },
  VIP:     { bg: '#EEEDFE', text: '#533AB7' },
  Regular: { bg: '#EAF3DE', text: '#3B6D11' },
};
const AVATAR_BG = ['#1565C0', '#185FA5', '#854F0B', '#533AB7', '#993556'];
const initials = name => name.split(' ').map(n => n[0]).join('').toUpperCase();

const PAY_METHODS = ['Cash', 'UPI', 'Card'];

export default function CustomersScreen() {
  const { state, dispatch } = useStore();

  // List state
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('All');

  // Add customer modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm]           = useState({ name: '', phone: '' });

  // Customer detail + payment modal
  const [selected, setSelected]         = useState(null);
  const [detailView, setDetailView]     = useState('detail'); // 'detail' | 'payment'
  const [payAmount, setPayAmount]       = useState('');
  const [payMethod, setPayMethod]       = useState('Cash');

  /* ── derived ── */
  const filtered = useMemo(() => {
    let list = state.customers;
    if (filter === 'With Dues') list = list.filter(c => c.due > 0);
    if (filter === 'Loyalty')   list = list.filter(c => c.tier !== 'Regular');
    if (filter === 'Regular')   list = list.filter(c => c.tier === 'Regular');
    if (search) list = list.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    );
    return list;
  }, [search, filter, state.customers]);

  const totalDue = useMemo(
    () => state.customers.reduce((s, c) => s + (c.due || 0), 0),
    [state.customers],
  );

  // Credit bills for selected customer
  const creditBills = useMemo(() => {
    if (!selected) return [];
    return (state.bills || [])
      .filter(b => b.customerId === selected.id && b.paymentMethod === 'Credit')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [selected, state.bills]);

  // Payment history for selected customer
  const customerPayments = useMemo(() => {
    if (!selected) return [];
    return (state.payments || [])
      .filter(p => p.customerId === selected.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [selected, state.payments]);

  /* ── handlers ── */
  const openCustomer = (c) => {
    setSelected(c);
    setDetailView('detail');
    setPayAmount(String(c.due || ''));
    setPayMethod('Cash');
  };

  const closeDetail = () => setSelected(null);

  const handleSaveCustomer = () => {
    if (!addForm.name.trim() || !addForm.phone.trim()) {
      Alert.alert('Missing fields', 'Name and phone are required.');
      return;
    }
    dispatch({ type: 'ADD_CUSTOMER', customer: { name: addForm.name.trim(), phone: addForm.phone.trim() } });
    setAddForm({ name: '', phone: '' });
    setShowAddModal(false);
  };

  const handleCollectPayment = () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount greater than 0.');
      return;
    }
    if (amount > selected.due) {
      Alert.alert('Overpayment', `Due is ₹${selected.due}. Amount cannot exceed the due balance.`);
      return;
    }
    dispatch({ type: 'COLLECT_PAYMENT', customerId: selected.id, amount, method: payMethod });
    const remaining = selected.due - amount;
    closeDetail();
    Alert.alert(
      'Payment Collected ✅',
      `₹${amount} received from ${selected.name} via ${payMethod}.\n${remaining > 0 ? `Remaining due: ₹${remaining}` : 'Account is now clear!'}`,
    );
  };

  /* ── render ── */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={styles.topbar}>
        <Text style={styles.title}>Customers ({state.customers.length})</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>＋</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone…"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {['All', 'With Dues', 'Loyalty', 'Regular'].map(f => (
          <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {totalDue > 0 && (
        <TouchableOpacity style={styles.dueBar} onPress={() => setFilter('With Dues')}>
          <Text style={styles.dueSummary}>
            ⚠️ Total outstanding: <Text style={{ color: COLORS.danger, fontWeight: '700' }}>₹{totalDue.toLocaleString('en-IN')}</Text>
            {'  '}from {state.customers.filter(c => c.due > 0).length} customers  →
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>No customers found</Text>
        ) : filtered.map((c, i) => (
          <TouchableOpacity key={c.id} style={styles.item} onPress={() => openCustomer(c)}>
            <View style={[styles.avatar, { backgroundColor: AVATAR_BG[i % AVATAR_BG.length] }]}>
              <Text style={styles.avatarText}>{initials(c.name)}</Text>
            </View>
            <View style={styles.info}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.name}>{c.name}</Text>
                {c.tier !== 'Regular' && (
                  <View style={[styles.tier, { backgroundColor: TIER_COLORS[c.tier].bg }]}>
                    <Text style={[styles.tierText, { color: TIER_COLORS[c.tier].text }]}>{c.tier}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.phone}>+91 {c.phone} · {c.purchases} purchases</Text>
              <Text style={styles.points}>⭐ {c.points} points</Text>
            </View>
            <View style={styles.right}>
              {c.due > 0
                ? <View style={styles.dueBadge}><Text style={styles.dueBadgeText}>₹{c.due.toLocaleString('en-IN')} due</Text></View>
                : <Text style={styles.clearText}>✓ Clear</Text>
              }
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Customer Detail Modal ── */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={dm.overlay}>
          <View style={dm.sheet}>
            {detailView === 'detail' ? (
              <CustomerDetailView
                customer={selected}
                creditBills={creditBills}
                payments={customerPayments}
                onCollect={() => setDetailView('payment')}
                onClose={closeDetail}
              />
            ) : (
              <CollectPaymentView
                customer={selected}
                payAmount={payAmount}
                setPayAmount={setPayAmount}
                payMethod={payMethod}
                setPayMethod={setPayMethod}
                onConfirm={handleCollectPayment}
                onBack={() => setDetailView('detail')}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Add Customer Modal ── */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={am.overlay}>
          <View style={am.sheet}>
            <Text style={am.title}>Add New Customer</Text>
            <Text style={am.label}>Full Name *</Text>
            <TextInput style={am.input} value={addForm.name} onChangeText={t => setAddForm(f => ({ ...f, name: t }))} placeholder="e.g. Priya Desai" placeholderTextColor={COLORS.textMuted} />
            <Text style={am.label}>Phone Number *</Text>
            <TextInput style={am.input} value={addForm.phone} onChangeText={t => setAddForm(f => ({ ...f, phone: t }))} placeholder="10-digit mobile" keyboardType="phone-pad" placeholderTextColor={COLORS.textMuted} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={am.cancelBtn} onPress={() => { setShowAddModal(false); setAddForm({ name: '', phone: '' }); }}>
                <Text style={{ color: COLORS.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={am.saveBtn} onPress={handleSaveCustomer}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Add Customer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

function CustomerDetailView({ customer, creditBills, payments, onCollect, onClose }) {
  if (!customer) return null;
  const tierColor = TIER_COLORS[customer.tier] || TIER_COLORS.Regular;
  const totalCredit = creditBills.reduce((s, b) => s + b.grandTotal, 0);
  const totalPaid   = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={dm.header}>
        <View style={dm.bigAvatar}>
          <Text style={dm.bigAvatarText}>{initials(customer.name)}</Text>
        </View>
        <Text style={dm.custName}>{customer.name}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <View style={[dm.tierBadge, { backgroundColor: tierColor.bg }]}>
            <Text style={[dm.tierText, { color: tierColor.text }]}>{customer.tier}</Text>
          </View>
          <Text style={dm.custPhone}>+91 {customer.phone}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={dm.statsRow}>
        <View style={dm.statItem}>
          <Text style={dm.statVal}>{customer.purchases}</Text>
          <Text style={dm.statLbl}>Purchases</Text>
        </View>
        <View style={dm.statDivider} />
        <View style={dm.statItem}>
          <Text style={dm.statVal}>{customer.points}</Text>
          <Text style={dm.statLbl}>Points</Text>
        </View>
        <View style={dm.statDivider} />
        <View style={dm.statItem}>
          <Text style={[dm.statVal, customer.due > 0 && { color: COLORS.danger }]}>
            {customer.due > 0 ? `₹${customer.due.toLocaleString('en-IN')}` : '—'}
          </Text>
          <Text style={dm.statLbl}>Due</Text>
        </View>
      </View>

      {/* Due section */}
      {customer.due > 0 && (
        <View style={dm.dueSection}>
          <View style={dm.dueSectionHeader}>
            <Text style={dm.dueSectionTitle}>📒 Pay Later Bills</Text>
            <View style={dm.dueTotalBadge}>
              <Text style={dm.dueTotalText}>₹{customer.due.toLocaleString('en-IN')} pending</Text>
            </View>
          </View>

          {creditBills.length > 0 && (
            <View style={dm.billList}>
              {creditBills.map(b => (
                <View key={b.id} style={dm.billItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={dm.billItemId}>Bill #{b.id.slice(-6)}</Text>
                    <Text style={dm.billItemDate}>
                      {new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text style={dm.billItemItems}>{b.items.length} item{b.items.length > 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={dm.billItemAmt}>₹{b.grandTotal}</Text>
                </View>
              ))}
              {totalCredit > customer.due && (
                <View style={dm.billItem}>
                  <Text style={[dm.billItemId, { color: COLORS.primary }]}>Payments received</Text>
                  <Text style={[dm.billItemAmt, { color: COLORS.primary }]}>−₹{(totalCredit - customer.due).toLocaleString('en-IN')}</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={dm.collectBtn} onPress={onCollect}>
            <Text style={dm.collectBtnText}>💰 Collect Payment</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <View style={dm.historySection}>
          <Text style={dm.historySectionTitle}>Payment History</Text>
          {payments.slice(0, 5).map(p => (
            <View key={p.id} style={dm.historyItem}>
              <View style={{ flex: 1 }}>
                <Text style={dm.historyMethod}>{p.method} payment</Text>
                <Text style={dm.historyDate}>
                  {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <Text style={dm.historyAmt}>₹{p.amount.toLocaleString('en-IN')}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={dm.closeBtn} onPress={onClose}>
        <Text style={dm.closeBtnText}>Close</Text>
      </TouchableOpacity>
      <View style={{ height: 8 }} />
    </ScrollView>
  );
}

function CollectPaymentView({ customer, payAmount, setPayAmount, payMethod, setPayMethod, onConfirm, onBack }) {
  if (!customer) return null;
  return (
    <View>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
        <Text style={{ color: COLORS.primary, fontSize: 14 }}>← Back</Text>
      </TouchableOpacity>

      <Text style={dm.collectTitle}>Collect Payment</Text>
      <Text style={dm.collectSubtitle}>from {customer.name}</Text>

      <View style={dm.dueHighlight}>
        <Text style={dm.dueHighlightLabel}>Outstanding Due</Text>
        <Text style={dm.dueHighlightAmt}>₹{(customer.due || 0).toLocaleString('en-IN')}</Text>
      </View>

      <Text style={dm.collectLabel}>Amount Received ₹</Text>
      <TextInput
        style={dm.collectInput}
        value={payAmount}
        onChangeText={setPayAmount}
        keyboardType="numeric"
        placeholder={String(customer.due || 0)}
        placeholderTextColor={COLORS.textMuted}
        autoFocus
      />
      <TouchableOpacity onPress={() => setPayAmount(String(customer.due || ''))}>
        <Text style={{ color: COLORS.primary, fontSize: 12, marginTop: 4 }}>Tap to fill full amount</Text>
      </TouchableOpacity>

      <Text style={[dm.collectLabel, { marginTop: 16 }]}>Payment Method</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        {PAY_METHODS.map(m => (
          <TouchableOpacity
            key={m}
            style={[dm.pmChip, payMethod === m && dm.pmChipActive]}
            onPress={() => setPayMethod(m)}
          >
            <Text style={[dm.pmChipText, payMethod === m && { color: '#fff' }]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) < customer.due && (
        <View style={dm.partialNote}>
          <Text style={dm.partialNoteText}>
            Partial payment. Remaining due after collection: ₹{(customer.due - parseFloat(payAmount)).toLocaleString('en-IN')}
          </Text>
        </View>
      )}

      <TouchableOpacity style={dm.confirmBtn} onPress={onConfirm}>
        <Text style={dm.confirmBtnText}>✓ Confirm — ₹{payAmount || '0'} via {payMethod}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.primary },
  topbar:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12 },
  title:          { color: '#fff', fontSize: 18, fontWeight: '600' },
  searchWrap:     { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: 12, borderWidth: 0.5, borderColor: COLORS.border },
  searchIcon:     { fontSize: 16, marginRight: 8 },
  searchInput:    { flex: 1, height: 42, fontSize: 14, color: COLORS.text },
  chipRow:        { maxHeight: 44, marginBottom: 4 },
  chip:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 12, color: COLORS.textMuted },
  chipTextActive: { color: '#fff' },
  dueBar:         { marginHorizontal: 12, marginBottom: 6, backgroundColor: COLORS.dangerLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  dueSummary:     { fontSize: 12, color: COLORS.text },
  list:           { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingTop: 4 },
  empty:          { textAlign: 'center', padding: 32, color: COLORS.textMuted, fontSize: 14 },
  item:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: COLORS.border },
  avatar:         { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#fff', fontSize: 14, fontWeight: '600' },
  info:           { flex: 1 },
  name:           { fontSize: 14, fontWeight: '500', color: COLORS.text },
  phone:          { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  points:         { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  tier:           { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  tierText:       { fontSize: 10, fontWeight: '600' },
  right:          { alignItems: 'flex-end', gap: 4 },
  dueBadge:       { backgroundColor: COLORS.dangerLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  dueBadgeText:   { fontSize: 11, fontWeight: '600', color: COLORS.danger },
  clearText:      { fontSize: 13, fontWeight: '500', color: COLORS.primary },
  chevron:        { fontSize: 20, color: COLORS.border },
});

const dm = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, maxHeight: '90%' },
  header:           { alignItems: 'center', paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  bigAvatar:        { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  bigAvatarText:    { color: '#fff', fontSize: 22, fontWeight: '700' },
  custName:         { fontSize: 18, fontWeight: '700', color: COLORS.text },
  custPhone:        { fontSize: 12, color: COLORS.textMuted },
  tierBadge:        { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  tierText:         { fontSize: 11, fontWeight: '600' },
  statsRow:         { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  statItem:         { flex: 1, alignItems: 'center' },
  statVal:          { fontSize: 18, fontWeight: '700', color: COLORS.text },
  statLbl:          { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  statDivider:      { width: 1, backgroundColor: COLORS.border },

  dueSection:       { marginTop: 16, backgroundColor: COLORS.dangerLight, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#fca5a5' },
  dueSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dueSectionTitle:  { fontSize: 13, fontWeight: '600', color: COLORS.danger },
  dueTotalBadge:    { backgroundColor: COLORS.danger, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  dueTotalText:     { color: '#fff', fontSize: 12, fontWeight: '600' },
  billList:         { backgroundColor: COLORS.white, borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  billItem:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  billItemId:       { fontSize: 13, fontWeight: '500', color: COLORS.text },
  billItemDate:     { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  billItemItems:    { fontSize: 11, color: COLORS.textMuted },
  billItemAmt:      { fontSize: 14, fontWeight: '700', color: COLORS.danger },
  collectBtn:       { backgroundColor: COLORS.danger, borderRadius: 10, padding: 13, alignItems: 'center' },
  collectBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },

  historySection:   { marginTop: 16, borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingTop: 14 },
  historySectionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  historyItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: COLORS.bg },
  historyMethod:    { fontSize: 13, color: COLORS.text },
  historyDate:      { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  historyAmt:       { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  closeBtn:         { marginTop: 20, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  closeBtnText:     { color: COLORS.textMuted, fontWeight: '500' },

  // Collect payment view
  collectTitle:     { fontSize: 18, fontWeight: '700', color: COLORS.text },
  collectSubtitle:  { fontSize: 13, color: COLORS.textMuted, marginTop: 2, marginBottom: 16 },
  dueHighlight:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 0.5, borderColor: '#fca5a5' },
  dueHighlightLabel:{ fontSize: 13, color: COLORS.danger },
  dueHighlightAmt:  { fontSize: 20, fontWeight: '800', color: COLORS.danger },
  collectLabel:     { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  collectInput:     { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontWeight: '700', color: COLORS.text },
  pmChip:           { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'center' },
  pmChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pmChipText:       { fontSize: 13, color: COLORS.textMuted },
  partialNote:      { backgroundColor: '#FEF3E2', borderRadius: 8, padding: 10, marginTop: 12 },
  partialNoteText:  { fontSize: 12, color: '#854F0B' },
  confirmBtn:       { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  confirmBtnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const am = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  title:      { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  label:      { fontSize: 12, color: COLORS.textMuted, marginBottom: 5, marginTop: 8 },
  input:      { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.bg },
  cancelBtn:  { flex: 1, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  saveBtn:    { flex: 2, backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
});
