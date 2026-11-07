import { getSupabase } from '@/lib/supabase';
import type { ScratchCard, ScratchCardPlayResult } from '@/types';

const CARD_COLUMNS = 'id, slug, title, description, price_cents, theme, sort_order';

export async function ensurePlayerSession(): Promise<string> {
  const supabase = getSupabase();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session) return sessionData.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw error ?? new Error('Não foi possível iniciar sua sessão.');
  }
  return data.user.id;
}

export async function fetchPlayerBalance(userId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('balance_cents')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || typeof data.balance_cents !== 'number') {
    throw new Error('Não foi possível carregar seu saldo.');
  }
  return data.balance_cents;
}

export async function listActiveScratchCards(): Promise<ScratchCard[]> {
  const { data, error } = await getSupabase()
    .from('scratch_cards')
    .select(CARD_COLUMNS)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as ScratchCard[];
}

export async function getActiveScratchCardBySlug(slug: string): Promise<ScratchCard | null> {
  const { data, error } = await getSupabase()
    .from('scratch_cards')
    .select(CARD_COLUMNS)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return (data as ScratchCard | null) ?? null;
}

const PURCHASE_ERROR_MESSAGES: Record<string, string> = {
  insufficient_balance: 'Saldo insuficiente para comprar esta raspadinha.',
  account_blocked: 'Sua conta está bloqueada no momento.',
  card_unavailable: 'Esta raspadinha não está disponível agora.',
  not_authenticated: 'Sua sessão expirou. Recarregue a página e tente novamente.',
};

export async function buyScratchCard(cardId: string): Promise<ScratchCardPlayResult> {
  const { data, error } = await getSupabase().rpc('buy_scratch_card', { p_card_id: cardId });

  if (error) {
    const known = Object.keys(PURCHASE_ERROR_MESSAGES).find((code) => error.message.includes(code));
    throw new Error(
      known ? PURCHASE_ERROR_MESSAGES[known] : 'Não foi possível comprar a raspadinha. Tente novamente.',
    );
  }

  const result = data as Partial<ScratchCardPlayResult> | null;
  if (
    !result ||
    typeof result.play_id !== 'string' ||
    typeof result.prize_cents !== 'number' ||
    typeof result.prize_label !== 'string' ||
    typeof result.balance_cents !== 'number'
  ) {
    throw new Error('Resposta inesperada ao comprar a raspadinha.');
  }
  return result as ScratchCardPlayResult;
}

export async function loadScratchCardList(): Promise<{ cards: ScratchCard[]; balanceCents: number }> {
  const userId = await ensurePlayerSession();
  const [cards, balanceCents] = await Promise.all([listActiveScratchCards(), fetchPlayerBalance(userId)]);
  return { cards, balanceCents };
}

export async function loadScratchCardPlay(slug: string): Promise<{ card: ScratchCard | null; balanceCents: number }> {
  const userId = await ensurePlayerSession();
  const [card, balanceCents] = await Promise.all([getActiveScratchCardBySlug(slug), fetchPlayerBalance(userId)]);
  return { card, balanceCents };
}
