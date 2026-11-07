/*
# Core schema: players, wallet, PIX deposits, scratch cards and plays

1. New Tables
- profiles: one row per sign-in account. Display name, role (player or admin), guest flag, blocked flag and wallet balance in cents.
- scratch_cards: catalog of scratch cards (title, price, theme, active flag).
- scratch_card_prizes: prize table of each card (prize value and weight). Used only by the server to draw results.
- deposits: PIX deposit requests waiting for review (pending, approved, rejected).
- wallet_transactions: audit ledger of every balance change (demo credit, deposit, bet, prize).
- plays: every scratch card purchase and the prize it paid.

2. Functions
- is_admin(): true when the signed-in user has the admin role.
- handle_new_user(): trigger that creates the profile (and demo credit for guests) when an account is created.

3. Security
- Row level security is enabled on every table.
- Players can read only their own profile, deposits, plays and wallet transactions.
- Admins can read everything.
- Scratch card prizes are readable only by admins, so players cannot see the odds.
- Players cannot write to any table directly. Balances, roles, deposits and results change only through database functions added in the next migration.
- The only direct update allowed is for admins on scratch card details, restricted to specific columns.

4. Notes
- All money is stored in cents (bigint) to avoid rounding errors.
- Guest accounts receive demo credit of 100.00 when created.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Jogador',
  role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  is_guest boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scratch_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents bigint NOT NULL CHECK (price_cents > 0),
  theme text NOT NULL DEFAULT 'gold',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scratch_card_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES scratch_cards(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  prize_cents bigint NOT NULL CHECK (prize_cents >= 0),
  weight integer NOT NULL CHECK (weight > 0)
);
CREATE INDEX IF NOT EXISTS idx_scratch_card_prizes_card ON scratch_card_prizes(card_id);

CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status, created_at);

CREATE TABLE IF NOT EXISTS plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES scratch_cards(id),
  bet_cents bigint NOT NULL CHECK (bet_cents > 0),
  prize_cents bigint NOT NULL CHECK (prize_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plays_user ON plays(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_plays_card ON plays(card_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('demo_credit', 'deposit', 'bet', 'prize')),
  amount_cents bigint NOT NULL,
  balance_after_cents bigint NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id, created_at);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_guest boolean := coalesce(NEW.raw_user_meta_data->>'is_guest', '') = 'true';
  v_balance bigint := CASE WHEN coalesce(NEW.raw_user_meta_data->>'is_guest', '') = 'true' THEN 10000 ELSE 0 END;
BEGIN
  INSERT INTO public.profiles (id, display_name, is_guest, balance_cents)
  VALUES (
    NEW.id,
    coalesce(nullif(left(trim(NEW.raw_user_meta_data->>'display_name'), 40), ''), 'Jogador'),
    v_is_guest,
    v_balance
  );

  IF v_balance > 0 THEN
    INSERT INTO public.wallet_transactions (user_id, kind, amount_cents, balance_after_cents)
    VALUES (NEW.id, 'demo_credit', v_balance, v_balance);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scratch_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE scratch_card_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON profiles, scratch_cards, scratch_card_prizes, deposits, plays, wallet_transactions TO authenticated;
GRANT UPDATE (title, description, price_cents, theme, is_active, sort_order) ON scratch_cards TO authenticated;

DROP POLICY IF EXISTS "Players read own profile" ON profiles;
CREATE POLICY "Players read own profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Players read active cards" ON scratch_cards;
CREATE POLICY "Players read active cards" ON scratch_cards FOR SELECT
  TO authenticated USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS "Admins update cards" ON scratch_cards;
CREATE POLICY "Admins update cards" ON scratch_cards FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins read prizes" ON scratch_card_prizes;
CREATE POLICY "Admins read prizes" ON scratch_card_prizes FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Players read own deposits" ON deposits;
CREATE POLICY "Players read own deposits" ON deposits FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all deposits" ON deposits;
CREATE POLICY "Admins read all deposits" ON deposits FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Players read own plays" ON plays;
CREATE POLICY "Players read own plays" ON plays FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all plays" ON plays;
CREATE POLICY "Admins read all plays" ON plays FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Players read own transactions" ON wallet_transactions;
CREATE POLICY "Players read own transactions" ON wallet_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all transactions" ON wallet_transactions;
CREATE POLICY "Admins read all transactions" ON wallet_transactions FOR SELECT
  TO authenticated USING (public.is_admin());
