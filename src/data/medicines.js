// src/data/medicines.js
export const medicines = [
  { id: '1', name: 'Paracetamol 500mg', cat: 'Analgesic', price: 28, stock: 8,  unit: 'Strip',  expiry: 'Dec 2026', status: 'low' },
  { id: '2', name: 'Amoxicillin 250mg', cat: 'Antibiotic', price: 85, stock: 42, unit: 'Strip',  expiry: 'Jul 2026', status: 'ok'  },
  { id: '3', name: 'Azithromycin 500mg',cat: 'Antibiotic', price: 120,stock: 25, unit: 'Strip',  expiry: 'Mar 2027', status: 'ok'  },
  { id: '4', name: 'Pan 40',            cat: 'Antacid',   price: 65, stock: 60, unit: 'Strip',  expiry: 'Nov 2026', status: 'ok'  },
  { id: '5', name: 'Limcee 500mg',      cat: 'Vitamin',   price: 35, stock: 3,  unit: 'Bottle', expiry: 'Sep 2026', status: 'low' },
  { id: '6', name: 'Metformin 500mg',   cat: 'Diabetes',  price: 45, stock: 80, unit: 'Strip',  expiry: 'Feb 2027', status: 'ok'  },
  { id: '7', name: 'Crocin Advance',    cat: 'Analgesic', price: 42, stock: 0,  unit: 'Strip',  expiry: 'Jan 2027', status: 'out' },
  { id: '8', name: 'Vitamin D3 60K',    cat: 'Vitamin',   price: 95, stock: 18, unit: 'Sachet', expiry: 'Jun 2027', status: 'ok'  },
  { id: '9', name: 'Atorvastatin 10mg', cat: 'Cardiac',   price: 110,stock: 35, unit: 'Strip',  expiry: 'Apr 2027', status: 'ok'  },
  { id:'10', name: 'Cetirizine 10mg',   cat: 'Antiallergic',price:22,stock: 55, unit: 'Strip',  expiry: 'Dec 2026', status: 'ok'  },
];

export const customers = [
  { id: '1', name: 'Priya Desai',   phone: '9876543210', purchases: 42, points: 380, due: 1200, tier: 'Regular' },
  { id: '2', name: 'Amit Joshi',    phone: '9123456780', purchases: 18, points: 220, due: 0,    tier: 'Regular' },
  { id: '3', name: 'Sunita Rao',    phone: '9988776655', purchases: 67, points: 680, due: 800,  tier: 'Gold'    },
  { id: '4', name: 'Ravi Kumar',    phone: '9654321098', purchases: 29, points: 460, due: 0,    tier: 'VIP'     },
  { id: '5', name: 'Meena Gupta',   phone: '9432109876', purchases: 11, points: 90,  due: 1400, tier: 'Regular' },
];

export const CATEGORIES = ['All', 'Analgesic', 'Antibiotic', 'Antacid', 'Vitamin', 'Diabetes', 'Cardiac', 'Antiallergic'];

export const COLORS = {
  primary: '#1565C0',
  primaryLight: '#E3F2FD',
  danger: '#c0392b',
  dangerLight: '#fdecea',
  warning: '#b7770d',
  warningLight: '#fef3e2',
  text: '#1a1a1a',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  bg: '#f9fafb',
  white: '#ffffff',
};
