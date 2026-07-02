import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, SafeAreaView,
} from 'react-native';
import { COLORS } from '../data/medicines';
import { useStore } from '../store/useStore';
import { useAuth }  from '../auth/AuthContext';
import { useIsDesktop } from '../utils/responsive';
import DesktopContainer from '../components/DesktopContainer';

const MONTH = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

function parseExpiry(str) {
  const [mon, yr] = (str || '').split(' ');
  if (MONTH[mon] === undefined || !yr) return null;
  return new Date(parseInt(yr), MONTH[mon] + 1, 0);
}

const StatCard = ({ label, value, sub, variant, style }) => (
  <View style={[styles.statCard, style, variant === 'danger' && styles.statDanger, variant === 'warning' && styles.statWarning]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, variant === 'danger' && { color: COLORS.danger }, variant === 'warning' && { color: COLORS.warning }]}>
      {value}
    </Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
);

const AlertRow = ({ a }) => (
  <View style={styles.alertItem}>
    <View style={[styles.alertIcon, { backgroundColor: a.badgeBg }]}>
      <Text style={{ fontSize: 18 }}>{a.icon}</Text>
    </View>
    <View style={styles.alertText}>
      <Text style={styles.alertName}>{a.name}</Text>
      <Text style={styles.alertDesc}>{a.desc}</Text>
    </View>
    <View style={[styles.badge, { backgroundColor: a.badgeBg }]}>
      <Text style={[styles.badgeText, { color: a.badgeColor }]}>{a.badge}</Text>
    </View>
  </View>
);

const QUICK_ACTIONS = [
  { icon: '🧾', label: 'New Bill',   sub: 'Create sale invoice', screen: 'Billing'   },
  { icon: '📦', label: 'Add Stock',  sub: 'Update inventory',    screen: 'Inventory' },
  { icon: '👥', label: 'Customers',  sub: 'View & manage',       screen: 'Customers' },
  { icon: '📊', label: 'Reports',    sub: 'Sales & stock',       screen: 'Reports'   },
];

export default function DashboardScreen({ navigation }) {
  const { state } = useStore();
  const { settings } = state;
  const { subscriptionStatus, daysLeft } = useAuth();
  const isDesktop = useIsDesktop();
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const todayBills = state.bills.filter(b => new Date(b.date).toDateString() === todayStr);
    const todaySales = todayBills.reduce((s, b) => s + b.grandTotal, 0);

    const lowStock = state.medicines.filter(m => m.status === 'low' || m.status === 'out');
    const expiringSoon = state.medicines.filter(m => {
      const d = parseExpiry(m.expiry);
      return d && d <= in30;
    });

    const totalDue = state.customers.reduce((s, c) => s + (c.due || 0), 0);
    const customersWithDue = state.customers.filter(c => c.due > 0);

    return { todaySales, billCount: todayBills.length, lowStock, expiringSoon, totalDue, customersWithDue };
  }, [state.bills, state.medicines, state.customers]);

  const alerts = [
    ...stats.lowStock.slice(0, 2).map(m => ({
      icon: '📦',
      name: m.name,
      desc: m.status === 'out' ? 'Out of stock — reorder now' : `Only ${m.stock} left — reorder`,
      badge: m.status === 'out' ? 'Out' : 'Low',
      badgeColor: COLORS.warning,
      badgeBg: COLORS.warningLight,
    })),
    ...stats.expiringSoon.slice(0, 1).map(m => ({
      icon: '📅',
      name: m.name,
      desc: `Expires ${m.expiry}`,
      badge: 'Expiry',
      badgeColor: COLORS.danger,
      badgeBg: COLORS.dangerLight,
    })),
    ...(stats.totalDue > 0 ? [{
      icon: '💰',
      name: 'Pending Dues',
      desc: `₹${stats.totalDue.toLocaleString('en-IN')} from ${stats.customersWithDue.length} customer${stats.customersWithDue.length > 1 ? 's' : ''}`,
      badge: 'Due',
      badgeColor: COLORS.danger,
      badgeBg: COLORS.dangerLight,
    }] : []),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Compact merged header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <View style={styles.headerDot} />
            <Text style={styles.headerAppName}>MedicalC</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>{today}</Text>
            {state.cart.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Billing')} style={styles.cartBtn}>
                <Text style={styles.cartText}>🛒 {state.cart.length}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.headerGreeting}>Good morning, {settings.ownerName} 👋</Text>
      </View>

      {subscriptionStatus === 'warning' && (
        <View style={styles.subWarning}>
          <Text style={styles.subWarningText}>
            ⚠️ Subscription expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — contact Samrath: 8878069736
          </Text>
        </View>
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {isDesktop ? (
          <DesktopContainer>
            <View style={styles.desktopRow}>
              <View style={styles.desktopMain}>
                <View style={[styles.statsGrid, styles.statsGridDesktop]}>
                  <StatCard
                    style={styles.statCardDesktop}
                    label="Today's Sales"
                    value={`₹${stats.todaySales.toLocaleString('en-IN')}`}
                    sub={stats.billCount > 0 ? `${stats.billCount} bill${stats.billCount > 1 ? 's' : ''} today` : 'No bills yet'}
                  />
                  <StatCard
                    style={styles.statCardDesktop}
                    label="Bills Today"
                    value={String(stats.billCount)}
                    sub={stats.billCount > 0 ? 'Tap Billing to add' : 'Create first bill'}
                  />
                  <StatCard
                    style={styles.statCardDesktop}
                    label="Low Stock"
                    value={String(stats.lowStock.length)}
                    sub="Items need reorder"
                    variant={stats.lowStock.length > 0 ? 'warning' : undefined}
                  />
                  <StatCard
                    style={styles.statCardDesktop}
                    label="Expiring Soon"
                    value={String(stats.expiringSoon.length)}
                    sub="Within 30 days"
                    variant={stats.expiringSoon.length > 0 ? 'danger' : undefined}
                  />
                </View>

                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={[styles.qaGrid, styles.qaGridDesktop]}>
                  {QUICK_ACTIONS.map((q, i) => (
                    <TouchableOpacity key={i} style={[styles.qaBtn, styles.qaBtnDesktop]} onPress={() => navigation.navigate(q.screen)}>
                      <Text style={styles.qaIcon}>{q.icon}</Text>
                      <Text style={styles.qaLabel}>{q.label}</Text>
                      <Text style={styles.qaSub}>{q.sub}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {alerts.length > 0 && (
                <View style={styles.desktopSide}>
                  <Text style={styles.sectionTitle}>⚠️ Alerts</Text>
                  {alerts.map((a, i) => <AlertRow key={i} a={a} />)}
                </View>
              )}
            </View>

            <View style={styles.watermark}>
              <Text style={styles.watermarkText}>Powered by VRNDAI · vrndai.com</Text>
            </View>
            <View style={{ height: 8 }} />
          </DesktopContainer>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                label="Today's Sales"
                value={`₹${stats.todaySales.toLocaleString('en-IN')}`}
                sub={stats.billCount > 0 ? `${stats.billCount} bill${stats.billCount > 1 ? 's' : ''} today` : 'No bills yet'}
              />
              <StatCard
                label="Bills Today"
                value={String(stats.billCount)}
                sub={stats.billCount > 0 ? 'Tap Billing to add' : 'Create first bill'}
              />
              <StatCard
                label="Low Stock"
                value={String(stats.lowStock.length)}
                sub="Items need reorder"
                variant={stats.lowStock.length > 0 ? 'warning' : undefined}
              />
              <StatCard
                label="Expiring Soon"
                value={String(stats.expiringSoon.length)}
                sub="Within 30 days"
                variant={stats.expiringSoon.length > 0 ? 'danger' : undefined}
              />
            </View>

            {alerts.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>⚠️ Alerts</Text>
                {alerts.map((a, i) => <AlertRow key={i} a={a} />)}
              </>
            )}

            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.qaGrid}>
              {QUICK_ACTIONS.map((q, i) => (
                <TouchableOpacity key={i} style={styles.qaBtn} onPress={() => navigation.navigate(q.screen)}>
                  <Text style={styles.qaIcon}>{q.icon}</Text>
                  <Text style={styles.qaLabel}>{q.label}</Text>
                  <Text style={styles.qaSub}>{q.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.watermark}>
              <Text style={styles.watermarkText}>Powered by VRNDAI · vrndai.com</Text>
            </View>
            <View style={{ height: 8 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.primary },
  header:          { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBrand:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerDot:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#64B5F6' },
  headerAppName:   { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  headerRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDate:      { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  headerGreeting:  { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '400', marginTop: 6 },
  cartBtn:         { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  cartText:        { color: '#fff', fontSize: 12, fontWeight: '600' },
  scroll:          { flex: 1, backgroundColor: COLORS.bg },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  statCard:     { width: '47%', backgroundColor: COLORS.white, borderRadius: 10, padding: 14, borderWidth: 0.5, borderColor: COLORS.border },
  statDanger:   { borderColor: '#fca5a5' },
  statWarning:  { borderColor: '#fcd34d' },
  statLabel:    { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:    { fontSize: 22, fontWeight: '600', marginTop: 4, color: COLORS.text },
  statSub:      { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  alertItem:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.white, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: COLORS.border },
  alertIcon:    { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  alertText:    { flex: 1 },
  alertName:    { fontSize: 13, fontWeight: '500', color: COLORS.text },
  alertDesc:    { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  badge:        { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 10, fontWeight: '600' },
  qaGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  qaBtn:        { width: '47%', backgroundColor: COLORS.white, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: COLORS.border },
  qaIcon:       { fontSize: 24, marginBottom: 8 },
  qaLabel:      { fontSize: 13, fontWeight: '600', color: COLORS.text },
  qaSub:        { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  watermark:      { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  watermarkText:  { fontSize: 10, color: COLORS.border, letterSpacing: 0.3 },
  subWarning:     { backgroundColor: '#fef3c7', paddingHorizontal: 14, paddingVertical: 9 },
  subWarningText: { fontSize: 12, color: '#92400e', fontWeight: '500', textAlign: 'center' },

  // Desktop-only — main content (stats + quick actions) beside an alerts sidebar.
  desktopRow:        { flexDirection: 'row', gap: 24, paddingVertical: 24 },
  desktopMain:        { flex: 1 },
  desktopSide:        { width: 300 },
  statsGridDesktop:   { padding: 0, marginBottom: 8 },
  statCardDesktop:    { width: '23%' },
  qaGridDesktop:      { paddingHorizontal: 0 },
  qaBtnDesktop:       { width: '23%' },
});
