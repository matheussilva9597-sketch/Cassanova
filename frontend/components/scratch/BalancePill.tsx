import { formatBRL } from '@/lib/money';

export default function BalancePill({ balanceCents }: { balanceCents: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-white shadow-md">
      <span className="text-sm text-gray-300">Saldo</span>
      <span className="font-bold text-yellow-400">{formatBRL(balanceCents)}</span>
    </div>
  );
}
