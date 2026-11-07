'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ScratchCard, ScratchCardPlayResult } from '@/types';
import { buyScratchCard, loadScratchCardPlay } from '@/lib/scratch-cards';
import { formatBRL } from '@/lib/money';
import BalancePill from '@/components/scratch/BalancePill';
import PrizeLayer from '@/components/scratch/PrizeLayer';
import ScratchSurface from '@/components/scratch/ScratchSurface';
import { SCRATCH_THEME_STYLES } from '@/components/scratch/scratch-theme';

type LoadStatus = 'loading' | 'ready' | 'error' | 'not_found';
type Phase = 'idle' | 'buying' | 'scratching' | 'revealed';

export default function ScratchCardPlayPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [card, setCard] = useState<ScratchCard | null>(null);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ScratchCardPlayResult | null>(null);
  const [ticketKey, setTicketKey] = useState(0);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadStatus('loading');
    loadScratchCardPlay(slug)
      .then(({ card: loadedCard, balanceCents: loadedBalance }) => {
        if (cancelled) return;
        if (!loadedCard) {
          setLoadStatus('not_found');
          return;
        }
        setCard(loadedCard);
        setBalanceCents(loadedBalance);
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

  const handleBuy = async () => {
    if (!card) return;
    setPhase('buying');
    setActionError('');
    try {
      const outcome = await buyScratchCard(card.id);
      setResult(outcome);
      setBalanceCents(outcome.balance_cents);
      setTicketKey((key) => key + 1);
      setPhase('scratching');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível comprar a raspadinha.');
      setPhase('idle');
    }
  };

  if (loadStatus === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="animate-pulse text-lg text-gray-700">Carregando raspadinha...</p>
      </main>
    );
  }

  if (loadStatus === 'not_found') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-100 px-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Raspadinha não encontrada</h1>
        <Link href="/raspadinhas" className="font-semibold text-gray-900 underline underline-offset-4">
          Voltar para as raspadinhas
        </Link>
      </main>
    );
  }

  if (loadStatus === 'error' || !card || balanceCents === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
          <p className="font-semibold text-red-700">Não foi possível carregar esta raspadinha.</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-4 rounded-lg bg-gray-900 px-5 py-2 font-semibold text-yellow-400 transition-colors hover:bg-gray-800"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  const theme = SCRATCH_THEME_STYLES[card.theme];
  const canAfford = balanceCents >= card.price_cents;
  const isBusy = phase === 'buying' || phase === 'scratching';

  let buttonLabel = `Comprar por ${formatBRL(card.price_cents)}`;
  if (phase === 'buying') buttonLabel = 'Comprando...';
  if (phase === 'scratching') buttonLabel = 'Raspe o bilhete para continuar';

  return (
    <main className="min-h-screen bg-gray-100">
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Link href="/raspadinhas" className="text-sm font-semibold text-yellow-400 hover:underline">
              ← Todas as raspadinhas
            </Link>
            <h1 className="text-3xl font-extrabold md:text-4xl">{card.title}</h1>
            <p className="text-gray-300">{card.description}</p>
          </div>
          <BalancePill balanceCents={balanceCents} />
        </div>
      </section>

      <section className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {result ? (
            <div key={ticketKey} className="animate-ticket-in mx-auto w-full max-w-2xl">
              <div className="relative aspect-[2/1] w-full select-none overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10">
                <ScratchSurface
                  resetKey={ticketKey}
                  onRevealed={() => setPhase('revealed')}
                >
                  <PrizeLayer result={result} theme={card.theme} />
                </ScratchSurface>
              </div>
              {phase === 'scratching' && (
                <p className="mt-4 text-center text-sm text-gray-600">
                  Passe o dedo ou o mouse sobre o bilhete para revelar o prêmio.
                </p>
              )}
            </div>
          ) : (
            <div
              className={`mx-auto flex aspect-[2/1] w-full max-w-2xl flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center shadow-xl ${theme.panel}`}
            >
              <span className={`text-3xl font-extrabold ${theme.text}`}>{card.title}</span>
              <span className={`text-base ${theme.text}`}>Compre um bilhete e raspe para ver se você ganhou.</span>
            </div>
          )}
        </div>

        <aside className="space-y-6 rounded-2xl bg-white p-6 shadow-md ring-1 ring-gray-200">
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Preço do bilhete</p>
            <p className="text-3xl font-extrabold text-gray-900">{formatBRL(card.price_cents)}</p>
          </div>

          <button
            type="button"
            onClick={handleBuy}
            disabled={isBusy || !canAfford}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-4 text-lg font-bold text-gray-900 shadow-md transition-all hover:from-yellow-500 hover:to-yellow-600 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-600 disabled:shadow-none"
          >
            {phase === 'buying' && (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            )}
            {buttonLabel}
          </button>

          {!canAfford && phase !== 'buying' && (
            <p className="text-sm font-medium text-red-700">Saldo insuficiente para comprar este bilhete.</p>
          )}

          {actionError && <p className="text-sm font-medium text-red-700">{actionError}</p>}

          {phase === 'revealed' && result && (
            <div className="animate-ticket-in rounded-xl bg-gray-900 p-4 text-white">
              <p className="font-semibold text-yellow-400">
                {result.prize_cents > 0 ? `Parabéns! Você ganhou ${formatBRL(result.prize_cents)}.` : 'Não foi dessa vez.'}
              </p>
              <p className="mt-1 text-sm text-gray-300">
                {result.prize_cents > 0
                  ? 'O prêmio já foi creditado no seu saldo.'
                  : 'Compre outro bilhete e tente novamente.'}
              </p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
