const Anthropic = require('@anthropic-ai/sdk');
const { client, MODEL } = require('./_lib/anthropic');
const { requireAuth } = require('./_lib/auth');

const SYSTEM_PROMPT = `You convert a spoken pharmacy billing command into a list of cart items. Extract each medicine name mentioned and its quantity. If no quantity is stated for an item, use 1. Ignore filler words like "add", "give me", "please". Split multiple items connected by "and", commas, or "then". Keep medicine names as spoken — do not correct spelling or expand abbreviations.`;

const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: { type: 'integer' },
        },
        required: ['name', 'qty'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const MAX_TRANSCRIPT_LENGTH = 2000;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await requireAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { transcript } = req.body || {};
  if (typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'transcript is required' });
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return res.status(400).json({ error: 'transcript is too long' });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: ITEM_SCHEMA },
      },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        { role: 'user', content: transcript.trim() },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(200).json({ error: "Couldn't parse that — try again or search manually." });
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const parsed = textBlock ? JSON.parse(textBlock.text) : { items: [] };
    return res.status(200).json({ items: Array.isArray(parsed.items) ? parsed.items : [] });
  } catch (err) {
    console.error('parse-voice-items:', err);
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Too many requests right now — try again in a moment.' });
    }
    if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.InternalServerError) {
      return res.status(502).json({ error: 'AI service is temporarily unavailable.' });
    }
    return res.status(502).json({ error: 'Something went wrong parsing that.' });
  }
};
