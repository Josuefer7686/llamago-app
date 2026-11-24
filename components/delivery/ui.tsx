'use client';

import { useEffect, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, Minus, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { haptics } from '@/utils/haptics';

/** Curva de salida fuerte (la de Emil): arranca rápido, frena suave. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Entrada escalonada de listas: 40 ms entre elementos, tope de 8 para que nunca se sienta lenta. */
export function useStagger() {
  const reduce = useReducedMotion();
  return (i: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.28, ease: EASE_OUT, delay: Math.min(i, 8) * 0.04 },
        };
}

/** Bloquea el scroll del fondo mientras una hoja está abierta. */
export function useLockScroll(active = true) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.06] ${className}`} aria-hidden />;
}

export function BackButton({ onClick, label = 'Volver' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => { haptics.selection(); onClick(); }}
      aria-label={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md touch-manipulation transition-transform duration-150 ease-out active:scale-95"
    >
      <ChevronLeft className="h-6 w-6" aria-hidden />
    </button>
  );
}

/** Botón principal dorado. */
export function GoldButton({
  children, onClick, disabled, loading, type = 'button', className = '',
}: { children: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; type?: 'button' | 'submit'; className?: string }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={() => { if (!disabled && !loading) { haptics.impact(); onClick?.(); } }}
      className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold-primary px-5 font-display text-base font-extrabold text-background shadow-[0_10px_28px_-10px_rgba(255,198,26,0.7)] touch-manipulation transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:shadow-none ${className}`}
    >
      {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-background/30 border-t-background" aria-label="Cargando" /> : children}
    </button>
  );
}

export function QtyStepper({
  qty, onChange, min = 1, max = 20, trashAtMin = false,
}: { qty: number; onChange: (n: number) => void; min?: number; max?: number; trashAtMin?: boolean }) {
  const btn = 'grid h-10 w-10 place-items-center rounded-full touch-manipulation transition-transform duration-150 ease-out active:scale-90 disabled:opacity-30';
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/[0.07] p-1">
      <button
        type="button"
        className={`${btn} text-white`}
        aria-label={trashAtMin && qty <= min ? 'Quitar del pedido' : 'Menos'}
        onClick={() => { haptics.selection(); onChange(qty - 1); }}
        disabled={!trashAtMin && qty <= min}
      >
        {trashAtMin && qty <= min ? <Trash2 className="h-[18px] w-[18px] text-red-400" aria-hidden /> : <Minus className="h-[18px] w-[18px]" aria-hidden />}
      </button>
      <span className="min-w-6 text-center font-display text-base font-extrabold tabular-nums" aria-live="polite">{qty}</span>
      <button
        type="button"
        className={`${btn} bg-gold-primary text-background`}
        aria-label="Más"
        onClick={() => { haptics.selection(); onChange(qty + 1); }}
        disabled={qty >= max}
      >
        <Plus className="h-[18px] w-[18px]" aria-hidden />
      </button>
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: 'gold' | 'green' | 'red' | 'gray'; children: ReactNode }) {
  const map = {
    gold: 'bg-gold-primary/15 text-gold-primary',
    green: 'bg-emerald-400/15 text-emerald-300',
    red: 'bg-red-400/15 text-red-300',
    gray: 'bg-white/10 text-text-secondary',
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${map[tone]}`}>{children}</span>;
}

/** Foto con degradado y respaldo si no carga (nunca deja un hueco roto). */
export function Photo({ src, alt = '', className = '' }: { src?: string; alt?: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          className="h-full w-full object-cover"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 -z-0 grid place-items-center text-white/15" aria-hidden><UtensilsCrossed className="h-8 w-8" /></div>
    </div>
  );
}

export const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

export { motion };
