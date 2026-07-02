import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { COLORS } from '../data/medicines';
import { useStore } from '../store/useStore';

const BAR_COLORS = ['#1a6b3a', '#185FA5', '#854F0B', '#993556', '#533AB7'];

const BarRow = ({ label, value, pct, color = COLORS.primary }) => (
  <View style={styles.barRow}>
    <View style={styles.barMeta}>
      <Text style={styles.barLabel}>{label}</Text>
      <Text style={styles.barValue}>{value}</Text>
    </View>
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  </View>
);

function filterBills(bills, period) {
  const now = new Date();
  return bills.filter(b => {
    const d = new Date(b.date);
    if (period === 'Today') return d.toDateString() === now.toDateString();
    if (period === 'This Week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (period === 'This Month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true; // All
  });
}

export default function ReportsScreen() {
  const { state } = useStore();
  const [period, setPeriod] = useState('Today');

  const stats = useMemo(() => {
    const bills = filterBills(state.bills, period);
    const revenue = bills.reduce((s, b) => s + b.grandTotal, 0);
    const profit = Math.round(revenue * 0.256);
    const billCount = bills.length;
    const itemsSold = bills.reduce((s, b) => s + b.items.reduce((ss, i) => ss + i.qty, 0), 0);
    const avgBill = billCount > 0 ? Math.round(revenue / billCount) : 0;
    const avgItems = billCount > 0 ? (itemsSold / billCount).toFixed(1) : '0';

    // Top selling items
    const itemMap = {};
    bills.forEach(b => b.items.forEach(i => {
      itemMap[i.name] = (itemMap[i.name] || 0) + i.qty;
    }));
    const topItems = Object.entries(itemMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const maxQty = topItems[0]?.[1] || 1;

    // Payment breakdown
    const payMap = {};
    bills.forEach(b => {
      payMap[b.paymentMethod] = (payMap[b.paymentMethod] || 0) + b.grandTotal;
    });
    const payEntries = Object.entries(payMap).sort((a, b) => b[1] - a[1]);

    // GST
    const taxable = bills.reduce((s, b) => s + b.subtotal, 0);
    const totalGst = bills.reduce((s, b) => s + b.gst, 0);

    return { revenue, profit, billCount, itemsSold, avgBill, avgItems, topItems, maxQty, payEntries, taxable, totalGst };
  }, [state.bills, period]);

  const noData = stats.billCount === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.topbar}>
        <Text style={styles.title}>Reports</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {['Today', 'This Week', 'This Month', 'All Time'].map(p => (
            <TouchableOpacity key={p} style={[styles.chip, period === p && styles.chipActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.chipText, period === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {noData ? (
          <View style={styles.noData}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>📊</Text>
            <Text style={styles.noDataText}>No bills for {period.toLowerCase()}</Text>
            <Text style={styles.noDataSub}>Complete a bill in Billing tab to see reports</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              {[
                { label: 'Revenue',    value: `₹${stats.revenue.toLocaleString('en-IN')}`,  sub: `Margin ~25.6%`,           subColor: COLORS.primary },
                { label: 'Profit',     value: `₹${stats.profit.toLocaleString('en-IN')}`,   sub: `Est. at 25.6%`,           subColor: COLORS.primary },
                { label: 'Bills',      value: String(stats.billCount),                        sub: `Avg ₹${stats.avgBill}/bill`, subColor: COLORS.textMuted },
                { label: 'Items Sold', value: String(stats.itemsSold),                        sub: `Avg ${stats.avgItems}/bill`, subColor: COLORS.textMuted },
              ].map((s, i) => (
                <View key={i} style={styles.statCard}>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={[styles.statSub, { color: s.subColor }]}>{s.sub}</Text>
                </View>
              ))}
            </View>

            {stats.topItems.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Top selling — {period.toLowerCase()}</Text>
                <View style={styles.card}>
                  {stats.topItems.map(([name, qty], i) => (
                    <BarRow
                      key={name}
                      label={name}
                      value={`${qty} unit${qty > 1 ? 's' : ''}`}
                      pct={Math.round((qty / stats.maxQty) * 100)}
                      color={BAR_COLORS[i % BAR_COLORS.length]}
                    />
                  ))}
                </View>
              </>
            )}

            {stats.payEntries.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Payment methods</Text>
                <View style={styles.card}>
                  {stats.payEntries.map(([method, amount], i) => {
                    const pct = Math.round((amount / stats.revenue) * 100);
                    return (
                      <BarRow
                        key={method}
                        label={method}
                        value={`₹${amount.toLocaleString('en-IN')} (${pct}%)`}
                        pct={pct}
                        color={BAR_COLORS[i % BAR_COLORS.length]}
                      />
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>GST summary</Text>
            <View style={styles.card}>
              {[
                { label: 'Taxable amount', value: `₹${stats.taxable.toLocaleString('en-IN')}` },
                { label: 'CGST (2.5%)',    value: `₹${Math.round(stats.totalGst / 2).toLocaleString('en-IN')}` },
                { label: 'SGST (2.5%)',    value: `₹${Math.round(stats.totalGst / 2).toLocaleString('en-IN')}` },
                { label: 'Total GST',      value: `₹${stats.totalGst.toLocaleString('en-IN')}`, bold: true },
              ].map((r, i) => (
                <View key={i} style={[styles.gstRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: COLORS.border }]}>
                  <Text style={[styles.gstLabel, r.bold && { fontWeight: '600', color: COLORS.text }]}>{r.label}</Text>
                  <Text style={[styles.gstVal, r.bold && { fontWeight: '700', color: COLORS.primary }]}>{r.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.primary },
  topbar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12 },
  title:        { color: '#fff', fontSize: 18, fontWeight: '600' },
  scroll:       { flex: 1, backgroundColor: COLORS.bg },
  chipRow:      { maxHeight: 44, marginVertical: 10 },
  chip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:     { fontSize: 12, color: COLORS.textMuted },
  chipTextActive:{ color: '#fff' },
  noData:       { alignItems: 'center', paddingTop: 60 },
  noDataText:   { fontSize: 15, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  noDataSub:    { fontSize: 12, color: COLORS.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  statCard:     { width: '47%', backgroundColor: COLORS.white, borderRadius: 10, padding: 14, borderWidth: 0.5, borderColor: COLORS.border },
  statLabel:    { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:    { fontSize: 22, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  statSub:      { fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  card:         { marginHorizontal: 12, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: COLORS.border },
  barRow:       { marginBottom: 12 },
  barMeta:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel:     { fontSize: 12, color: COLORS.textMuted },
  barValue:     { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  barTrack:     { height: 8, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden' },
  barFill:      { height: 8, borderRadius: 4 },
  gstRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  gstLabel:     { fontSize: 13, color: COLORS.textMuted },
  gstVal:       { fontSize: 13, color: COLORS.text },
});
