// Matches a free-text name (from OCR or voice transcription) against the
// existing medicine list: exact match, then substring match either
// direction, then a first-word-prefix match. Used by both bill-scanning
// (ScanBillModal.js) and voice billing.
export function fuzzyMatch(name, medicines) {
  const q = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  let m = medicines.find(x => x.name.toLowerCase() === q);
  if (m) return m;
  m = medicines.find(x => x.name.toLowerCase().includes(q) || q.includes(x.name.toLowerCase()));
  if (m) return m;
  const first = q.split(' ')[0];
  if (first.length > 3) m = medicines.find(x => x.name.toLowerCase().startsWith(first));
  return m || null;
}
