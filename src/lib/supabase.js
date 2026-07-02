import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL  || '',
  process.env.SUPABASE_ANON_KEY || '',
  {
    auth: {
      persistSession: true,
      storageKey: 'medicalc_auth_v1',
      autoRefreshToken: true,
    },
  }
);
