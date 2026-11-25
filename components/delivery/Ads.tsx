'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Clock, X } from 'lucide-react';
import { activePlan, bs, deliveryFeeFor, roadKm, type Restaurant } from '@/lib/delivery';
import { useAppStore } from '@/store/useAppStore';
import { haptics } from '@/utils/haptics';
import { readLater, removeLater, saveLater, trackClick, trackView, type LaterItem } from '@/services/adClient';
import { useReducedMotion } from 'motion/react';
import { Photo, motion } from './ui';

/** Etiqueta discreta: siempre se dice cuándo algo es publicidad. */
export function SponsoredTag({ className = '' }: { className?: string }) {
  return <span className={`inline-flex items-center rounded-full border border-gold-primary/50 bg-black/55 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-gold-primary backdrop-blur-md ${className}`}>Patrocinado</span>;
}

/** Llama a `onSeen` una sola vez cuando el elemento aparece al menos a la mitad en pantalla. */
function useSeen(onSeen: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onSeen);
  useEffect(() => { cb.current = onSeen; });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { cb.current(); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { cb.current(); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Cuenta una vista del anuncio cuando esta marca aparece en pantalla (no se ve, no ocupa lugar). */
export function SeenTracker({ restaurantId, slot }: { restaurantId: string; slot: 'list' | 'home' }) {
  const ref = useSeen(() => trackView(restaurantId, slot));
  return <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden />;
}

export const sponsored = (list: Restaurant[] | null | undefined, now = Date.now()) =>
  (list || []).filter((r) => r.active !== false && r.open && activePlan(r, now)).sort((a, b) => Number(activePlan(b, now) === 'PREMIUM') - Number(activePlan(a, now) === 'PREMIUM'));

function CarouselCard({ r, onOpen, solo }: { r: Restaurant; onOpen: (id: string) => void; solo: boolean }) {
  const here = useAppStore((s) => s.currentLocation);
  const ref = useSeen(() => trackView(r.id, 'carousel'));
  const fee = here ? bs(deliveryFeeFor(roadKm(here, { lat: r.lat, lng: r.lng }))) : null;
  return (
    <div ref={ref} className={`shrink-0 snap-center ${solo ? "w-full px-0" : "w-[86%]"}`}>
      <button
        type="button"
        onClick={() => { haptics.selection(); trackClick(r.id, 'carousel'); onOpen(r.id); }}
        className="relative block h-44 w-full overflow-hidden rounded-3xl border border-gold-primary/25 text-left touch-manipulation transition-transform duration-150 ease-out active:scale-[0.98]"
      >
        <Photo src={r.coverUrl} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
        <SponsoredTag className="absolute left-3 top-3" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <p title={r.name} className="line-clamp-2 font-display text-xl font-extrabold leading-tight text-white [overflow-wrap:anywhere]">{r.name}</p>
            <p className="mt-0.5 line-clamp-1 text-sm text-white/80">{r.adHeadline || r.description}</p>
            {fee && <p className="mt-1 text-xs font-semibold text-gold-primary">Envío {fee}</p>}
          </div>
          <span className="shrink-0 rounded-full bg-gold-primary px-5 py-2.5 font-display text-sm font-extrabold text-background shadow-lg">Pedir</span>
        </div>
      </button>
    </div>
  );
}

/** "Recomendados": carrusel con los negocios que pagaron su plan. Se oculta si no hay ninguno. */
export function RecommendedCarousel({ restaurants, onOpen }: { restaurants: Restaurant[]; onOpen: (id: string) => void }) {
  const list = sponsored(restaurants).slice(0, 6);
  if (!list.length) return null;
  return (
    <section aria-label="Recomendados" className="-mx-4">
      <h2 className="mb-2 px-4 font-display text-lg font-extrabold tracking-tight">Recomendados</h2>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((r) => <CarouselCard key={r.id} r={r} onOpen={onOpen} solo={list.length === 1} />)}
      </div>
    </section>
  );
}

/** "Pedir más tarde": lo que la persona guardó mientras esperaba su pedido. */
export function LaterChips({ restaurants, onOpen }: { restaurants: Restaurant[] | null; onOpen: (id: string) => void }) {
  // Se lee después de montar (localStorage no existe en el servidor): evita diferencias al hidratar.
  const [items, setItems] = useState<LaterItem[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única al montar
  useEffect(() => { setItems(readLater()); }, []);
  const live = items.filter((x) => restaurants?.some((r) => r.id === x.id && r.open));
  if (!live.length) return null;
  return (
    <div className="space-y-2">
      {live.map((x) => (
        <div key={x.id} className="flex items-center gap-1 rounded-2xl border border-gold-primary/40 bg-gold-primary/10 pl-3.5">
          <button type="button" onClick={() => { haptics.impact(); removeLater(x.id); trackClick(x.id, 'later'); onOpen(x.id); }} className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 text-left touch-manipulation">
            <Clock className="h-5 w-5 shrink-0 text-gold-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[15px]"><span className="font-bold">Para después:</span> {x.name}</span>
            <span className="shrink-0 whitespace-nowrap font-display text-sm font-extrabold text-gold-primary">Pedir ahora</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-gold-primary" aria-hidden />
          </button>
          <button type="button" aria-label="Quitar" onClick={() => { removeLater(x.id); setItems(readLater()); }} className="grid h-12 w-11 shrink-0 place-items-center text-text-secondary touch-manipulation"><X className="h-4 w-4" aria-hidden /></button>
        </div>
      ))}
    </div>
  );
}

const hash = (s: string) => [...s].reduce((t, c) => (t * 31 + c.charCodeAt(0)) >>> 0, 7);

/** "Mientras esperas": un solo anuncio elegante mientras el pedido busca o prepara. Solo negocios Premium. */
export function WaitingAd({ restaurants, orderId, exclude, onOpen }: { restaurants: Restaurant[] | null; orderId: string; exclude: string; onOpen: (id: string) => void }) {
  const pool = sponsored(restaurants).filter((r) => r.id !== exclude && activePlan(r) === 'PREMIUM');
  const r = pool.length ? pool[hash(orderId) % pool.length] : null;
  const ref = useSeen(() => { if (r) trackView(r.id, 'wait'); });
  const [saved, setSaved] = useState(false);
  const reduce = useReducedMotion();
  if (!r) return null;
  return (
    <motion.section
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="overflow-hidden rounded-3xl border border-white/10 bg-surface" aria-label="Mientras esperas"
    >
      <div className="relative h-28">
        <Photo src={r.coverUrl} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-black/20 to-black/30" />
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white/90 backdrop-blur-md">Mientras esperas</span>
        <SponsoredTag className="absolute right-3 top-3" />
      </div>
      <div className="px-4 pb-4 pt-1">
        <p title={r.name} className="line-clamp-2 font-display text-lg font-extrabold leading-tight [overflow-wrap:anywhere]">{r.name}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary [overflow-wrap:anywhere]">{r.adHeadline || r.description}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={saved}
            onClick={() => { haptics.success(); saveLater(r.id, r.name); setSaved(true); }}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-gold-primary px-2 text-center font-display text-[15px] font-extrabold leading-tight text-background touch-manipulation transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-80"
          >
            {saved ? <><Check className="h-4 w-4" strokeWidth={3} aria-hidden /> Guardado</> : <><Clock className="h-4 w-4" aria-hidden /> Pedir más tarde</>}
          </button>
          <button
            type="button"
            onClick={() => { haptics.selection(); trackClick(r.id, 'wait'); onOpen(r.id); }}
            className="min-h-12 rounded-2xl bg-white/[0.08] px-2 text-center font-display text-[15px] font-bold leading-tight touch-manipulation transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Ver menú
          </button>
        </div>
        {saved && <p className="mt-2 text-xs text-text-secondary">Listo. Lo verás arriba en Delivery cuando quieras pedir.</p>}
      </div>
    </motion.section>
  );
}
