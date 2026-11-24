'use client';

import { useMemo, useState } from 'react';
import { Clock, MapPin, Receipt, Search, Star, Bike, ChevronRight, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  DELIVERY_CATEGORIES, STATUS_LABEL, bs, deliveryFeeFor, fmtKm, roadKm, isActiveOrder,
  type DeliveryOrder, type Restaurant,
} from '@/lib/delivery';
import { haptics } from '@/utils/haptics';
import { Photo, Skeleton, StatusPill, motion, useStagger } from './ui';

interface Props {
  restaurants: Restaurant[] | null;
  failed: boolean;
  activeOrder: DeliveryOrder | null;
  onOpen: (id: string) => void;
  onTrack: (id: string) => void;
  onOrders: () => void;
}

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function RestaurantList({ restaurants, failed, activeOrder, onOpen, onTrack, onOrders }: Props) {
  const here = useAppStore((s) => s.currentLocation);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('Todos');
  const stagger = useStagger();

  const list = useMemo(() => {
    if (!restaurants) return [];
    const term = norm(q.trim());
    return restaurants
      .map((r) => ({ r, km: here ? roadKm(here, { lat: r.lat, lng: r.lng }) : null }))
      .filter(({ r }) => (cat === 'Todos' || r.category === cat) && (!term || norm(`${r.name} ${r.category} ${r.description}`).includes(term)))
      // Abiertos primero, luego los más cercanos
      .sort((a, b) => Number(b.r.open) - Number(a.r.open) || (a.km ?? 0) - (b.km ?? 0));
  }, [restaurants, q, cat, here]);

  return (
    <div className="h-full overflow-y-auto overscroll-contain pb-8">
      <header className="sticky top-0 z-20 bg-background/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="mx-auto flex max-w-[430px] items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <MapPin className="h-3.5 w-3.5 text-gold-primary" aria-hidden /> Riberalta
            </p>
            <h1 className="mt-1 font-display text-[28px] font-extrabold italic leading-[1.05] tracking-tight">
              ¿Qué se te <span className="text-gold-primary">antoja</span> hoy?
            </h1>
          </div>
          <button
            type="button"
            onClick={() => { haptics.selection(); onOrders(); }}
            aria-label="Mis pedidos"
            className="mt-1 flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 text-sm font-semibold touch-manipulation transition-transform duration-150 ease-out active:scale-95"
          >
            <Receipt className="h-[18px] w-[18px] text-gold-primary" aria-hidden /> Pedidos
          </button>
        </div>

        <div className="relative mx-auto mt-3 max-w-[430px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca un restaurante o un plato"
            aria-label="Buscar restaurante"
            enterKeyHint="search"
            className="h-12 w-full rounded-2xl border border-white/10 bg-surface pl-12 pr-11 text-base text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Borrar búsqueda" className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-text-secondary touch-manipulation">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        <div className="mx-auto mt-3 flex max-w-[430px] gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Categorías">
          {DELIVERY_CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cat === c}
              type="button"
              onClick={() => { haptics.selection(); setCat(c); }}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold touch-manipulation transition-[background-color,color,transform] duration-150 ease-out active:scale-95 ${
                cat === c ? 'bg-gold-primary text-background' : 'bg-white/[0.07] text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-[430px] space-y-4 px-4">
        {activeOrder && (
          <motion.button
            type="button"
            onClick={() => { haptics.impact(); onTrack(activeOrder.id); }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="flex w-full items-center gap-3 rounded-2xl border border-gold-primary/40 bg-gold-primary/10 p-3.5 text-left touch-manipulation active:scale-[0.99]"
          >
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-primary text-background">
              <Bike className="h-6 w-6" aria-hidden />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-gold-primary" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-base font-extrabold">{STATUS_LABEL[activeOrder.status]}</span>
              <span className="block truncate text-sm text-text-secondary">{activeOrder.restaurantName} · {bs(activeOrder.total)}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-gold-primary" aria-hidden />
          </motion.button>
        )}

        {restaurants === null && !failed && (
          <div className="space-y-4" aria-busy="true" aria-label="Cargando restaurantes">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-60" />)}
          </div>
        )}

        {failed && (
          <p className="rounded-2xl bg-surface p-5 text-center text-sm text-text-secondary">
            No pudimos cargar los restaurantes. Revisa tu conexión e intenta otra vez.
          </p>
        )}

        {restaurants && !list.length && !failed && (
          <div className="rounded-3xl bg-surface p-8 text-center">
            <p className="font-display text-lg font-extrabold">{restaurants.length ? 'No encontramos nada así' : 'Muy pronto, restaurantes aquí'}</p>
            <p className="mt-1.5 text-sm text-text-secondary">
              {restaurants.length ? 'Prueba con otra palabra o cambia de categoría.' : 'Estamos sumando los mejores sabores de Riberalta.'}
            </p>
          </div>
        )}

        {list.map(({ r, km }, i) => {
          const fee = km != null ? bs(deliveryFeeFor(km)) : null;
          return (
            <motion.button
              key={r.id}
              type="button"
              {...stagger(i)}
              onClick={() => { haptics.selection(); onOpen(r.id); }}
              className="block w-full overflow-hidden rounded-3xl border border-white/10 bg-surface text-left touch-manipulation transition-transform duration-150 ease-out active:scale-[0.985]"
            >
              <div className="relative">
                <Photo src={r.coverUrl} alt="" className={`h-40 w-full ${r.open ? '' : 'grayscale'}`} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
                <div className="absolute left-3 top-3 flex gap-2">
                  {r.open ? <StatusPill tone="green">Abierto</StatusPill> : <StatusPill tone="gray">Cerrado</StatusPill>}
                  {r.demo && <StatusPill tone="gold">Demo</StatusPill>}
                </div>
                {r.rating ? (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold backdrop-blur-md">
                    <Star className="h-3.5 w-3.5 fill-gold-primary text-gold-primary" aria-hidden /> {r.rating.toFixed(1)}
                  </span>
                ) : null}
              </div>
              <div className="px-4 pb-4 pt-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="truncate font-display text-xl font-extrabold tracking-tight">{r.name}</h2>
                  <span className="shrink-0 text-xs font-semibold text-gold-primary">{r.category}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-sm text-text-secondary">{r.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-text-secondary">
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden /> {r.prepMinutes + (km != null ? Math.round(km * 4) : 10)} min</span>
                  {fee && <span className="flex items-center gap-1.5"><Bike className="h-3.5 w-3.5" aria-hidden /> Envío {fee}</span>}
                  {km != null && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden /> {fmtKm(km)}</span>}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
