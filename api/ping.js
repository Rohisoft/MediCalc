// Throwaway smoke-test endpoint — confirms Vercel picks up /api functions and
// that env vars resolve in the serverless runtime. Delete once ask-data.js
// and parse-voice-items.js are both live and verified.
module.exports = async function handler(req, res) {
  res.status(200).json({
    ok: true,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  });
};
