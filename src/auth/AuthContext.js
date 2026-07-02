import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [loading,  setLoading]  = useState(true);
  const [user,     setUser]     = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [tenant,   setTenant]   = useState(null);

  useEffect(() => {
    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for sign-in / sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setUser(null); setProfile(null); setTenant(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*, tenant:tenants(*)')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);
      setTenant(data?.tenant ?? null);
      setUser({ id: userId });
    } catch (e) {
      console.error('loadProfile:', e.message);
    } finally {
      setLoading(false);
    }
  }

  // days until subscription expires  (negative = already expired)
  const daysLeft = () => {
    if (!tenant?.subscription_end) return 0;
    return Math.ceil((new Date(tenant.subscription_end) - new Date()) / 86_400_000);
  };

  // 'active' | 'warning' (≤7 days) | 'expired'
  const subscriptionStatus = () => {
    if (!user) return 'none';
    if (profile?.role === 'superadmin') return 'active';
    if (tenant?.status === 'suspended') return 'expired';
    const d = daysLeft();
    if (d <= 0) return 'expired';
    if (d <= 7) return 'warning';
    return 'active';
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = () => supabase.auth.signOut();

  const refreshTenant = () => user && loadProfile(user.id);

  return (
    <AuthCtx.Provider value={{
      loading,
      user,
      profile,
      tenant,
      isAuthenticated:    !!user,
      isSuperAdmin:       profile?.role === 'superadmin',
      subscriptionStatus: subscriptionStatus(),
      daysLeft:           daysLeft(),
      login,
      logout,
      refreshTenant,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
