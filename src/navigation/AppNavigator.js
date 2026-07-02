import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import DashboardScreen   from '../screens/DashboardScreen';
import InventoryScreen   from '../screens/InventoryScreen';
import BillingScreen     from '../screens/BillingScreen';
import BillHistoryScreen from '../screens/BillHistoryScreen';
import BillDetailScreen  from '../screens/BillDetailScreen';
import CustomersScreen   from '../screens/CustomersScreen';
import ReportsScreen     from '../screens/ReportsScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import { COLORS } from '../data/medicines';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function BillingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BillingMain"   component={BillingScreen} />
      <Stack.Screen name="BillHistory"   component={BillHistoryScreen} />
      <Stack.Screen name="BillDetail"    component={BillDetailScreen} />
    </Stack.Navigator>
  );
}

const ICONS = {
  Dashboard: '🏠',
  Inventory: '📦',
  Billing:   '🧾',
  Customers: '👥',
  Reports:   '📊',
  Profile:   '👤',
};

const LABELS = {
  Dashboard: 'Home',
  Inventory: 'Stock',
  Billing:   'Bill',
  Customers: 'Clients',
  Reports:   'Reports',
  Profile:   'Me',
};

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: () => (
          <Text style={{ fontSize: 18 }}>{ICONS[route.name] ?? '•'}</Text>
        ),
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: COLORS.border,
          height: 56,
          paddingBottom: 4,
          paddingTop: 4,
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: { fontSize: 9, marginTop: 1 },
        tabBarItemStyle: { paddingHorizontal: 0 },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: LABELS.Dashboard }} />
      <Tab.Screen name="Inventory" component={InventoryScreen} options={{ tabBarLabel: LABELS.Inventory }} />
      <Tab.Screen name="Billing"   component={BillingStack}    options={{ tabBarLabel: LABELS.Billing }} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ tabBarLabel: LABELS.Customers }} />
      <Tab.Screen name="Reports"   component={ReportsScreen}   options={{ tabBarLabel: LABELS.Reports }} />
      <Tab.Screen name="Profile"   component={ProfileScreen}   options={{ tabBarLabel: LABELS.Profile }} />
    </Tab.Navigator>
  );
}
