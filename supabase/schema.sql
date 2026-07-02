-- ============================================================
-- MediPlus SaaS Schema  —  run this in Supabase SQL Editor
-- ============================================================

-- TENANTS  (one row per pharmacy)
CREATE TABLE tenants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name        TEXT NOT NULL,
  owner_name       TEXT NOT NULL,
  address          TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  gst_number       TEXT NOT NULL DEFAULT '',
  plan             TEXT NOT NULL DEFAULT 'starter'
                   CHECK (plan IN ('starter','pro','unlimited')),
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','suspended','expired','pending')),
  subscription_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  invite_code      TEXT UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- USER PROFILES  (extends auth.users)
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'owner'
             CHECK (role IN ('owner','staff','superadmin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MEDICINES  (inventory per tenant)
CREATE TABLE medicines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT '',
  price      NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock      INTEGER NOT NULL DEFAULT 0,
  unit       TEXT NOT NULL DEFAULT 'Strip',
  expiry     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','low','out')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CUSTOMERS  (per tenant)
CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  tier       TEXT NOT NULL DEFAULT 'Regular' CHECK (tier IN ('Regular','Gold','VIP')),
  purchases  INTEGER NOT NULL DEFAULT 0,
  points     INTEGER NOT NULL DEFAULT 0,
  due        NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BILLS
CREATE TABLE bills (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bill_number    TEXT,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name  TEXT,
  items          JSONB NOT NULL DEFAULT '[]',
  subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax            NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  status         TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','credit','cancelled')),
  date           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PAYMENTS  (due collections)
CREATE TABLE payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount      NUMERIC(10,2) NOT NULL,
  method      TEXT NOT NULL DEFAULT 'Cash',
  note        TEXT NOT NULL DEFAULT '',
  date        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX ON medicines(tenant_id);
CREATE INDEX ON customers(tenant_id);
CREATE INDEX ON bills(tenant_id, date DESC);
CREATE INDEX ON payments(tenant_id);
CREATE INDEX ON payments(customer_id);
CREATE INDEX ON user_profiles(tenant_id);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments      ENABLE ROW LEVEL SECURITY;

-- Helper functions (fast cached lookups)
CREATE OR REPLACE FUNCTION my_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Tenants: own row OR superadmin, OR anyone can read by invite_code
CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (
  id = my_tenant_id() OR my_role() = 'superadmin' OR invite_code IS NOT NULL
);
CREATE POLICY "tenants_insert" ON tenants FOR INSERT WITH CHECK (my_role() = 'superadmin');
CREATE POLICY "tenants_update" ON tenants FOR UPDATE USING (my_role() = 'superadmin');

-- User profiles: own row OR superadmin
CREATE POLICY "profiles_select" ON user_profiles FOR SELECT USING (
  id = auth.uid() OR my_role() = 'superadmin'
);
CREATE POLICY "profiles_insert" ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Data tables: own tenant OR superadmin
CREATE POLICY "medicines_all" ON medicines FOR ALL
  USING (tenant_id = my_tenant_id() OR my_role() = 'superadmin');
CREATE POLICY "customers_all" ON customers FOR ALL
  USING (tenant_id = my_tenant_id() OR my_role() = 'superadmin');
CREATE POLICY "bills_all"     ON bills FOR ALL
  USING (tenant_id = my_tenant_id() OR my_role() = 'superadmin');
CREATE POLICY "payments_all"  ON payments FOR ALL
  USING (tenant_id = my_tenant_id() OR my_role() = 'superadmin');

-- ─── INVITE CODE FUNCTIONS ───────────────────────────────────

-- Lookup tenant info by invite code (called before login, SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_tenant_by_invite(code TEXT)
RETURNS TABLE(id UUID, shop_name TEXT, owner_name TEXT, plan TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, shop_name, owner_name, plan
  FROM   tenants
  WHERE  invite_code = code
  LIMIT  1;
$$;

-- Claim invite code: creates user_profile and clears invite_code atomically
CREATE OR REPLACE FUNCTION claim_invite(code TEXT, user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  t_id UUID;
BEGIN
  SELECT id INTO t_id FROM tenants WHERE invite_code = code;
  IF t_id IS NULL THEN RAISE EXCEPTION 'Invalid or already-used invite code'; END IF;

  UPDATE tenants SET invite_code = NULL, status = 'active' WHERE id = t_id;
  INSERT INTO user_profiles (id, tenant_id, role) VALUES (user_id, t_id, 'owner');
  RETURN t_id;
END;
$$;

-- ─── INITIAL SUPERADMIN SETUP ────────────────────────────────
-- After running schema:
--   1. Go to Supabase → Authentication → Users → "Add user"
--      Use your own email/password.  Copy the new User UID.
--   2. Run the SQL below, replacing <YOUR_USER_ID>:
--
-- INSERT INTO tenants (id, shop_name, owner_name, plan, subscription_end, status)
-- VALUES (
--   '00000000-0000-0000-0000-000000000001',
--   'Admin Panel', 'Samrath Panchal', 'unlimited', '2099-12-31', 'active'
-- );
--
-- INSERT INTO user_profiles (id, tenant_id, role)
-- VALUES ('<YOUR_USER_ID>', '00000000-0000-0000-0000-000000000001', 'superadmin');
