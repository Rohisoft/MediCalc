import { formatBillId, formatBillDate } from './receipt';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function downloadBillPDF(bill, settings) {
  if (typeof window === 'undefined') return;

  const win = window.open('', '_blank');
  if (!win) {
    alert(
      'Pop-ups are blocked.\n\nTo download PDF:\nSettings → Site Settings → Pop-ups → Allow for this site',
    );
    return;
  }

  win.document.write(buildHTML(bill, settings));
  win.document.close();
}

function buildHTML(bill, settings) {
  const shopName = settings.shopName || 'Medical Store';
  const billNo   = formatBillId(bill.id);
  const dateStr  = formatBillDate(bill.date);
  const items    = bill.items || [];

  const itemRows = items.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : ''}">
      <td class="td-name">${esc(item.name)}</td>
      <td class="td-center">${item.qty}</td>
      <td class="td-right">&#8377;${parseFloat(item.price).toFixed(2)}</td>
      <td class="td-right td-bold">&#8377;${(item.price * item.qty).toFixed(2)}</td>
    </tr>`).join('');

  const discountRow = bill.discount > 0
    ? `<tr>
         <td colspan="2" class="tl-label">Discount</td>
         <td class="tl-val tl-red">&minus;&#8377;${bill.discount}</td>
       </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Receipt #${billNo} &#8212; ${esc(shopName)}</title>
  <style>
    @page { size: A5 portrait; margin: 14mm; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px; color: #1a1a1a; background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .receipt { width: 100%; max-width: 148mm; margin: 0 auto; padding-bottom: 70px; }

    /* ── Header ───────────────────────────── */
    .header {
      text-align: center;
      padding-bottom: 16px;
      border-bottom: 1.5px dashed #90CAF9;
      margin-bottom: 14px;
    }
    .shop-name {
      font-size: 22px; font-weight: 900; color: #1565C0;
      letter-spacing: 0.3px; margin-bottom: 6px;
    }
    .shop-detail { font-size: 10px; color: #666; line-height: 1.7; }
    .gst-chip {
      display: inline-block; margin-top: 6px;
      background: #EFF8FF; color: #1565C0;
      border: 1px solid #BBDEFB; border-radius: 5px;
      padding: 2px 9px; font-size: 9px; font-weight: 700;
    }

    /* ── Bill meta ────────────────────────── */
    .meta {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 8px 20px; margin-bottom: 16px;
      padding-bottom: 13px; border-bottom: 1px dashed #ddd;
    }
    .meta-label { font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 2px; }
    .meta-val   { font-size: 11.5px; font-weight: 600; color: #111; }
    .pay-chip {
      display: inline-block; padding: 2px 9px; border-radius: 5px;
      font-size: 9px; font-weight: 700;
      background: #EFF8FF; color: #1565C0; border: 1px solid #BBDEFB;
    }

    /* ── Items table ──────────────────────── */
    .section-label {
      font-size: 8.5px; font-weight: 700; color: #888;
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    thead tr { border-bottom: 1.5px solid #1565C0; }
    thead th {
      font-size: 8.5px; font-weight: 700; color: #1565C0;
      text-transform: uppercase; letter-spacing: 0.5px;
      padding: 4px 5px; text-align: left;
    }
    .td-center, th.th-center { text-align: center; }
    .td-right,  th.th-right  { text-align: right;  }
    .td-bold    { font-weight: 600; }
    .td-name    { font-weight: 500; max-width: 90px; }
    tbody tr { border-bottom: 0.5px solid #f0f0f0; }
    .row-even { background: #fafafa; }
    tbody td { padding: 6px 5px; font-size: 11px; color: #222; vertical-align: middle; }

    /* ── Totals ───────────────────────────── */
    .totals-wrap {
      border-top: 1.5px dashed #90CAF9;
      padding-top: 10px; margin-top: 6px; margin-bottom: 16px;
    }
    .tl-table { width: 100%; border-collapse: collapse; }
    .tl-table td { padding: 3.5px 5px; font-size: 11px; }
    .tl-label { color: #666; width: 60%; }
    .tl-val   { text-align: right; color: #111; }
    .tl-red   { color: #dc2626; text-align: right; }
    .grand-row td {
      padding-top: 9px; font-size: 15px; font-weight: 900; color: #1565C0;
      border-top: 1.5px solid #1565C0;
    }

    /* ── Footer ───────────────────────────── */
    .footer {
      text-align: center;
      border-top: 1.5px dashed #90CAF9;
      padding-top: 14px;
    }
    .footer-main { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 4px; }
    .footer-phone { font-size: 11px; color: #1565C0; font-weight: 500; margin-bottom: 4px; }
    .footer-sub  { font-size: 9px; color: #bbb; margin-top: 8px; }

    /* ── Action bar (screen only, hidden on print) ── */
    .action-bar {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #fff; border-top: 1px solid #e5e7eb;
      padding: 12px 20px; display: flex; gap: 10px; justify-content: center;
      box-shadow: 0 -2px 12px rgba(0,0,0,0.08);
    }
    .btn {
      padding: 11px 28px; border-radius: 10px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      border: none; letter-spacing: 0.2px;
    }
    .btn-pdf   { background: #1565C0; color: #fff; }
    .btn-pdf:hover { background: #0D47A1; }
    .btn-close { background: #f3f4f6; color: #374151; }

    @media print {
      .action-bar { display: none !important; }
      .receipt    { padding-bottom: 0; }
    }
  </style>
</head>
<body>

<div class="receipt">

  <!-- ── Shop header ── -->
  <div class="header">
    <div class="shop-name">&#128138; ${esc(shopName)}</div>
    ${settings.address ? `<div class="shop-detail">${esc(settings.address)}</div>` : ''}
    ${settings.phone   ? `<div class="shop-detail">Tel: ${esc(settings.phone)}</div>` : ''}
    ${settings.gstNumber ? `<span class="gst-chip">GST: ${esc(settings.gstNumber)}</span>` : ''}
  </div>

  <!-- ── Bill info ── -->
  <div class="meta">
    <div>
      <div class="meta-label">Bill No.</div>
      <div class="meta-val">#${billNo}</div>
    </div>
    <div>
      <div class="meta-label">Date &amp; Time</div>
      <div class="meta-val">${dateStr}</div>
    </div>
    <div>
      <div class="meta-label">Customer</div>
      <div class="meta-val">${esc(bill.customerName || 'Walk-in')}</div>
    </div>
    <div>
      <div class="meta-label">Payment</div>
      <div class="meta-val">
        <span class="pay-chip">${esc(bill.paymentMethod === 'Credit' ? 'Pay Later' : bill.paymentMethod)}</span>
      </div>
    </div>
  </div>

  <!-- ── Items ── -->
  <div class="section-label">Items Purchased</div>
  <table>
    <thead>
      <tr>
        <th style="width:42%">Medicine</th>
        <th class="th-center" style="width:12%">Qty</th>
        <th class="th-right"  style="width:23%">Rate</th>
        <th class="th-right"  style="width:23%">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- ── Totals ── -->
  <div class="totals-wrap">
    <table class="tl-table">
      <tr>
        <td class="tl-label">Subtotal</td>
        <td class="tl-val">&#8377;${bill.subtotal}</td>
      </tr>
      <tr>
        <td class="tl-label">GST (5%)</td>
        <td class="tl-val">&#8377;${bill.gst}</td>
      </tr>
      ${discountRow}
      <tr class="grand-row">
        <td>GRAND TOTAL</td>
        <td class="td-right">&#8377;${bill.grandTotal}</td>
      </tr>
    </table>
  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <div class="footer-main">Thank you for your purchase! &#128591;</div>
    ${settings.phone ? `<div class="footer-phone">&#128222; ${esc(settings.phone)}</div>` : ''}
    <div class="footer-sub">Powered by VRNDAI &middot; vrndai.com</div>
  </div>

</div>

<!-- Action bar visible on screen, hidden when printing -->
<div class="action-bar">
  <button class="btn btn-pdf"   onclick="window.print()">&#128229; Download PDF / Print</button>
  <button class="btn btn-close" onclick="window.close()">&#10005; Close</button>
</div>

</body>
</html>`;
}
