import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, Share, Platform,
} from 'react-native';
import { COLORS } from '../data/medicines';
import { useStore } from '../store/useStore';
import { formatBillDate, formatBillId, shareBill } from '../utils/receipt';

const PAY_ICONS = { Cash: '💵', UPI: '📱', Card: '💳', Credit: '📒' };

export default function BillDetailScreen({ route, navigation }) {
  const { billId } = route.params;
  const { state } = useStore();
  const [sharing, setSharing] = useState(false);

  const bill = state.bills.find(b => b.id === billId);
  const settings = state.settings;

  if (!bill) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: COLORS.textMuted }}>Bill not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleShare = async () => {
    setSharing(true);
    try {
      if (Platform.OS !== 'web') {
        await Share.share({
          message: require('../utils/receipt').generateReceiptText(bill, settings),
          title: `Receipt ₹${bill.grandTotal}`,
        });
        setSharing(false);
        return;
      }
      const result = await shareBill(bill, settings);
      if (result === 'copied') {
        Alert.alert(
          'Receipt Copied ✅',
          'Receipt text copied to clipboard.\nPaste it in WhatsApp, SMS or Email to send to customer.',
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Could not share receipt.');
    }
    setSharing(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Receipt</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Receipt card */}
        <View style={styles.receipt}>

          {/* Shop header */}
          <View style={styles.shopHeader}>
            <Text style={styles.shopIcon}>💊</Text>
            <Text style={styles.shopName}>{settings.shopName}</Text>
            {settings.address ? <Text style={styles.shopDetail}>{settings.address}</Text> : null}
            {settings.phone ? <Text style={styles.shopDetail}>📞 {settings.phone}</Text> : null}
            {settings.gstNumber ? <Text style={styles.shopDetail}>GST: {settings.gstNumber}</Text> : null}
          </View>

          <View style={styles.dashed} />

          {/* Bill info */}
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bill No.</Text>
              <Text style={styles.infoVal}>#{formatBillId(bill.id)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date & Time</Text>
              <Text style={styles.infoVal}>{formatBillDate(bill.date)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoVal}>{bill.customerName || 'Walk-in'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment</Text>
              <Text style={styles.infoVal}>{PAY_ICONS[bill.paymentMethod] || ''} {bill.paymentMethod}</Text>
            </View>
          </View>

          <View style={styles.dashed} />

          {/* Items */}
          <View style={styles.section}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 3 }]}>ITEM</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>QTY</Text>
              <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right' }]}>AMOUNT</Text>
            </View>
            {bill.items.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.itemName, { flex: 3 }]}>{item.name}</Text>
                <Text style={[styles.itemQty, { flex: 1 }]}>×{item.qty}</Text>
                <Text style={[styles.itemTotal, { flex: 1.2 }]}>₹{item.price * item.qty}</Text>
              </View>
            ))}
          </View>

          <View style={styles.dashed} />

          {/* Totals */}
          <View style={styles.section}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalVal}>₹{bill.subtotal}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST (5%)</Text>
              <Text style={styles.totalVal}>₹{bill.gst}</Text>
            </View>
            {bill.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={[styles.totalVal, { color: COLORS.danger }]}>−₹{bill.discount}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={styles.grandLabel}>TOTAL</Text>
              <Text style={styles.grandVal}>₹{bill.grandTotal}</Text>
            </View>
          </View>

          <View style={styles.dashed} />

          {/* Footer */}
          <View style={styles.footer}>
            {settings.phone ? <Text style={styles.footerPhone}>📞 {settings.phone}</Text> : null}
            <Text style={styles.footerText}>Thank you for visiting! 🙏</Text>
            <Text style={styles.footerSub}>Powered by VRNDAI · vrndai.com</Text>
          </View>

        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Share button — fixed at bottom */}
      <View style={styles.shareBar}>
        <TouchableOpacity
          style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
          onPress={handleShare}
          disabled={sharing}
        >
          <Text style={styles.shareBtnText}>
            {sharing ? 'Preparing…' : '📤 Share Receipt'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.copyBtn}
          onPress={async () => {
            try {
              const text = require('../utils/receipt').generateReceiptText(bill, settings);
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                Alert.alert('Copied ✅', 'Receipt copied to clipboard.');
              } else {
                Alert.alert('Receipt', text);
              }
            } catch { /* ignore */ }
          }}
        >
          <Text style={styles.copyBtnText}>📋 Copy</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.primary },
  topbar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:      { width: 60 },
  backText:     { color: '#fff', fontSize: 14 },
  title:        { color: '#fff', fontSize: 17, fontWeight: '600' },
  scroll:       { flex: 1, backgroundColor: COLORS.bg },
  scrollContent:{ padding: 16 },

  receipt:      { backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: COLORS.border },

  shopHeader:   { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, backgroundColor: COLORS.primaryLight },
  shopIcon:     { fontSize: 32, marginBottom: 6 },
  shopName:     { fontSize: 18, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  shopDetail:   { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },

  dashed:       { borderTopWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed', marginHorizontal: 16 },

  section:      { paddingHorizontal: 16, paddingVertical: 14 },

  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel:    { fontSize: 12, color: COLORS.textMuted },
  infoVal:      { fontSize: 12, fontWeight: '500', color: COLORS.text, maxWidth: '60%', textAlign: 'right' },

  tableHeader:  { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  tableCell:    { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  tableRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.bg },
  itemName:     { fontSize: 13, color: COLORS.text },
  itemQty:      { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  itemTotal:    { fontSize: 13, fontWeight: '500', color: COLORS.text, textAlign: 'right' },

  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel:   { fontSize: 13, color: COLORS.textMuted },
  totalVal:     { fontSize: 13, color: COLORS.text },
  grandRow:     { borderTopWidth: 1.5, borderTopColor: COLORS.primary, marginTop: 8, paddingTop: 10 },
  grandLabel:   { fontSize: 15, fontWeight: '700', color: COLORS.text },
  grandVal:     { fontSize: 17, fontWeight: '800', color: COLORS.primary },

  footer:       { alignItems: 'center', paddingVertical: 18, backgroundColor: COLORS.bg },
  footerPhone:  { fontSize: 13, color: COLORS.primary, fontWeight: '500', marginBottom: 4 },
  footerText:   { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  footerSub:    { fontSize: 10, color: COLORS.textMuted, marginTop: 6 },

  shareBar:         { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 24, backgroundColor: COLORS.white, borderTopWidth: 0.5, borderTopColor: COLORS.border },
  shareBtn:         { flex: 3, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  shareBtnDisabled: { backgroundColor: COLORS.textMuted },
  shareBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  copyBtn:          { flex: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  copyBtnText:      { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
});
