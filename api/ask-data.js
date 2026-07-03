const Anthropic = require('@anthropic-ai/sdk');
const { client, MODEL } = require('./_lib/anthropic');
const { requireAuth } = require('./_lib/auth');

const SYSTEM_PROMPT = `You are a data analyst embedded in MediPlus, a pharmacy point-of-sale app. You answer the shop owner's questions about their own sales and inventory data, which is provided to you as JSON.

Rules:
- Use ₹ for all currency figures.
- Be concise and concrete — name specific medicines and give specific numbers, not generic advice.
- If the data doesn't contain enough information to answer confidently, say so rather than guessing.
- The JSON has: shop (overall stats), medicines (per-medicine stock/sales rollup, including daysSinceLastSale), monthlyByCategory (monthly sales trend per category), topCustomersByDue (customers who owe money).`;

// Defensive cap — bounds worst-case token cost per call regardless of how
// this function gets invoked (e.g. a scripted call with an inflated payload).
const MAX_SUMMARY_JSON_LENGTH = 200_000;
const MAX_QUESTION_LENGTH = 1000;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await requireAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { question, dataSummary } = req.body || {};
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: 'question is too long' });
  }
  const summaryJson = JSON.stringify(dataSummary || {});
  if (summaryJson.length > MAX_SUMMARY_JSON_LENGTH) {
    return res.status(400).json({ error: 'dataSummary is too large' });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        { role: 'user', content: `Shop data:\n${summaryJson}\n\nQuestion: ${question.trim()}` },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(200).json({ error: "Couldn't process that question — try rephrasing it." });
    }

    const textBlock = response.content.find(b => b.type === 'text');
    return res.status(200).json({ answer: textBlock ? textBlock.text : '' });
  } catch (err) {
    console.error('ask-data:', err);
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Too many requests right now — try again in a moment.' });
    }
    if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.InternalServerError) {
      return res.status(502).json({ error: 'AI service is temporarily unavailable.' });
    }
    return res.status(502).json({ error: 'Something went wrong processing that question.' });
  }
};
