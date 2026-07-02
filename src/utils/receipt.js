export function formatBillDate(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

export function formatBillId(id) {
  return id.replace('BILL-', '').slice(-6);
}

export function generateReceiptText(bill, settings) {
  const sep = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const lines = [];

  lines.push(`💊 *${(settings.shopName || 'Medical Store').toUpperCase()}*`);
  if (settings.address) lines.push(`📍 ${settings.address}`);
  lines.push('');
  lines.push(sep);
  lines.push(`*Bill #: ${formatBillId(bill.id)}*`);
  lines.push(`📅 ${formatBillDate(bill.date)}`);
  if (bill.customerName) lines.push(`👤 ${bill.customerName}`);
  lines.push(sep);
  lines.push('');
  lines.push('*ITEMS:*');
  bill.items.forEach(item => {
    lines.push(`• ${item.name} × ${item.qty}  =  ₹${item.price * item.qty}`);
  });
  lines.push('');
  lines.push(sep);
  lines.push(`Subtotal:${''.padEnd(16)}₹${bill.subtotal}`);
  if (bill.discount && bill.discount > 0) {
    lines.push(`Discount:${''.padEnd(15)}-₹${bill.discount}`);
  }
  lines.push(`*Grand Total:${''.padEnd(12)}₹${bill.grandTotal}*`);
  lines.push(sep);
  lines.push('');
  lines.push(`💳 Payment: ${bill.paymentMethod === 'Credit' ? 'Pay Later' : bill.paymentMethod}`);
  if (settings.phone) lines.push(`📞 ${settings.phone}`);
  lines.push('');
  lines.push('Thank you for visiting! 🙏');
  lines.push('_Powered by VRNDAI · vrndai.com_');

  return lines.join('\n');
}

export async function shareBill(bill, settings) {
  const text = generateReceiptText(bill, settings);
  const title = `Receipt ₹${bill.grandTotal} — ${settings.shopName || 'Medical Store'}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (e) {
      if (e.name !== 'AbortError') throw e;
      return 'cancelled';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }

  return 'fallback';
}
