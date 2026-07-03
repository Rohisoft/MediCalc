const { createClient } = require('@supabase/supabase-js');

// A fresh client per invocation is fine here — this only ever calls
// auth.getUser(token), which is a stateless verification call, not something
// that needs session persistence or the app's own supabase.js singleton.
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Verifies the caller is a logged-in MediPlus user before letting them spend
// the shop's Anthropic budget. Returns the user id on success, or null.
async function requireAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

module.exports = { requireAuth };
