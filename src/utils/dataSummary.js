// Builds a compact summary of the shop's full sales/inventory history for
// the "ask your data" AI feature — sent to api/ask-data.js instead of raw
// bills, which could be thousands of rows for an established shop (the
// bills query's row cap was removed earlier, so this must not re-introduce
// that problem by shipping the whole table on every question).

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function buildDataSummary(medicines, bills, customers) {
  const now = new Date();

  // Per-medicine rollup: how much of each medicine has sold, ever, and when
  // it last moved — this is what answers "what's losing me money" (stock
  // tied up in slow movers) and "what should I stock before monsoon"
  // (category sales trend) without re-deriving anything server-side.
  const medicineStats = {};
  medicines.forEach(m => {
    medicineStats[m.id] = {
      name: m.name, category: m.category, currentStock: m.stock,
      unit: m.unit, price: m.price,
      totalUnitsSoldAllTime: 0, totalRevenueAllTime: 0, lastSoldDate: null,
    };
  });

  const monthlyByCategory = {}; // "2026-06|Cough & Cold" -> { month, category, unitsSold, revenue }

  bills.forEach(bill => {
    const mKey = monthKey(bill.date);
    bill.items.forEach(item => {
      const stat = medicineStats[item.id];
      const revenue = item.price * item.qty;
      if (stat) {
        stat.totalUnitsSoldAllTime += item.qty;
        stat.totalRevenueAllTime += revenue;
        if (!stat.lastSoldDate || bill.date > stat.lastSoldDate) stat.lastSoldDate = bill.date;
      }
      const category = stat?.category || 'Unknown';
      const catKey = `${mKey}|${category}`;
      if (!monthlyByCategory[catKey]) {
        monthlyByCategory[catKey] = { month: mKey, category, unitsSold: 0, revenue: 0 };
      }
      monthlyByCategory[catKey].unitsSold += item.qty;
      monthlyByCategory[catKey].revenue += revenue;
    });
  });

  const medicineRollup = Object.values(medicineStats).map(s => ({
    ...s,
    daysSinceLastSale: s.lastSoldDate
      ? Math.floor((now - new Date(s.lastSoldDate)) / 86400000)
      : null,
  }));

  const dates = bills.map(b => b.date).sort();
  const totalDue = customers.reduce((s, c) => s + (c.due || 0), 0);
  const topCustomersByDue = [...customers]
    .filter(c => c.due > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 10)
    .map(c => ({ name: c.name, due: c.due, tier: c.tier }));

  const payMix = {};
  bills.forEach(b => { payMix[b.paymentMethod] = (payMix[b.paymentMethod] || 0) + b.grandTotal; });

  return {
    shop: {
      billCount: bills.length,
      dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
      totalCustomerDue: totalDue,
      paymentMethodMix: payMix,
    },
    medicines: medicineRollup,
    monthlyByCategory: Object.values(monthlyByCategory),
    topCustomersByDue,
  };
}
