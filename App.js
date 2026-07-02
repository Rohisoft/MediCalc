import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { StoreProvider }          from './src/store/useStore';
import AppNavigator               from './src/navigation/AppNavigator';
import LoginScreen                from './src/screens/LoginScreen';
import RegisterScreen             from './src/screens/RegisterScreen';
import SubscriptionExpiredScreen  from './src/screens/SubscriptionExpiredScreen';
import AdminScreen                from './src/screens/AdminScreen';
import { COLORS }                 from './src/data/medicines';

function getInviteCode() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('code');
}

function RootNavigator() {
  const { loading, isAuthenticated, isSuperAdmin, subscriptionStatus, profile, logout } = useAuth();
  const inviteCode = getInviteCode();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  // Invite link always goes to register, even if someone is already logged in
  if (inviteCode) {
    if (isAuthenticated) logout();
    return <RegisterScreen inviteCode={inviteCode} />;
  }

  if (!isAuthenticated) return <LoginScreen />;

  // Authenticated but profile not loaded yet (race condition after first registration)
  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (subscriptionStatus === 'expired') return <SubscriptionExpiredScreen />;

  // Superadmin gets the admin panel instead of the pharmacy app
  if (isSuperAdmin) {
    return (
      <NavigationContainer>
        <AdminScreen />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StoreProvider>
          <RootNavigator />
        </StoreProvider>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
