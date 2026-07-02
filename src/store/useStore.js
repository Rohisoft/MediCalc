import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
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
  settings:  { shopName: '', ownerName: '', address: '', phone: '' },
};

// ─── Supabase data loader ────────────────────────────────────
async function loadAllData(tenantId, tenant, dispatch) {
  try {
    const [meds, bills, custs, pays] = await Promise.all([
      supabase.from('medicines').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('bills').select('*').eq('tenant_id', tenantId).order('date', { ascending: false }),
      supabase.from('customers').select('*').eq('tenant_id', tenantId).order('name'),
      supabase.from('payments').select('*').eq('tenant_id', tenantId).order('date', { ascending: false }),
    ]);
    // Supabase resolves (doesn't reject) even when a query itself errors —
    // `data` comes back null in that case. Without this check, a single
    // flaky query silently became `[] ` below and wiped that entire slice of
    // state on every load, which looked identical to the data being deleted.
    if (meds.error)  throw meds.error;
    if (bills.error) throw bills.error;
    if (custs.error) throw custs.error;
    if (pays.error)  throw pays.error;
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
  grandTotal: Number(b.grand_total),
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
// Supabase calls don't throw on a database-level failure (RLS rejection,
// constraint violation, etc.) — they resolve with { data, error }. Without
// this check, a failed write is indistinguishable from a successful one: the
// local optimistic state still shows it, right up until the next reload
// re-fetches from the DB and it's simply gone. Every write below must be
// wrapped so failures actually propagate to dispatchWithSync's catch.
function check({ error }) {
  if (error) throw error;
}

async function syncAction(action, tenantId) {
  switch (action.type) {

    case 'ADD_MEDICINE': {
      const m = action.medicine;
      check(await supabase.from('medicines').upsert({
        id: m.id, tenant_id: tenantId,
        name: m.name, category: m.category || '',
        price: parseFloat(m.price) || 0, stock: parseInt(m.stock) || 0,
        unit: m.unit || 'Strip', expiry: m.expiry || '',
        status: computeStatus(parseInt(m.stock) || 0),
      }));
      break;
    }

    case 'COMPLETE_BILL': {
      const { bill } = action;
      // Insert bill first — if this fails, throw immediately and skip the
      // stock/customer updates below rather than silently partially applying.
      check(await supabase.from('bills').insert({
        id: bill.id, tenant_id: tenantId,
        bill_number: bill.id.slice(-6).toUpperCase(),
        customer_id: bill.customerId || null,
        customer_name: bill.customerName || null,
        items: bill.items,
        subtotal: bill.subtotal, discount: 0, tax: 0, grand_total: bill.grandTotal,
        payment_method: bill.paymentMethod,
        status: bill.paymentMethod === 'Credit' ? 'credit' : 'paid',
        date: bill.date,
      }));
      // Update stock for each sold item
      for (const item of bill.items) {
        const newStock = Math.max(0, (item.stock ?? 0) - item.qty);
        check(await supabase.from('medicines')
          .update({ stock: newStock, status: computeStatus(newStock) })
          .eq('id', item.id).eq('tenant_id', tenantId));
      }
      // Update customer stats
      if (bill.customerId) {
        const { data: c, error: custErr } = await supabase.from('customers').select('purchases,points,due').eq('id', bill.customerId).single();
        if (custErr) throw custErr;
        if (c) {
          const newPurchases = (c.purchases || 0) + 1;
          check(await supabase.from('customers').update({
            purchases: newPurchases,
            points:    (c.points || 0) + Math.floor(bill.grandTotal / 10),
            due:       (c.due || 0) + (bill.paymentMethod === 'Credit' ? bill.grandTotal : 0),
            tier:      newPurchases >= 100 ? 'VIP' : newPurchases >= 50 ? 'Gold' : undefined,
          }).eq('id', bill.customerId));
        }
      }
      break;
    }

    case 'ADD_CUSTOMER': {
      const c = action.customer;
      check(await supabase.from('customers').insert({
        id: c.id, tenant_id: tenantId,
        name: c.name, phone: c.phone || '', tier: 'Regular',
        purchases: 0, points: 0, due: 0,
      }));
      break;
    }

    case 'COLLECT_PAYMENT': {
      check(await supabase.from('payments').insert({
        id: crypto.randomUUID(), tenant_id: tenantId,
        customer_id: action.customerId, amount: action.amount,
        method: action.method, date: new Date().toISOString(),
      }));
      const { data: c, error: custErr } = await supabase.from('customers').select('due').eq('id', action.customerId).single();
      if (custErr) throw custErr;
      if (c) {
        check(await supabase.from('customers').update({ due: Math.max(0, (c.due || 0) - action.amount) }).eq('id', action.customerId));
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
      syncAction(action, tenant.id).catch(e => {
        console.error('syncAction:', e.message);
        // The optimistic update above already changed local state, but the
        // write to the database failed — without this, that failure was
        // completely invisible until the next reload silently dropped it.
        const msg = `Could not save your last change (${action.type.replace(/_/g, ' ').toLowerCase()}). Check your connection and try again — it has not been saved yet.`;
        if (typeof window !== 'undefined') window.alert(msg);
        else Alert.alert('Save Failed', msg);
      });
    }
  }, [tenant?.id]);

  return <Ctx.Provider value={{ state, dispatch: dispatchWithSync }}>{children}</Ctx.Provider>;
}

export function useStore() {
  return useContext(Ctx);
}
