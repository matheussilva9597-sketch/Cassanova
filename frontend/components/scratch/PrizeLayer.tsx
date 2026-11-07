import { ScratchCardPlayResult } from '@/types';
import { formatBRL } from '@/lib/money';
import { SCRATCH_THEME_STYLES } from './scratch-theme';

interface PrizeLayerProps {
  result: ScratchCardPlayResult;
  theme: keyof typeof SCRATCH_THEME_STYLES;
}

export default function PrizeLayer({ result, theme }: PrizeLayerProps) {
  const style = SCRATCH_THEME_STYLES[theme];
  const won = result.prize_cents > 0;

  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center ${style.panel}`}>
      <span className={`text-sm font-semibold uppercase tracking-widest ${style.text}`}>
        {won ? 'Você ganhou' : 'Resultado'}
      </span>
      <span className={`text-4xl font-extrabold md:text-5xl ${style.text} ${won ? 'animate-prize-pop' : ''}`}>
        {won ? formatBRL(result.prize_cents) : 'Não foi dessa vez'}
      </span>
      <span className={`text-base font-medium ${style.text}`}>{result.prize_label}</span>
    </div>
  );
}
