/*
# Wallet and admin functions: deposits, scratch card purchases, user blocking, GGR summary

1. New Functions
- request_pix_deposit(amount_cents): player asks to add funds via PIX. Creates a pending deposit (min R$ 10,00, max R$ 50.000,00).
- admin_review_deposit(deposit_id, approve): admin approves or rejects a pending deposit. Approval credits the player's wallet and writes a ledger entry.
- buy_scratch_card(card_id): player buys a scratch card. The prize is drawn on the server using the card's weighted prize table, the balance is debited and credited atomically, and the play and ledger entries are recorded.
- admin_set_user_blocked(user_id, blocked): admin blocks or unblocks a player. Blocked players cannot deposit or play.
- admin_financial_summary(): admin dashboard figures. Deposits approved, bets, prizes paid, GGR (house profit = bets minus prizes), and a breakdown per card.

2. Security
- Every function is SECURITY DEFINER with a fixed search_path.
- EXECUTE is revoked from PUBLIC and anon. Only signed-in users can call them.
- Admin functions check the admin role before doing anything.
- Balances, deposits and prize results can only change through these functions.

3. Notes
- Prize draws use random() once per purchase and select from the cumulative weights, so odds match the weights in scratch_card_prizes.
- Money is always in cents.
*/

CREATE OR REPLACE FUNCTION public.request_pix_deposit(p_amount_cents bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_blocked boolean;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents < 1000 OR p_amount_cents > 5000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT is_blocked INTO v_blocked FROM public.profiles WHERE id = v_user;
  IF v_blocked IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
  IF v_blocked THEN
    RAISE EXCEPTION 'account_blocked';
  END IF;

  INSERT INTO public.deposits (user_id, amount_cents)
  VALUES (v_user, p_amount_cents)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_deposit(p_deposit_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
  v_new_balance bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;
  IF v_dep.status <> 'pending' THEN
    RAISE EXCEPTION 'deposit_already_reviewed';
  END IF;

  IF p_approve THEN
    UPDATE public.profiles
    SET balance_cents = balance_cents + v_dep.amount_cents
    WHERE id = v_dep.user_id
    RETURNING balance_cents INTO v_new_balance;

    INSERT INTO public.wallet_transactions (user_id, kind, amount_cents, balance_after_cents, ref_id)
    VALUES (v_dep.user_id, 'deposit', v_dep.amount_cents, v_new_balance, p_deposit_id);
  END IF;

  UPDATE public.deposits
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_deposit_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_scratch_card(p_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_card public.scratch_cards%ROWTYPE;
  v_total bigint;
  v_pick bigint;
  v_prize bigint;
  v_label text;
  v_balance_after_bet bigint;
  v_new_balance bigint;
  v_play_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
  IF v_profile.is_blocked THEN
    RAISE EXCEPTION 'account_blocked';
  END IF;

  SELECT * INTO v_card FROM public.scratch_cards WHERE id = p_card_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_unavailable';
  END IF;

  IF v_profile.balance_cents < v_card.price_cents THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  SELECT COALESCE(SUM(weight), 0) INTO v_total
  FROM public.scratch_card_prizes
  WHERE card_id = p_card_id;
  IF v_total = 0 THEN
    RAISE EXCEPTION 'card_unavailable';
  END IF;

  v_pick := floor(random() * v_total)::bigint;

  SELECT s.prize_cents, s.label INTO v_prize, v_label
  FROM (
    SELECT prize_cents, label, weight,
           SUM(weight) OVER (ORDER BY id) - weight AS range_start
    FROM public.scratch_card_prizes
    WHERE card_id = p_card_id
  ) s
  WHERE v_pick >= s.range_start AND v_pick < s.range_start + s.weight;

  v_balance_after_bet := v_profile.balance_cents - v_card.price_cents;
  v_new_balance := v_balance_after_bet + v_prize;

  UPDATE public.profiles SET balance_cents = v_new_balance WHERE id = v_user;

  INSERT INTO public.plays (user_id, card_id, bet_cents, prize_cents)
  VALUES (v_user, v_card.id, v_card.price_cents, v_prize)
  RETURNING id INTO v_play_id;

  INSERT INTO public.wallet_transactions (user_id, kind, amount_cents, balance_after_cents, ref_id)
  VALUES (v_user, 'bet', -v_card.price_cents, v_balance_after_bet, v_play_id);

  IF v_prize > 0 THEN
    INSERT INTO public.wallet_transactions (user_id, kind, amount_cents, balance_after_cents, ref_id)
    VALUES (v_user, 'prize', v_prize, v_new_balance, v_play_id);
  END IF;

  RETURN jsonb_build_object(
    'play_id', v_play_id,
    'prize_cents', v_prize,
    'prize_label', v_label,
    'balance_cents', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_blocked(p_user_id uuid, p_blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_block_self';
  END IF;

  UPDATE public.profiles SET is_blocked = p_blocked WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'deposits_approved_cents', COALESCE((SELECT SUM(amount_cents) FROM public.deposits WHERE status = 'approved'), 0),
    'deposits_pending_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'pending'),
    'bets_cents', COALESCE((SELECT SUM(bet_cents) FROM public.plays), 0),
    'prizes_cents', COALESCE((SELECT SUM(prize_cents) FROM public.plays), 0),
    'ggr_cents', COALESCE((SELECT SUM(bet_cents - prize_cents) FROM public.plays), 0),
    'plays_count', (SELECT COUNT(*) FROM public.plays),
    'players_count', (SELECT COUNT(*) FROM public.profiles WHERE role = 'player'),
    'player_balances_cents', COALESCE((SELECT SUM(balance_cents) FROM public.profiles), 0),
    'by_card', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort_order)
      FROM (
        SELECT sc.title,
               sc.sort_order,
               COUNT(p.id) AS plays,
               COALESCE(SUM(p.bet_cents), 0) AS bets_cents,
               COALESCE(SUM(p.prize_cents), 0) AS prizes_cents,
               COALESCE(SUM(p.bet_cents - p.prize_cents), 0) AS ggr_cents
        FROM public.scratch_cards sc
        LEFT JOIN public.plays p ON p.card_id = sc.id
        GROUP BY sc.id, sc.title, sc.sort_order
      ) c
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_pix_deposit(bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_deposit(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buy_scratch_card(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_blocked(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_financial_summary() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_pix_deposit(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_deposit(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_scratch_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_blocked(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_financial_summary() TO authenticated;
