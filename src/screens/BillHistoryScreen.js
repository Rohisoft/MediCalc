import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { COLORS } from '../data/medicines';
import { useStore } from '../store/useStore';
import { formatBillDate, formatBillId } from '../utils/receipt';

const PAY_COLORS = {
  Cash:   { bg: '#EAF3DE', text: '#3B6D11' },
  UPI:    { bg: '#E8F0FE', text: '#1A56DB' },
  Card:   { bg: '#EEEDFE', text: '#533AB7' },
  Credit: { bg: '#FDECEA', text: '#C0392B' },
};

function groupByDate(bills) {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterdayStr = new Date(now - 86400000).toDateString();

  const groups = {};
  [...bills]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(bill => {
      const d = new Date(bill.date);
      const key = d.toDateString();
      const label = key === todayStr ? 'Today' : key === yesterdayStr ? 'Yesterday'
        : d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(bill);
    });
  return Object.entries(groups);
}

export default function BillHistoryScreen({ navigation }) {
  const { state } = useStore();

  const grouped = useMemo(() => groupByDate(state.bills), [state.bills]);

  const totalRevenue = useMemo(
    () => state.bills.reduce((s, b) => s + b.grandTotal, 0),
    [state.bills],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Bill History</Text>
        <View style={{ width: 60 }} />
      </View>

      {state.bills.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{state.bills.length}</Text>
            <Text style={styles.summaryLabel}>Total Bills</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>₹{totalRevenue.toLocaleString('en-IN')}</Text>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {state.bills.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 44, textAlign: 'center' }}>🧾</Text>
            <Text style={styles.emptyTitle}>No bills yet</Text>
            <Text style={styles.emptySub}>Complete a bill in Billing tab to see history here</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
              <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Create New Bill</Text>
            </TouchableOpacity>
          </View>
        ) : grouped.map(([dateLabel, bills]) => {
          const dayTotal = bills.reduce((s, b) => s + b.grandTotal, 0);
          return (
            <View key={dateLabel}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateLabel}>{dateLabel}</Text>
                <Text style={styles.dateTotal}>₹{dayTotal.toLocaleString('en-IN')}</Text>
              </View>
              {bills.map(bill => {
                const payStyle = PAY_COLORS[bill.paymentMethod] || PAY_COLORS.Cash;
                return (
                  <TouchableOpacity
                    key={bill.id}
                    style={styles.card}
                    onPress={() => navigation.navigate('BillDetail', { billId: bill.id })}
                  >
                    <View style={styles.cardLeft}>
                      <View style={styles.billNumRow}>
                        <Text style={styles.billNum}>#{formatBillId(bill.id)}</Text>
                        <View style={[styles.payBadge, { backgroundColor: payStyle.bg }]}>
                          <Text style={[styles.payBadgeText, { color: payStyle.text }]}>
                            {bill.paymentMethod}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.billTime}>
                        {new Date(bill.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {bill.customerName ? ` · ${bill.customerName}` : ' · Walk-in'}
                      </Text>
                      <Text style={styles.billItems}>
                        {bill.items.length} item{bill.items.length > 1 ? 's' : ''}
                        {' — '}
                        {bill.items.slice(0, 2).map(i => i.name).join(', ')}
                        {bill.items.length > 2 ? ` +${bill.items.length - 2} more` : ''}
                      </Text>
                    </View>
                    <View style={styles.cardRight}>
                      <Text style={styles.amount}>₹{bill.grandTotal.toLocaleString('en-IN')}</Text>
                      <Text style={styles.arrow}>›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.primary },
  topbar:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:        { width: 60 },
  backText:       { color: '#fff', fontSize: 14 },
  title:          { color: '#fff', fontSize: 17, fontWeight: '600' },
  summaryBar:     { flexDirection: 'row', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryVal:     { color: '#fff', fontSize: 18, fontWeight: '700' },
  summaryLabel:   { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 4 },
  scroll:         { flex: 1, backgroundColor: COLORS.bg },
  empty:          { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle:     { fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptySub:       { fontSize: 13, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
  emptyBtn:       { marginTop: 20, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  dateHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  dateLabel:      { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  dateTotal:      { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  card:           { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: COLORS.border },
  cardLeft:       { flex: 1 },
  billNumRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  billNum:        { fontSize: 14, fontWeight: '700', color: COLORS.text },
  payBadge:       { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  payBadgeText:   { fontSize: 10, fontWeight: '600' },
  billTime:       { fontSize: 11, color: COLORS.textMuted, marginBottom: 3 },
  billItems:      { fontSize: 12, color: COLORS.textMuted },
  cardRight:      { alignItems: 'flex-end', gap: 4 },
  amount:         { fontSize: 16, fontWeight: '700', color: COLORS.text },
  arrow:          { fontSize: 20, color: COLORS.border },
});
