'use client';

import { useEffect, useState } from 'react';
import type { ScratchCard } from '@/types';
import { loadScratchCardList } from '@/lib/scratch-cards';
import BalancePill from '@/components/scratch/BalancePill';
import ScratchCardTile from '@/components/scratch/ScratchCardTile';

export default function ScratchCardsPage() {
  const [cards, setCards] = useState<ScratchCard[]>([]);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadScratchCardList()
      .then(({ cards: loadedCards, balanceCents: loadedBalance }) => {
        if (cancelled) return;
        setCards(loadedCards);
        setBalanceCents(loadedBalance);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <main className="min-h-screen bg-gray-100">
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto flex flex-col gap-6 px-4 py-12 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Raspadinhas</p>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">Escolha seu bilhete e raspe</h1>
            <p className="text-gray-300 leading-relaxed">
              Compre uma raspadinha, veja o resultado na hora e receba o prêmio direto no seu saldo.
            </p>
          </div>
          {balanceCents !== null && <BalancePill balanceCents={balanceCents} />}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        {status === 'loading' && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
            <p className="font-semibold text-red-700">Não foi possível carregar as raspadinhas.</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-4 rounded-lg bg-gray-900 px-5 py-2 font-semibold text-yellow-400 transition-colors hover:bg-gray-800"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {status === 'ready' && cards.length === 0 && (
          <p className="text-center text-gray-600">Nenhuma raspadinha disponível no momento.</p>
        )}

        {status === 'ready' && cards.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, index) => (
              <div key={card.id} className="animate-ticket-in" style={{ animationDelay: `${index * 80}ms` }}>
                <ScratchCardTile card={card} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
