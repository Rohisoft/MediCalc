import { fuzzyMatch } from './fuzzyMatch';

// Free, on-device parser for voice billing commands like
// "two strips paracetamol and one bottle cough syrup" — no API call.
// Deliberately simple: unlike bill-scan OCR, voice cart items don't need
// price/expiry (those come from the matched medicine's own record), so
// this only needs to recover a quantity and a name per spoken item.

const NUM_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20,
};

const UNIT_WORDS = new Set([
  'strip', 'strips', 'tablet', 'tablets', 'tab', 'tabs', 'bottle', 'bottles',
  'vial', 'vials', 'injection', 'injections', 'syrup', 'cream', 'ointment',
  'sachet', 'sachets', 'powder', 'drop', 'drops', 'capsule', 'capsules',
  'cap', 'caps', 'pack', 'packs', 'box', 'boxes', 'piece', 'pieces', 'pcs',
]);

const LEADING_COMMAND = /^(please\s+)?(add|give me|i need|i want|get me)\s+/i;

export function parseVoiceText(transcript, medicines) {
  const cleaned = (transcript || '').trim().replace(LEADING_COMMAND, '');
  if (!cleaned) return [];

  const chunks = cleaned.split(/\s*(?:,|\band\b|\bthen\b|\bplus\b)\s*/i).filter(Boolean);

  return chunks
    .map((chunk, i) => {
      const tokens = chunk.trim().split(/\s+/);
      let idx = 0;
      let qty = 1;

      const first = (tokens[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (/^\d+$/.test(first)) {
        qty = parseInt(first, 10);
        idx = 1;
      } else if (NUM_WORDS[first] != null) {
        qty = NUM_WORDS[first];
        idx = 1;
      }

      if (UNIT_WORDS.has((tokens[idx] || '').toLowerCase())) idx++;
      if ((tokens[idx] || '').toLowerCase() === 'of') idx++;

      const name = tokens.slice(idx).join(' ').trim();
      return {
        id: i,
        name,
        qty: Math.max(1, qty),
        match: name ? fuzzyMatch(name, medicines) : null,
      };
    })
    .filter((item) => item.name.length > 1);
}
