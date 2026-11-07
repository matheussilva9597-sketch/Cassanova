import type { ScratchCard } from '@/types';

interface ScratchThemeStyle {
  panel: string;
  text: string;
  badge: string;
}

export const SCRATCH_THEME_STYLES: Record<ScratchCard['theme'], ScratchThemeStyle> = {
  gold: {
    panel: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-500',
    text: 'text-amber-950',
    badge: 'bg-amber-950 text-amber-100',
  },
  emerald: {
    panel: 'bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-600',
    text: 'text-emerald-950',
    badge: 'bg-emerald-950 text-emerald-100',
  },
  ruby: {
    panel: 'bg-gradient-to-br from-red-600 via-red-600 to-red-800',
    text: 'text-white',
    badge: 'bg-white text-red-900',
  },
};
