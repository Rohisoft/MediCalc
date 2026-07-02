import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';

const Ctx = createContext(null);

function computeStatus(stock) {
  return stock <= 0 ? 'out' : stock <= 10 ? 'low' : 'ok';
}

function reducer(state, action) {
  switch (action.type) {

    case 'HYDRATE':
      return { ...state, ...action.payload, loaded: true };

    case 'ADD_MEDICINE': {
      const m = {
        ...action.medicine,
        id:     action.medicine.id || crypto.randomUUID(),
        stock:  parseInt(action.medicine.stock)  || 0,
        price:  parseFloat(action.medicine.price) || 0,
        status: computeStatus(parseInt(action.medicine.stock) || 0),
      };
      return { ...state, medicines: [...state.medicines, m] };
    }

    case 'UPDATE_MEDICINE_STOCK': {
      return {
        ...state,
        medicines: state.medicines.map(m =>
          m.id === action.id
            ? { ...m, stock: action.stock, status: computeStatus(action.stock) }
            : m
        ),
      };
    }

    case 'ADD_TO_CART': {
      const existing = state.cart.find(i => i.id === action.item.id);
      if (existing) {
        return { ...state, cart: state.cart.map(i => i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i) };
      }
      return { ...state, cart: [...state.cart, { ...action.item, qty: 1 }] };
    }

    case 'UPDATE_CART_QTY': {
      const updated = state.cart.map(i => i.id === action.id ? { ...i, qty: i.qty + action.delta } : i);
      return { ...state, cart: updated.filter(i => i.qty > 0) };
    }

    case 'CLEAR_CART':
      return { ...state, cart: [] };

    case 'COMPLETE_BILL': {
      const { bill } = action;
      const updatedMeds = state.medicines.map(m => {
        const item = bill.items.find(i => i.id === m.id);
        if (!item) return m;
        const newStock = Math.max(0, m.stock - item.qty);
        return { ...m, stock: newStock, status: computeStatus(newStock) };
      });
      let updatedCustomers = state.customers;
      if (bill.customerId) {
        updatedCustomers = state.customers.map(c => {
          if (c.id !== bill.customerId) return c;
          const newPurchases = (c.purchases || 0) + 1;
          const tier = newPurchases >= 100 ? 'VIP' : newPurchases >= 50 ? 'Gold' : c.tier;
          const dueDelta = bill.paymentMethod === 'Credit' ? bill.grandTotal : 0;
          return { ...c, purchases: newPurchases, points: (c.points || 0) + Math.floor(bill.grandTotal / 10), due: (c.due || 0) + dueDelta, tier };
        });
      }
      return { ...state, medicines: updatedMeds, customers: updatedCustomers, bills: [...state.bills, bill], cart: [] };
    }

    case 'ADD_CUSTOMER': {
      const c = { ...action.customer, id: action.customer.id || crypto.randomUUID(), purchases: 0, points: 0, due: 0, tier: 'Regular' };
      return { ...state, customers: [...state.customers, c] };
    }

    case 'COLLECT_PAYMENT': {
      const payment = { id: crypto.randomUUID(), customerId: action.customerId, amount: action.amount, method: action.method, date: new Date().toISOString() };
      return {
        ...state,
        customers: state.customers.map(c =>
          c.id === action.customerId ? { ...c, due: Math.max(0, (c.due || 0) - action.amount) } : c
        ),
        payments: [...(state.payments || []), payment],
      };
    }

    case 'CLEAR_DUE':
      return { ...state, customers: state.customers.map(c => c.id === action.customerId ? { ...c, due: 0 } : c) };

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    default:
      return state;
  }
}

const INITIAL = {
  loaded:    false,
  medicines: [],
  bills:     [],
  customers: [],
  cart:      [],
  payments:  [],
  settings:  { shopName: '', ownerName: '', address: '', phone: '', gstNumber: '' },
};

// ─── Supabase data loader ────────────────────────────────────
async function loadAllData(tenantId, tenant, dispatch) {
  try {
    const [meds, bills, custs, pays] = await Promise.all([
      supabase.from('medicines').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('bills').select('*').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(500),
      supabase.from('customers').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('payments').select('*').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(300),
    ]);
    dispatch({
      type: 'HYDRATE',
      payload: {
        medicines: (meds.data  || []).map(transformMed),
        bills:     (bills.data || []).map(transformBill),
        customers: (custs.data || []).map(transformCustomer),
        payments:  (pays.data  || []).map(transformPayment),
        settings: {
          shopName:  tenant.shop_name,
          ownerName: tenant.owner_name,
          address:   tenant.address,
          phone:     tenant.phone,
          gstNumber: tenant.gst_number || '',
        },
      },
    });
  } catch (e) {
    console.error('loadAllData:', e.message);
    dispatch({ type: 'HYDRATE', payload: {} });
  }
}

// ─── Row transformers (snake_case → camelCase) ───────────────
const transformMed = m => ({
  id: m.id, name: m.name, category: m.category,
  price: Number(m.price), stock: m.stock, unit: m.unit, expiry: m.expiry, status: m.status,
});
const transformBill = b => ({
  id: b.id, billNumber: b.bill_number, customerId: b.customer_id, customerName: b.customer_name,
  items: b.items, subtotal: Number(b.subtotal), discount: Number(b.discount),
  gst: Number(b.tax), grandTotal: Number(b.grand_total),
  paymentMethod: b.payment_method, status: b.status, date: b.date,
});
const transformCustomer = c => ({
  id: c.id, name: c.name, phone: c.phone, tier: c.tier,
  purchases: c.purchases, points: c.points, due: Number(c.due),
});
const transformPayment = p => ({
  id: p.id, customerId: p.customer_id, amount: Number(p.amount), method: p.method, date: p.date,
});

// ─── Supabase write sync ─────────────────────────────────────
async function syncAction(action, tenantId) {
  switch (action.type) {

    case 'ADD_MEDICINE': {
      const m = action.medicine;
      await supabase.from('medicines').upsert({
        id: m.id, tenant_id: tenantId,
        name: m.name, category: m.category || '',
        price: parseFloat(m.price) || 0, stock: parseInt(m.stock) || 0,
        unit: m.unit || 'Strip', expiry: m.expiry || '',
        status: computeStatus(parseInt(m.stock) || 0),
      });
      break;
    }

    case 'COMPLETE_BILL': {
      const { bill } = action;
      // Insert bill
      await supabase.from('bills').insert({
        id: bill.id, tenant_id: tenantId,
        bill_number: bill.id.slice(-6).toUpperCase(),
        customer_id: bill.customerId || null,
        customer_name: bill.customerName || null,
        items: bill.items,
        subtotal: bill.subtotal, discount: 0, tax: bill.gst, grand_total: bill.grandTotal,
        payment_method: bill.paymentMethod,
        status: bill.paymentMethod === 'Credit' ? 'credit' : 'paid',
        date: bill.date,
      });
      // Update stock for each sold item
      for (const item of bill.items) {
        const newStock = Math.max(0, (item.stock ?? 0) - item.qty);
        await supabase.from('medicines')
          .update({ stock: newStock, status: computeStatus(newStock) })
          .eq('id', item.id).eq('tenant_id', tenantId);
      }
      // Update customer stats
      if (bill.customerId) {
        const { data: c } = await supabase.from('customers').select('purchases,points,due').eq('id', bill.customerId).single();
        if (c) {
          const newPurchases = (c.purchases || 0) + 1;
          await supabase.from('customers').update({
            purchases: newPurchases,
            points:    (c.points || 0) + Math.floor(bill.grandTotal / 10),
            due:       (c.due || 0) + (bill.paymentMethod === 'Credit' ? bill.grandTotal : 0),
            tier:      newPurchases >= 100 ? 'VIP' : newPurchases >= 50 ? 'Gold' : undefined,
          }).eq('id', bill.customerId);
        }
      }
      break;
    }

    case 'ADD_CUSTOMER': {
      const c = action.customer;
      await supabase.from('customers').insert({
        id: c.id, tenant_id: tenantId,
        name: c.name, phone: c.phone || '', tier: 'Regular',
        purchases: 0, points: 0, due: 0,
      });
      break;
    }

    case 'COLLECT_PAYMENT': {
      await supabase.from('payments').insert({
        id: crypto.randomUUID(), tenant_id: tenantId,
        customer_id: action.customerId, amount: action.amount,
        method: action.method, date: new Date().toISOString(),
      });
      const { data: c } = await supabase.from('customers').select('due').eq('id', action.customerId).single();
      if (c) {
        await supabase.from('customers').update({ due: Math.max(0, (c.due || 0) - action.amount) }).eq('id', action.customerId);
      }
      break;
    }

    // Cart actions and HYDRATE don't need cloud sync
  }
}

// ─── Provider ────────────────────────────────────────────────
export function StoreProvider({ children }) {
  const [state, dispatch]        = useReducer(reducer, INITIAL);
  const { tenant, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !tenant?.id) {
      // Reset to empty state when logged out
      dispatch({ type: 'HYDRATE', payload: {} });
      return;
    }
    loadAllData(tenant.id, tenant, dispatch);
  }, [isAuthenticated, tenant?.id]);

  const dispatchWithSync = useCallback(async (action) => {
    dispatch(action); // optimistic local update
    if (tenant?.id) {
      syncAction(action, tenant.id).catch(e => console.error('syncAction:', e.message));
    }
  }, [tenant?.id]);

  return <Ctx.Provider value={{ state, dispatch: dispatchWithSync }}>{children}</Ctx.Provider>;
}

export function useStore() {
  return useContext(Ctx);
}
