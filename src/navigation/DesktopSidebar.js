import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../data/medicines';

export const SIDEBAR_WIDTH = 220;

const ICONS = {
  Dashboard: '🏠',
  Inventory: '📦',
  Billing:   '🧾',
  Customers: '👥',
  Reports:   '📊',
  Profile:   '👤',
};

// Full labels, unlike the phone tab bar's abbreviated LABELS map
// ("Home"/"Stock"/"Bill") which was sized for a cramped 56px bottom bar —
// the sidebar has room to say what things actually are.
const DESKTOP_LABELS = {
  Dashboard: 'Dashboard',
  Inventory: 'Inventory',
  Billing:   'Billing',
  Customers: 'Customers',
  Reports:   'Reports',
  Profile:   'Profile',
};

// Consumed via Tab.Navigator's `tabBar` render-prop — receives the same
// { state, descriptors, navigation } shape the default BottomTabBar gets,
// so route state / nested stacks / active-tab tracking all just work.
export default function DesktopSidebar({ state, navigation }) {
  return (
    <View style={s.sidebar}>
      <View style={s.brand}>
        <Text style={s.brandIcon}>💊</Text>
        <Text style={s.brandText}>MediPlus</Text>
      </View>

      <View style={s.nav}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label = DESKTOP_LABELS[route.name] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[s.navItem, isFocused && s.navItemActive]}
            >
              <Text style={s.navIcon}>{ICONS[route.name] ?? '•'}</Text>
              <Text style={[s.navLabel, isFocused && s.navLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.footer}>Powered by VRNDAI</Text>
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDEBAR_WIDTH,
    backgroundColor: COLORS.white, borderRightWidth: 1, borderRightColor: COLORS.border,
    paddingVertical: 20, paddingHorizontal: 12,
  },
  brand:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, marginBottom: 28 },
  brandIcon:  { fontSize: 22 },
  brandText:  { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  nav:        { gap: 2 },
  navItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10 },
  navItemActive: { backgroundColor: COLORS.primaryLight },
  navIcon:    { fontSize: 17, width: 20, textAlign: 'center' },
  navLabel:   { fontSize: 14, fontWeight: '500', color: COLORS.textMuted },
  navLabelActive: { color: COLORS.primary, fontWeight: '700' },
  footer:     { position: 'absolute', bottom: 16, left: 20, fontSize: 10, color: COLORS.border },
});
