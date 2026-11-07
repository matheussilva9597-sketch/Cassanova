import Link from 'next/link';
import type { ScratchCard } from '@/types';
import { formatBRL } from '@/lib/money';
import { SCRATCH_THEME_STYLES } from './scratch-theme';

export default function ScratchCardTile({ card }: { card: ScratchCard }) {
  const theme = SCRATCH_THEME_STYLES[card.theme];

  return (
    <Link
      href={`/raspadinhas/${card.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-gray-200 transition duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400"
    >
      <div className={`relative flex aspect-[16/9] items-center justify-center ${theme.panel}`}>
        <span className={`text-3xl font-extrabold tracking-wide ${theme.text}`}>{card.title}</span>
        <span className="absolute right-3 top-3 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold text-white">
          {formatBRL(card.price_cents)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-sm leading-relaxed text-gray-600">{card.description}</p>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">{formatBRL(card.price_cents)}</span>
          <span className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-yellow-400 transition-colors group-hover:bg-gray-800">
            Jogar
          </span>
        </div>
      </div>
    </Link>
  );
}
