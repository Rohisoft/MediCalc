const Anthropic = require('@anthropic-ai/sdk');
const { client, MODEL } = require('./_lib/anthropic');
const { requireAuth } = require('./_lib/auth');

const SYSTEM_PROMPT = `You are reading a photo of a wholesale pharmacy bill/invoice. Extract every medicine line item you can find: name, quantity, unit, price, and expiry.

- unit: one of Tablet, Capsule, Strip, Bottle, Vial, Injection, Syrup, Cream, Ointment, Sachet, Powder, Drops. Default to Strip if unclear.
- price: the per-unit rate column for that line, not the line total.
- expiry: convert to "MMM YYYY" format (e.g. "Jun 2027") if shown, otherwise null.
- Skip header rows, totals, tax lines, and anything that isn't an actual product line.
- If a field genuinely isn't present on the bill, use null rather than guessing.`;

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
          unit: { type: ['string', 'null'] },
          price: { type: ['number', 'null'] },
          expiry: { type: ['string', 'null'] },
        },
        required: ['name', 'qty', 'unit', 'price', 'expiry'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Defensive cap — a properly client-resized image should be well under 1MB;
// this only guards against a scripted call bypassing the client-side resize.
const MAX_BASE64_LENGTH = 6_000_000;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await requireAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { imageBase64, mediaType } = req.body || {};
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return res.status(400).json({ error: 'Image is too large' });
  }
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return res.status(400).json({ error: 'Unsupported image type' });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: ITEM_SCHEMA },
      },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Extract every medicine line item from this bill.' },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(200).json({ error: "Couldn't read that bill — try Free Scan instead." });
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const parsed = textBlock ? JSON.parse(textBlock.text) : { items: [] };
    return res.status(200).json({ items: Array.isArray(parsed.items) ? parsed.items : [] });
  } catch (err) {
    console.error('parse-bill-image:', err);
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Too many requests right now — try again in a moment.' });
    }
    if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.InternalServerError) {
      return res.status(502).json({ error: 'AI service is temporarily unavailable.' });
    }
    return res.status(502).json({ error: 'Something went wrong reading that bill.' });
  }
};
