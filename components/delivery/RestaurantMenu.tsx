'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MapPin, Phone, Plus, ShoppingBag, Star } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cartCount, cartSubtotal, useDeliveryStore } from '@/store/useDeliveryStore';
import { deliveryService } from '@/services/deliveryService';
import { bs, deliveryFeeFor, roadKm, type CartLine, type MenuItem, type Restaurant } from '@/lib/delivery';
import { haptics } from '@/utils/haptics';
import { BackButton, Photo, Skeleton, StatusPill, motion, useStagger } from './ui';
import { ProductSheet } from './ProductSheet';

interface Props {
  restaurant: Restaurant;
  onBack: () => void;
  onCart: () => void;
}

export function RestaurantMenu({ restaurant: r, onBack, onCart }: Props) {
  const here = useAppStore((s) => s.currentLocation);
  const { lines, addLine, clear, restaurantId: cartRestaurant, restaurantName: cartRestaurantName } = useDeliveryStore();
  const [conflict, setConflict] = useState<CartLine | null>(null);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<MenuItem | null>(null);
  const [cat, setCat] = useState('');
  const [toast, setToast] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stagger = useStagger();

  useEffect(() => deliveryService.subscribeMenu(r.id, setItems, () => setFailed(true)), [r.id]);

  const groups = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    (items || []).forEach((i) => map.set(i.category || 'Menú', [...(map.get(i.category || 'Menú') || []), i]));
    return [...map.entries()];
  }, [items]);

  const activeCat = cat || groups[0]?.[0] || '';

  const km = here ? roadKm(here, { lat: r.lat, lng: r.lng }) : null;
  const count = cartRestaurant === r.id ? cartCount(lines) : 0;
  const subtotal = cartRestaurant === r.id ? cartSubtotal(lines) : 0;

  const jump = (c: string) => {
    haptics.selection();
    setCat(c);
    const el = scroller.current?.querySelector<HTMLElement>(`[data-cat="${CSS.escape(c)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(''), 1800); };

  return (
    <div className="relative h-full">
      <div ref={scroller} className="h-full overflow-y-auto overscroll-contain pb-32">
        <div className="relative">
          <Photo src={r.coverUrl} alt="" className={`h-56 w-full ${r.open ? '' : 'grayscale'}`} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-black/40" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <BackButton onClick={onBack} />
            {count > 0 && (
              <button type="button" onClick={onCart} aria-label={`Carrito, ${count} productos`} className="relative grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md touch-manipulation active:scale-95">
                <ShoppingBag className="h-5 w-5" aria-hidden />
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold-primary px-1 text-[11px] font-extrabold text-background">{count}</span>
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto -mt-10 max-w-[430px] px-4">
          <div className="relative rounded-3xl border border-white/10 bg-surface p-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight">{r.name}</h1>
              {r.open ? <StatusPill tone="green">Abierto</StatusPill> : <StatusPill tone="gray">Cerrado</StatusPill>}
            </div>
            <p className="mt-1 text-sm leading-snug text-text-secondary">{r.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-text-secondary">
              {r.rating ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-gold-primary text-gold-primary" aria-hidden /> {r.rating.toFixed(1)}</span> : null}
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden /> {r.prepMinutes + (km != null ? Math.round(km * 4) : 10)} min</span>
              {km != null && <span className="flex items-center gap-1">Envío {bs(deliveryFeeFor(km))}</span>}
              <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{r.address}</span></span>
              {r.hours && <span>{r.hours}</span>}
              {r.minOrder ? <span>Mínimo {bs(r.minOrder)}</span> : null}
              {r.phone && (
                <a href={`tel:${r.phone}`} className="flex min-h-8 items-center gap-1 text-gold-primary"><Phone className="h-3.5 w-3.5" aria-hidden /> Llamar</a>
              )}
            </div>
            {!r.open && (
              <p className="mt-3 rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-text-secondary">Ahora está cerrado. Puedes ver el menú, pero no pedir todavía.</p>
            )}
          </div>
        </div>

        {groups.length > 1 && (
          <div className="sticky top-0 z-20 mt-4 bg-background/95 py-2 backdrop-blur-md">
            <div className="mx-auto flex max-w-[430px] gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Categorías del menú">
              {groups.map(([c]) => (
                <button key={c} role="tab" aria-selected={activeCat === c} type="button" onClick={() => jump(c)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold touch-manipulation transition-[background-color,color,transform] duration-150 ease-out active:scale-95 ${activeCat === c ? 'bg-gold-primary text-background' : 'bg-white/[0.07] text-white'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto mt-4 max-w-[430px] space-y-6 px-4">
          {items === null && !failed && (
            <div className="grid grid-cols-2 gap-3" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}</div>
          )}
          {failed && <p className="rounded-2xl bg-surface p-5 text-center text-sm text-text-secondary">No pudimos cargar el menú. Intenta otra vez.</p>}
          {items && !items.length && <p className="rounded-2xl bg-surface p-5 text-center text-sm text-text-secondary">Este restaurante aún no publicó su menú.</p>}

          {groups.map(([c, list]) => (
            <section key={c} data-cat={c} className="scroll-mt-16">
              <h2 className="mb-3 font-display text-xl font-extrabold tracking-tight">{c}</h2>
              <div className="grid grid-cols-2 gap-3">
                {list.map((it, i) => (
                  <motion.div key={it.id} {...stagger(i)} className="relative">
                    <button
                      type="button"
                      onClick={() => { haptics.selection(); setOpen(it); }}
                      disabled={!r.open}
                      className="block w-full overflow-hidden rounded-3xl border border-white/10 bg-surface text-left touch-manipulation transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-70"
                    >
                      <Photo src={it.photo} alt="" className={`aspect-[4/3] w-full ${it.available ? '' : 'grayscale'}`} />
                      <div className="p-3 pb-3.5">
                        <h3 className="line-clamp-2 min-h-[2.5rem] text-[15px] font-bold leading-tight">{it.name}</h3>
                        <p className="mt-0.5 line-clamp-2 min-h-[2.25rem] text-xs leading-snug text-text-secondary">{it.description}</p>
                        <p className="mt-2 font-display text-lg font-extrabold tabular-nums">{bs(it.price)}</p>
                      </div>
                    </button>
                    {it.available && r.open ? (
                      <span className="pointer-events-none absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-gold-primary text-background shadow-lg" aria-hidden>
                        <Plus className="h-5 w-5" strokeWidth={3} />
                      </span>
                    ) : !it.available ? (
                      <span className="absolute left-3 top-3"><StatusPill tone="gray">Agotado</StatusPill></span>
                    ) : null}
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {toast && (
        <div role="status" className="pointer-events-none absolute inset-x-0 bottom-28 z-30 mx-auto w-fit rounded-full bg-white px-4 py-2 text-sm font-bold text-background shadow-xl">
          {toast}
        </div>
      )}

      {count > 0 && (
        <motion.div
          initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pb-4 pt-8"
        >
          <button
            type="button"
            onClick={() => { haptics.impact(); onCart(); }}
            className="mx-auto flex min-h-14 w-full max-w-[430px] items-center justify-between rounded-2xl bg-gold-primary px-5 font-display font-extrabold text-background shadow-[0_10px_28px_-10px_rgba(255,198,26,0.7)] touch-manipulation transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <span className="flex items-center gap-2.5">
              <span className="grid h-7 min-w-7 place-items-center rounded-full bg-background px-1.5 text-sm text-gold-primary">{count}</span>
              Ver carrito
            </span>
            <span className="tabular-nums">{bs(subtotal)}</span>
          </button>
        </motion.div>
      )}

      {conflict && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-6" role="alertdialog" aria-modal="true" aria-label="Cambiar de restaurante">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-surface p-5">
            <h2 className="font-display text-xl font-extrabold">¿Empezar un carrito nuevo?</h2>
            <p className="mt-2 text-sm leading-snug text-text-secondary">
              Tu carrito tiene productos de <b className="text-white">{cartRestaurantName}</b>. Solo puedes pedir a un restaurante a la vez.
            </p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={() => { clear(); addLine({ id: r.id, name: r.name }, conflict); setConflict(null); flash('Agregado al carrito'); }}
                className="min-h-12 rounded-2xl bg-gold-primary font-display font-extrabold text-background touch-manipulation active:scale-[0.97]">Vaciar y agregar</button>
              <button type="button" onClick={() => setConflict(null)} className="min-h-12 rounded-2xl bg-white/[0.07] font-bold touch-manipulation active:scale-[0.97]">Mantener mi carrito</button>
            </div>
          </div>
        </div>
      )}

      <ProductSheet
        item={open}
        onClose={() => setOpen(null)}
        onAdd={(line) => {
          if (cartRestaurant && cartRestaurant !== r.id && lines.length) { setConflict(line); return; }
          flash('Agregado al carrito');
          addLine({ id: r.id, name: r.name }, line);
        }}
      />
    </div>
  );
}
