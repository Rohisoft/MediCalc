const Anthropic = require('@anthropic-ai/sdk');

// Server-side only — process.env.ANTHROPIC_API_KEY is injected by Vercel into
// the serverless function runtime directly. Never route this through
// webpack's DefinePlugin (that would bake it into the client bundle).
const client = new Anthropic();

const MODEL = 'claude-sonnet-5';

module.exports = { client, MODEL };
